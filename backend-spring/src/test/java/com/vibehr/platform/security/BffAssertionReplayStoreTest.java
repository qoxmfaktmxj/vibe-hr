package com.vibehr.platform.security;

import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.time.Instant;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.dao.DataAccessResourceFailureException;

class BffAssertionReplayStoreTest {

    private static final Instant NOW = Instant.parse("2026-08-02T00:00:00Z");

    @Test
    void atomicallyConsumesTheGloballyUniqueNonceWithinTheSignedClientSourceScope() {
        JdbcTemplate jdbc = mock(JdbcTemplate.class);
        when(jdbc.queryForObject(anyString(), eq(Integer.class), any(Object[].class))).thenReturn(1);
        BffAssertionReplayStore store = new BffAssertionReplayStore(jdbc);

        store.consume(assertion("nonce-1"), NOW.plusSeconds(30), NOW);

        ArgumentCaptor<Object[]> parameters = ArgumentCaptor.forClass(Object[].class);
        verify(jdbc).queryForObject(anyString(), eq(Integer.class), parameters.capture());
        assertThat(parameters.getValue()[3]).isEqualTo("nonce-1");
        assertThat(parameters.getValue()[4]).isEqualTo(BffAssertionBinding.replayScope("client-1", sourceHash()));
        assertThat(parameters.getValue()[5]).isEqualTo(sourceHash());
    }

    @Test
    void rejectsReplaysOrOnlyTheOverloadedClientIpScopeWithoutAnyProcessLocalFallback() {
        JdbcTemplate jdbc = mock(JdbcTemplate.class);
        when(jdbc.queryForObject(anyString(), eq(Integer.class), any(Object[].class))).thenReturn(0);
        BffAssertionReplayStore store = new BffAssertionReplayStore(jdbc);

        assertThatThrownBy(() -> store.consume(assertion("nonce-2"), NOW.plusSeconds(30), NOW))
                .isInstanceOf(InvalidBffAssertionException.class);
    }

    @Test
    void propagatesDatabaseFailuresSoTheSecurityFilterCanFailClosed() {
        JdbcTemplate jdbc = mock(JdbcTemplate.class);
        when(jdbc.queryForObject(anyString(), eq(Integer.class), any(Object[].class)))
                .thenThrow(new DataAccessResourceFailureException("database write failed"));
        BffAssertionReplayStore store = new BffAssertionReplayStore(jdbc);

        assertThatThrownBy(() -> store.consume(assertion("nonce-3"), NOW.plusSeconds(30), NOW))
                .isInstanceOf(DataAccessResourceFailureException.class);
    }

    private static BffAssertionPrincipal assertion(String nonce) {
        return new BffAssertionPrincipal(
                "login", null, null, null, null, false,
                "client-1", sourceHash(), BffAssertionBinding.replayBucket(sourceHash()), "binding", "digest", nonce
        );
    }

    private static String sourceHash() {
        return BffAssertionBinding.sha256Base64Url("127.0.0.1");
    }
}
