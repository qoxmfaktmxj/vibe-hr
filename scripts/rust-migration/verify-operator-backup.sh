#!/usr/bin/env bash
# Run on the operator's private verification host. This script only opens a backup.
set -euo pipefail
umask 077
[[ $# == 2 ]] || { echo "Usage: bash $0 BACKUP_DIRECTORY_OR_CUSTOM_DUMP DATABASE_NAME" >&2; exit 2; }
backup=$(realpath -- "$1")
db=$2
[[ "$db" =~ ^[a-zA-Z_][a-zA-Z0-9_]*$ ]] || { echo "Check database name" >&2; exit 2; }
: "${PGUSER:?Set the application DB login for the restored database}"
: "${PGPASSWORD:?Set the DB password in this shell}"
: "${PG_IMAGE:?Set the matching PostgreSQL 16 image with its extensions}"
: "${RUST_IMAGE:?Set the candidate Rust image}"
root=$(cd "$(dirname "$0")/../.." && pwd)
sql="$root/backend-spring/src/main/resources/db/migration"
test -r "$sql/schema-metadata-manifest.json"
docker image inspect "$PG_IMAGE" "$RUST_IMAGE" redgate/flyway:12.4.0 >/dev/null
tag="vibehr-restore-$(date -u +%Y%m%d%H%M%S)-$(openssl rand -hex 4)"
pg="$tag-db"; api="$tag-api"; volume="$tag-data"
label="vibehr.restore-test=$tag"
cleanup() {
  for name in "$api" "$pg"; do
    if [[ $(docker inspect -f '{{index .Config.Labels "vibehr.restore-test"}}' "$name" 2>/dev/null || true) == "$tag" ]]; then
      docker rm -f "$name" >/dev/null
    fi
  done
  if [[ $(docker volume inspect -f '{{index .Labels "vibehr.restore-test"}}' "$volume" 2>/dev/null || true) == "$tag" ]]; then
    docker volume rm "$volume" >/dev/null
  fi
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM
data="type=volume,source=$volume,target=/var/lib/postgresql/data"
docker volume create --label "$label" "$volume" >/dev/null
if [[ -d "$backup" ]]; then
  [[ $(cat "$backup/PG_VERSION") == 16 && -s "$backup/backup_manifest" ]] || { echo "Expected a PostgreSQL 16 plain base backup with manifest" >&2; exit 1; }
  [[ -z $(find "$backup/pg_tblspc" -mindepth 1 -print -quit) ]] || { echo "Use the installation's tablespace-aware restore procedure" >&2; exit 1; }
  docker run --rm --network none -v "$backup:/backup:ro" --entrypoint pg_verifybackup "$PG_IMAGE" /backup
  docker run --rm --network none -v "$backup:/backup:ro" --mount "$data" --entrypoint sh "$PG_IMAGE" -ec '
    cp -a /backup/. /var/lib/postgresql/data/
    chown -R postgres:postgres /var/lib/postgresql/data
    chmod 700 /var/lib/postgresql/data'
  # Use the copied data directory only. No source volumes, published ports or egress.
  docker run -d --name "$pg" --label "$label" --network none --mount "$data" --user postgres --entrypoint postgres "$PG_IMAGE" \
    -D /var/lib/postgresql/data -p 5432 -c listen_addresses=127.0.0.1 -c archive_mode=off -c primary_conninfo= -c restore_command= >/dev/null
  physical=true
else
  [[ -s "$backup" && $(head -c 5 "$backup") == PGDMP ]] || { echo "Expected a nonempty pg_dump custom-format backup" >&2; exit 1; }
  sha256sum "$backup"
  export POSTGRES_USER="$PGUSER" POSTGRES_PASSWORD="$PGPASSWORD" POSTGRES_DB="$db"
  docker run -d --name "$pg" --label "$label" --network none --mount "$data" \
    -e POSTGRES_USER -e POSTGRES_PASSWORD -e POSTGRES_DB "$PG_IMAGE" -p 5432 >/dev/null
  physical=false
fi
pgclient=(docker exec -e PGPASSWORD "$pg")
for attempt in {1..90}; do
  if "${pgclient[@]}" psql -XAtq -h 127.0.0.1 -p 5432 -U "$PGUSER" -d "$db" -c 'select 1' >/dev/null 2>&1; then break; fi
  [[ $(docker inspect -f '{{.State.Running}}' "$pg") == true && $attempt != 90 ]] || { echo "Restored DB could not accept the application login" >&2; exit 1; }
  sleep 2
done
if [[ $physical == false ]]; then
  docker exec -i -e PGPASSWORD "$pg" pg_restore --exit-on-error --single-transaction --no-owner --no-privileges \
    -h 127.0.0.1 -p 5432 -U "$PGUSER" -d "$db" < "$backup"
fi
psql=("${pgclient[@]}" psql -X -v ON_ERROR_STOP=1 -h 127.0.0.1 -p 5432 -U "$PGUSER" -d "$db")
versions=$("${psql[@]}" -Atqc "SELECT string_agg(version,',' ORDER BY installed_rank) FROM flyway_schema_history WHERE success")
[[ "$versions" == "1,2,3,4,5,6,7" && $("${psql[@]}" -Atqc 'SELECT count(*) FROM flyway_schema_history WHERE NOT success') == 0 ]] || { echo "Unexpected Flyway history" >&2; exit 1; }
"${psql[@]}" -c 'SELECT (SELECT count(*) FROM hr_employees) AS employees, (SELECT count(*) FROM org_departments) AS departments, (SELECT count(*) FROM tim_leave_requests) AS leave_requests, (SELECT count(*) FROM pay_payroll_runs) AS payroll_runs'
export FLYWAY_URL="jdbc:postgresql://127.0.0.1:5432/$db" FLYWAY_USER="$PGUSER" FLYWAY_PASSWORD="$PGPASSWORD"
export SPRING_DATASOURCE_URL="$FLYWAY_URL" SPRING_DATASOURCE_USERNAME="$PGUSER" SPRING_DATASOURCE_PASSWORD="$PGPASSWORD"
network=(--network "container:$pg")
creds=(-e SPRING_DATASOURCE_URL -e SPRING_DATASOURCE_USERNAME -e SPRING_DATASOURCE_PASSWORD)
docker run --rm "${network[@]}" -v "$sql:/migrations:ro" -e FLYWAY_URL -e FLYWAY_USER -e FLYWAY_PASSWORD \
  -e FLYWAY_LOCATIONS=filesystem:/migrations -e FLYWAY_CLEAN_DISABLED=true redgate/flyway:12.4.0 validate
docker run --rm "${network[@]}" "${creds[@]}" -e VIBEHR_SCHEMA_OWNER=flyway "$RUST_IMAGE" schema-preflight
docker run --rm "${network[@]}" "${creds[@]}" -v "$sql:/migrations:ro" "$RUST_IMAGE" schema-verify /migrations/schema-metadata-manifest.json
AUTH_TOKEN_SECRET=$(openssl rand -hex 32); VIBEHR_BFF_ASSERTION_SECRET=$(openssl rand -hex 32)
export AUTH_TOKEN_SECRET VIBEHR_BFF_ASSERTION_SECRET
docker run -d --name "$api" --label "$label" "${network[@]}" "${creds[@]}" -e AUTH_TOKEN_SECRET -e VIBEHR_BFF_ASSERTION_SECRET \
  -e ENVIRONMENT=restore-proof -e BIND_ADDRESS=127.0.0.1:8080 "$RUST_IMAGE" >/dev/null
for attempt in {1..45}; do
  if docker exec "$api" curl -fsS http://127.0.0.1:8080/actuator/health/readiness >/dev/null 2>&1; then break; fi
  [[ $attempt != 45 ]] || { echo "Rust readiness failed" >&2; exit 1; }
  sleep 2
done
docker exec "$api" curl -fsS http://127.0.0.1:8080/api/v1/health | jq -e '.environment == "restore-proof" and .db == "ok" and .status == "ok"' >/dev/null
docker exec "$api" curl -fsS http://127.0.0.1:8080/openapi.json | jq -e '.openapi == "3.1.0" and (.paths | length) > 0' >/dev/null
echo "PASS: backup restored, Flyway V1-V7 validated, schema verified, Rust ready with healthy restored DB."
