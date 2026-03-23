# AG Grid CRUD 기능 전수 점검 결과

> 2026-03-23 실시. 63개 AG Grid 화면 대상.

## 요약

| 구분 | 화면 수 | 비율 |
|------|:---:|:---:|
| ✅ 전체 CRUD 완성 | 25 | 40% |
| 📖 읽기전용 (정상) | 19 | 30% |
| ⚠️ 부분 구현 | 9 | 14% |
| 🔧 워크플로우 (예외) | 3 | 5% |
| 🎛️ 커스텀 엔진 | 1 | 2% |

## ✅ 전체 CRUD 완성 (25개)

8개 CRUD 작업(조회/입력/삭제/저장/복사/다운로드/양식/업로드) 모두 동작:

**HR**: careers, certificates, contacts, educations, evaluations, military, rewards, appointment-codes, appointment-records, employee, recruit-finalists
**MNG**: companies
**PAYROLL**: allowance-deduction-items, codes, item-groups, tax-rates
**TIM**: attendance-codes, holidays, work-schedules
**TRA**: course-events, cyber-upload, elearning-windows, histories, required-standards, required-targets

## 📖 읽기전용 화면 (19개)

조회 + 다운로드만 필요한 화면. toolbar을 `["query", "download"]`로 제한해야 함:

- hr.retire.checklist, tim.annual-leave, tim.attendance-status, tim.leave-approval, tim.reports
- hri.tasks.approvals, hri.tasks.receives
- mng.dev-inquiries, mng.dev-projects, mng.dev-requests, mng.dev-staff, mng.infra, mng.manager-status, mng.outsource-attendance, mng.outsource-contracts
- org.dept-history
- wel.benefit-types

## ⚠️ 부분 구현 (9개) — 추후 보완 필요

| 화면 | 누락 기능 | 우선순위 |
|------|----------|:---:|
| payroll.employee-profiles | copy | 낮음 |
| payroll.income-tax-brackets | template, upload | 낮음 |
| payroll.variable-inputs | copy, download, upload | 중간 |
| payroll.payment-schedules | create, copy, download, upload | 중간 |
| pap.targets | copy, download, template, upload | 중간 |
| org.restructure | query, save, copy, download, template, upload | 높음 |
| settings.common-codes | query, save (별도 패턴: 듀얼 그리드) | 낮음 |

## 🔧 워크플로우 예외 (3개)

표준 CRUD가 아닌 워크플로우 버튼 사용. 정상:

- **payroll.runs**: 계산→마감→지급 워크플로우
- **wel.requests**: 승인→반려 워크플로우
- **wel.my-requests**: 신청→회수 워크플로우

## 🎛️ 커스텀 엔진 (1개)

- **tim.month-close**: HTML 테이블 (AgGridReact 아님), engine: "custom"

## Config 정합성 이슈

19개 읽기전용 화면이 full toolbar 7개 버튼으로 등록되어 있으나 실제로는 query+download만 지원.
→ `config/grid-screens.json`에서 toolbar을 실제 지원 기능에 맞게 조정 필요.

## 향후 조치

1. 읽기전용 화면의 toolbar을 `["query", "download"]`으로 축소
2. 부분 구현 화면에 누락 기능 보완
3. `variant` 필드 활용: `"crud"` | `"readonly"` | `"approval"` | `"workflow"`
