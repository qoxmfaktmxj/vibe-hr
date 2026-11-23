# Vibe-HR Rust 백엔드

`vibehr-backend`는 axum/Tokio로 HTTP 요청을 받고 SQLx로 PostgreSQL을 사용합니다. 서버 진입점은 [main.rs](src/main.rs), 도메인 라우터 조립은 [lib.rs](src/lib.rs)에 있습니다.

| 변경 대상 | 코드 |
| --- | --- |
| 로그인, BFF 서명, 메뉴 권한 | [security](src/security), [menu.rs](src/menu.rs) |
| 조직, 인사 | [organization](src/organization), [hr](src/hr) |
| 근태, 급여, 결재 | [time](src/time), [payroll](src/payroll), [hri](src/hri) |
| 스키마 검사, 개발용 시드 | [db](src/db), [버전별 Flyway SQL](../backend-spring/src/main/resources/db/migration) |

## 로컬 실행

[저장소 실행 절차](../README.md#로컬-실행-방법)에 따라 DB 연결과 서로 다른 JWT/BFF 서명 키를 설정합니다. 새 DB는 `schema-preflight`, Flyway `migrate`, `schema-verify` 순서로 준비합니다. 준비가 끝난 DB에서 이 디렉터리를 기준으로 실행합니다.

```powershell
cargo run --locked
```

기본 주소는 `http://127.0.0.1:8080`입니다. `/health`에서 프로세스 상태를, `/api/v1/health`에서 DB 상태를 확인합니다. API 명세는 `/openapi.json`에서 조회합니다.

## 변경 검증

```powershell
cargo fmt --all -- --check
cargo clippy --locked --all-targets -- -D warnings
cargo test --locked
```

PostgreSQL을 사용하는 `#[ignore]` 테스트에는 격리된 DB와 도메인별 fixture가 필요합니다. [테스트 전략](../docs/TEST_STRATEGY.md)은 개별 실행 조건을, [이관 검증 스크립트](../scripts/ci/verify-rust.sh)는 Spring 비교와 Rust 단독 검증 절차를 담고 있습니다.
