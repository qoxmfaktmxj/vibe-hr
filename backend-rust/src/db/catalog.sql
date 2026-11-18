WITH owned AS (
    SELECT table_name AS name FROM information_schema.tables
    WHERE table_schema='public' AND table_type='BASE TABLE'
      AND table_name NOT IN ('alembic_version','flyway_schema_history','bff_assertion_replays')
), cols AS (
    SELECT table_name AS name, json_agg(json_build_object(
        'name',column_name,'data_type',data_type,'udt_name',udt_name,'nullable',is_nullable,
        'default',column_default,'character_maximum_length',character_maximum_length::text,
        'numeric_precision',numeric_precision::text,'numeric_scale',numeric_scale::text,
        'datetime_precision',datetime_precision::text) ORDER BY ordinal_position) AS items
    FROM information_schema.columns WHERE table_schema='public' GROUP BY table_name
), cons AS (
    SELECT r.relname AS name,json_agg(json_build_object('name',c.conname,'type',c.contype,
        'definition',pg_get_constraintdef(c.oid,true)) ORDER BY c.conname) AS items
    FROM pg_constraint c JOIN pg_class r ON r.oid=c.conrelid
    JOIN pg_namespace n ON n.oid=r.relnamespace WHERE n.nspname='public' GROUP BY r.relname
), idx AS (
    SELECT tablename AS name,json_agg(json_build_object('name',indexname,'definition',indexdef)
        ORDER BY indexname) AS items FROM pg_indexes WHERE schemaname='public' GROUP BY tablename
)
SELECT json_build_object('tables',coalesce((SELECT json_agg(json_build_object(
    'name',owned.name,'columns',coalesce(cols.items,'[]'),'constraints',coalesce(cons.items,'[]'),
    'indexes',coalesce(idx.items,'[]')) ORDER BY owned.name)
    FROM owned LEFT JOIN cols USING(name) LEFT JOIN cons USING(name) LEFT JOIN idx USING(name)),'[]'),
    'sequences',coalesce((SELECT json_agg(json_build_object('name',sequence_name,'data_type',data_type,
        'start',start_value,'minimum',minimum_value,'maximum',maximum_value,'increment',increment,'cycle',cycle_option)
        ORDER BY sequence_name) FROM information_schema.sequences WHERE sequence_schema='public'),'[]'),
    'extensions',coalesce((SELECT json_agg(json_build_object('name',extname,'version',extversion)
        ORDER BY extname) FROM pg_extension WHERE extname='btree_gist'),'[]'))
