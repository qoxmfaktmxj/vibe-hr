# VIBE-HR 통합 신청 페이지 / 승인 페이지 크로스체크

## 1. 목적

- 목표: `신청 입력 페이지`는 통합하고, `운영/관리 화면`은 도메인별로 유지하는 방향으로 레거시 EHR과 현재 VIBE-HR을 교차 점검한다.
- 범위:
  - Legacy EHR 신청/승인 엔트리 포인트
  - Current VIBE-HR 공통 신청/결재 인프라
  - 현재 모듈별 신청/승인 화면
- 주의:
  - 아래 표의 `업무명`은 파일 경로/컨트롤러명으로 확인 가능한 수준까지만 적었다.
  - 컨트롤러명만으로 의미가 확정되지 않는 항목은 `미확인`으로 표기했다.

## 2. 근거 소스

### 2.1 Legacy EHR

- 공통 신청 허브
  - `C:\EHR_PROJECT\isu-hr\EHR_HR50\src\main\java\com\hr\ben\apply\benApplyUser\BenApplyUserController.java`
  - `C:\EHR_PROJECT\isu-hr\EHR_HR50\src\main\java\com\hr\hrm\apply\hrmApplyUser\HrmApplyUserController.java`
- 인사/공통
  - `C:\EHR_PROJECT\isu-hr\EHR_HR50\src\main\java\com\hr\hrm\certificate\certiApp\CertiAppController.java`
  - `C:\EHR_PROJECT\isu-hr\EHR_HR50\src\main\java\com\hr\hrm\certificate\certiApr\CertiAprController.java`
  - `C:\EHR_PROJECT\isu-hr\EHR_HR50\src\main\java\com\hr\hrm\retire\retireApp\RetireAppController.java`
  - `C:\EHR_PROJECT\isu-hr\EHR_HR50\src\main\java\com\hr\hrm\retire\retireApr\RetireAprController.java`
  - `C:\EHR_PROJECT\isu-hr\EHR_HR50\src\main\java\com\hr\hrm\other\hrQueryApp\HrQueryAppController.java`
  - `C:\EHR_PROJECT\isu-hr\EHR_HR50\src\main\java\com\hr\hrm\other\hrQueryApr\HrQueryAprController.java`
  - `C:\EHR_PROJECT\isu-hr\EHR_HR50\src\main\java\com\hr\hrm\timeOff\timeOffApp\TimeOffAppController.java`
  - `C:\EHR_PROJECT\isu-hr\EHR_HR50\src\main\java\com\hr\hrm\timeOff\timeOffApr\TimeOffAprController.java`
  - `C:\EHR_PROJECT\isu-hr\EHR_HR50\src\main\java\com\hr\hrm\dispatch\dispatchApr\DispatchAprController.java`
  - `C:\EHR_PROJECT\isu-hr\EHR_HR50\src\main\java\com\hr\hri\commonApproval\comApp\ComAppController.java`
  - `C:\EHR_PROJECT\isu-hr\EHR_HR50\src\main\java\com\hr\hri\commonApproval\comApr\ComAprController.java`
  - `C:\EHR_PROJECT\isu-hr\EHR_HR50\src\main\java\com\hr\hri\partMgr\partMgrApp\PartMgrAppController.java`
  - `C:\EHR_PROJECT\isu-hr\EHR_HR50\src\main\java\com\hr\hri\partMgr\partMgrApr\PartMgrAprController.java`
- 조직
  - `C:\EHR_PROJECT\isu-hr\EHR_HR50\src\main\java\com\hr\org\capacity\orgCapaPlanApp\OrgCapaPlanAppController.java`
  - `C:\EHR_PROJECT\isu-hr\EHR_HR50\src\main\java\com\hr\org\capacity\orgCapaPlanApr\OrgCapaPlanAprController.java`
  - `C:\EHR_PROJECT\isu-hr\EHR_HR50\src\main\java\com\hr\org\job\jobDivReportApp\JobDivReportAppController.java`
  - `C:\EHR_PROJECT\isu-hr\EHR_HR50\src\main\java\com\hr\org\job\jobDivReportApr\JobDivReportAprController.java`
  - `C:\EHR_PROJECT\isu-hr\EHR_HR50\src\main\java\com\hr\org\job\jobRegApp\JobRegAppController.java`
  - `C:\EHR_PROJECT\isu-hr\EHR_HR50\src\main\java\com\hr\org\job\jobRegApr\JobRegAprController.java`

### 2.2 Current VIBE-HR

- 공통 HRI 신청/결재 인프라
  - `backend/app/api/hri_request.py`
  - `backend/app/schemas/hri_request.py`
  - `backend/app/services/hri_request_service.py`
  - `backend/app/bootstrap.py`
  - `frontend/src/app/hri/requests/mine/page.tsx`
  - `frontend/src/app/hri/tasks/approvals/page.tsx`
  - `frontend/src/app/hri/tasks/receives/page.tsx`
  - `frontend/src/components/hri/hri-application-hub.tsx`
  - `frontend/src/components/hri/hri-approval-task-board.tsx`
  - `frontend/src/components/hri/hri-receive-task-board.tsx`
- 현재 모듈별 신청/운영 화면
  - `frontend/src/app/tim/leave-request/page.tsx`
  - `frontend/src/app/tim/leave-approval/page.tsx`
  - `frontend/src/components/tim/leave-request-manager.tsx`
  - `frontend/src/components/tim/leave-approval-manager.tsx`
  - `backend/app/api/tim_leave.py`
  - `frontend/src/app/wel/requests/page.tsx`
  - `backend/app/api/welfare.py`
  - `frontend/src/app/tra/applications/page.tsx`
  - `frontend/src/components/tra/tra-applications-manager.tsx`
  - `frontend/src/components/tra/tra-screen-configs.ts`
  - `backend/app/api/tra.py`
  - `frontend/src/app/hr/retire/approvals/page.tsx`
  - `backend/app/api/hr_retire.py`
  - `backend/app/api/pap_appraisal.py`

## 3. 현재 VIBE-HR 기준점

### 3.1 공통 신청/결재 엔진은 이미 있다

- `backend/app/api/hri_request.py`
  - 공통 draft/save, submit, withdraw, approve, reject, receive-complete, receive-reject API가 있다.
- `backend/app/schemas/hri_request.py`
  - 공통 request master, approval/receive task list, detail payload 구조가 있다.
- `frontend/src/components/hri/hri-application-hub.tsx`
  - 공통 신청 허브가 있고 `NewRequestDialog`에서 폼 타입 선택 후 `/api/hri/requests/draft` -> `/api/hri/requests/{id}/submit`으로 제출한다.
  - 현재 `FormEditView`/`FormDetailView`에서 명시적으로 다루는 form code는 `TIM_CORRECTION`, `CERT_EMPLOYMENT`, `LEAVE_REQUEST`다.
- `frontend/src/components/hri/hri-approval-task-board.tsx`
  - 공통 결재함은 `/api/hri/tasks/my-approvals` 조회와 approve/reject 액션은 있으나, 상세 내용 렌더러는 없다.
- `frontend/src/components/hri/hri-receive-task-board.tsx`
  - 공통 수신함은 `/api/hri/tasks/my-receives`와 receive-complete/receive-reject 액션 중심이다.

### 3.2 현재 seed된 HRI 폼 타입은 3개뿐이다

- `backend/app/bootstrap.py`
  - `HRI_FORM_TYPE_SEEDS`
    - `CERT_EMPLOYMENT`
    - `TIM_CORRECTION`
    - `EXPENSE_COMMON`
  - `HRI_FORM_TYPE_POLICY_SEEDS`도 위 3개에 대해서만 있다.
- 즉, `LEAVE_REQUEST`는 `hri_request_service.py`에서 상세/완료 handler는 존재하지만, bootstrap seed 폼 타입에는 아직 올라와 있지 않다.

### 3.3 현재 도메인별 상태

| 영역 | 현재 VIBE-HR 상태 | 근거 |
| --- | --- | --- |
| 공통 HRI | 구현 | `backend/app/api/hri_request.py`, `frontend/src/components/hri/hri-application-hub.tsx` |
| 근태 휴가 | 모듈 전용 구현, HRI 통합은 부분구현 | `frontend/src/components/tim/leave-request-manager.tsx`, `backend/app/api/tim_leave.py`, `backend/app/services/hri_request_service.py` |
| 복리후생 | 기준/현황 조회만 부분구현 | `frontend/src/app/wel/requests/page.tsx`, `backend/app/api/welfare.py` |
| 교육 | 리소스/운영형 grid 위주 부분구현 | `frontend/src/components/tra/tra-screen-configs.ts`, `backend/app/api/tra.py` |
| 인사 퇴직 | 운영/승인형 화면 부분구현 | `frontend/src/app/hr/retire/approvals/page.tsx`, `backend/app/api/hr_retire.py` |
| 평가 | 마스터 관리 위주, 신청/승인 미구현 | `backend/app/api/pap_appraisal.py` |
| 급여 | 신청/승인 화면 미구현 | `backend/app/api/payroll_phase2.py`, `backend/app/api/pay_setup.py` 기준 신청 API 없음 |
| 조직 | 신청/승인 화면 미구현 | `backend/app/api/organization.py`, `backend/app/api/hr_appointment_record.py` 기준 신청 API 없음 |

## 4. 통합 신청 페이지 대상 선별 기준

### 4.1 통합 신청 페이지에 넣을 대상

다음 조건을 만족하면 `공통 신청 페이지`에 넣는 것이 맞다.

- 문서형 신청이다.
- 1명의 신청자 기준으로 작성된다.
- 상태 전이가 `draft -> submit -> approval -> receive/complete` 구조로 표현 가능하다.
- 도메인별 상세 항목만 다르고, 공통 메타는 같다.
  - 신청자
  - 소속/직위
  - 제목
  - 사유
  - 첨부
  - 결재선
  - 수신처리 여부

### 4.2 통합 신청 페이지에서 제외할 대상

다음은 `운영/관리형 화면`으로 남기는 것이 맞다.

- 대량 grid 편집이 필요한 업무
- 월마감/배치/정산/집계 업무
- 체크리스트/자산반납/여러 하위 객체를 동시에 관리하는 업무
- 평가 점수 입력처럼 폼 자체가 복합 워크플로우인 업무

## 5. Legacy EHR x VIBE-HR 신청서 크로스체크

상태 기준:

- `구현`: 현재 VIBE-HR에서 실제 신청/승인 흐름이 있다.
- `부분구현`: 화면 또는 엔진 일부만 있다.
- `미구현`: 현재 VIBE-HR에서 대응 신청/승인 흐름을 확인하지 못했다.
- `미확인`: 명칭만으로 업무 의미를 확정할 수 없다.

### 5.1 인사/공통

| 신청/승인 단위 | Legacy EHR 근거 | 현재 VIBE-HR | 통합 신청 페이지 대상 | 승인 페이지 권장안 |
| --- | --- | --- | --- | --- |
| 재직증명서 신청 | `hrm/certificate/certiApp/CertiAppController.java`, `certiApr/CertiAprController.java` | 구현 | 즉시 포함 | 공통 결재함 |
| 근태 정정 신청 | Legacy exact 대응은 `workAttendAdjApp/WorkAttendAdjAppController.java`, `workAttendAdjApr/WorkAttendAdjAprController.java`로 추정 가능하나 exact mapping은 미확인 | 구현 | 즉시 포함 | 공통 결재함 |
| 휴가 신청 | `tim/request/vacationApp/VacationAppController.java`, `vacationApr/VacationAprController.java` | 부분구현 | 즉시 포함 | 공통 결재함 + TIM 전용 운영 승인 화면 유지 |
| 퇴직 신청 | `hrm/retire/retireApp/RetireAppController.java`, `retireApr/RetireAprController.java` | 부분구현 | 별도 전용 페이지 권장 | 전용 승인 화면 유지 |
| HR Query | `hrm/other/hrQueryApp/HrQueryAppController.java`, `hrQueryApr/HrQueryAprController.java` | 미구현 | 공통 신청 페이지에 포함 가능 | 공통 결재함 |
| TimeOff | `hrm/timeOff/timeOffApp/TimeOffAppController.java`, `timeOffApr/TimeOffAprController.java` | 미구현 | 공통 신청 페이지 후보 | 공통 결재함 |
| Dispatch | `hrm/dispatch/dispatchApr/DispatchAprController.java` | 미구현 | 미확인 | 승인 화면 설계 전 상세 분석 필요 |
| CommonApproval | `hri/commonApproval/comApp/ComAppController.java`, `comApr/ComAprController.java` | 공통 HRI 엔진으로 부분대응 | 공통 신청 페이지 인프라로 흡수 | 공통 결재함 |
| PartMgr | `hri/partMgr/partMgrApp/PartMgrAppController.java`, `partMgrApr/PartMgrAprController.java` | 미구현 | 미확인 | 공통 결재함 후보 |

### 5.2 조직

| 신청/승인 단위 | Legacy EHR 근거 | 현재 VIBE-HR | 통합 신청 페이지 대상 | 승인 페이지 권장안 |
| --- | --- | --- | --- | --- |
| OrgCapaPlan | `org/capacity/orgCapaPlanApp/OrgCapaPlanAppController.java`, `orgCapaPlanApr/OrgCapaPlanAprController.java` | 미구현 | 제외 권장 | 전용 승인 화면 |
| JobDivReport | `org/job/jobDivReportApp/JobDivReportAppController.java`, `jobDivReportApr/JobDivReportAprController.java` | 미구현 | 제외 권장 | 전용 승인 화면 |
| JobReg | `org/job/jobRegApp/JobRegAppController.java`, `jobRegApr/JobRegAprController.java` | 미구현 | 제외 권장 | 전용 승인 화면 |

판단:

- 조직 영역은 대부분 조직기획/직무기준/용량계획 성격이라 `직원 공통 신청서`보다는 `관리형 업무 화면`에 가깝다.
- 따라서 신청 입력 통합 대상이 아니라, 나중에 `결재 태스크만 공통 결재함에 표시`하는 방식이 맞다.

### 5.3 근태/WTM

| 신청/승인 단위 | Legacy EHR 근거 | 현재 VIBE-HR | 통합 신청 페이지 대상 | 승인 페이지 권장안 |
| --- | --- | --- | --- | --- |
| AnnualPlanAgr | `tim/annual/annualPlanAgrApp/AnnualPlanAgrAppController.java`, `AnnualPlanAgrAprController.java` | 미구현 | 공통 신청 페이지 후보 | 공통 결재함 |
| AnnualPlan | `tim/annual/annualPlanApp/AnnualPlanAppController.java`, `AnnualPlanAprController.java` | 부분구현 (`annual-leave`는 잔여관리 중심) | 공통 신청 페이지 후보 | 공통 결재함 + 연차 운영 화면 유지 |
| Vacation | `tim/request/vacationApp/VacationAppController.java`, `VacationAprController.java` | 부분구현 | 즉시 포함 | 공통 결재함 + `/tim/leave-approval` 유지 |
| VacationUpd | `tim/request/vacationUpdApp/VacationUpdAppController.java`, `VacationUpdAprController.java` | 미구현 | 공통 신청 페이지 후보 | 공통 결재함 |
| BizTrip | `tim/request/bizTripApp/BizTripAppController.java`, `BizTripAprController.java` | 미구현 | 공통 신청 페이지 후보 | 공통 결재함 |
| BizTripExpen | `tim/request/bizTripExpenApp/BizTripExpenAppController.java`, `BizTripExpenAprController.java` | 미구현 | 공통 신청 페이지 후보 | 공통 결재함 또는 공통 경비 수신함 |
| Workday | `tim/request/workday/WorkdayAppController.java` | 미구현 | 미확인 | 미확인 |
| WorkSchedule | `tim/schedule/workScheduleApp/WorkScheduleAppController.java`, `WorkScheduleAprController.java` | 미구현 | 제외 권장 | 전용 승인 화면 |
| WorkScheduleOrg | `tim/schedule/workScheduleOrgApp/WorkScheduleOrgAppController.java`, `WorkScheduleOrgAprController.java` | 미구현 | 제외 권장 | 전용 승인 화면 |
| WorkTime | `tim/schedule/workTimeApp/WorkTimeAppController.java`, `WorkTimeAprController.java` | 미구현 | 공통 신청 페이지 후보 | 공통 결재함 |
| ExcWork | `tim/workApp/excWorkApp/ExcWorkAppController.java`, `ExcWorkAprController.java` | 미구현 | 공통 신청 페이지 후보 | 공통 결재함 |
| ExtenWork | `tim/workApp/extenWorkApp/ExtenWorkAppController.java`, `ExtenWorkAprController.java` | 미구현 | 공통 신청 페이지 후보 | 공통 결재함 |
| HolAlter | `tim/workApp/holAlterApp/HolAlterAppController.java`, `HolAlterAprController.java` | 미구현 | 공통 신청 페이지 후보 | 공통 결재함 |
| HolWork | `tim/workApp/holWorkApp/HolWorkAppController.java`, `HolWorkAprController.java` | 미구현 | 공통 신청 페이지 후보 | 공통 결재함 |
| OtWorkOrg | `tim/workApp/otWorkOrgApp/OtWorkOrgAppController.java`, `OtWorkOrgAprController.java` | 미구현 | 제외 권장 | 전용 승인 화면 |
| OtWorkOrgUpd | `tim/workApp/otWorkOrgUpdApp/OtWorkOrgUpdAppController.java` | 미구현 | 제외 권장 | 전용 승인 화면 |
| WorkAttendAdj | `tim/workApp/workAttendAdjApp/WorkAttendAdjAppController.java`, `WorkAttendAdjAprController.java` | 부분구현 | 즉시 포함 | 공통 결재함 |
| WorkingType | `tim/workingType/workingTypeApp/WorkingTypeAppController.java`, `WorkingTypeAprController.java` | 미구현 | 공통 신청 페이지 후보 | 공통 결재함 |
| WtmAnnualPlanAgr | `wtm/annualPlan/wtmAnnualPlanAgrApp/WtmAnnualPlanAgrAppController.java`, `WtmAnnualPlanAgrAprController.java` | 미구현 | 공통 신청 페이지 후보 | 공통 결재함 |
| WtmReducedWork | `wtm/request/wtmReducedWork/wtmReducedWorkApp/WtmReducedWorkAppController.java` | 미구현 | 공통 신청 페이지 후보 | 공통 결재함 |
| WtmRequest | `wtm/request/wtmRequestApr/WtmRequestAprController.java` | 미구현 | 미확인 | 미확인 |

### 5.4 급여

| 신청/승인 단위 | Legacy EHR 근거 | 현재 VIBE-HR | 통합 신청 페이지 대상 | 승인 페이지 권장안 |
| --- | --- | --- | --- | --- |
| DeptPartPay | `cpn/payApp/deptPartPayApp/DeptPartPayAppController.java` | 미구현 | 공통 신청 페이지 후보 | 공통 결재함 + 급여 운영 화면 |
| EtcPay | `cpn/payApp/etcPayApp/EtcPayAppController.java` | 미구현 | 공통 신청 페이지 후보 | 공통 결재함 + 급여 운영 화면 |
| ExWorkDriverN | `cpn/payApp/exWorkDriverNApp/ExWorkDriverNAppController.java` | 미구현 | 미확인 | 별도 분석 필요 |
| ExWorkDriverS | `cpn/payApp/exWorkDriverSApp/ExWorkDriverSAppController.java` | 미구현 | 미확인 | 별도 분석 필요 |
| Personal Account Change | `cpn/personalPay/perlAccChgApp/PerlAccChgAppController.java`, `perAccChgApr/PerAccChgAprController.java` | 미구현 | 공통 신청 페이지에 즉시 올리기 좋음 | 공통 결재함 |

판단:

- 급여 영역은 `정산/마감`은 전용 운영 화면, `개인별 요청서`는 공통 신청 페이지로 나누는 것이 맞다.
- 가장 먼저 올리기 쉬운 급여 신청서는 `개인 계좌 변경`, `기타 지급`, `부서/부분 지급성 요청`이다.

### 5.5 복리후생

| 신청/승인 단위 | Legacy EHR 근거 | 현재 VIBE-HR | 통합 신청 페이지 대상 | 승인 페이지 권장안 |
| --- | --- | --- | --- | --- |
| Buscard | `ben/buscard/buscardApp/BuscardAppController.java`, `BuscardAprController.java` | 미구현 | 공통 신청 페이지 후보 | 공통 결재함 |
| CarAllocate | `ben/carAllocate/carAllocateApp/CarAllocateAppController.java`, `CarAllocateAprController.java` | 미구현 | 공통 신청 페이지 후보 | 공통 결재함 |
| Club | `ben/club/clubApp/ClubAppController.java`, `ClubAprController.java` | 미구현 | 공통 신청 페이지 후보 | 공통 결재함 |
| Clubpay | `ben/club/clubpayApp/ClubpayAppController.java`, `ClubpayAprController.java` | 미구현 | 공통 신청 페이지 후보 | 공통 결재함 |
| Clubref | `ben/club/clubrefApp/ClubrefAppController.java`, `ClubrefAprController.java` | 미구현 | 공통 신청 페이지 후보 | 공통 결재함 |
| Ftestmon | `ben/ftestmon/ftestmonApp/FtestmonAppController.java`, `FtestmonAprController.java` | 미구현 | 미확인 | 미확인 |
| Gift | `ben/gift/giftApp/GiftAppController.java` | 미구현 | 공통 신청 페이지 후보 | 승인 흐름 미확인 |
| Golf | `ben/golf/golfApp/GolfAppController.java` | 미구현 | 공통 신청 페이지 후보 | 승인 흐름 미확인 |
| Loan | `ben/loan/loanApp/LoanAppController.java`, `LoanAprController.java` | 미구현 | 공통 신청 페이지 즉시 후보 | 공통 결재함 + 지급/상환 운영 화면 |
| LoanRep | `ben/loan/loanRepApp/LoanRepAppController.java`, `LoanRepAprController.java` | 미구현 | 공통 신청 페이지 후보 | 공통 결재함 |
| Med | `ben/medical/medApp/MedAppController.java`, `MedAprController.java` | 미구현 | 공통 신청 페이지 즉시 후보 | 공통 결재함 |
| MeetRoom | `ben/meetRoom/meetRoomApp/MeetRoomAppController.java`, `MeetRoomAprController.java` | 미구현 | 공통 신청 페이지 후보 | 공통 결재함 또는 예약 운영 화면 |
| Occ | `ben/occasion/occApp/OccAppController.java`, `OccAprController.java` | 미구현 | 공통 신청 페이지 즉시 후보 | 공통 결재함 |
| PsnalPen | `ben/psnalPension/psnalPenApp/PsnalPenAppController.java`, `PsnalPenAprController.java` | 미구현 | 공통 신청 페이지 후보 | 공통 결재함 |
| Reservation | `ben/reservation/reservationApp/ReservationAppController.java` | 미구현 | 공통 신청 페이지 후보 | 승인 흐름 미확인 |
| Resort | `ben/resort/resortApp/ResortAppController.java`, `ResortAprController.java` | 미구현 | 공통 신청 페이지 즉시 후보 | 공통 결재함 |
| Sch | `ben/scholarship/schApp/SchAppController.java`, `SchAprController.java` | 미구현 | 공통 신청 페이지 즉시 후보 | 공통 결재함 |
| Welfare generic request | 현재 VIBE-HR `frontend/src/app/wel/requests/page.tsx`, `backend/app/api/welfare.py` | 부분구현 | 즉시 포함 | 공통 결재함 + 복리후생 현황/반영 화면 유지 |

판단:

- 복리후생은 `신청 입력`을 통합하기 가장 좋은 영역이다.
- 실제 상세 입력 차이는 `benefit_type_code`와 유형별 폼 섹션으로 흡수하는 것이 맞다.
- 즉, 복리후생은 `한 개의 신청 페이지 + 여러 benefit type renderer` 구조가 정답이다.

### 5.6 교육

| 신청/승인 단위 | Legacy EHR 근거 | 현재 VIBE-HR | 통합 신청 페이지 대상 | 승인 페이지 권장안 |
| --- | --- | --- | --- | --- |
| Edu | `tra/requestApproval/eduApp/EduAppController.java`, `EduAprController.java` | 부분구현 (`tra/applications`는 resource grid) | 공통 신청 페이지 후보 | 공통 결재함 + 교육 운영 화면 |
| EduCancel | `tra/requestApproval/eduCancelApp/EduCancelAppController.java`, `EduCancelAprController.java` | 미구현 | 공통 신청 페이지 후보 | 공통 결재함 |
| EduResult | `tra/requestApproval/eduResultApr/EduResultAprController.java` | 미구현 | 별도 전용 페이지 권장 | 전용 승인/결과 화면 |
| EduEl | `tra/eLearning/eduElApp/EduElAppController.java`, `EduElAprController.java` | 부분구현 여부 미확인 | 공통 신청 페이지 후보 | 공통 결재함 |
| LectureFee | `tra/lectureFee/lectureFeeApp/LectureFeeAppController.java`, `LectureFeeAprController.java` | 미구현 | 공통 신청 페이지 후보 | 공통 결재함 |
| LectureRst | `tra/lectureRst/lectureRstApp/LectureRstAppController.java`, `LectureRstAprController.java` | 미구현 | 별도 전용 페이지 권장 | 전용 승인 화면 |
| YearEdu | `tra/yearEduPlan/yearEduApp/YearEduAppController.java` | 부분구현 여부 미확인 | 제외 권장 | 전용 운영/승인 화면 |
| YearEduOrg | `tra/yearEduPlan/yearEduOrgApp/YearEduOrgAppController.java`, `YearEduOrgAprController.java` | 미구현 | 제외 권장 | 전용 승인 화면 |
| Pubc | `hrd/pubc/pubcApp/PubcAppController.java`, `PubcAprController.java` | 미구현 | 미확인 | 별도 분석 필요 |
| SelfDevelopment | `hrd/selfDevelopment/selfDevelopmentApp/SelfDevelopmentAppController.java`, `SelfDevelopmentAprController.java` | 미구현 | 공통 신청 페이지 후보 | 공통 결재함 |

판단:

- `교육 신청`, `교육 취소`, `자기계발`, `강사료 요청`은 공통 신청 페이지 후보로 적합하다.
- 반면 `교육 계획`, `결과보고`, `실적/이수 운영`은 운영 화면으로 유지하는 것이 맞다.

### 5.7 평가

| 신청/승인 단위 | Legacy EHR 근거 | 현재 VIBE-HR | 통합 신청 페이지 대상 | 승인 페이지 권장안 |
| --- | --- | --- | --- | --- |
| AppSelfReport | `pap/evaluation/appSelfReportApp/AppSelfReportAppController.java` | 미구현 | 전용 페이지 권장 | 전용 승인/제출 화면 |
| AppCoaching | `pap/evaluation/appCoachingApr/AppCoachingAprController.java` | 미구현 | 제외 권장 | 전용 승인 화면 |
| CompApp1st | `pap/evaluation/compApp1stApr/CompApp1stAprController.java` | 미구현 | 제외 권장 | 전용 승인 화면 |
| CompApp2nd | `pap/evaluation/compApp2ndApr/CompApp2ndAprController.java` | 미구현 | 제외 권장 | 전용 승인 화면 |
| MboCoaching | `pap/evaluation/mboCoachingApr/MboCoachingAprController.java` | 미구현 | 제외 권장 | 전용 승인 화면 |
| MboTarget | `pap/evaluation/mboTargetApr/MboTargetAprController.java` | 미구현 | 제외 권장 | 전용 승인 화면 |
| MboTargetMid | `pap/evaluation/mboTargetMidApr/MboTargetMidAprController.java` | 미구현 | 제외 권장 | 전용 승인 화면 |
| InternApp | `pap/intern/internApp/InternAppController.java`, `InternApp1stAprController.java`, `InternApp2ndAprController.java` | 미구현 | 전용 페이지 권장 | 전용 승인 화면 |

판단:

- 평가는 `문서형 신청서`보다 `평가 workflow`에 가깝다.
- 따라서 통합 신청 페이지보다 전용 화면 설계가 맞고, 공통 결재함은 보조 수단 정도로만 쓰는 것이 안전하다.

## 6. 최종 권장안: 통합 신청 페이지에 올릴 1차 후보

### 6.1 즉시 올릴 대상

현재 VIBE-HR 구조와 레거시 수요를 같이 봤을 때, 아래는 우선순위가 높다.

1. 재직증명서
2. 근태정정
3. 휴가신청
4. 복리후생 일반 신청
5. 대부 신청
6. 대부 상환 신청
7. 의료비 신청
8. 경조 신청
9. 리조트 신청
10. 장학/학자금 신청
11. 개인 계좌 변경
12. 교육 신청
13. 교육 취소
14. 자기계발 신청

### 6.2 2차 후보

1. 출장 신청
2. 출장비 신청
3. 연차계획/연차협의
4. 연장근무
5. 휴일근무
6. 대체휴일
7. 근무형태 변경
8. 유연/단축근무
9. 회의실/예약 계열
10. 복리후생 기타 유형

### 6.3 전용 화면 유지 대상

1. 퇴직
2. 조직 기획/직무등록/정원계획
3. 평가 전 영역
4. 교육 계획/결과보고/이수운영
5. 급여 마감/배치/정산
6. 근무스케줄 조직 단위 운영

## 7. 통합 신청 페이지 구조 권장안

### 7.1 화면 구조

- 메뉴: `신청서 작성`
- 공통 상단:
  - 신청 분류
  - 신청 유형
  - 제목
  - 신청자/소속/직위
  - 첨부
  - 결재선 미리보기
- 본문:
  - 유형별 동적 폼 renderer
- 하단:
  - 임시저장
  - 결재요청

### 7.2 기술 구조

- 공통 master:
  - `hri_request_master`
  - `hri_request_step_snapshot`
- 유형 registry:
  - `form_code`
  - `module_code`
  - `renderer_key`
  - `requires_receive`
- 저장 방식:
  - 1차: `content_json` + 필요시 detail table dual-write
  - 안정화 후: 유형별 detail table 확장

### 7.3 왜 이 구조가 맞는가

- `frontend/src/components/hri/hri-application-hub.tsx`가 이미 이 방향의 초기 구현이다.
- `backend/app/services/hri_request_service.py`가 이미 form code별 detail upsert/complete handler 확장 지점을 제공한다.
- 따라서 새 신청 페이지를 완전히 새로 만드는 것보다, `HRI form registry`를 키우는 것이 더 짧고 일관된다.

## 8. 승인 페이지 구조 권장안

### 8.1 기본 원칙

- `신청 입력`은 통합한다.
- `승인 inbox`는 통합한다.
- `운영 승인 화면`은 도메인별로 남긴다.

즉, 승인 페이지는 아래 3축으로 가는 것이 맞다.

1. 공통 결재함
2. 공통 수신함
3. 도메인 전용 운영 승인 화면

### 8.2 공통 결재함에서 처리할 대상

- 재직증명서
- 근태정정
- 휴가신청
- 복리후생 신청 전반
- 교육 신청/취소
- 개인 계좌 변경
- 기타 문서형 개인 신청

근거:

- `backend/app/api/hri_request.py`에 approve/reject/receive-complete/receive-reject API가 이미 있다.
- `frontend/src/components/hri/hri-approval-task-board.tsx`
- `frontend/src/components/hri/hri-receive-task-board.tsx`

### 8.3 도메인 전용 승인 화면을 유지할 대상

- 휴가 운영 승인
  - 근거: `frontend/src/app/tim/leave-approval/page.tsx`
  - 이유: 휴가는 캘린더/잔여연차/중복검증 등 운영 문맥이 크다.
- 퇴직 승인
  - 근거: `frontend/src/app/hr/retire/approvals/page.tsx`, `backend/app/api/hr_retire.py`
  - 이유: 체크리스트/반납/확정/취소 등 하위 절차가 많다.
- 교육 운영 승인
  - 이유: 과정/차수/결과/이수실적과 연결되는 운영 화면이 필요하다.
- 평가 승인
  - 이유: 단순 approve/reject보다 평가 워크플로우가 우선이다.
- 급여 운영
  - 이유: 승인 후 지급/반영/마감이 별도다.

### 8.4 공통 결재함에서 반드시 추가할 것

현재 공통 결재함은 액션은 가능하지만, 다형성 상세 보기 측면에서 아직 부족하다.

반드시 추가할 항목:

1. 상세 drawer/panel
2. 유형별 detail renderer
3. 첨부 파일 표시
4. 결재선/이력 timeline
5. form type / domain filter
6. requester / department filter
7. 상태 전이 후 domain callback 결과 표시

근거:

- `frontend/src/components/hri/hri-approval-task-board.tsx`는 목록 + comment + approve/reject 중심이다.
- `frontend/src/components/hri/hri-receive-task-board.tsx`도 동일하다.
- 반면 `frontend/src/components/hri/hri-application-hub.tsx`는 상세/타임라인 렌더링이 이미 있으므로, 이 패턴을 승인함에도 재사용하는 것이 맞다.

## 9. 추천 메뉴 구조

### 9.1 통합 메뉴

1. `신청서 작성`
2. `내 신청현황`
3. `결재함`
4. `수신함`

### 9.2 도메인 운영 메뉴

1. `근태 승인관리`
2. `복리후생 신청현황`
3. `복리후생 반영관리`
4. `교육 신청운영`
5. `퇴직 승인관리`
6. `급여 반영/정산`
7. `평가 운영`

## 10. 바로 다음 설계 우선순위

1. `HRI form registry` 기준으로 1차 신청서 코드 목록 확정
2. 공통 신청 페이지의 `form renderer registry` 설계
3. 공통 결재함에 상세 drawer 추가
4. 휴가신청을 TIM 전용 화면에서 HRI 공통 신청으로 흡수할지 병행할지 결정
5. 복리후생 유형과 `benefit_type_code`를 HRI form/detail 모델에 연결
6. 교육 신청/취소를 공통 신청서로 올릴 최소 스키마 확정

## 11. 결론

- 방향 자체는 맞다.
- `신청 페이지 하나로 통합`은 적극 권장한다.
- 다만 `승인/운영 화면까지 하나로 통합`은 비추천이다.
- 실제 구현은 `HRI 공통 신청/결재 엔진 확장`으로 가는 것이 가장 효율적이다.
- 우선순위는 `휴가 + 복리후생 + 교육 + 개인성 급여 신청` 순서가 적절하다.
