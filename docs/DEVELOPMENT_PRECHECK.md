# VIBE-HR 개발 전 필독 규칙 (Living)

작성일: 2026-02-27  
적용: 프로젝트 참여 개발자/AI 에이전트 공통

## 0) 개발 시작 전 읽기 순서

1. `docs/DEVELOPMENT_PRECHECK.md` (이 문서)
2. `AGENTS.md`
3. `WORKFLOW.md`
4. `docs/MENU_ACTION_PERMISSION_PLAN.md`
5. 작업 대상 화면/컴포넌트/서비스 파일

AG Grid 화면 작업 시에는 아래 순서를 **반드시 고정**:
1. `config/grid-screens.json`
2. `docs/GRID_SCREEN_STANDARD.md`
3. `docs/AG_GRID_COMMON_GUIDE.md`
4. 대상 `page.tsx` + 컴포넌트

## 1) 공통 강제 규칙

- 권한은 UI 숨김으로 대체하지 않는다. 서버 API에서 액션별 권한 검증을 수행한다.
- 배치 저장 플로우는 `DELETE -> UPDATE -> INSERT` 순서를 유지한다.
- 문서/코드 불일치를 허용하지 않는다. 신규 화면/API/테이블 추가 시 관련 MD를 같은 커밋(또는 직후 커밋)에서 갱신한다.
- 병합 전 검증 게이트를 통과한다.
  - Frontend: `npm run lint`, `npm run build`
  - AG Grid 포함 작업: `npm run validate:grid` 추가

## 2) AG Grid 강제 규칙

`AgGridReact`를 사용하는 화면은 아래를 모두 만족해야 한다.

- 공통 모듈 사용:
  - `frontend/src/components/grid/*`
  - `frontend/src/lib/grid/*`
- 페이지 파일에 `GRID_SCREEN` 메타데이터 선언
- `config/grid-screens.json` 등록/갱신
- 툴바 순서 고정:
  - `query -> create -> copy -> template -> upload -> save -> download`
- 상태 필드 계약 유지:
  - `_status`, `_original`, `_prevStatus`
- 화면별 커스텀 툴바/상태전이/페이지네이션 로직 구현 금지
- legacy AG Grid 화면을 수정하면 같은 작업에서 standard-v2로 마이그레이션

## 3) 데이터/아키텍처 규칙

- 비즈니스 로직을 DB 프로시저/함수/트리거에 넣지 않는다. API/Service 계층에서 처리한다.
- 신규 테이블 네이밍은 `snake_case` + 도메인 prefix + 복수형 원칙을 사용한다.
- 레거시 `T*` 코드형 테이블명/숫자 suffix 관례를 신규 테이블에 재도입하지 않는다.
- 레거시 객체 이관 시 매핑 근거를 남긴다(`app_legacy_object_xref` 권장).

## 4) 모듈별 추가 규칙 (조건부)

- TIM/CPN/HRI 연계 반영은 `TIM -> CPN -> HRI` 순서를 우선한다.
- HR: `auth_users`와 `hr_employees.user_id` 1:1 무결성을 깨지 않는다.
- ORG: 부서 삭제/변경 시 타 모듈 FK 영향(직원/신청/스케줄) 검증을 포함한다.
- TIM: 스케줄 판정 우선순위(`개인예외 > 부서기본 > 회사기본`)와 연차 데이터 일관성을 유지한다.

## 5) 테스트 실행 기준 (조건부)

- 급여/보상 작업: `PAYROLL_TEST_GUIDE.md` 시나리오 수행
- HRI 작업: `HRI_TEST_SCENARIO.md` 필수 시나리오(특히 5.1~5.7)와 무결성 SQL 수행
- TIM 작업: `TIM_PHASE2_TEST.md`, `TIM_PHASE3_TEST.md` 체크리스트 기반 검증
- MNG 작업: `docs/MNG-DB-TEST-PLAN.md` 기준으로 DB/CRUD/정적검증 수행

## 6) 주기적 갱신 정책

이 문서는 고정 문서가 아니라 운영 규칙의 단일 진입점(Living 문서)이다.

- 즉시 갱신 트리거:
  - 신규 화면/신규 API/신규 테이블 추가
  - 권한 정책/툴바 정책/저장 순서 변경
  - 테스트 게이트/검증 명령 변경
- 정기 점검 주기:
  - 최소 주 1회(권장: 금요일) 문서 링크/규칙 유효성 점검
- 갱신 시 최소 기록:
  - 변경 목적
  - 영향 파일/모듈
  - 테스트 포인트

## 7) 원문 기준 문서

- `AGENTS.md`
- `README.md`
- `WORKFLOW.md`
- `docs/GRID_SCREEN_STANDARD.md`
- `docs/AG_GRID_COMMON_GUIDE.md`
- `docs/MENU_ACTION_PERMISSION_PLAN.md`
- `docs/EHR_TABLE_RENAMING_STANDARD.md`
- `docs/PAP_MODULE_RULES.md`
- `docs/modules/README.md` + `docs/modules/*.md`
- `PAYROLL_TEST_GUIDE.md`
- `HRI_TEST_SCENARIO.md`
- `TIM_PHASE2_TEST.md`
- `TIM_PHASE3_TEST.md`
- `docs/MNG-DB-TEST-PLAN.md`
