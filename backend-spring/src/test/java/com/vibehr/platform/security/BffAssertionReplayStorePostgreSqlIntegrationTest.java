package com.vibehr.platform.security;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.time.Instant;
import java.sql.Timestamp;
import java.util.List;
import java.util.concurrent.Callable;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import javax.sql.DataSource;
import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.dao.DataAccessException;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.postgresql.PostgreSQLContainer;

@Tag("integration")
@Testcontainers(disabledWithoutDocker = true)
class BffAssertionReplayStorePostgreSqlIntegrationTest {

    private static final Instant NOW = Instant.parse("2026-08-02T00:00:00Z");

    @Container
    private static final PostgreSQLContainer POSTGRES = new PostgreSQLContainer("postgres:16-alpine")
            .withDatabaseName("vibehr_test")
            .withUsername("vibehr")
            .withPassword("vibehr");

    private JdbcTemplate jdbc;

    @BeforeEach
    void migrateFreshDatabase() {
        Flyway.configure().dataSource(dataSource()).cleanDisabled(false).load().clean();
        Flyway.configure().dataSource(dataSource()).locations("classpath:db/migration").load().migrate();
        jdbc = new JdbcTemplate(dataSource());
    }

    @Test
    void concurrentSameNonceConsumesAcrossStoreInstancesHaveExactlyOneWinner() throws Exception {
        BffAssertionReplayStore first = new BffAssertionReplayStore(jdbc);
        BffAssertionReplayStore second = new BffAssertionReplayStore(new JdbcTemplate(dataSource()));
        CountDownLatch ready = new CountDownLatch(2);
        CountDownLatch start = new CountDownLatch(1);
        ExecutorService executor = Executors.newFixedThreadPool(2);
        try {
            List<Future<Boolean>> results = List.of(
                    executor.submit(consumeOnce(first, ready, start)),
                    executor.submit(consumeOnce(second, ready, start))
            );
            assertThat(ready.await(5, TimeUnit.SECONDS)).isTrue();
            start.countDown();

            assertThat(results.stream().filter(result -> get(result)).count()).isEqualTo(1);
        } finally {
            start.countDown();
            executor.shutdownNow();
        }

        assertThat(jdbc.queryForObject("select count(*) from bff_assertion_replays", Integer.class)).isEqualTo(1);
    }

    @Test
    void consumesExpiredRowsAcrossDifferentScopesInBoundedGlobalBatches() {
        assertThat(jdbc.queryForObject("""
                select count(*) from pg_indexes
                 where schemaname = 'public' and indexname = 'bff_assertion_replays_expiry_idx'
                """, Integer.class)).isEqualTo(1);
        insertReplay("expired-nonce-1", "expired-scope-1", sourceHash("expired-1"), NOW.minusSeconds(1));
        insertReplay("expired-nonce-2", "expired-scope-2", sourceHash("expired-2"), NOW.minusSeconds(1));

        new BffAssertionReplayStore(jdbc).consume(assertion("active-client", "active-nonce"), NOW.plusSeconds(30), NOW);

        assertThat(jdbc.queryForObject(
                "select count(*) from bff_assertion_replays where expires_at <= ?", Integer.class, Timestamp.from(NOW))).isZero();
        assertThat(jdbc.queryForObject("select count(*) from bff_assertion_replays", Integer.class)).isEqualTo(1);
    }

    @Test
    void sourceQuotaCannotBlockAnUnrelatedSourceInTheSameGlobalBucket() {
        String abusiveSource = sourceHash("abusive-source");
        int bucket = BffAssertionBinding.replayBucket(abusiveSource);
        String unrelatedSource = sourceHashForBucket("unrelated-source", bucket);
        BffAssertionReplayStore store = new BffAssertionReplayStore(jdbc);

        for (int index = 0; index < 32; index++) {
            store.consume(assertion("abusive-client-" + index, "abusive-nonce-" + index, abusiveSource), NOW.plusSeconds(30), NOW);
        }

        assertThatThrownBy(() -> store.consume(
                assertion("abusive-client-overflow", "abusive-nonce-overflow", abusiveSource), NOW.plusSeconds(30), NOW))
                .isInstanceOf(InvalidBffAssertionException.class);

        store.consume(assertion("unrelated-client", "unrelated-nonce", unrelatedSource), NOW.plusSeconds(30), NOW);
        assertThat(jdbc.queryForObject(
                "select count(*) from bff_assertion_replays where replay_bucket = ? and expires_at > ?",
                Integer.class,
                bucket,
                Timestamp.from(NOW))).isEqualTo(33);
    }

    @Test
    void bucketCapacityIsBoundedWithoutEvictingUnexpiredEvidenceFromOtherBuckets() {
        BffAssertionReplayStore store = new BffAssertionReplayStore(jdbc);
        String firstSource = sourceHash("bucket-source-0");
        int saturatedBucket = BffAssertionBinding.replayBucket(firstSource);

        for (int sourceIndex = 0; sourceIndex < 8; sourceIndex++) {
            String sourceHash = sourceIndex == 0 ? firstSource : sourceHashForBucket("bucket-source-" + sourceIndex + "-", saturatedBucket);
            for (int nonceIndex = 0; nonceIndex < 32; nonceIndex++) {
                store.consume(assertion(
                        "bucket-client-" + sourceIndex + "-" + nonceIndex,
                        "bucket-nonce-" + sourceIndex + "-" + nonceIndex,
                        sourceHash),
                        NOW.plusSeconds(30),
                        NOW);
            }
        }

        String overflowSource = sourceHashForBucket("overflow-source", saturatedBucket);
        assertThatThrownBy(() -> store.consume(
                assertion("overflow-client", "overflow-nonce", overflowSource), NOW.plusSeconds(30), NOW))
                .isInstanceOf(InvalidBffAssertionException.class);
        assertThat(jdbc.queryForObject(
                "select count(*) from bff_assertion_replays where replay_bucket = ? and expires_at > ?",
                Integer.class,
                saturatedBucket,
                Timestamp.from(NOW))).isEqualTo(256);

        String unrelatedSource = sourceHashForBucket("unrelated-bucket-source", (saturatedBucket + 1) % 256);
        store.consume(assertion("unrelated-bucket-client", "unrelated-bucket-nonce", unrelatedSource), NOW.plusSeconds(30), NOW);
        assertThat(jdbc.queryForObject("select count(*) from bff_assertion_replays", Integer.class)).isEqualTo(257);
    }

    @Test
    void propagatesPostgreSqlWriteFailuresForTheAuthenticationFilterToHandleFailClosed() {
        jdbc.execute("drop role if exists bff_replay_read_only");
        jdbc.execute("create role bff_replay_read_only login password 'bff-replay-read-only-password'");
        jdbc.execute("grant connect on database vibehr_test to bff_replay_read_only");
        jdbc.execute("grant usage on schema public to bff_replay_read_only");
        jdbc.execute("grant select, update on bff_assertion_replays to bff_replay_read_only");
        JdbcTemplate restrictedJdbc = new JdbcTemplate(new DriverManagerDataSource(
                POSTGRES.getJdbcUrl(), "bff_replay_read_only", "bff-replay-read-only-password"));

        assertThatThrownBy(() -> new BffAssertionReplayStore(restrictedJdbc)
                .consume(assertion("restricted-client", "restricted-nonce"), NOW.plusSeconds(30), NOW))
                .isInstanceOf(DataAccessException.class);
    }

    private Callable<Boolean> consumeOnce(
            BffAssertionReplayStore store,
            CountDownLatch ready,
            CountDownLatch start
    ) {
        return () -> {
            ready.countDown();
            start.await();
            try {
                store.consume(assertion("concurrent-client", "concurrent-nonce"), NOW.plusSeconds(30), NOW);
                return true;
            } catch (InvalidBffAssertionException exception) {
                return false;
            }
        };
    }

    private static boolean get(Future<Boolean> result) {
        try {
            return result.get();
        } catch (Exception exception) {
            throw new AssertionError("Concurrent replay consume failed unexpectedly.", exception);
        }
    }

    private static BffAssertionPrincipal assertion(String clientId, String nonce) {
        return assertion(clientId, nonce, sourceHash(clientId));
    }

    private static BffAssertionPrincipal assertion(String clientId, String nonce, String sourceHash) {
        return new BffAssertionPrincipal(
                "login", null, null, null, null, false,
                clientId, sourceHash, BffAssertionBinding.replayBucket(sourceHash), "binding", "digest", nonce
        );
    }

    private static String sourceHash(String value) {
        return BffAssertionBinding.sha256Base64Url("source-" + value);
    }

    private String sourceHashForBucket(String prefix, int bucket) {
        for (int index = 0; index < 10_000; index++) {
            String sourceHash = sourceHash(prefix + index);
            if (BffAssertionBinding.replayBucket(sourceHash) == bucket) {
                return sourceHash;
            }
        }
        throw new AssertionError("Unable to find a deterministic source hash for the requested bucket.");
    }

    private void insertReplay(String nonce, String scopeHash, String sourceHash, Instant expiresAt) {
        jdbc.update(
                "insert into bff_assertion_replays (nonce, scope_hash, source_hash, replay_bucket, expires_at) values (?, ?, ?, ?, ?)",
                nonce,
                scopeHash,
                sourceHash,
                BffAssertionBinding.replayBucket(sourceHash),
                Timestamp.from(expiresAt));
    }

    private DataSource dataSource() {
        return new DriverManagerDataSource(POSTGRES.getJdbcUrl(), POSTGRES.getUsername(), POSTGRES.getPassword());
    }
}
