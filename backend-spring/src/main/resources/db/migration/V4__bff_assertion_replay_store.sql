create table bff_assertion_replays (
    nonce varchar(128) primary key,
    scope_hash varchar(43) not null,
    expires_at timestamp with time zone not null
);

create index bff_assertion_replays_scope_expiry_idx
    on bff_assertion_replays (scope_hash, expires_at);

create index bff_assertion_replays_expiry_idx
    on bff_assertion_replays (expires_at);
