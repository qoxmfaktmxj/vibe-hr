# Vibe-Grid Lifecycle QA Plan

Date: 2026-07-08
Risk class: R0 document plan

## Decision

Design redesign is deferred.

Use `vibe-grid` first as a grid governance and lifecycle QA guard, not as a visual redesign vehicle. Any change to shared grid modules or `config/grid-screens.json` remains R2 and requires approval before implementation.

## Current Baseline

- Registered AG Grid screens: 60
- Validation command: `npm run validate:grid`
- Latest result: passed
- Standard docs:
  - `config/grid-screens.json`
  - `docs/GRID_SCREEN_STANDARD.md`
  - `docs/AG_GRID_COMMON_GUIDE.md`

## Lifecycle Screen Map

| Flow step | Primary grid screens | Notes |
| --- | --- | --- |
| 채용 | `hr.recruit.finalists` | finalist 생성, 사원화, IF sync 확인 대상 |
| 인사정보 등록 | `hr.employee`, `hr.admin.*` | 사원 기본정보와 부가정보 등록 확인 대상 |
| 조직 발령 | `hr.appointment.records`, `hr.appointment.codes`, `org.departments`, `org.restructure` | 발령 확정, 부서 이력, 조직개편 연계 확인 대상 |
| 근태 | `tim.work-schedules`, `tim.attendance-codes`, `tim.attendance-status`, `tim.annual-leave`, `tim.leave-approval`, `tim.reports`, `tim.month-close` | 스케줄, 출퇴근, 휴가, 월마감 확인 대상 |
| 복리후생 | `wel.my-requests`, `wel.requests`, `wel.benefit-types` | 신청, 승인/반려, 급여반영 상태 확인 대상 |
| 급여 | `payroll.employee-profiles`, `payroll.variable-inputs`, `payroll.runs`, `payroll.payment-schedules`, `payroll.codes` | 대상자 스냅샷, 계산, 마감, 지급 확인 대상 |
| 전표 | 없음 | voucher/GL 모듈 부재. R3 설계 승인 필요 |
| 퇴직 | `hr.retire.checklist`; `/hr/retire/approvals`는 비등록 커스텀 화면 | 체크리스트는 grid 검증 대상. 퇴직 승인 화면은 별도 QA 또는 AG Grid 등록 판단 필요 |

## How To Use Vibe-Grid Now

1. Baseline guard
   - 모든 AG Grid 관련 작업 전 `npm run validate:grid`를 먼저 실행한다.
   - 이후 `npm run lint`, `npm run build` 순서로 확인한다.

2. Lifecycle QA matrix
   - 위 화면 맵을 기준으로 Playwright/GStack 시나리오를 구성한다.
   - 각 단계는 "목록 조회 -> 더미 데이터 식별 -> 핵심 액션 -> 다음 단계 반영 확인"으로 고정한다.
   - 화면별 스크린샷을 `output/playwright/lifecycle-grid-*` 아래에 저장한다.

3. Dummy data policy
   - 가능한 한 프론트 API 또는 백엔드 API로 생성한다.
   - DB 직접 수정은 마이그레이션/복구 시나리오가 아니면 피한다.
   - 더미 데이터는 `2026-07-gridqa-*` 식별자를 붙여 재조회 가능하게 만든다.

4. R2 candidate backlog
   - `config/grid-screens.json`에 `variant` 필드 추가: `crud`, `readonly`, `workflow`, `custom`
   - 읽기전용 화면 toolbar를 실제 지원 액션인 `query`, `download` 중심으로 축소
   - `/hr/retire/approvals`를 AG Grid 등록 대상으로 볼지, 커스텀 예외로 둘지 결정
   - `VibeGrid` wrapper는 readonly 화면 1개로 파일럿 후 확장

5. Deferred design work
   - 시각 디자인 개편은 별도 결정 후 진행한다.
   - 그 전에는 shared grid contract, 화면별 데이터 흐름, dirty-row protection, toolbar 순서만 개선 대상으로 둔다.

## Suggested Next Execution Slice

Scope: QA only, no R2 code changes.

1. Run `npm run validate:grid`.
2. Start backend/frontend dev servers.
3. Use existing dummy data plus API-created `gridqa` records.
4. Browser-check these core screens:
   - `/hr/recruit/finalists`
   - `/hr/employee`
   - `/hr/appointment/records`
   - `/tim/status`
   - `/wel/requests`
   - `/payroll/runs`
   - `/hr/retire/checklist`
   - `/hr/retire/approvals`
5. Record gaps into `docs/TASK_LEDGER.md`.

## Definition Of Done

- `npm run validate:grid`: passed
- Core lifecycle screens render in browser
- At least one screenshot per flow segment exists
- Any R2/R3 gap is listed without modifying protected files
- Voucher/GL absence remains explicit until approved design work starts
