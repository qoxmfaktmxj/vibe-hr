# HR 도메인 테이블 리모델링 계획

작성일: 2026-02-27

## 1. 목적
- `hr_employee_info_records` 범용 카테고리 구조를 종료하고, 도메인별 물리 테이블로 분리한다.
- 테이블명은 `THRM` 번호 기반이 아니라 업무 의미 기반으로 사용한다.
- 상벌 신청은 별도 상벌신청 테이블을 만들지 않고 `hri_request_masters`와 연계한다.

## 2. 네이밍 합의안
- 주소+연락처: `hr_contact_points`
- 경력(사내/사외 통합): `hr_careers`
- 자격증(자격사항): `hr_licenses`
- 병역: `hr_military`
- 상벌(포상/징계 통합): `hr_reward_punish`

## 3. 핵심 설계 원칙
- 상벌(`hr_reward_punish`)은 `reward_punish_type` 컬럼으로 `REWARD`/`PUNISH` 구분한다.
- 상벌신청은 `hri_request_masters`를 헤더로 사용한다.
- 신청 상세는 `hri_request_masters.content_json` + `hri_request_histories.event_payload_json`로 관리한다.
- 승인 완료 시에만 `hr_reward_punish`로 반영한다.
- DB 프로시저/함수/트리거 없이 API/Service 레이어에서 처리한다.

## 4. 테이블 초안
### 4.1 `hr_contact_points`
- `id`, `employee_id`, `seq`
- `contact_type` (자택/주민등록/비상연락 등)
- `zip_code`, `addr1`, `addr2`
- `phone_mobile`, `phone_home`, `phone_work`
- `email`
- `emergency_name`, `emergency_relation`, `emergency_phone`
- `is_primary`, `valid_from`, `valid_to`
- `note`, `created_at`, `updated_at`, `created_by`, `updated_by`

### 4.2 `hr_careers`
- `id`, `employee_id`, `seq`
- `career_scope` (`INTERNAL`/`EXTERNAL`)
- `company_name`, `department_name`
- `position_title`, `job_title`
- `start_date`, `end_date`, `is_current`
- `career_years`, `career_months`
- `description`, `note`
- `created_at`, `updated_at`, `created_by`, `updated_by`

### 4.3 `hr_licenses`
- `id`, `employee_id`, `seq`
- `license_type`, `license_code`, `license_name`, `license_grade`
- `license_no`
- `issued_org`, `issued_date`, `renewal_date`, `expire_date`
- `allowance_yn`, `allowance_rate`, `allowance_amount`
- `note`
- `created_at`, `updated_at`, `created_by`, `updated_by`

### 4.4 `hr_military`
- `id`, `employee_id`, `seq`
- `military_type`, `branch`, `rank`
- `service_start_date`, `service_end_date`
- `discharge_type`, `exemption_reason`
- `special_case_yn`, `special_case_type`
- `note`
- `created_at`, `updated_at`, `created_by`, `updated_by`

### 4.5 `hr_reward_punish`
- `id`, `employee_id`, `seq`
- `reward_punish_type` (`REWARD`/`PUNISH`)
- `code`, `title`
- `reason`
- `action_date`
- `office_name`
- `amount`
- `status` (`DRAFT`/`REQUESTED`/`APPROVED`/`REJECTED`/`CONFIRMED`)
- `hri_request_id` (`hri_request_masters.id`)
- `note`
- `created_at`, `updated_at`, `created_by`, `updated_by`

## 5. 신청서 연계(상벌)
- 폼타입:
1. `HR_REWARD_APPLY`
2. `HR_PUNISH_APPLY`
- 저장:
1. 신청 작성/임시저장: `hri_request_masters`
2. 상태 이력/추가 payload: `hri_request_histories`
- 반영:
1. 승인 완료 전: `hr_reward_punish` 미반영
2. 승인 완료 후: `hr_reward_punish` upsert
3. 반려/회수: `hr_reward_punish` 변경 없음

## 6. API 목표 구조
- `GET/POST/PUT/DELETE /api/hr/contact-points/*`
- `GET/POST/PUT/DELETE /api/hr/careers/*`
- `GET/POST/PUT/DELETE /api/hr/licenses/*`
- `GET/POST/PUT/DELETE /api/hr/military/*`
- `GET/POST/PUT/DELETE /api/hr/reward-punish/*`
- `POST /api/hr/reward-punish/requests`
- `POST /api/hr/reward-punish/requests/{request_id}/submit`
- `POST /api/hr/reward-punish/requests/{request_id}/approve`
- `POST /api/hr/reward-punish/requests/{request_id}/reject`

## 7. 이행 순서
### Phase 1
- 신규 테이블 SQLModel 추가
- 마이그레이션 생성/적용

### Phase 2
- 서비스/스키마/API 도메인 분리
- 기존 `hr/basic` 범용 records read-only 호환

### Phase 3
- 화면 분리 및 메뉴 매핑
- 상벌 신청 UI + 결재 흐름 연결

### Phase 4
- 데이터 이관
- 통합 테스트/회귀 테스트
- 구 구조 제거

## 8. 완료 기준
- `hr_employee_info_records` 의존 없이 도메인 테이블 직접 CRUD
- 상벌 신청이 `hri_request_masters` 기반으로 동작
- 승인 시 `hr_reward_punish` 자동 반영
- 화면/백엔드/시드/이관 스크립트까지 일관성 확보
