# CLAUDE.md
## 역할
당신은 VIBE-HR 저장소에 투입된 Claude Code다.
이 저장소는 일반적인 CRUD 프로젝트가 아니라, **AG Grid 표준 화면 체계**, **메뉴/액션 권한 분리**, **배치 저장 순서 계약**, **시드 기반 업무 시나리오**가 강하게 묶여 있는 HR 시스템이다.
따라서 구현 전에 반드시 저장소 규칙을 먼저 해석하고, 변경을 작고 검증 가능하게 유지해야 한다.

---

## 1. 작업 시작 전 필수 읽기
항상 아래 순서로 읽는다.

1. `docs/DEVELOPMENT_PRECHECK.md`
2. `AGENTS.md`
3. `WORKFLOW.md`
4. `config/grid-screens.json`
5. `docs/GRID_SCREEN_STANDARD.md`
6. `docs/AG_GRID_COMMON_GUIDE.md`
7. `docs/MENU_ACTION_PERMISSION_PLAN.md`
8. 작업 대상 파일

작업 전에 위 문서를 읽지 않은 상태에서 코드를 수정하지 않는다.

---

## 2. 이 저장소에서 가장 중요한 규칙
### AG Grid 표준 화면 규칙
AG Grid 기반 화면을 수정/추가할 때는 아래를 반드시 지킨다.

- 페이지 파일에 `GRID_SCREEN` 메타데이터를 선언한다.
- `config/grid-screens.json`에 registry를 등록/갱신한다.
- 공통 grid 모듈(`frontend/src/components/grid/*`, `frontend/src/lib/grid/*`)을 우선 사용한다.
- toolbar 순서는 반드시 유지한다.
- dirty-row 보호를 유지한다.
- row 상태 계약을 유지한다.
- `npm run validate:grid`를 실행한다.

### toolbar 순서
`query -> create -> copy -> template -> upload -> save -> download`

### row 상태 계약
- `_status`
- `_original`
- `_prevStatus`

---

## 3. 금지사항
다음을 하지 않는다.

1. 화면별 독자 toolbar를 새로 만들지 말 것
2. 화면별 독자 pagination/dirty-warning/status-style 로직을 만들지 말 것
3. `grid-screens.json` 등록 없이 AG Grid 화면을 추가/수정 완료로 간주하지 말 것
4. 권한을 UI 숨김만으로 처리하지 말 것
5. 서버 액션 권한 검증 없이 프론트 버튼만 수정하지 말 것
6. 저장 순서 `DELETE -> UPDATE -> INSERT`를 깨지 말 것
7. `ENTER_CD`가 포함된 로그인 구조를 무시하지 말 것
8. 프론트/백엔드 계약 변경 후 한쪽만 수정하지 말 것
9. 공통 모듈 확장으로 해결할 문제를 화면별 임시 코드로 우회하지 말 것
10. 관련 문서 갱신이 필요한데 코드만 수정하고 끝내지 말 것

---

## 4. 작업 수행 원칙
### 원칙 A. 먼저 구조를 찾고, 그다음 수정한다
작업 시작 시 먼저 아래를 식별한다.
- 대상 화면/기능의 registryKey
- 관련 page 파일
- 관련 manager/component 파일
- 관련 shared grid module
- 관련 route handler / server util
- 관련 backend router/schema/service/model
- 관련 docs/TODO

### 원칙 B. 변경 범위를 좁게 유지한다
- 큰 리팩터링보다 작은 단위 변경을 선호한다.
- 기능 추가 중 공통 규칙이 필요하면 shared module을 최소 확장한다.
- unrelated 파일은 건드리지 않는다.

### 원칙 C. 권한과 저장 흐름을 같이 본다
UI가 맞아 보여도 아래가 틀리면 실패다.
- 메뉴/액션 권한
- 서버 검증
- 저장 순서
- dirty-row 보호
- 페이지네이션 응답 형식

### 원칙 D. 시드와 진행 상태를 고려한다
이 프로젝트는 도메인 완성도가 균일하지 않다.
대상 기능이 “이미 돌아가는 영역”인지 “부분 구현 영역”인지 먼저 파악한 뒤 설계한다.

---

## 5. 인증/세션 이해
- 루트(`/`)는 토큰 쿠키를 보고 `/login` 또는 `/dashboard`로 이동한다.
- `frontend/src/proxy.ts`는 인증 보호, redirect, refresh를 담당하는 핵심 계층이다.
- 로그인은 `ENTER_CD + login_id + password` 기반이다.
- dev 계정 정보가 있어도 활성 회사 정보가 맞지 않으면 로그인 실패가 가능하다.
- auth 수정 시 프론트 route handler와 백엔드 auth API를 함께 확인한다.

---

## 6. 프론트-백엔드 계약 규칙
프론트 수정 시 아래 중 하나라도 연관되면 같이 확인한다.
- `frontend/src/lib/server/backend-client.ts`
- `frontend/src/lib/server/route-proxy.ts`
- `frontend/src/app/api/**`
- `backend-rust/src/lib.rs`와 해당 도메인 모듈의 axum 핸들러, Serde 입력, SQLx 쿼리
- `backend-rust/resources/openapi.json`

API shape를 바꾸면:
1. 프론트 호출부
2. route proxy
3. backend schema
4. backend service
5. 필요 문서
를 함께 정합시킨다.

---

## 7. AG Grid 화면 작업 절차
AG Grid 화면 작업은 아래 순서를 따른다.

1. `config/grid-screens.json`에서 대상 screen registry 확인
2. page 파일의 `GRID_SCREEN` 메타데이터 확인
3. manager/component에서 shared module 사용 여부 확인
4. toolbar/action code가 표준과 일치하는지 확인
5. dirty-row 보호와 status contract 확인
6. list API의 `page`, `limit`, `all`, `total_count` 형식 확인
7. 저장 API의 처리 순서 확인
8. 권한 검증 확인
9. 검증 명령 실행
10. 필요한 문서 갱신

---

## 8. 메뉴/액션 권한 규칙
표준 액션 코드:
- `query`
- `create`
- `copy`
- `template_download`
- `upload`
- `save`
- `download`

규칙:
- 메뉴 진입 권한과 화면 액션 권한을 분리해서 생각한다.
- allowedActions가 있더라도 서버 검증이 없으면 불완전하다.
- 권한 관련 작업 시 `docs/MENU_ACTION_PERMISSION_PLAN.md`를 먼저 다시 읽는다.

---

## 9. 저장/정합성 규칙
배치 저장 처리 시 기본 순서는 반드시 다음을 따른다.

`DELETE -> UPDATE -> INSERT`

또한 row 상태 값은 공통 status 유틸과 일치해야 한다.
개별 화면에서 독자 상태 체계를 만들지 않는다.

---

## 10. 완료 판정 기준
다음 조건을 충족해야 “완료”로 본다.

### 공통
- 변경 이유와 영향 범위를 설명할 수 있다.
- 관련 파일이 왜 수정되었는지 정리되어 있다.

### AG Grid 화면 관련
- `GRID_SCREEN` / registry / shared module 사용이 맞다.
- toolbar 순서가 맞다.
- dirty-row 보호가 유지된다.
- row status 계약이 유지된다.
- `npm run validate:grid` 통과

### 프론트
- `npm run lint` 통과
- 필요 시 `npm run test`
- 필요 시 `npm run build`

### 백엔드
- 변경한 Rust 도메인의 Cargo 테스트와 [DB 검증 조건](TEST_STRATEGY.md)
- 필요 시 로컬 기동 검증

### 기능 검증
- 브라우저 기준으로 한국어 UI/정렬/버튼 상태/저장 경고/권한 반영을 확인한다.

---

## 11. 응답 형식 규칙
작업 결과를 보고할 때 아래 형식을 따른다.

### 1) 변경 요약
- 무엇을 바꿨는지
- 왜 바꿨는지

### 2) 영향 범위
- page/component
- shared module
- backend router/schema/service
- docs

### 3) 규칙 점검
- AG Grid 표준 준수 여부
- 권한 검증 여부
- 저장 순서 영향 여부
- dirty-row/status 영향 여부

### 4) 검증
- 실행한 명령
- 수동 확인한 시나리오

### 5) 남은 리스크
- 진행 문서상 아직 열린 영역인지
- 후속 작업이 필요한지

---

## 12. 작업 요청을 받았을 때 먼저 출력해야 할 체크포인트
새 요청을 받으면 구현 전에 내부적으로 아래를 먼저 정리한다.

- 이 작업은 어느 도메인인가?
- AG Grid 표준 화면인가?
- 관련 registryKey는 무엇인가?
- shared module 재사용 대상은 무엇인가?
- 권한/저장 순서/dirty-row에 영향이 있는가?
- 이 기능은 현재 안정 영역인가, 미완료 영역인가?
- 어떤 검증 명령이 필요한가?

이 체크 없이 바로 코드를 수정하지 않는다.
