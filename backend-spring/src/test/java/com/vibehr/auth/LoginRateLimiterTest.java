package com.vibehr.auth;

import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.Callable;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import org.junit.jupiter.api.Test;

class LoginRateLimiterTest {

    private static final Clock CLOCK = Clock.fixed(Instant.parse("2026-08-02T00:00:00Z"), ZoneOffset.UTC);

    @Test
    void saturatedTrackingBoundsOneSha256OverflowShardWithoutBlockingAnotherShard() {
        MutableClock clock = new MutableClock(Instant.parse("2026-08-02T00:00:00Z"));
        int shardCount = 2;
        LoginRateLimiter limiter = new LoginRateLimiter(clock, 2, shardCount);

        exhaust(limiter,
                keyForShard(0, shardCount, "protected-client-one"),
                keyForShard(0, shardCount, "protected-login-one"),
                keyForShard(0, shardCount, "protected-source-one"));
        exhaust(limiter,
                keyForShard(0, shardCount, "protected-client-two"),
                keyForShard(0, shardCount, "protected-login-two"),
                keyForShard(0, shardCount, "protected-source-two"));

        for (int attempt = 0; attempt < 10; attempt++) {
            limiter.check(
                    keyForShard(0, shardCount, "new-client-" + attempt),
                    keyForShard(0, shardCount, "new-login-" + attempt),
                    keyForShard(0, shardCount, "new-source-" + attempt));
        }
        assertThatThrownBy(() -> limiter.check(
                keyForShard(0, shardCount, "blocked-client"),
                keyForShard(0, shardCount, "blocked-login"),
                keyForShard(0, shardCount, "blocked-source")))
                .isInstanceOf(LoginRateLimitException.class)
                .extracting(exception -> ((LoginRateLimitException) exception).retryAfterSeconds())
                .isEqualTo(300L);
        assertThatCode(() -> limiter.check(
                keyForShard(1, shardCount, "other-client"),
                keyForShard(1, shardCount, "other-login"),
                keyForShard(1, shardCount, "other-source")))
                .doesNotThrowAnyException();
        assertThatThrownBy(() -> limiter.check(
                keyForShard(0, shardCount, "protected-client-one"),
                keyForShard(0, shardCount, "protected-login-one"),
                keyForShard(0, shardCount, "protected-source-one")))
                .isInstanceOf(LoginRateLimitException.class);
        assertThatThrownBy(() -> limiter.check(
                keyForShard(0, shardCount, "protected-client-two"),
                keyForShard(0, shardCount, "protected-login-two"),
                keyForShard(0, shardCount, "protected-source-two")))
                .isInstanceOf(LoginRateLimitException.class);

        clock.advanceSeconds(300);
        assertThatCode(() -> limiter.check(
                keyForShard(0, shardCount, "recovered-client"),
                keyForShard(0, shardCount, "recovered-login"),
                keyForShard(0, shardCount, "recovered-source")))
                .doesNotThrowAnyException();
    }

    @Test
    void concurrentAttemptsKeepTheProtectedClientLimitExact() throws Exception {
        LoginRateLimiter limiter = new LoginRateLimiter(CLOCK, 64);
        CountDownLatch ready = new CountDownLatch(40);
        CountDownLatch start = new CountDownLatch(1);
        ExecutorService executor = Executors.newFixedThreadPool(40);
        try {
            List<Future<Boolean>> results = new ArrayList<>();
            for (int attempt = 0; attempt < 40; attempt++) {
                results.add(executor.submit(check(limiter, ready, start)));
            }
            if (!ready.await(5, TimeUnit.SECONDS)) throw new AssertionError("Concurrent limiter test did not become ready.");
            start.countDown();
            long accepted = 0;
            for (Future<Boolean> result : results) {
                if (result.get(5, TimeUnit.SECONDS)) accepted++;
            }
            org.assertj.core.api.Assertions.assertThat(accepted).isEqualTo(10);
        } finally {
            start.countDown();
            executor.shutdownNow();
        }
    }

    @Test
    void limitsOneClientAcrossUniqueLoginsAndSourcesAtThirtyAttempts() {
        LoginRateLimiter limiter = new LoginRateLimiter(CLOCK, 64);

        for (int attempt = 0; attempt < 30; attempt++) {
            limiter.check("shared-client", "login-" + attempt, "source-" + attempt);
        }

        assertRateLimited(() -> limiter.check("shared-client", "login-overflow", "source-overflow"));
    }

    @Test
    void limitsOneLoginAcrossUniqueClientsAndSourcesAtTenAttempts() {
        LoginRateLimiter limiter = new LoginRateLimiter(CLOCK, 64);

        for (int attempt = 0; attempt < 10; attempt++) {
            limiter.check("client-" + attempt, "shared-login", "source-" + attempt);
        }

        assertRateLimited(() -> limiter.check("client-overflow", "shared-login", "source-overflow"));
    }

    @Test
    void limitsOneSourceAcrossUniqueClientsAndLoginsAtTenAttempts() {
        LoginRateLimiter limiter = new LoginRateLimiter(CLOCK, 64);

        for (int attempt = 0; attempt < 10; attempt++) {
            limiter.check("client-" + attempt, "login-" + attempt, "shared-source");
        }

        assertRateLimited(() -> limiter.check("client-overflow", "login-overflow", "shared-source"));
    }

    private static Callable<Boolean> check(LoginRateLimiter limiter, CountDownLatch ready, CountDownLatch start) {
        return () -> {
            ready.countDown();
            start.await();
            try {
                limiter.check("concurrent-client", "concurrent-login", "concurrent-source");
                return true;
            } catch (LoginRateLimitException exception) {
                return false;
            }
        };
    }

    private static void exhaust(LoginRateLimiter limiter, String clientId, String loginBinding, String sourceHash) {
        for (int attempt = 0; attempt < 10; attempt++) {
            limiter.check(clientId, loginBinding, sourceHash);
        }
        assertThatThrownBy(() -> limiter.check(clientId, loginBinding, sourceHash))
                .isInstanceOf(LoginRateLimitException.class);
    }

    private static void assertRateLimited(Runnable attempt) {
        assertThatThrownBy(attempt::run)
                .isInstanceOf(LoginRateLimitException.class)
                .extracting(exception -> ((LoginRateLimitException) exception).retryAfterSeconds())
                .isEqualTo(300L);
    }

    private static String keyForShard(int shard, int shardCount, String prefix) {
        for (int suffix = 0; suffix < 10_000; suffix++) {
            String key = prefix + "-" + suffix;
            if (LoginRateLimiter.overflowShardFor(key, shardCount) == shard) return key;
        }
        throw new AssertionError("No key found for shard " + shard + ".");
    }

    private static final class MutableClock extends Clock {

        private Instant instant;

        private MutableClock(Instant instant) {
            this.instant = instant;
        }

        void advanceSeconds(long seconds) {
            instant = instant.plusSeconds(seconds);
        }

        @Override
        public ZoneOffset getZone() {
            return ZoneOffset.UTC;
        }

        @Override
        public Clock withZone(java.time.ZoneId zone) {
            return this;
        }

        @Override
        public Instant instant() {
            return instant;
        }
    }
}
