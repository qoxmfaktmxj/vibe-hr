# EHR Phase 1 미구현 실행 백로그

작성일: 2026-02-27  
기준 문서: `docs/EHR_PHASE1_SCREEN_GAP.md`  
목적: 미구현 기능을 실행 가능한 단위로 분해하여 재실행

---

## 1. 사용 방법

1. 아래 에픽(E1~E9) 중 `우선순위 상`부터 순서대로 진행한다.
2. 각 에픽의 체크리스트를 완료할 때마다 `[ ] -> [x]`로 갱신한다.
3. AG Grid 화면이 포함된 에픽은 반드시 아래 공통 게이트를 통과한다.

공통 게이트:
- `npm run validate:grid`
- `npm run lint`
- `npm run build`

---

## 2. 실행 순서 (권장)

### Wave A (핵심 운영 공백 해소)
- E1 HR 퇴직 체크리스트/퇴직처리
- E2 ORG 조직개편 적용/조직정렬
- E3 TIM 월마감/근무시간 배치
- E9 메뉴 액션권한

### Wave B (복리/교육/운영툴)
- E7 WEL 복리후생
- E8 TRA 교육
- E6 SYS 데이터 이관/정합성 점검

### Wave C (급여 본체)
- E4 CPN 급여 코어(고정급/예외/월대장/계산)
- E5 CPN 연말정산/마감취소

---

## 3. 에픽 상세

## E1. HR 퇴직 체크리스트/퇴직처리
- 우선순위: 상
- 상태: [ ] 미시작
- 목표: `/hr/retire` 화면 + 퇴직 프로세스(체크리스트, 확정, 이력 반영)

체크리스트:
- [ ] DB 스키마/모델 정의 (퇴직체크 항목, 퇴직처리 헤더/상세, 감사로그)
- [ ] Backend API 구현 (`/api/v1/hr/retire/*`)
- [ ] Frontend 페이지 구현 (`/hr/retire`)
- [ ] 권한 정책 적용 (`hr_manager`, `admin`)
- [ ] HR 기본정보/사원상태(재직->퇴직) 연동
- [ ] 통합 테스트 (신청->체크->확정->이력확인)

완료 기준:
- [ ] 퇴직처리 완료 시 직원 상태/퇴직일/관련 이력이 일관되게 반영됨
- [ ] 롤백/취소 정책 정의 및 동작 확인

---

## E2. ORG 조직개편 적용/조직정렬 배치
- 우선순위: 상
- 상태: [ ] 미시작
- 목표: 조직개편 시뮬레이션 결과를 실제 조직에 적용하고 정렬 배치 수행

체크리스트:
- [ ] 조직개편 적용 API 구현 (`/api/v1/org/reorg/apply`)
- [ ] 조직정렬 배치 API 구현 (`/api/v1/org/reorg/sort`)
- [ ] 프론트 화면 구현/보강 (`/org/chart` + 정렬 실행 UI)
- [ ] 적용 전/후 diff 미리보기 제공
- [ ] 실패 시 트랜잭션 롤백 보장

완료 기준:
- [ ] 시뮬레이션 결과와 실제 반영 결과가 동일함
- [ ] 조직장/상위조직 관계 무결성 유지

---

## E3. TIM 월마감/근무시간 배치
- 우선순위: 상
- 상태: [ ] 미시작
- 목표: 월 단위 근무시간 집계와 마감(닫기/재오픈 정책 포함)

체크리스트:
- [ ] 월마감 테이블/상태 모델 정의 (`open`, `closed`)
- [ ] 월집계 배치 서비스 구현 (초과근무/결근/근무시간)
- [ ] 월마감 API 구현 (`/api/v1/tim/month-close/*`)
- [ ] 월마감 화면 구현 (`/tim/month-close`)
- [ ] 마감 후 수정 제한 정책 적용

완료 기준:
- [ ] 동일 월 재실행 시 중복/누락 없이 idempotent 동작
- [ ] 마감 후 일상근태 수정 경로가 정책대로 차단/예외처리됨

---

## E4. CPN 급여 코어 (고정급/예외/월대장/계산)
- 우선순위: 상
- 상태: [ ] 미시작
- 목표: 급여 계산의 핵심 데이터와 계산 엔진 1차 완성

체크리스트:
- [ ] 모델 추가: `PayEmployeeFixedItem`, `PayEmployeeException`
- [ ] 모델 추가: `PayPayrollMaster`, `PayVariableInput`
- [ ] 모델 추가: `PayPayrollRecord`, `PayPayrollDetail`
- [ ] API 추가: 개인 고정급 CRUD (`/api/v1/pay/employee-fixed`)
- [ ] API 추가: 월대장 생성/조회/저장
- [ ] 계산 서비스 구현 (`pay_engine_service.py`)
- [ ] 프론트 화면: 연봉(고정급)관리
- [ ] 프론트 화면: 급여대장 생성/월별변동 입력/급상여계산

완료 기준:
- [ ] 샘플 월(1개) 기준 계산 결과가 수동 계산과 일치
- [ ] `DELETE -> UPDATE -> INSERT` 저장 순서 준수
- [ ] 실패 시 트랜잭션 롤백

---

## E5. CPN 연말정산/마감취소
- 우선순위: 상
- 상태: [ ] 미시작
- 목표: 연말정산 실행/검증 및 급여/연말 마감취소 지원

체크리스트:
- [ ] 연말정산 실행 API 구현
- [ ] 연말정산 검증/에러리포트 API 구현
- [ ] 급여/연말 마감 및 취소 API 구현
- [ ] 연말정산 관리 화면 구현 (`/payroll/year-end`)
- [ ] 감사로그/재처리 정책 수립

완료 기준:
- [ ] 마감/취소 이력이 감사 가능하게 남음
- [ ] 재실행 시 데이터 정합성 보장

---

## E6. SYS 데이터 이관/정합성 점검 도구
- 우선순위: 중
- 상태: [ ] 미시작
- 목표: 데이터 복사/삭제/정합성 검증 도구 제공

체크리스트:
- [ ] 데이터 이관 실행 API 구현 (권한 제한 강함)
- [ ] 정합성 점검 API 구현 (FK/중복/누락 검증)
- [ ] 운영용 화면 구현 (`/settings/data-tools` 또는 별도 관리자 경로)
- [ ] 실행 이력/결과 로그 저장

완료 기준:
- [ ] dry-run/실행 모드 분리
- [ ] 위험 작업(전체삭제 등) 다중 확인/감사로그 필수

---

## E7. WEL 복리후생 모듈 본체
- 우선순위: 상
- 상태: [ ] 미시작
- 목표: `wel_benefit_types`를 넘어 실제 신청/승인/급여연동 구현

체크리스트:
- [ ] 복리후생 도메인 테이블 생성 (학자금/경조금/의료비/대출/연금/리조트/동호회/건강검진)
- [ ] 모듈별 API 구현 (`/api/v1/wel/{module}/*`)
- [ ] 승인 시 급여연동 서비스 구현 (`apply_welfare_to_payslip`)
- [ ] 프론트 페이지 구현 (`/wel/*`)
- [ ] AG Grid 화면은 `GRID_SCREEN`/`grid-screens.json` 등록

완료 기준:
- [ ] 승인 -> 급여반영 파이프라인 자동 동작
- [ ] 복리후생별 최소 1개 E2E 시나리오 통과

---

## E8. TRA 교육신청/필수교육
- 우선순위: 중
- 상태: [ ] 미시작
- 목표: 교육 신청/승인/필수교육 이수 관리
- 상세 체크리스트: `docs/TRA_MODULE_PLAN.md`

체크리스트:
- [ ] 교육 마스터/신청/이수 모델 설계
- [ ] 교육 API 구현 (`/api/v1/tra/*`)
- [ ] 프론트 화면 구현 (`/tra/*`)
- [ ] 권한/대상자/수료처리 정책 구현

완료 기준:
- [ ] 필수교육 대상자 추출 및 이수율 조회 가능

---

## E9. 메뉴 액션권한 (버튼 단위 권한)
- 우선순위: 상
- 상태: [ ] 미시작
- 목표: 메뉴 접근권한과 액션권한을 분리 운영

체크리스트:
- [ ] 테이블 추가: `app_menu_actions`, `app_role_menu_actions`
- [ ] API 추가:
  - [ ] `GET /api/v1/menus/actions/tree`
  - [ ] `GET /api/v1/menus/actions/roles/{roleId}`
  - [ ] `PUT /api/v1/menus/actions/roles/{roleId}`
- [ ] 권한관리 UI에 액션 매트릭스 탭 추가
- [ ] AG Grid 툴바 버튼 권한 연동 (`query/create/copy/template/upload/save/download`)
- [ ] 서버 API 액션 권한 검증 적용 (UI 비노출만으로 대체 금지)

완료 기준:
- [ ] 버튼 비활성/비노출 + 서버 차단이 모두 동작
- [ ] 권한 없는 사용자 직접 API 호출 시 403 반환

---

## 4. 실행 시작 체크리스트 (재실행용)

- [ ] 이번 사이클 대상 에픽 선택 (권장: E1, E2, E3, E9)
- [ ] 에픽별 브랜치 전략 결정 (`feature/e1-retire`, ...)
- [ ] 스키마 변경 포함 시 마이그레이션 전략 합의
- [ ] AG Grid 화면 변경 시 문서/레지스트리 동시 반영 원칙 확인
- [ ] 게이트 실행 및 결과 기록
  - [ ] `npm run validate:grid`
  - [ ] `npm run lint`
  - [ ] `npm run build`

---

## 5. 메모

- 본 문서는 실행 백로그이므로, “완료/미완료” 상태를 최신 코드 기준으로 계속 갱신한다.
- 테스트 문서(`TIM_PHASE2_TEST.md`, `TIM_PHASE3_TEST.md`, `MNG-DB-TEST-PLAN.md`)는 각 에픽 완료 시점에 함께 소진한다.

---

## 6. Progress Log

### 2026-02-27 (E1 - Phase 1 implemented)

- [x] Backend schema/model added
  - `hr_retire_checklist_items`
  - `hr_retire_cases`
  - `hr_retire_case_items`
  - `hr_retire_audit_logs`
- [x] Backend API added: `/api/v1/hr/retire/*`
  - checklist list/create/update
  - retire case list/create/detail
  - case item check update
  - confirm/cancel flow
- [x] HR status/history linkage implemented
  - employee `employment_status` transition on confirm/cancel
  - `HrEmployeeBasicProfile.retire_date` sync
  - history records (`hr_employee_info_records`, `hr_personnel_histories`) created
- [x] Frontend page added: `/hr/retire`
  - case creation, checklist processing, confirm/cancel, audit log view
  - checklist master item add UI
- [x] Menu/seed integrated
  - menu code `hr.retire` (`/hr/retire`)
  - default retire checklist seed (4 items)
- [x] Smoke verification done
  - create -> required check -> confirm -> cancel flow verified
