#!/usr/bin/env bash
set -euo pipefail

# Destructive fixture tests get their own Compose project and a restored database per suite.
cd "$(dirname "$0")/../.."
project="vibehr-rust-ci-$(openssl rand -hex 8)"
runtime="$project:tested"
work=$(mktemp -d)
reference_container=
candidate_container=
pg=
target_volume=
registry_volume=
source_dir="$PWD"
override_file="$work/ci.yml"
if command -v cygpath >/dev/null; then
  source_dir=$(cygpath -am "$source_dir")
  override_file=$(cygpath -am "$override_file")
  export MSYS_NO_PATHCONV=1
fi
compose=(docker compose --project-name "$project" --project-directory "$source_dir"
  -f docker-compose.rust-smoke.yml -f "$override_file")
toolbox=
cleanup() {
  if [[ -n "$reference_container" ]]; then docker rm -f "$reference_container" >/dev/null; fi
  if [[ -n "$candidate_container" ]]; then docker rm -f "$candidate_container" >/dev/null; fi
  if [[ -n "$toolbox" ]]; then docker rm -f "$toolbox" >/dev/null; fi
  "${compose[@]}" down --volumes --remove-orphans >/dev/null
  if [[ -n "$target_volume" ]]; then docker volume rm "$target_volume" >/dev/null; fi
  if [[ -n "$registry_volume" ]]; then docker volume rm "$registry_volume" >/dev/null; fi
  docker image rm "$runtime" >/dev/null 2>&1 || true
  docker image rm "$project:spring-reference" >/dev/null 2>&1 || true
  docker image rm "$project:legacy" >/dev/null 2>&1 || true
  rm -f "$work/ci.yml"
  rmdir "$work"
}
export AUTH_TOKEN_SECRET VIBEHR_BFF_ASSERTION_SECRET
AUTH_TOKEN_SECRET=$(openssl rand -hex 32)
VIBEHR_BFF_ASSERTION_SECRET=$(openssl rand -hex 32)
while [[ "$AUTH_TOKEN_SECRET" == "$VIBEHR_BFF_ASSERTION_SECRET" ]]; do VIBEHR_BFF_ASSERTION_SECRET=$(openssl rand -hex 32); done
cat > "$work/ci.yml" <<EOF
services:
  preflight: {image: $runtime}
  verify-schema: {image: $runtime}
  backend: {image: $runtime}
  postgres:
    labels: {codex.task: $project}
    ports: ["127.0.0.1::5432"]
EOF
trap cleanup EXIT
"${compose[@]}" up --build --detach --wait --wait-timeout 300
pg=$("${compose[@]}" ps -q postgres)
backend_url="http://$("${compose[@]}" port backend 8080)"
node scripts/spring-migration/verify-delivery.js --rust-image "$runtime"
node scripts/rust-migration/openapi-contract.mjs verify "$backend_url"
node scripts/spring-migration/verify-spring-openapi.js --base-url "$backend_url"

# Verify repeat migration and empty-to-restored compatibility using the same
# Flyway binary and metadata as the release. No live host is addressable here.
for stage in preflight migrate verify-schema; do
  "${compose[@]}" run --rm --no-deps "$stage"
done
for mode in dev demo; do
  count=()
  if [[ "$mode" == demo ]]; then count=(1); fi
  docker run --rm --network "container:$pg" -e DATABASE_URL=postgres://vibehr:vibehr@127.0.0.1/vibehr_smoke \
    -e "SPRING_PROFILES_ACTIVE=local,${mode}-seed" -e VIBEHR_ALLOW_FIXTURE_SEEDING=true \
    "$runtime" seed "$mode" "$mode" "${count[@]}"
done
# Restore by physical template to retain exact PostgreSQL catalog constraints.
# Stock pg_restore can reserialize equivalent array expressions with a different fingerprint.
"${compose[@]}" stop backend
restore() {
  docker exec "$pg" createdb -U vibehr --template=vibehr_smoke "$1"
}
for db in platform_test auth_test organization_test payroll_test hr_test training_test time_concurrency_test; do restore "$db"; done
target_volume=$(docker volume create --label "codex.task=$project" "$project-target")
registry_volume=$(docker volume create --label "codex.task=$project" "$project-registry")
toolbox=$(docker run -d --network "container:$pg" -w /src --mount "type=bind,source=$source_dir/backend-rust,target=/src,readonly" \
  -v "$target_volume:/target" -v "$registry_volume:/usr/local/cargo/registry" -e CARGO_TARGET_DIR=/target \
  -e VIBEHR_PLATFORM_TEST_URL=postgres://vibehr:vibehr@127.0.0.1/platform_test \
  -e VIBEHR_AUTH_TEST_DATABASE_URL=postgres://vibehr:vibehr@127.0.0.1/auth_test \
  -e VIBEHR_ORGANIZATION_TEST_URL=postgres://vibehr:vibehr@127.0.0.1/organization_test \
  -e VIBEHR_PAYROLL_TEST_URL=postgres://vibehr:vibehr@127.0.0.1/payroll_test \
  -e VIBEHR_HR_TEST_URL=postgres://vibehr:vibehr@127.0.0.1/hr_test \
  -e VIBEHR_TRAINING_TEST_URL=postgres://vibehr:vibehr@127.0.0.1/training_test \
  -e VIBEHR_TIME_TEST_URL=postgres://vibehr:vibehr@127.0.0.1/time_concurrency_test \
  rust:1.100-bookworm sleep infinity)
docker exec "$toolbox" bash -euc '
    rustup component add clippy rustfmt
    apt-get update -qq
    apt-get install -y --no-install-recommends fonts-nanum poppler-utils
    cargo fmt --all -- --check
    cargo clippy --locked --all-targets -- -D warnings
    cargo test --locked --all-targets --no-fail-fast -- --include-ignored
  '

docker build --build-arg "BACKEND_IMAGE=$runtime" -f scripts/rust-migration/legacy.Dockerfile -t "$project:legacy" .
pg_name=$(docker inspect --format '{{.Name}}' "$pg")
VIBEHR_LEGACY_TEST_PASSWORD=vibehr python3 scripts/rust-migration/legacy-parity.py \
  --postgres "${pg_name#/}" --network "${project}_default" --user vibehr --image "$project:legacy"

# Each pair gets the exact same logical database image. Publish only to loopback.
docker build -t "$project:spring-reference" backend-spring
bash scripts/ci/rehearse-rust-promotion.sh "$project" "$runtime" "$project:spring-reference" "$pg"
wait_url() {
  for _ in $(seq 1 90); do
    if curl --fail --silent "$1/actuator/health/readiness" >/dev/null; then return; fi
    sleep 2
  done
  echo "Fixture did not become ready: $1" >&2
  return 1
}
pair() {
  local refdb="$1" rustdb="$2"
  if [[ -n "$reference_container" ]]; then docker rm -f "$reference_container" >/dev/null; reference_container=; fi
  if [[ -n "$candidate_container" ]]; then docker rm -f "$candidate_container" >/dev/null; candidate_container=; fi
  restore "$refdb"
  restore "$rustdb"
  local -a opts=(--detach --network "${project}_default" -p 127.0.0.1::8080
    -e AUTH_TOKEN_SECRET -e VIBEHR_BFF_ASSERTION_SECRET -e ENVIRONMENT=rust-parity -e TZ=UTC)
  reference_container=$(docker run "${opts[@]}" -e "APP_NAME=${3:-$refdb}" -e JAVA_TOOL_OPTIONS="-Duser.language=en -Duser.timezone=UTC" \
    -e SPRING_DATASOURCE_HIKARI_MAXIMUM_POOL_SIZE=2 -e SPRING_DATASOURCE_HIKARI_MINIMUM_IDLE=1 \
    -e "SPRING_DATASOURCE_URL=jdbc:postgresql://postgres:5432/$refdb" -e SPRING_DATASOURCE_USERNAME=vibehr \
    -e SPRING_DATASOURCE_PASSWORD=vibehr "$project:spring-reference")
  candidate_container=$(docker run "${opts[@]}" -e "APP_NAME=${3:-$rustdb}" -e "DATABASE_URL=postgres://vibehr:vibehr@postgres/$rustdb" "$runtime")
  ref_port=$(docker port "$reference_container" 8080/tcp)
  rust_port=$(docker port "$candidate_container" 8080/tcp)
  [[ "$ref_port" =~ ^127\.0\.0\.1:[0-9]+$ && "$rust_port" =~ ^127\.0\.0\.1:[0-9]+$ ]]
  ref_port=${ref_port##*:}
  rust_port=${rust_port##*:}
  left="http://127.0.0.1:$ref_port"
  right="http://127.0.0.1:$rust_port"
  wait_url "$left"
  wait_url "$right"
  VIBEHR_PARITY_TOKEN=$(python3 scripts/ci/fixture-session.py "$ref_port" admin-local)
  export VIBEHR_PARITY_TOKEN VIBEHR_PARITY_DB_USER=vibehr
}

pair read_oracle read_candidate rust-read-fixture
node scripts/rust-migration/read-parity.mjs "$left" "$right" anonymous
node scripts/rust-migration/read-parity.mjs "$left" "$right" admin
VIBEHR_PARITY_TOKEN=$(python3 scripts/ci/fixture-session.py "$ref_port" kr-0001) \
  node scripts/rust-migration/read-parity.mjs "$left" "$right" employee

pair hr_reference_test hr_candidate_test
pg_port=$("${compose[@]}" port postgres 5432)
VIBEHR_HR_REFERENCE_DATABASE_URL="postgres://vibehr:vibehr@$pg_port/hr_reference_test" \
VIBEHR_HR_CANDIDATE_DATABASE_URL="postgres://vibehr:vibehr@$pg_port/hr_candidate_test" \
VIBEHR_HR_REFERENCE_TOKEN="$VIBEHR_PARITY_TOKEN" VIBEHR_HR_CANDIDATE_TOKEN="$VIBEHR_PARITY_TOKEN" \
VIBEHR_HR_PARITY=isolated-only python3 scripts/rust-migration/hr-parity.py "$left" "$right"

pair payroll_oracle payroll_candidate
python3 scripts/rust-migration/payroll-parity.py --reference "$ref_port" --candidate "$rust_port" --container "$pg" --user vibehr --month 2080-01 --pdf-container "$toolbox"
pair time_oracle time_candidate
python3 scripts/rust-migration/time-parity.py --reference "$ref_port" --candidate "$rust_port" --container "$pg" --user vibehr
python3 scripts/rust-migration/settings-parity.py --reference "$ref_port" --candidate "$rust_port" --container "$pg" --user vibehr
pair business_oracle business_candidate
for domain in organization management appraisal training; do
  node scripts/rust-migration/business-parity.mjs "$domain" "$ref_port" "$rust_port" "$pg"
done
