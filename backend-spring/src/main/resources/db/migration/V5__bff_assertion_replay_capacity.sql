alter table bff_assertion_replays
    add column source_hash varchar(43),
    add column replay_bucket smallint;

-- V4 rows have a maximum assertion lifetime of two minutes and cannot be recovered
-- to their original source. Keep them replay-protected until expiry under one legacy scope.
update bff_assertion_replays
   set source_hash = 'legacy-replay-source-hash-unavailable-00000',
       replay_bucket = 0
 where source_hash is null;

alter table bff_assertion_replays
    alter column source_hash set not null,
    alter column replay_bucket set not null,
    add constraint bff_assertion_replays_bucket_check check (replay_bucket between 0 and 255);

create index bff_assertion_replays_bucket_expiry_idx
    on bff_assertion_replays (replay_bucket, expires_at);

create index bff_assertion_replays_source_expiry_idx
    on bff_assertion_replays (source_hash, expires_at);
