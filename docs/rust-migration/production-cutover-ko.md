# VIBE-HR 운영자가 실행하는 첫 Rust 배포

`main`에 Rust 코드가 들어가도 운영 서버는 Spring으로 계속 서비스한다. GitHub Actions의 push와 매일 08:00 KST 예약 실행은 검증만 수행한다. **운영자는 실제 백업 복원을 통과한 뒤 그때 검증한 40자리 SHA를 입력해 배포한다.** 아래 명령은 운영 서버의 **같은 Bash 셸**에서 순서대로 실행한다. GitHub의 수동 실행 버튼은 운영자 PC에서 눌러도 된다.

## 1. 서비스 상태와 배포할 커밋 고정

필요한 도구는 Bash, Git, Docker, Docker Compose v2, curl, jq, OpenSSL이다. 복구 자료를 저장할 경로는 운영자만 읽을 수 있는 보호된 디스크여야 한다. 빌드와 복원에 필요한 여유 공간을 먼저 확인한다.

```bash
set -euo pipefail
set +x
umask 077
LIVE=/root/.openclaw/workspace/vibe-hr
cd "$LIVE"
test "$(git branch --show-current)" = main
test -z "$(git status --porcelain)"
git fetch origin main
RELEASE_SHA=$(git rev-parse origin/main)
OLD_BACKEND=$(docker inspect -f '{{.Image}}' vibehr-backend-spring)
OLD_FRONTEND=$(docker inspect -f '{{.Image}}' vibehr-frontend)
OLD_SHA=$(docker image inspect -f '{{index .Config.Labels "org.opencontainers.image.revision"}}' "$OLD_BACKEND")
[[ "$OLD_SHA" =~ ^[0-9a-f]{40}$ ]]
git diff --exit-code "$OLD_SHA" "$RELEASE_SHA" -- backend-spring/src/main/resources/db/migration
curl -fsS http://127.0.0.1:8080/actuator/health/readiness | jq -e '.status=="UP"'
curl -fsS https://hr.minseok91.cloud/api/auth/enter-cds | jq -e '.corporations | type=="array"'
docker ps --format '{{.Names}}  {{.Image}}'
DOCKER_ROOT=$(docker info --format '{{.DockerRootDir}}')
df -h /var/backups "$DOCKER_ROOT"
```

이 가이드는 현재 제공된 Spring 릴리스에서 **Flyway V1~V7 SQL 변경 없이** 전환하는 경우를 다룬다. 위 명령이 실패하거나 이미 Rust가 운영 중이면 현재 릴리스와 복구 계획을 먼저 확인한다. 운영 체크아웃의 미커밋 파일을 지워서 검사를 통과시키지 않는다.

```bash
STAMP=$(date -u +%Y%m%dT%H%M%SZ)
EVIDENCE=/var/backups/vibe-hr/rust-cutover-$STAMP
mkdir -p "$(dirname "$EVIDENCE")"
mkdir -m 700 "$EVIDENCE"
mkdir -m 700 "$EVIDENCE/release"
git archive "$RELEASE_SHA" | tar -x -C "$EVIDENCE/release"
git show "$OLD_SHA:docker-compose.deploy.yml" > "$EVIDENCE/previous.compose.yml"
PROJECT=$(docker inspect -f '{{index .Config.Labels "com.docker.compose.project"}}' vibehr-frontend)
test -n "$PROJECT"
docker image tag "$OLD_BACKEND" "vibehr-backend:manual-hold-$STAMP"
docker image tag "$OLD_FRONTEND" "vibehr-frontend:manual-hold-$STAMP"
printf '%s\n' "$RELEASE_SHA" > "$EVIDENCE/verified-candidate.sha"
printf '%s\n' "$OLD_SHA" > "$EVIDENCE/previous.sha"
printf '%s\n' "$PROJECT" > "$EVIDENCE/compose-project"
cat > "$EVIDENCE/rollback.override.yml" <<EOF
services:
  backend:
    image: vibehr-backend:manual-hold-$STAMP
    container_name: vibehr-backend-spring
  frontend:
    image: vibehr-frontend:manual-hold-$STAMP
    container_name: vibehr-frontend
EOF
printf '복구 자료 %s\n후보 SHA %s\n' "$EVIDENCE" "$RELEASE_SHA"
```

## 2. 운영 백업 선택

아래에서 `PG_CONTAINER`는 위의 `docker ps`에서 확인한 **실제 운영 PostgreSQL 컨테이너 이름**이다. 데이터베이스 이름과 계정은 현재 서비스 중인 Spring 설정에서 읽는다. 암호나 환경 파일 내용을 화면, Git, 채팅에 출력하지 않는다.

```bash
read -rp '운영 PostgreSQL 16 컨테이너 이름: ' PG_CONTAINER
export PG_IMAGE=$(docker inspect -f '{{.Image}}' "$PG_CONTAINER")
APP_DB=$(docker exec vibehr-backend-spring sh -ec 'u=${SPRING_DATASOURCE_URL%%\?*}; printf %s "${u##*/}"')
export PGUSER=$(docker exec vibehr-backend-spring printenv SPRING_DATASOURCE_USERNAME)
export PGPASSWORD=$(docker exec vibehr-backend-spring printenv SPRING_DATASOURCE_PASSWORD)
[[ "$APP_DB" =~ ^[A-Za-z_][A-Za-z0-9_]*$ ]]
docker exec -e PGPASSWORD "$PG_CONTAINER" psql -XAt -v ON_ERROR_STOP=1 -h 127.0.0.1 -U "$PGUSER" -d "$APP_DB" \
  -c "select current_database(),current_setting('server_version'),pg_is_in_recovery()"
```

DB 이름, PostgreSQL 16, 기본 서버를 의미하는 `f`를 확인한다. 사내 백업 시스템에 최신 복구용 백업이 있으면 해당 시각, 출처, 체크섬 또는 백업 ID를 기록하고 다음 명령으로 경로를 지정한다. **8월의 이전 Alembic 백업이나 개발 fixture를 선택하면 안 된다.**

```bash
read -erp '현재 운영 백업의 절대 경로: ' BACKUP
test -r "$BACKUP"
```

검증 도구는 PostgreSQL 16 `pg_basebackup`의 일반 디렉터리 형식(`backup_manifest` 포함)과 `pg_dump -Fc` 파일을 지원한다. 보관 중인 백업이 없으면 아래 접힌 절차로 새 물리 백업을 만든다. 같은 PostgreSQL 클러스터에 다른 서비스가 있으면 **그 데이터도 포함**되므로 클러스터 전체 백업 권한과 저장 공간을 확인한다.

<details>
<summary>신규 물리 백업 만들기</summary>

새 백업을 만드는 경우 위의 기존 백업 경로 입력 블록을 건너뛴다. 운영 DB는 분리된 컨테이너에서 실행 중이어야 한다. 아래 명령은 DB 컨테이너의 네트워크에서 복제 권한이 있는 기존 계정으로 읽는다. 사용자 정의 테이블스페이스나 외부 WAL 디렉터리를 쓰는 설치는 해당 설치의 백업 도구와 격리 복원 절차를 사용한다.

```bash
SRC=(docker exec -e PGPASSWORD "$PG_CONTAINER" psql -XAtq -v ON_ERROR_STOP=1 -h 127.0.0.1 -U "$PGUSER" -d "$APP_DB")
test "$("${SRC[@]}" -c "select count(*) from pg_tablespace where spcname not in ('pg_default','pg_global')")" = 0
"${SRC[@]}" -c 'select pg_size_pretty(sum(pg_database_size(datname))) from pg_database'
df -h "$EVIDENCE" "$DOCKER_ROOT"
BACKUP="$EVIDENCE/pg16-base"
mkdir -m 700 "$BACKUP"
read -rp '기존 PostgreSQL 복제 계정 이름: ' REPL_USER
read -rsp '복제 계정 암호: ' REPL_PASSWORD; printf '\n'
PGPASSWORD="$REPL_PASSWORD" docker run --rm --network "container:$PG_CONTAINER" \
  -v "$BACKUP:/backup" -e PGPASSWORD --entrypoint pg_basebackup "$PG_IMAGE" \
  -h 127.0.0.1 -p 5432 -U "$REPL_USER" -D /backup -Fp -X stream --checkpoint=spread --manifest-checksums=SHA256
unset REPL_PASSWORD
test -s "$BACKUP/backup_manifest"
```

백업과 복원본이 동시에 존재할 공간이 필요하다. 권한 오류, 공간 부족, 백업 중단이 발생하면 새 경로에 다시 받고 검증한다.

</details>

## 3. 격리된 컨테이너에서 복원 검증

운영 호스트의 메모리가 작으면 **이미지는 같은 CPU 아키텍처의 빌드 PC에서 준비**한다. 아래는 빌드 PC의 Bash에서 실행한다. SHA는 1단계 출력값을 사용한다. 이 파일에는 공개 저장소의 릴리스 이미지만 들어간다. 운영 백업은 운영자의 보호된 저장소에 둔다.

```bash
set -euo pipefail
read -rp '1단계의 main SHA 40자리: ' SHA
[[ "$SHA" =~ ^[0-9a-f]{40}$ ]]
git fetch origin main
test "$(git rev-parse origin/main)" = "$SHA"
BUILD_DIR=$(mktemp -d)
git archive "$SHA" backend-rust | tar -x -C "$BUILD_DIR"
docker build --label "org.opencontainers.image.revision=$SHA" -t "vibehr-restore-proof:$SHA" "$BUILD_DIR/backend-rust"
docker save "vibehr-restore-proof:$SHA" | gzip > "vibehr-restore-proof-$SHA.tar.gz"
sha256sum "vibehr-restore-proof-$SHA.tar.gz" > "vibehr-restore-proof-$SHA.tar.gz.sha256"
```

두 파일을 승인된 전송 경로로 운영 서버의 `$EVIDENCE`에 복사한다. 아래부터 다시 **1단계의 운영 서버 셸**에서 실행한다.

```bash
cd "$EVIDENCE"
sha256sum -c "vibehr-restore-proof-$RELEASE_SHA.tar.gz.sha256"
docker load -i "vibehr-restore-proof-$RELEASE_SHA.tar.gz"
cd "$EVIDENCE/release"
export RUST_IMAGE="vibehr-restore-proof:$RELEASE_SHA"
test "$(docker image inspect -f '{{index .Config.Labels "org.opencontainers.image.revision"}}' "$RUST_IMAGE")" = "$RELEASE_SHA"
docker pull redgate/flyway:12.4.0
bash scripts/rust-migration/verify-operator-backup.sh "$BACKUP" "$APP_DB" \
  2>&1 | tee "$EVIDENCE/restore-check.log"
unset PGPASSWORD
tail -1 "$EVIDENCE/restore-check.log"
```

**진행 조건은 종료 코드 0과 마지막 줄의 `PASS: backup restored`이다.** 복원 도구는 외부 네트워크와 공개 포트가 없는 새 PostgreSQL에만 연결한다. 물리 백업이면 먼저 `pg_verifybackup`으로 파일과 WAL을 확인한다. 복원된 DB에서 Flyway V1~V7 이력과 체크섬, Rust의 엄격한 스키마 검증, DB 연결 상태와 OpenAPI 기동을 확인한다. 출력된 사원, 부서, 휴가, 급여 건수를 백업 시점의 운영 기록과 대조하고 0건이나 급격한 차이가 예상 밖이면 멈춘다. 복구용 원본 백업과 로그는 보관하고 임시 컨테이너와 볼륨만 자동 정리한다.

`PostgreSQL catalog differs`가 나오면 배포를 중단한다. PostgreSQL 16 논리 덤프 복원에서 CHECK 식의 표기 차이만으로도 실제 차단된 사례가 있다. 물리 백업을 별도로 복원해 통과 여부를 확인한다. `flyway repair`, 체크섬 수정, 제약 삭제, 검증 생략은 이 전환의 복구 절차에 포함되지 않는다.

## 4. 운영자가 GitHub에서 배포 실행

1. [UI validation](https://github.com/qoxmfaktmxj/vibe-hr/actions/workflows/ui-validation.yml)에서 대상 `main` SHA의 검증 성공을 확인한다.
2. 서버에서 아래 명령으로 검증한 SHA와 현재 원격 `main`이 같은지 확인한다. 다르면 새 커밋 기준으로 다시 검증한다.
3. [Deploy Vibe-HR](https://github.com/qoxmfaktmxj/vibe-hr/actions/workflows/deploy.yml) → **Run workflow** → 브랜치 **main** → **운영 백업 복원 검증을 통과한 main 커밋 SHA 40자리**에 출력값을 붙여넣고 실행한다. 같은 SHA의 자동 실행을 재실행하는 대신 새 **수동 실행**을 선택한다.
4. `ui`, `test`, **`deploy`** 세 작업이 모두 초록색인지 확인한다. `deploy`가 회색 `skipped`이면 운영 전환이 이루어지지 않은 것이다. 올바른 SHA를 사용했는지 확인한다.

```bash
cd "$LIVE"
git fetch origin main
test "$(git rev-parse origin/main)" = "$(cat "$EVIDENCE/verified-candidate.sha")"
cat "$EVIDENCE/verified-candidate.sha"
```

워크플로가 후보 이미지를 호스트에 전달하고, 운영 DB의 사전 점검과 Flyway 검증, 후보 readiness와 OpenAPI를 통과한 뒤 Compose를 전환한다. Nginx의 TLS 설정과 Next.js의 내부 API 주소 `http://backend:8080`는 계속 사용한다.

## 5. 전환 직후 확인

```bash
for svc in vibehr-backend-rust vibehr-frontend; do
  id=$(docker inspect -f '{{.Image}}' "$svc")
  test "$(docker image inspect -f '{{index .Config.Labels "org.opencontainers.image.revision"}}' "$id")" = "$RELEASE_SHA"
done
curl -fsS http://127.0.0.1:8080/actuator/health/readiness | jq -e '.status=="UP"'
curl -fsS http://127.0.0.1:8080/api/v1/health | jq -e '.db=="ok" and .status=="ok"'
curl -fsS http://127.0.0.1:8080/openapi.json | jq -e '.openapi=="3.1.0"'
curl -fsS -o /dev/null https://hr.minseok91.cloud/login
curl -fsS https://hr.minseok91.cloud/api/auth/enter-cds | jq -e '.corporations | type=="array"'
```

운영 계정으로 HTTPS 로그인 후 본인의 메뉴, 사원 그리드 검색, 기존 근태 월마감과 급여 조회를 확인한다. 모니터링에는 배포 시각, 릴리스 SHA, 검사 성공 여부만 남긴다.

## 6. 중단과 롤백

후보 승격 전에 실패하면 기존 서비스 상태부터 확인한다. 승격 도중의 실패는 워크플로에서 이전 이미지 복구를 시도하므로 완료될 때까지 수동 Compose 명령을 겹쳐 실행하지 않는다. 성공 후에도 로그인, 권한, 데이터나 급여 결과에 문제가 있으면 쓰기를 중지하고 원인을 확인한다.

아래는 **이번 전환처럼 스키마가 같고, 기존 Spring이 새로 저장된 데이터와 호환됨을 확인한 경우**의 사후 롤백이다. 같은 셸이 아니면 `LIVE=/root/.openclaw/workspace/vibe-hr`와 1단계에서 기록한 `EVIDENCE` 경로를 다시 지정한다. 승인된 작업 창에서 실행한다.

```bash
cd "$LIVE"
OLD_SHA=$(cat "$EVIDENCE/previous.sha")
RELEASE_SHA=$(cat "$EVIDENCE/verified-candidate.sha")
PROJECT=$(cat "$EVIDENCE/compose-project")
id=$(docker inspect -f '{{.Image}}' vibehr-backend-rust)
test "$(docker image inspect -f '{{index .Config.Labels "org.opencontainers.image.revision"}}' "$id")" = "$RELEASE_SHA"
git diff --exit-code "$OLD_SHA" "$RELEASE_SHA" -- backend-spring/src/main/resources/db/migration
docker compose --project-directory "$LIVE" -p "$PROJECT" \
  --env-file "$LIVE/.env.deploy" --env-file "$LIVE/.env.deploy.secret" \
  -f "$EVIDENCE/previous.compose.yml" -f "$EVIDENCE/rollback.override.yml" \
  up -d --no-build --pull never --no-deps --force-recreate backend frontend
curl --retry 30 --retry-all-errors --retry-delay 2 -fsS http://127.0.0.1:8080/actuator/health/readiness | jq -e '.status=="UP"'
curl -fsS http://127.0.0.1:8080/openapi.json | jq -e '.openapi=="3.1.0"'
curl -fsS https://hr.minseok91.cloud/api/auth/enter-cds | jq -e '.corporations | type=="array"'
```

기존 운영 세션으로 조회가 가능한지 확인하고 장애 시각과 복구 SHA를 기록한다. 이미지 롤백은 이미 커밋된 업무 데이터를 되돌리지 않는다. DB 시점 복구가 필요하면 쓰기를 중단한 상태에서 별도의 복구 판단을 한다.
