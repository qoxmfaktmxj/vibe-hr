# HRI Form Registry Phase 1 Draft

## 1. 목적

- `통합 신청 페이지`에 실제로 올릴 `form_code` 초안을 확정한다.
- 각 신청서마다 필요한 `template`, `policy`, `sample seed` 기준을 같이 정한다.
- 원칙: 새 신청서를 개발할 때마다 seed도 같이 만든다.

## 2. 현재 기준 구조

### 2.1 현재 HRI 마스터 구조

- `backend/app/models/entities.py`
  - `HriFormType`
    - `form_code`
    - `form_name_ko`
    - `module_code`
    - `allow_draft`
    - `allow_withdraw`
    - `requires_receive`
    - `default_priority`
  - `HriFormTypePolicy`
  - `HriFormTypeApprovalMap`
  - `HriRequestMaster`
  - `HriRequestStepSnapshot`
  - `HriRequestHistory`
  - `HriRequestAttachment`

### 2.2 현재 상세 테이블

- `backend/app/models/entities.py`
  - `HriReqTimCorrection`
  - `HriReqCertEmployment`
  - `HriReqLeave`

### 2.3 현재 seed 상태

- `backend/app/bootstrap.py`
  - `HRI_FORM_TYPE_SEEDS`
    - `CERT_EMPLOYMENT`
    - `TIM_CORRECTION`
    - `EXPENSE_COMMON`
  - `HRI_FORM_TYPE_POLICY_SEEDS`
    - 첨부 필수 여부, 첨부 개수 정도만 정의됨
  - `HRI_APPROVAL_TEMPLATE_SEEDS`
    - `HRI_TMPL_CERT`
    - `HRI_TMPL_TIM_SIMPLE`
    - `HRI_TMPL_DEFAULT`
  - `HRI_FORM_TYPE_TEMPLATE_MAP_SEEDS`
    - `CERT_EMPLOYMENT -> HRI_TMPL_CERT`
    - `TIM_CORRECTION -> HRI_TMPL_TIM_SIMPLE`
    - `EXPENSE_COMMON -> HRI_TMPL_DEFAULT`

### 2.4 현재 구현상 중요한 제약

- `frontend/src/components/hri/hri-application-hub.tsx`
  - 폼 renderer가 현재 `TIM_CORRECTION`, `CERT_EMPLOYMENT`, `LEAVE_REQUEST`만 명시 대응한다.
- `backend/app/services/hri_request_service.py`
  - detail upsert / post-complete handler도 현재는 위 3개 중심이다.
- 결론:
  - 새 신청서는 `form_code`만 추가해서 끝나지 않는다.
  - 최소한 `renderer`, `detail upsert`, `post-complete`, `seed`를 한 묶음으로 넣어야 한다.

## 3. seed 원칙

## 3.1 답변

예. 새로 개발할 때마다 seed를 계속 만든다.

정확히는 아래 6개를 같이 넣는 것이 기본 원칙이다.

1. 메뉴 seed
2. HRI form type seed
3. HRI policy seed
4. HRI template map seed
5. 최소 샘플 transaction seed
6. Playwright 확인

## 3.2 새 신청서 개발 시 필수 seed 묶음

| 구분 | 필수 여부 | 위치 |
| --- | --- | --- |
| 메뉴 seed | 필수 | `backend/app/bootstrap.py` `MENU_TREE` |
| form type seed | 필수 | `backend/app/bootstrap.py` `HRI_FORM_TYPE_SEEDS` |
| form policy seed | 필수 | `backend/app/bootstrap.py` `HRI_FORM_TYPE_POLICY_SEEDS` |
| form-template map seed | 필수 | `backend/app/bootstrap.py` `HRI_FORM_TYPE_TEMPLATE_MAP_SEEDS` |
| 샘플 요청 seed | 필수 | 새 `ensure_<module>_sample_requests()` 또는 동등 함수 |
| 샘플 상세 seed | 필수 | detail table seed |
| 메뉴 가시성 확인 | 필수 | Playwright |
| 요청/결재 상태 확인 | 필수 | Playwright |

## 3.3 샘플 seed 최소 기준

- 신규 신청서마다 최소 4건
  - `DRAFT` 1건
  - `APPROVAL_IN_PROGRESS` 1건
  - `APPROVAL_REJECTED` 또는 `RECEIVE_REJECTED` 1건
  - `COMPLETED` 1건
- `requires_receive = true` 인 신청서는 추가로 `RECEIVE_IN_PROGRESS` 1건 권장

## 4. Phase 1 form registry 초안

주의:

- 아래 `renderer_key`는 현재 DB 필드가 아니다.
- 우선은 frontend registry 상수로 관리하고, 필요해지면 DB 컬럼으로 승격한다.

| form_code | form_name_ko | module_code | renderer_key | requires_receive | 권장 template | 상태 |
| --- | --- | --- | --- | --- | --- | --- |
| CERT_EMPLOYMENT | 재직증명서 신청 | HR | `certEmployment` | `true` | `HRI_TMPL_CERT` | 기존 유지 |
| TIM_CORRECTION | 근태 정정 신청 | TIM | `timCorrection` | `false` | `HRI_TMPL_TIM_SIMPLE` | 기존 유지 |
| LEAVE_REQUEST | 휴가 신청 | TIM | `leaveRequest` | `false` | `HRI_TMPL_TIM_SIMPLE` | seed 추가 필요 |
| WEL_BENEFIT_REQUEST | 복리후생 일반 신청 | WEL | `welBenefitGeneric` | `true` | `HRI_TMPL_WEL_RECEIVE` | 신규 |
| WEL_LOAN_REQUEST | 대부 신청 | WEL | `welLoan` | `true` | `HRI_TMPL_WEL_RECEIVE` | 신규 |
| WEL_LOAN_REPAY_REQUEST | 대부 상환 신청 | WEL | `welLoanRepay` | `true` | `HRI_TMPL_WEL_RECEIVE` | 신규 |
| WEL_MEDICAL_REQUEST | 의료비 신청 | WEL | `welMedical` | `true` | `HRI_TMPL_WEL_RECEIVE` | 신규 |
| WEL_OCCASION_REQUEST | 경조 신청 | WEL | `welOccasion` | `true` | `HRI_TMPL_WEL_RECEIVE` | 신규 |
| WEL_RESORT_REQUEST | 리조트 신청 | WEL | `welResort` | `true` | `HRI_TMPL_WEL_RECEIVE` | 신규 |
| WEL_SCHOLARSHIP_REQUEST | 학자금/장학 신청 | WEL | `welScholarship` | `true` | `HRI_TMPL_WEL_RECEIVE` | 신규 |
| PAY_ACCOUNT_CHANGE | 계좌 변경 신청 | PAY | `payAccountChange` | `true` | `HRI_TMPL_PAY_RECEIVE` | 신규 |
| TRA_EDU_REQUEST | 교육 신청 | TRA | `traEduRequest` | `true` | `HRI_TMPL_EDU_RECEIVE` | 신규 |
| TRA_EDU_CANCEL_REQUEST | 교육 취소 신청 | TRA | `traEduCancel` | `true` | `HRI_TMPL_EDU_RECEIVE` | 신규 |
| HR_SELF_DEVELOPMENT_REQUEST | 자기계발 신청 | HRD | `hrSelfDevelopment` | `true` | `HRI_TMPL_EDU_RECEIVE` | 신규 |

## 5. form_code별 레거시 근거

| form_code | Legacy EHR 근거 |
| --- | --- |
| CERT_EMPLOYMENT | `C:\EHR_PROJECT\isu-hr\EHR_HR50\src\main\java\com\hr\hrm\certificate\certiApp\CertiAppController.java`, `certiApr\CertiAprController.java` |
| TIM_CORRECTION | `C:\EHR_PROJECT\isu-hr\EHR_HR50\src\main\java\com\hr\tim\workApp\workAttendAdjApp\WorkAttendAdjAppController.java`, `workAttendAdjApr\WorkAttendAdjAprController.java` |
| LEAVE_REQUEST | `C:\EHR_PROJECT\isu-hr\EHR_HR50\src\main\java\com\hr\tim\request\vacationApp\VacationAppController.java`, `vacationApr\VacationAprController.java` |
| WEL_BENEFIT_REQUEST | `C:\EHR_PROJECT\isu-hr\EHR_HR50\src\main\java\com\hr\ben\apply\benApplyUser\BenApplyUserController.java` + 현재 VIBE-HR `frontend/src/app/wel/requests/page.tsx` |
| WEL_LOAN_REQUEST | `C:\EHR_PROJECT\isu-hr\EHR_HR50\src\main\java\com\hr\ben\loan\loanApp\LoanAppController.java`, `loanApr\LoanAprController.java` |
| WEL_LOAN_REPAY_REQUEST | `C:\EHR_PROJECT\isu-hr\EHR_HR50\src\main\java\com\hr\ben\loan\loanRepApp\LoanRepAppController.java`, `loanRepApr\LoanRepAprController.java` |
| WEL_MEDICAL_REQUEST | `C:\EHR_PROJECT\isu-hr\EHR_HR50\src\main\java\com\hr\ben\medical\medApp\MedAppController.java`, `medApr\MedAprController.java` |
| WEL_OCCASION_REQUEST | `C:\EHR_PROJECT\isu-hr\EHR_HR50\src\main\java\com\hr\ben\occasion\occApp\OccAppController.java`, `occApr\OccAprController.java` |
| WEL_RESORT_REQUEST | `C:\EHR_PROJECT\isu-hr\EHR_HR50\src\main\java\com\hr\ben\resort\resortApp\ResortAppController.java`, `resortApr\ResortAprController.java` |
| WEL_SCHOLARSHIP_REQUEST | `C:\EHR_PROJECT\isu-hr\EHR_HR50\src\main\java\com\hr\ben\scholarship\schApp\SchAppController.java`, `schApr\SchAprController.java` |
| PAY_ACCOUNT_CHANGE | `C:\EHR_PROJECT\isu-hr\EHR_HR50\src\main\java\com\hr\cpn\personalPay\perlAccChgApp\PerlAccChgAppController.java`, `perAccChgApr\PerAccChgAprController.java` |
| TRA_EDU_REQUEST | `C:\EHR_PROJECT\isu-hr\EHR_HR50\src\main\java\com\hr\tra\requestApproval\eduApp\EduAppController.java`, `eduApr\EduAprController.java` |
| TRA_EDU_CANCEL_REQUEST | `C:\EHR_PROJECT\isu-hr\EHR_HR50\src\main\java\com\hr\tra\requestApproval\eduCancelApp\EduCancelAppController.java`, `eduCancelApr\EduCancelAprController.java` |
| HR_SELF_DEVELOPMENT_REQUEST | `C:\EHR_PROJECT\isu-hr\EHR_HR50\src\main\java\com\hr\hrd\selfDevelopment\selfDevelopmentApp\SelfDevelopmentAppController.java`, `selfDevelopmentApr\SelfDevelopmentAprController.java` |

## 6. template 권장안

### 6.1 기존 template 재사용

| template_code | 용도 | 근거 |
| --- | --- | --- |
| HRI_TMPL_CERT | 증명서/발급류 | `backend/app/bootstrap.py` 기존 seed |
| HRI_TMPL_TIM_SIMPLE | 휴가/근태 정정/단순 근태 요청 | `backend/app/bootstrap.py` 기존 seed |
| HRI_TMPL_DEFAULT | 범용 결재 | `backend/app/bootstrap.py` 기존 seed |

### 6.2 신규 template 제안

아래는 설계 제안이다. 아직 코드에는 없다.

| template_code | 권장 step 구성 | 대상 |
| --- | --- | --- |
| HRI_TMPL_WEL_RECEIVE | 팀장 승인 -> 부서장 승인 -> HR_ADMIN 수신 | 복리후생 신청 |
| HRI_TMPL_PAY_RECEIVE | 팀장 승인 -> 부서장 승인 -> PAYROLL 수신 | 계좌 변경/개인성 급여 신청 |
| HRI_TMPL_EDU_RECEIVE | 팀장 승인 -> 부서장 승인 -> HRD 수신 | 교육 신청/취소/자기계발 |

이유:

- 현재 `requires_receive` 컬럼이 이미 있다.
- 복리후생/급여/교육은 승인 이후 운영 부서 후처리가 필요할 가능성이 높다.
- 따라서 `APPROVAL`만 있는 template보다 `RECEIVE` 단계가 있는 template이 더 안전하다.

## 7. 정책 seed 권장안

## 7.1 공통 정책 key

기존 `attachment_required`, `max_attachment_count` 외에 아래 key를 같이 쓰는 안을 권장한다.

| policy_key | 예시 값 | 설명 |
| --- | --- | --- |
| attachment_required | `true` | 첨부 필수 여부 |
| max_attachment_count | `5` | 첨부 최대 개수 |
| allow_past_date | `false` | 과거일 신청 허용 여부 |
| max_span_days | `31` | 신청 가능 최대 기간 |
| require_reason | `true` | 사유 필수 여부 |
| allow_cancel_after_submit | `true` | 제출 후 취소 허용 여부 |
| payroll_linked | `true` | 급여 반영 연계 여부 |
| benefit_type_required | `true` | 복리후생 유형 선택 필수 여부 |

## 7.2 form별 권장 정책

| form_code | 권장 정책 |
| --- | --- |
| LEAVE_REQUEST | `require_reason=true`, `allow_past_date=false`, `max_span_days=31` |
| WEL_BENEFIT_REQUEST | `benefit_type_required=true`, `attachment_required=false` |
| WEL_MEDICAL_REQUEST | `benefit_type_required=true`, `attachment_required=true`, `payroll_linked=true` |
| WEL_LOAN_REQUEST | `attachment_required=true`, `payroll_linked=true` |
| PAY_ACCOUNT_CHANGE | `attachment_required=true`, `require_reason=true` |
| TRA_EDU_REQUEST | `attachment_required=false`, `require_reason=true` |
| TRA_EDU_CANCEL_REQUEST | `attachment_required=false`, `require_reason=true` |
| HR_SELF_DEVELOPMENT_REQUEST | `attachment_required=true`, `require_reason=true` |

## 8. 샘플 seed 권장안

## 8.1 form_code별 최소 샘플 수

| form_code | 최소 샘플 | 비고 |
| --- | --- | --- |
| CERT_EMPLOYMENT | 4건 | 기존 흐름 유지 |
| TIM_CORRECTION | 4건 | 기존 흐름 유지 |
| LEAVE_REQUEST | 5건 | 승인/취소 흐름 포함 |
| WEL_* | 유형별 4건 | `draft`, `approval`, `rejected`, `completed` |
| PAY_ACCOUNT_CHANGE | 4건 | `receive` 포함 권장 |
| TRA_* | 4건 | 교육 취소는 반려 1건 포함 |
| HR_SELF_DEVELOPMENT_REQUEST | 4건 | 첨부 1건 이상 포함 |

## 8.2 새 기능 개발 시 같이 넣을 항목

예를 들어 `WEL_MEDICAL_REQUEST`를 새로 만든다면 같이 들어가야 할 것은 아래다.

1. `HRI_FORM_TYPE_SEEDS` row
2. `HRI_FORM_TYPE_POLICY_SEEDS` row
3. `HRI_FORM_TYPE_TEMPLATE_MAP_SEEDS` row
4. `frontend` renderer 등록
5. `backend` detail upsert / detail read / complete handler
6. `seed` 요청 4~5건
7. 메뉴 노출 확인
8. Playwright 2회 이상 검증

즉, 앞으로도 새로 개발할 때마다 seed는 계속 만든다.

## 9. 구현 순서 권장안

1. `LEAVE_REQUEST`를 먼저 bootstrap seed에 올려 공통 HRI 허브에 연결
2. `WEL_BENEFIT_REQUEST`를 generic 복리후생 신청으로 추가
3. 복리후생 상세 유형은 `benefit_type_code` 기반 동적 renderer로 확장
4. `PAY_ACCOUNT_CHANGE` 추가
5. `TRA_EDU_REQUEST` / `TRA_EDU_CANCEL_REQUEST` 추가
6. `HR_SELF_DEVELOPMENT_REQUEST` 추가

## 10. 결론

- 통합 신청 페이지는 `HRI form registry` 중심으로 키우는 것이 맞다.
- 새 기능을 만들 때 seed는 예외 없이 같이 넣는 것이 맞다.
- 특히 `form type seed + sample request seed + menu seed`는 한 세트로 봐야 한다.
- 다음 구현 시작점은 `LEAVE_REQUEST seed 등록`과 `WEL_BENEFIT_REQUEST form_code 추가`가 가장 효율적이다.
