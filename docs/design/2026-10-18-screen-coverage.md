# VIBE-HR 전체 경로별 확인 목록

기준: 2026-10-18 / 소스 9b4ab8fc8bbb62f6fcfd3d7dfa0b3a013095c62f

91개 경로 정적 대조와 86개 업무 첫 화면 브라우저 관찰. 다음 표는 UI와 구조의 조사 기록이며 기능 테스트 통과표가 아니다. 초기 로딩이 남은 화면은 데이터 완료 상태 미검증으로 표시했다.

| 경로 | 구성 | 등록 유형 | 확인 상태 | 개선 포인트 |
| --- | --- | --- | --- | --- |
| `/` | 진입 분기 | - | 소스 확인 | 공통 토큰과 화면 유형에 맞춰 개편 |
| `/dashboard` | 전용 UI | - | 첫 화면 관찰 | 업무 우선순위와 보조 정보 비중 재편 |
| `/hr/admin/appointments` | 리다이렉트 | - | 소스 확인 | 공통 토큰과 화면 유형에 맞춰 개편 |
| `/hr/admin/careers` | AG Grid | crud | 첫 화면 관찰 / 데이터 완료 상태 미검증 | 공통 토큰과 화면 유형에 맞춰 개편 |
| `/hr/admin/certificates` | AG Grid | crud | 첫 화면 관찰 / 데이터 완료 상태 미검증 | 공통 토큰과 화면 유형에 맞춰 개편 |
| `/hr/admin/contacts` | AG Grid | crud | 첫 화면 관찰 / 데이터 완료 상태 미검증 | 공통 토큰과 화면 유형에 맞춰 개편 |
| `/hr/admin/educations` | AG Grid | crud | 첫 화면 관찰 / 데이터 완료 상태 미검증 | 공통 토큰과 화면 유형에 맞춰 개편 |
| `/hr/admin/evaluations` | AG Grid | crud | 첫 화면 관찰 / 데이터 완료 상태 미검증 | 공통 토큰과 화면 유형에 맞춰 개편 |
| `/hr/admin/military` | AG Grid | crud | 첫 화면 관찰 / 데이터 완료 상태 미검증 | 공통 토큰과 화면 유형에 맞춰 개편 |
| `/hr/admin/rewards` | AG Grid | crud | 첫 화면 관찰 / 데이터 완료 상태 미검증 | 공통 토큰과 화면 유형에 맞춰 개편 |
| `/hr/appointment/codes` | AG Grid | crud | 첫 화면 관찰 | 공통 토큰과 화면 유형에 맞춰 개편; 공통 페이지 컨트롤 미렌더 후보 |
| `/hr/appointment/records` | AG Grid | workflow | 첫 화면 관찰 | 공통 토큰과 화면 유형에 맞춰 개편; 공통 페이지 컨트롤 미렌더 후보 |
| `/hr/basic` | HTML 표 포함 | - | 첫 화면 관찰 | 단일 값 카드 반복, 이력 HTML 표 |
| `/hr/employee` | AG Grid | crud | 첫 화면 관찰 | 도구 순서와 모바일 상단 밀도 우선 |
| `/hr/recruit/finalists` | AG Grid | workflow | 첫 화면 관찰 | 공통 토큰과 화면 유형에 맞춰 개편 |
| `/hr/retire` | 전용 UI | - | 첫 화면 관찰 | 공통 토큰과 화면 유형에 맞춰 개편 |
| `/hr/retire/approvals` | AG Grid | approval | 첫 화면 관찰 | 공통 토큰과 화면 유형에 맞춰 개편 |
| `/hr/retire/checklist` | AG Grid | workflow | 첫 화면 관찰 | 공통 토큰과 화면 유형에 맞춰 개편 |
| `/hr/severance/calcs` | AG Grid | workflow | 첫 화면 관찰 | 공통 토큰과 화면 유형에 맞춰 개편 |
| `/hri/admin/approval-lines` | HTML 표 포함 | - | 첫 화면 관찰 | HTML 목록과 단계 폼 분리 후보 |
| `/hri/admin/form-types` | HTML 표 포함 | - | 첫 화면 관찰 | HTML 관리 목록, 공통 그리드 전환 후보 |
| `/hri/my-payslip` | HTML 표 포함 | - | 첫 화면 관찰 | 문서형 상세, 비그리드 허용 후보 |
| `/hri/requests/mine` | AG Grid | workflow | 첫 화면 관찰 | 공통 도구 이름 참조, 별도 버튼 사용; 공통 페이지 컨트롤 미렌더 후보 |
| `/hri/tasks/approvals` | AG Grid | approval | 첫 화면 관찰 | 공통 토큰과 화면 유형에 맞춰 개편 |
| `/hri/tasks/receives` | AG Grid | approval | 첫 화면 관찰 | 공통 토큰과 화면 유형에 맞춰 개편 |
| `/login` | 전용 UI | - | 소스 확인 | 공통 토큰과 화면 유형에 맞춰 개편 |
| `/mng/companies` | AG Grid | crud | 첫 화면 관찰 | 공통 토큰과 화면 유형에 맞춰 개편; 공통 페이지 컨트롤 미렌더 후보 |
| `/mng/dev-inquiries` | AG Grid | readonly | 첫 화면 관찰 | 공통 토큰과 화면 유형에 맞춰 개편 |
| `/mng/dev-projects` | AG Grid | readonly | 첫 화면 관찰 | 공통 토큰과 화면 유형에 맞춰 개편 |
| `/mng/dev-requests` | AG Grid | readonly | 첫 화면 관찰 | 공통 토큰과 화면 유형에 맞춰 개편 |
| `/mng/dev-staff` | AG Grid | readonly | 첫 화면 관찰 | 공통 토큰과 화면 유형에 맞춰 개편 |
| `/mng/infra` | AG Grid | readonly | 첫 화면 관찰 | 공통 토큰과 화면 유형에 맞춰 개편 |
| `/mng/manager-status` | AG Grid | readonly | 첫 화면 관찰 | 공통 토큰과 화면 유형에 맞춰 개편 |
| `/mng/outsource-attendance` | AG Grid | readonly | 첫 화면 관찰 | 공통 토큰과 화면 유형에 맞춰 개편 |
| `/mng/outsource-contracts` | AG Grid | readonly | 첫 화면 관찰 | 공통 토큰과 화면 유형에 맞춰 개편 |
| `/org/chart` | 전용 UI | - | 첫 화면 관찰 | 조직 트리 유지 |
| `/org/corporations` | AG Grid | crud | 첫 화면 관찰 | 공통 토큰과 화면 유형에 맞춰 개편 |
| `/org/departments` | AG Grid | crud | 첫 화면 관찰 | 공통 토큰과 화면 유형에 맞춰 개편 |
| `/org/dept-history` | AG Grid | readonly | 첫 화면 관찰 | 공통 토큰과 화면 유형에 맞춰 개편; 공통 페이지 컨트롤 미렌더 후보 |
| `/org/restructure` | AG Grid | workflow | 첫 화면 관찰 | 공통 검색/그리드/도구 이름만 참조하는 편차; 공통 페이지 컨트롤 미렌더 후보 |
| `/org/type-items` | AG Grid | crud | 첫 화면 관찰 | 공통 토큰과 화면 유형에 맞춰 개편 |
| `/org/type-personal-status` | AG Grid | readonly | 첫 화면 관찰 / 데이터 완료 상태 미검증 | 공통 토큰과 화면 유형에 맞춰 개편 |
| `/org/type-upload` | AG Grid | workflow | 첫 화면 관찰 | 공통 토큰과 화면 유형에 맞춰 개편 |
| `/org/types` | AG Grid | crud | 첫 화면 관찰 | 공통 토큰과 화면 유형에 맞춰 개편 |
| `/pap/appraisals` | AG Grid | crud | 첫 화면 관찰 | 공통 토큰과 화면 유형에 맞춰 개편 |
| `/pap/final-results` | AG Grid | crud | 첫 화면 관찰 | 공통 토큰과 화면 유형에 맞춰 개편 |
| `/pap/targets` | AG Grid | crud | 첫 화면 관찰 | 공통 토큰과 화면 유형에 맞춰 개편 |
| `/payroll/allowance-deduction-items` | AG Grid | crud | 첫 화면 관찰 | 공통 토큰과 화면 유형에 맞춰 개편 |
| `/payroll/codes` | AG Grid | crud | 첫 화면 관찰 | 공통 토큰과 화면 유형에 맞춰 개편 |
| `/payroll/employee-profiles` | AG Grid | crud | 첫 화면 관찰 / 데이터 완료 상태 미검증 | 공통 토큰과 화면 유형에 맞춰 개편 |
| `/payroll/gl-accounts` | AG Grid | crud | 첫 화면 관찰 | 공통 토큰과 화면 유형에 맞춰 개편 |
| `/payroll/gl-mappings` | AG Grid | crud | 첫 화면 관찰 | 공통 토큰과 화면 유형에 맞춰 개편 |
| `/payroll/income-tax-brackets` | AG Grid | crud | 첫 화면 관찰 | 공통 토큰과 화면 유형에 맞춰 개편 |
| `/payroll/item-groups` | AG Grid | crud | 첫 화면 관찰 | 공통 토큰과 화면 유형에 맞춰 개편 |
| `/payroll/payment-schedules` | AG Grid | crud | 첫 화면 관찰 / 데이터 완료 상태 미검증 | 공통 토큰과 화면 유형에 맞춰 개편 |
| `/payroll/runs` | AG Grid | workflow | 첫 화면 관찰 | 공통 토큰과 화면 유형에 맞춰 개편 |
| `/payroll/severance-item-rules` | AG Grid | crud | 첫 화면 관찰 | 공통 토큰과 화면 유형에 맞춰 개편 |
| `/payroll/tax-rates` | AG Grid | crud | 첫 화면 관찰 | 공통 토큰과 화면 유형에 맞춰 개편 |
| `/payroll/variable-inputs` | AG Grid | crud | 첫 화면 관찰 | 공통 토큰과 화면 유형에 맞춰 개편 |
| `/payroll/vouchers` | AG Grid | workflow | 첫 화면 관찰 | 공통 토큰과 화면 유형에 맞춰 개편 |
| `/settings/common-codes` | AG Grid | crud | 첫 화면 관찰 | 공통 토큰과 화면 유형에 맞춰 개편 |
| `/settings/icons` | 전용 UI | - | 첫 화면 관찰 | 공통 토큰과 화면 유형에 맞춰 개편 |
| `/settings/menus` | 전용 UI | - | 첫 화면 관찰 | 메뉴 트리와 상세 유지 |
| `/settings/permissions` | HTML 표 포함 | - | 첫 화면 관찰 | 목적에 맞는 매트릭스, 비그리드 허용 후보 |
| `/settings/roles` | 전용 UI | - | 첫 화면 관찰 | 공통 토큰과 화면 유형에 맞춰 개편 |
| `/settings/system` | 전용 UI | - | 첫 화면 관찰 | 공통 토큰과 화면 유형에 맞춰 개편 |
| `/settings/users` | 전용 UI | - | 첫 화면 관찰 | 준비 문구만 있는 화면 |
| `/tim/annual-leave` | AG Grid | readonly | 첫 화면 관찰 | 공통 토큰과 화면 유형에 맞춰 개편 |
| `/tim/check-in` | 전용 UI | - | 첫 화면 관찰 | 공통 토큰과 화면 유형에 맞춰 개편 |
| `/tim/codes` | AG Grid | crud | 첫 화면 관찰 | 공통 토큰과 화면 유형에 맞춰 개편 |
| `/tim/correction` | 전용 UI | - | 첫 화면 관찰 | 공통 토큰과 화면 유형에 맞춰 개편 |
| `/tim/holidays` | AG Grid | crud | 첫 화면 관찰 | 공통 토큰과 화면 유형에 맞춰 개편 |
| `/tim/leave-approval` | AG Grid | approval | 첫 화면 관찰 / 데이터 완료 상태 미검증 | 공통 토큰과 화면 유형에 맞춰 개편 |
| `/tim/leave-request` | HTML 표 포함 | - | 첫 화면 관찰 | 공통 토큰과 화면 유형에 맞춰 개편 |
| `/tim/month-close` | HTML 표 포함 | crud | 첫 화면 관찰 | custom 등록 예외, 월 상태표 |
| `/tim/month-closing` | HTML 표 포함 | - | 소스 확인 | 월마감 중복 경로, 동일 컴포넌트 |
| `/tim/reports` | AG Grid | readonly | 첫 화면 관찰 | 공통 토큰과 화면 유형에 맞춰 개편; 공통 페이지 컨트롤 미렌더 후보 |
| `/tim/status` | AG Grid | readonly | 첫 화면 관찰 | 공통 토큰과 화면 유형에 맞춰 개편 |
| `/tim/work-codes` | AG Grid | crud | 첫 화면 관찰 | AG Grid와 HTML 표 2개 혼합, 구도 재편 우선 |
| `/tra/applications` | AG Grid | approval | 첫 화면 관찰 / 데이터 완료 상태 미검증 | 공통 토큰과 화면 유형에 맞춰 개편; 공통 페이지 컨트롤 미렌더 후보 |
| `/tra/course-events` | AG Grid | crud | 첫 화면 관찰 | 공통 토큰과 화면 유형에 맞춰 개편; 공통 페이지 컨트롤 미렌더 후보 |
| `/tra/cyber-upload` | AG Grid | crud | 첫 화면 관찰 / 데이터 완료 상태 미검증 | 공통 토큰과 화면 유형에 맞춰 개편; 공통 페이지 컨트롤 미렌더 후보 |
| `/tra/elearning-windows` | AG Grid | crud | 첫 화면 관찰 | 공통 토큰과 화면 유형에 맞춰 개편; 공통 페이지 컨트롤 미렌더 후보 |
| `/tra/histories` | AG Grid | crud | 첫 화면 관찰 / 데이터 완료 상태 미검증 | 공통 토큰과 화면 유형에 맞춰 개편; 공통 페이지 컨트롤 미렌더 후보 |
| `/tra/my-applications` | AG Grid | workflow | 첫 화면 관찰 | 공통 토큰과 화면 유형에 맞춰 개편; 공통 페이지 컨트롤 미렌더 후보 |
| `/tra/required-standards` | AG Grid | crud | 첫 화면 관찰 | 공통 토큰과 화면 유형에 맞춰 개편; 공통 페이지 컨트롤 미렌더 후보 |
| `/tra/required-targets` | AG Grid | crud | 첫 화면 관찰 / 데이터 완료 상태 미검증 | 공통 토큰과 화면 유형에 맞춰 개편; 공통 페이지 컨트롤 미렌더 후보 |
| `/unauthorized` | 전용 UI | - | 소스 확인 | 공통 토큰과 화면 유형에 맞춰 개편 |
| `/wel/benefit-types` | AG Grid | readonly | 첫 화면 관찰 | 공통 토큰과 화면 유형에 맞춰 개편 |
| `/wel/my-requests` | AG Grid | workflow | 첫 화면 관찰 | 공통 토큰과 화면 유형에 맞춰 개편 |
| `/wel/requests` | AG Grid | approval | 첫 화면 관찰 | 상태 열 HTML 문자열 노출 재현 |

## 공통 페이지 이동 컨트롤 미렌더 후보 15개

JSX import 연결에서 GridPaginationControls가 실제 사용되지 않은 후보다. 단일 페이지/별도 목록의 의도적 예외 여부는 명시적으로 결정해야 하며, 이 결과만으로 서버 페이징 부재를 뜻하지는 않는다.

- `/hr/appointment/codes`
- `/hr/appointment/records`
- `/hri/requests/mine`
- `/mng/companies`
- `/org/dept-history`
- `/org/restructure`
- `/tim/reports`
- `/tra/applications`
- `/tra/course-events`
- `/tra/cyber-upload`
- `/tra/elearning-windows`
- `/tra/histories`
- `/tra/my-applications`
- `/tra/required-standards`
- `/tra/required-targets`
