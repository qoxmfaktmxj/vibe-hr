Status: Draft
Owner: 석
Canonical: Yes
Source of Truth: This file
Last Verified: 2026-03-22
Confidence: Medium

# SKILLS_INDEX.md

## 목적
Vibe-HR에서 상황별로 주입할 skill/working pattern의 목록과 적용 조건을 정의한다.

## 기본 원칙
- skill은 큰 백과사전이 아니라 상황별 규칙 패키지다.
- path / task / risk / event 기반으로 호출한다.
- 적용 시 반드시 관련 검증과 연결한다.
- grid는 사원관리 화면 패턴을 우선 참고한다.
- 단기 우선순위는 grid 정교화보다 workflow 기능 완성이다.

## 추천 skill 목록
| Skill | 목적 | 호출 조건 | 관련 문서 | 관련 테스트 |
|---|---|---|---|---|
| `employee-grid-reference` | 사원관리 grid 패턴 참조 | grid/toolbar/editor/action 구현 시 | `docs/GRID_SCREEN_STANDARD.md`, `docs/employee-grid-standard.md` | grid/manual checks |
| `permission-change` | 메뉴/액션 권한 작업 보호 | 메뉴 권한, 액션 권한, role matrix 변경 | `docs/MENU_ACTION_PERMISSION_PLAN.md`, `docs/GOVERNANCE.md` | permission tests |
| `workflow-gap-check` | workflow 1~10 기준 누락 화면/API/데이터 찾기 | cron/analysis/manual planning | `docs/ARCHITECTURE.md`, `docs/HARNESS_STATUS.md` | browser/manual review |
| `deploy-safety` | 수동 배포 전 점검 | workflow_dispatch, docker compose deploy, runtime fix | `docs/GOVERNANCE.md`, `docs/OBSERVABILITY.md` | health/deploy checks |
| `legacy-regression` | 기존 화면/동작 보호 | legacy hotspot 수정 시 | `docs/TEST_STRATEGY.md`, `docs/TASK_LEDGER.md` | regression/manual checks |

## 자동화/cron 관련 원칙
- cron은 R0/R1만 자동 수행
- 새 화면 추가 시 DB 메뉴/권한/seed까지 확인
- browser 도구를 써서 실제 진입/동작을 확인할 수 있으면 우선 검증한다

## 추가 예정 skill
- `payroll-target-selection`
- `appointment-to-employee-flow`
- `attendance-close-smoke`
