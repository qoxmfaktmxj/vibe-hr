## 언어
- 모든 응답은 한국어로 작성.
- IT 용어는 필요하면 영문 병기 가능.

## 작업 원칙
- 필요한 범위만 수정하고, 요청과 무관한 정리는 하지 않는다.
- 가정이 크거나 해석이 갈리면 먼저 드러내고 확인한다.
- cleanup/refactor 성격 작업은 수정 전에 간단한 계획과 검증 기준을 먼저 잡는다.
- 새 의존성은 명시 요청 없이는 추가하지 않는다.

## AG Grid 필수 규칙
- AG Grid 화면 수정 전 아래 순서를 반드시 읽을 것:
  1. `config/grid-screens.json`
  2. `docs/GRID_SCREEN_STANDARD.md`
  3. `docs/AG_GRID_COMMON_GUIDE.md`
  4. 대상 화면 page/component 파일
- `AgGridReact` 사용 화면은 예외 없이 다음을 준수:
  - `frontend/src/components/grid/*`, `frontend/src/lib/grid/*` 공통 모듈 사용
  - 표준 toolbar 순서 유지: `query -> create -> copy -> template -> upload -> save -> download`
  - page 파일에 `GRID_SCREEN` 메타데이터 선언
  - `config/grid-screens.json` 등록/갱신
  - `npm run validate:grid`를 lint/build 전에 실행

## 프로젝트 실행 규칙
- 프론트엔드는 `frontend/*`, 실행 백엔드는 `backend-rust/*`에서 작업한다. `backend-spring/*`에는 비교용 Spring 구현과 Flyway SQL을 유지한다. 두 계층을 함께 바꾸면 공유 계약을 명시한다.
- API 계약 변경 시 영향받는 frontend 화면과 backend schema/service를 함께 언급한다.
- 공유 UI 또는 AG Grid 변경 시 기존 화면 최소 1개 이상 회귀 확인을 포함한다.
- 메뉴/액션/권한 관련 변경은 `docs/MENU_ACTION_PERMISSION_PLAN.md`와 교차 확인한다.
- 큰 리팩터링은 화면, endpoint, 도메인 단위로 잘라서 진행한다.

## 위험도
- `R0`: 문서/비실행/저위험 변경
- `R1`: 로컬 저위험 코드 변경. 검증 필수
- `R2`: 공통 계약, CI, 권한 흐름, 공유 Grid 규칙 변경. 사전 승인 필요
- `R3`: 인증/인가, 급여 의미, DB schema/migration, 배포/infra, secret. 명시 승인 필요

## 민감 경로
- `frontend/src/components/grid/**`
- `frontend/src/lib/grid/**`
- `config/grid-screens.json`
- `backend-rust/src/security/**`, `backend-rust/src/payroll/**`, `backend-rust/src/menu.rs`, `backend-rust/src/menu/**`, `backend-rust/src/db/**`, `backend-rust/Dockerfile`
- `backend-spring/src/main/java/com/vibehr/auth/**`
- `backend-spring/src/main/java/com/vibehr/payroll/**`
- `backend-spring/src/main/java/com/vibehr/menu/**`
- `backend-spring/src/main/java/com/vibehr/platform/security/**`
- `backend-spring/src/main/resources/db/migration/**`
- `backend-spring/src/test/java/com/vibehr/auth/**`
- `backend-spring/src/test/java/com/vibehr/payroll/**`
- `backend-spring/src/test/java/com/vibehr/menu/**`
- `backend-spring/Dockerfile`
- `.github/workflows/**`
- `docker-compose.deploy.yml`

## 검증
- AG Grid 화면: `npm run validate:grid`
- Frontend 변경: 필요 시 `cd frontend && npm run lint`
- Rust 백엔드를 변경하면 `backend-rust`에서 `cargo fmt --all -- --check`, `cargo clippy --locked --all-targets -- -D warnings`, `cargo test --locked`를 실행한다. 변경과 관련된 PostgreSQL, BFF 동작도 검증한다.
- 이관 전후 동작과 롤백은 `scripts/ci/verify-rust.sh`로 확인한다. Spring 비교 구현의 변경은 관련 Gradle 테스트로 검증한다.
- 검증을 못 돌리면 이유를 최종 보고에 명시

## 최종 보고
- 변경 파일
- 검증 결과
- 단순화한 내용
- 남은 위험 또는 미실행 검증
