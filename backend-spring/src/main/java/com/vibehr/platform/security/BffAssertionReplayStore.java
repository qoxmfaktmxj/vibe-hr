package com.vibehr.platform.security;

import java.sql.Timestamp;
import java.time.Instant;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

@Component
final class BffAssertionReplayStore {

    private static final int MAX_ACTIVE_NONCES_PER_SCOPE = 128;
    private static final int MAX_ACTIVE_NONCES_PER_SOURCE = 32;
    private static final int MAX_ACTIVE_NONCES_PER_BUCKET = 256;
    private static final int MAX_EXPIRED_REPLAY_CLEANUP_PER_REQUEST = 256;
    private static final String CONSUME_NONCE = """
            with expired_candidates as (
                select ctid
                  from bff_assertion_replays
                 where expires_at <= ?
                 order by expires_at
                 limit ?
                 for update skip locked
            ), expired as (
                delete from bff_assertion_replays replay
                 using expired_candidates candidate
                 where replay.ctid = candidate.ctid
            ), bucket_lock as materialized (
                select pg_advisory_xact_lock(hashtextextended('vibehr-bff-replay-bucket:' || ?, 0))
            ), inserted as (
                insert into bff_assertion_replays (nonce, scope_hash, source_hash, replay_bucket, expires_at)
                select ?, ?, ?, ?, ?
                  from bucket_lock
                 where (select count(*) from bff_assertion_replays where replay_bucket = ? and expires_at > ?) < ?
                   and (select count(*) from bff_assertion_replays where source_hash = ? and expires_at > ?) < ?
                   and (select count(*) from bff_assertion_replays where scope_hash = ? and expires_at > ?) < ?
                on conflict (nonce) do nothing
                returning 1
            )
            select count(*) from inserted
            """;
    private static final String DELETE_EXPIRED = """
            with expired_candidates as (
                select ctid
                  from bff_assertion_replays
                 where expires_at <= ?
                 order by expires_at
                 limit ?
                 for update skip locked
            )
            delete from bff_assertion_replays replay
             using expired_candidates candidate
             where replay.ctid = candidate.ctid
            """;

    private final JdbcTemplate jdbc;

    BffAssertionReplayStore(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    void consume(BffAssertionPrincipal assertion, Instant expiresAt, Instant now) {
        if (assertion.clientId() == null || assertion.sourceHash() == null || assertion.sourceHash().isBlank()) {
            throw new InvalidBffAssertionException("BFF assertion replay scope is invalid.");
        }
        String scopeHash = BffAssertionBinding.replayScope(assertion.clientId(), assertion.sourceHash());
        Integer inserted = jdbc.queryForObject(
                CONSUME_NONCE,
                Integer.class,
                Timestamp.from(now),
                MAX_EXPIRED_REPLAY_CLEANUP_PER_REQUEST,
                assertion.replayBucket(),
                assertion.nonce(),
                scopeHash,
                assertion.sourceHash(),
                assertion.replayBucket(),
                Timestamp.from(expiresAt),
                assertion.replayBucket(),
                Timestamp.from(now),
                MAX_ACTIVE_NONCES_PER_BUCKET,
                assertion.sourceHash(),
                Timestamp.from(now),
                MAX_ACTIVE_NONCES_PER_SOURCE,
                scopeHash,
                Timestamp.from(now),
                MAX_ACTIVE_NONCES_PER_SCOPE
        );
        if (inserted == null || inserted != 1) {
            throw new InvalidBffAssertionException("BFF assertion was already used or its replay scope is exhausted.");
        }
    }

    @Scheduled(fixedDelayString = "${vibehr.bff-assertion.replay-cleanup-delay-ms:5000}")
    void deleteExpired() {
        jdbc.update(DELETE_EXPIRED, Timestamp.from(Instant.now()), MAX_EXPIRED_REPLAY_CLEANUP_PER_REQUEST);
    }
}
