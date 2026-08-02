package com.vibehr.auth;

import java.time.Clock;
import java.nio.charset.StandardCharsets;
import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Iterator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;

@Component
public final class LoginRateLimiter {

    private static final int MAX_ATTEMPTS_PER_CLIENT = 30;
    private static final int MAX_ATTEMPTS_PER_LOGIN = 10;
    private static final int MAX_ATTEMPTS_PER_SOURCE = 10;
    private static final long WINDOW_SECONDS = 300;
    private static final int MAX_TRACKED_KEYS = 10_000;
    private static final int OVERFLOW_SHARDS = 256;

    private final Clock clock;
    private final int maximumTrackedKeys;
    private final Map<String, ArrayDeque<Long>> attemptsByClient = new LinkedHashMap<>(16, 0.75f, true);
    private final Map<String, ArrayDeque<Long>> attemptsByLogin = new LinkedHashMap<>(16, 0.75f, true);
    private final Map<String, ArrayDeque<Long>> attemptsBySource = new LinkedHashMap<>(16, 0.75f, true);
    private final List<ArrayDeque<Long>> overflowByClient;
    private final List<ArrayDeque<Long>> overflowByLogin;
    private final List<ArrayDeque<Long>> overflowBySource;

    @Autowired
    public LoginRateLimiter(Clock clock) {
        this(clock, MAX_TRACKED_KEYS);
    }

    LoginRateLimiter(Clock clock, int maximumTrackedKeys) {
        this(clock, maximumTrackedKeys, OVERFLOW_SHARDS);
    }

    LoginRateLimiter(Clock clock, int maximumTrackedKeys, int overflowShardCount) {
        if (maximumTrackedKeys < 1 || overflowShardCount < 1) {
            throw new IllegalArgumentException("Login rate limiter capacities must be positive.");
        }
        this.clock = clock;
        this.maximumTrackedKeys = maximumTrackedKeys;
        this.overflowByClient = overflowShards(overflowShardCount);
        this.overflowByLogin = overflowShards(overflowShardCount);
        this.overflowBySource = overflowShards(overflowShardCount);
    }

    synchronized void check(String clientId, String requestBinding, String sourceHash) {
        long now = clock.instant().getEpochSecond();
        expireInactive(now, attemptsByClient);
        expireInactive(now, attemptsByLogin);
        expireInactive(now, attemptsBySource);
        expireOverflow(now, overflowByClient);
        expireOverflow(now, overflowByLogin);
        expireOverflow(now, overflowBySource);
        ArrayDeque<Long> clientHistory = historyFor(attemptsByClient, clientId, MAX_ATTEMPTS_PER_CLIENT, overflowByClient);
        ArrayDeque<Long> loginHistory = historyFor(attemptsByLogin, requestBinding, MAX_ATTEMPTS_PER_LOGIN, overflowByLogin);
        ArrayDeque<Long> sourceHistory = historyFor(attemptsBySource, sourceHash, MAX_ATTEMPTS_PER_SOURCE, overflowBySource);
        long retryAfter = Math.max(
                retryAfter(clientHistory, MAX_ATTEMPTS_PER_CLIENT, now),
                Math.max(
                        retryAfter(loginHistory, MAX_ATTEMPTS_PER_LOGIN, now),
                        retryAfter(sourceHistory, MAX_ATTEMPTS_PER_SOURCE, now)
                )
        );
        if (retryAfter > 0) {
            throw new LoginRateLimitException("Too many login attempts. Please try again later.", retryAfter);
        }
        clientHistory.addLast(now);
        loginHistory.addLast(now);
        sourceHistory.addLast(now);
    }

    private ArrayDeque<Long> historyFor(
            Map<String, ArrayDeque<Long>> histories,
            String key,
            int maximumAttempts,
            List<ArrayDeque<Long>> overflow
    ) {
        ArrayDeque<Long> history = histories.get(key);
        if (history != null) {
            return history;
        }
        if (histories.size() >= maximumTrackedKeys) {
            if (!evictForNewKey(histories, maximumAttempts)) {
                // Never evict an active throttled key. Meter only its SHA-256 overflow shard instead.
                return overflow.get(overflowShardFor(key, overflow.size()));
            }
        }
        history = new ArrayDeque<>();
        histories.put(key, history);
        return history;
    }

    /**
     * Keep currently throttled keys when possible. New keys are admitted by evicting an
     * unthrottled LRU entry, then use their finite overflow shard only when none is available.
     */
    private static boolean evictForNewKey(Map<String, ArrayDeque<Long>> histories, int maximumAttempts) {
        Iterator<Map.Entry<String, ArrayDeque<Long>>> entries = histories.entrySet().iterator();
        while (entries.hasNext()) {
            Map.Entry<String, ArrayDeque<Long>> candidate = entries.next();
            if (candidate.getValue().size() < maximumAttempts) {
                entries.remove();
                return true;
            }
        }
        return false;
    }

    private static long retryAfter(ArrayDeque<Long> history, int maxAttempts, long now) {
        if (history.size() < maxAttempts) {
            return 0;
        }
        return Math.max(1, WINDOW_SECONDS - (now - history.peekFirst()));
    }

    private static void expireInactive(long now, Map<String, ArrayDeque<Long>> histories) {
        Iterator<Map.Entry<String, ArrayDeque<Long>>> entries = histories.entrySet().iterator();
        while (entries.hasNext()) {
            ArrayDeque<Long> history = entries.next().getValue();
            expireHistory(now, history);
            if (history.isEmpty()) {
                entries.remove();
            }
        }
    }

    private static void expireHistory(long now, ArrayDeque<Long> history) {
        while (!history.isEmpty() && history.peekFirst() <= now - WINDOW_SECONDS) {
            history.removeFirst();
        }
    }

    private static List<ArrayDeque<Long>> overflowShards(int shardCount) {
        List<ArrayDeque<Long>> shards = new ArrayList<>(shardCount);
        for (int index = 0; index < shardCount; index++) {
            shards.add(new ArrayDeque<>());
        }
        return shards;
    }

    private static void expireOverflow(long now, List<ArrayDeque<Long>> overflow) {
        for (ArrayDeque<Long> history : overflow) {
            expireHistory(now, history);
        }
    }

    static int overflowShardFor(String key, int shardCount) {
        if (shardCount < 1) throw new IllegalArgumentException("Overflow shard count must be positive.");
        byte[] digest;
        try {
            digest = MessageDigest.getInstance("SHA-256").digest(key.getBytes(StandardCharsets.UTF_8));
        } catch (NoSuchAlgorithmException exception) {
            throw new IllegalStateException("SHA-256 must be available in the Java runtime.", exception);
        }
        long hash = ((long) (digest[0] & 0xff) << 24)
                | ((long) (digest[1] & 0xff) << 16)
                | ((long) (digest[2] & 0xff) << 8)
                | (digest[3] & 0xffL);
        return (int) (hash % shardCount);
    }
}

class LoginRateLimitException extends RuntimeException {

    private final long retryAfterSeconds;

    LoginRateLimitException(String detail, long retryAfterSeconds) {
        super(detail);
        this.retryAfterSeconds = retryAfterSeconds;
    }

    long retryAfterSeconds() {
        return retryAfterSeconds;
    }
}
