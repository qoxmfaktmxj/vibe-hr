#!/usr/bin/env bash
set -euo pipefail

# Exercise the release Compose graph and the actual previous-Spring rollback
# on a private database. Only the backend changes; the Next BFF address stays backend:8080.
project=$1
rust=$2
spring=$3
pg=$4
[[ "$project" =~ ^vibehr-rust-ci-[0-9a-f]{16}$ ]]
[[ "$(docker inspect --format '{{index .Config.Labels "codex.task"}}' "$pg")" == "$project" ]]
docker exec "$pg" createdb -U vibehr --template=vibehr_smoke delivery_test
work=$(mktemp -d)
mkdir -p "$work/backend-spring/src/main/resources/db"
cp -R backend-spring/src/main/resources/db/migration "$work/backend-spring/src/main/resources/db/"
cp docker-compose.deploy.yml "$work/"
export VIBEHR_BFF_BACKEND_URL=http://backend:8080 VIBEHR_BFF_TRUSTED_CLIENT_IP_HEADER=x-vibehr-client-ip
export VIBEHR_SCHEMA_OWNER=flyway SPRING_DATASOURCE_USERNAME=vibehr SPRING_DATASOURCE_PASSWORD=vibehr
export SPRING_DATASOURCE_URL=jdbc:postgresql://postgres:5432/delivery_test VIBEHR_BACKEND_IMAGE="$rust"
cat > "$work/.env.deploy" <<EOF
SPRING_DATASOURCE_URL=$SPRING_DATASOURCE_URL
SPRING_DATASOURCE_USERNAME=vibehr
SPRING_PROFILES_ACTIVE=flyway-cutover
SPRING_DATASOURCE_HIKARI_MAXIMUM_POOL_SIZE=5
SPRING_DATASOURCE_HIKARI_MINIMUM_IDLE=1
VIBEHR_SCHEMA_OWNER=flyway
ENVIRONMENT=rust-parity
EOF
(umask 077; printf 'SPRING_DATASOURCE_PASSWORD=vibehr\nAUTH_TOKEN_SECRET=%s\nVIBEHR_BFF_ASSERTION_SECRET=%s\n' "$AUTH_TOKEN_SECRET" "$VIBEHR_BFF_ASSERTION_SECRET" > "$work/.env.deploy.secret")
cat > "$work/test.yml" <<EOF
services:
  backend:
    container_name: $project-rehearsal-rust
    ports: !override ["127.0.0.1::8080"]
networks:
  default:
    external: true
    name: ${project}_default
EOF
cat > "$work/previous.yml" <<EOF
services:
  backend:
    container_name: $project-rehearsal-spring
    image: $spring
EOF
host_dir=$work
if command -v cygpath >/dev/null; then host_dir=$(cygpath -am "$work"); fi
base=(docker compose --project-name "$project-rehearsal" --project-directory "$host_dir" -f "$host_dir/docker-compose.deploy.yml" -f "$host_dir/test.yml")
previous=("${base[@]}" -f "$host_dir/previous.yml")
cleanup() {
  "${base[@]}" down --remove-orphans --volumes >/dev/null
  # mktemp supplied a private workspace; remove only files and copied migration directory.
  rm -f "$work/backend-spring/src/main/resources/db/migration/"*.sql "$work/backend-spring/src/main/resources/db/migration/schema-metadata-manifest.json"
  rmdir "$work/backend-spring/src/main/resources/db/migration" "$work/backend-spring/src/main/resources/db" \
    "$work/backend-spring/src/main/resources" "$work/backend-spring/src/main" "$work/backend-spring/src" "$work/backend-spring"
  rm -f "$work/.env.deploy" "$work/.env.deploy.secret" "$work/docker-compose.deploy.yml" "$work/test.yml" "$work/previous.yml"
  rmdir "$work"
}
trap cleanup EXIT
probe() {
  local container=$1 expected=$2 address
  [[ "$(docker inspect --format '{{.Image}}' "$container")" == "$(docker image inspect --format '{{.Id}}' "$expected")" ]]
  address=$(docker port "$container" 8080/tcp)
  [[ "$address" =~ ^127\.0\.0\.1:[0-9]+$ ]]
  for _ in $(seq 1 90); do
    if curl --silent --fail "http://$address/actuator/health/readiness" >/dev/null; then
      curl --silent --fail "http://$address/openapi.json" >/dev/null
      return 0
    fi
    sleep 2
  done
  return 1
}
"${base[@]}" config -q
"${previous[@]}" up --detach --no-deps --no-build backend
probe "$project-rehearsal-spring" "$spring"
spring_port=$(docker port "$project-rehearsal-spring" 8080/tcp)
session=$(python3 scripts/ci/fixture-session.py "${spring_port##*:}" admin-local)
for stage in preflight migrate verify-schema; do
  "${base[@]}" run --rm --no-deps --pull never "$stage"
done
"${base[@]}" up --detach --no-build --remove-orphans --force-recreate --no-deps backend
probe "$project-rehearsal-rust" "$rust"
rust_address=$(docker port "$project-rehearsal-rust" 8080/tcp)
role_json=$(curl --fail --silent --show-error "http://$rust_address/api/v1/menus/admin/roles" \
  -H "Authorization: Bearer $session" -H "Content-Type: application/json" \
  --data '{"code":"rust-rollback-proof","name":"Rollback proof"}')
role_id=$(node -e 'const r=JSON.parse(process.argv[1]).role;if(!Number.isInteger(r.id))process.exit(1);console.log(r.id)' "$role_json")
"${previous[@]}" up --detach --no-build --remove-orphans --force-recreate --no-deps backend
probe "$project-rehearsal-spring" "$spring"
spring_address=$(docker port "$project-rehearsal-spring" 8080/tcp)
curl --fail --silent --show-error "http://$spring_address/api/v1/menus/admin/roles" -H "Authorization: Bearer $session" | \
  node -e 'let b="";process.stdin.on("data",d=>b+=d);process.stdin.on("end",()=>{const rows=JSON.parse(b).roles;if(!rows.some(r=>r.id===Number(process.argv[1])&&r.code==="rust-rollback-proof"&&r.name==="Rollback proof"))process.exit(1)})' "$role_id"
echo "Restored-fixture deployment rehearsed from Spring to Rust and back to Spring."
