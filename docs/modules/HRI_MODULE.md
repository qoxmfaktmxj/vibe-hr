# 신청서(HRI) 모듈 상세 문서

## 핵심 설계 원칙 (요청 반영)
- **신청서 공통 마스터 1개 + 신청유형별 상세 테이블 분리**
- 즉, `마스터(공통)` : `상세(유형별)` = **1:1**

## 권장 DB 구조
### 1) 공통 마스터
`hri_request_masters`
- request_no (자동채번)
- requester_id
- requested_at
- status_code
- form_code
- title
- current_step_order
- submitted_at / completed_at

### 2) 유형별 상세 테이블(예시)
- `hri_req_tim_attendance`
  - request_id(FK, unique)
  - attendance_code
  - start_date / end_date
  - start_time / end_time
  - applied_minutes (분 단위)
  - reason
- `hri_req_cert_employment`
- `hri_req_education_support`
- `hri_req_condolence`
- ... (신청서별 개별 확장)

## 분 단위 정책
- 근태 신청 시간 계산은 **분 단위**를 기본
- 반차/시간차/외근 등 세밀 정책 확장 가능

## 현재 구현 상태
- 공통 결재 엔진/히스토리/스냅샷 구조는 이미 존재
- 현재 일부는 `content_json` 기반
- 다음 단계에서 유형별 상세 테이블로 점진 전환 권장

## 전환 전략(권장)
1. 신규 신청부터 상세 테이블 동시 저장 (dual write)
2. 조회는 상세 테이블 우선, 없으면 JSON fallback
3. 안정화 후 JSON 의존 단계적 축소

## 주요 경로
- Backend API:
  - `backend/app/api/hri_form_type.py`
  - `backend/app/api/hri_approval_template.py`
  - `backend/app/api/hri_request.py`
- Frontend:
  - `frontend/src/app/hri/*`
  - `frontend/src/components/hri/*`

## 저장 순서 정책 (요청 반영)
**TIM → CPN → HRI** 순으로 반영/점검한다.
(현재 seed 호출 체인도 이 순서 유지)
