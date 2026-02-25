# TIM Phase 3 - 휴가 관리 테스트 가이드

> 작성일: 2026-02-25
> 대상: 다른 AI 개발자를 위한 테스트 명세서
> 환경: 로컬 개발 (backend:8000, frontend:3000)

---

## 1. 환경 준비

### 1.1 Backend 기동
```bash
cd backend
python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

**기동 시 자동 실행:**
- `HrAnnualLeave` 테이블 생성
- 기존 직원 2,000명 대상 연차 자동 발생 (현재 연도)
- 메뉴 업데이트: tim.leave (휴가관리)

### 1.2 Frontend 기동
```bash
cd frontend
npm run dev
# http://localhost:3000
```

### 1.3 Test 계정
- 일반 직원: `kr-xxxx-xxxx` (2,000명)
- 관리자: `admin-local` / 비밀번호: `admin`

---

## 2. Backend API - 휴가신청 관리

### 2.1 휴가신청 목록 조회 (Pagination)

#### 2.1.1 전체 조회 (필터 + 페이지네이션)

```
GET /api/v1/tim/leave-requests?start_date=2026-02-01&end_date=2026-02-28&page=1&limit=50
```

**예상 응답:**
```json
{
  "items": [
    {
      "id": 1001,
      "employee_id": 100,
      "employee_name": "김민준",
      "leave_type": "annual",
      "attendance_code_id": 1,
      "start_date": "2026-02-25",
      "end_date": "2026-02-27",
      "leave_days": 3.0,
      "reason": "개인사정",
      "request_status": "pending",
      "created_at": "2026-02-20T09:00:00Z",
      "approver_employee_id": null,
      "approved_at": null
    }
  ],
  "total_count": 450,
  "page": 1,
  "limit": 50,
  "total_pages": 9
}
```

**검증 항목:**
- [ ] `total_count` = 해당 기간의 모든 신청 (2,000명 × 28일 × ?)
- [ ] `leave_days` = 근무일 수 (주말 제외, 예: 월~금 5건 아닌 3일)
- [ ] `total_pages` = ceil(450 / 50) = 9
- [ ] `start_date` <= `end_date`
- [ ] 페이지 순환 검증: page=9 요청 시 마지막 페이지 (1~50개)

#### 2.1.2 필터 테스트

**테스트 케이스 1: 직원별 조회**
```
GET /api/v1/tim/leave-requests?employee_id=100
```
- [ ] 해당 직원의 신청만 반환

**테스트 케이스 2: 상태별 조회**
```
GET /api/v1/tim/leave-requests?status=pending
```
- [ ] 대기 중인 신청만 반환

**테스트 케이스 3: 승인대기 (관리자용)**
```
GET /api/v1/tim/leave-requests/pending-approval?department_id=5
```
- [ ] 관리 부서의 대기 중인 신청만 반환 (또는 부서장 추적)

**테스트 케이스 4: 내 신청 (직원용)**
```
GET /api/v1/tim/leave-requests/my
```
- [ ] 로그인 직원의 신청만 반환

---

### 2.2 휴가신청 생성 API

#### 2.2.1 정상 신청

```
POST /api/v1/tim/leave-requests
Content-Type: application/json

{
  "attendance_code_id": 1,
  "start_date": "2026-02-25",
  "end_date": "2026-02-27",
  "reason": "개인사정"
}
```

**예상 응답 (201 Created):**
```json
{
  "id": 1001,
  "employee_id": 100,
  "leave_type": "annual",
  "start_date": "2026-02-25",
  "end_date": "2026-02-27",
  "leave_days": 3.0,
  "reason": "개인사정",
  "request_status": "pending",
  "created_at": "2026-02-20T10:15:23Z"
}
```

**검증:**
- [ ] 근무일 계산: 2/25(수), 2/26(목), 2/27(금) = 3일
- [ ] 상태: "pending"
- [ ] request_status 확인

#### 2.2.2 연차 잔여 확인 검증

**준비:**
1. 직원 A의 현재 연차 잔여: 10일
2. 신청 시도: 15일

```
POST /api/v1/tim/leave-requests

{
  "attendance_code_id": 1,
  "start_date": "2026-02-25",
  "end_date": "2026-03-11",
  "reason": "해외 출장"
}
```

**예상 응답 (400 Bad Request):**
```json
{
  "detail": "Insufficient annual leave: 10 days remaining, requested 15 days"
}
```

- [ ] 에러 메시지 명확
- [ ] 요청 거절 (DB에 기록 안 됨)

#### 2.2.3 중복 신청 감지

**준비:**
1. 직원 B의 기존 신청: 2/25~2/27 (approved)
2. 동일 기간 신청 시도

```
POST /api/v1/tim/leave-requests

{
  "attendance_code_id": 1,
  "start_date": "2026-02-26",
  "end_date": "2026-02-28",
  "reason": "또 다른 신청"
}
```

**예상 응답 (409 Conflict):**
```json
{
  "detail": "Overlapping leave request exists: 2026-02-26 ~ 2026-02-27 (approved)"
}
```

- [ ] 오버래핑 감지
- [ ] 상태(approved/pending)에 관계없이 감지
- [ ] 부분 오버래핑도 감지 (완전 포함 아닐 때)

#### 2.2.4 최소/최대 일수 검증

**테스트 케이스: 반차는 최대 0.5일**

```
POST /api/v1/tim/leave-requests

{
  "attendance_code_id": 2,  # 오전반차 (C01A, max 0.5)
  "start_date": "2026-02-25",
  "end_date": "2026-02-26",
  "reason": "오류"
}
```

**예상 응답 (400 Bad Request):**
```json
{
  "detail": "Maximum 0.5 days allowed for this leave type, requested 2.0 days"
}
```

- [ ] 최대 일수 초과 방지
- [ ] 반차/시간 단위 지원 확인

---

### 2.3 휴가승인 API

#### 2.3.1 정상 승인

```
POST /api/v1/tim/leave-requests/1001/approve
Content-Type: application/json

{}  # 또는 { "reason": "승인" }
```

**예상 응답:**
```json
{
  "id": 1001,
  "request_status": "approved",
  "approver_employee_id": 1,
  "approved_at": "2026-02-20T10:30:00Z",
  "message": "휴가가 승인되었습니다."
}
```

**DB 확인:**
- [ ] HrLeaveRequest.request_status = "approved"
- [ ] HrLeaveRequest.approver_employee_id = 로그인 관리자
- [ ] HrAnnualLeave.used_days += 3.0 (연차인 경우)
- [ ] HrAnnualLeave.remaining_days -= 3.0

#### 2.3.2 권한 검증: 관리자만 가능

```
# 일반 직원으로 로그인 후
POST /api/v1/tim/leave-requests/1001/approve

# 예상: 403 Forbidden
{ "detail": "권한이 없습니다" }
```

- [ ] 직원 권한 거절
- [ ] hr_manager/admin만 승인 가능

#### 2.3.3 상태 검증: pending만 승인 가능

```
# 이미 rejected 상태인 신청 승인 시도
POST /api/v1/tim/leave-requests/1002/approve

# 예상: 400 Bad Request
{ "detail": "Can only approve pending requests, current: rejected" }
```

- [ ] 상태 체크

---

### 2.4 휴가반려 API

```
POST /api/v1/tim/leave-requests/1001/reject
Content-Type: application/json

{
  "reason": "개인사정 신청은 경영진 승인 필요"
}
```

**예상 응답:**
```json
{
  "id": 1001,
  "request_status": "rejected",
  "rejection_reason": "개인사정 신청은 경영진 승인 필요",
  "approved_at": "2026-02-20T10:35:00Z"
}
```

**검증:**
- [ ] request_status = "rejected"
- [ ] rejection_reason 저장됨
- [ ] 연차 미차감 (approved가 아니므로)

---

### 2.5 휴가취소 API

#### 2.5.1 approved 상태에서 취소 (연차 복구)

```
# 승인된 연차 신청 1003 (3일) 취소
POST /api/v1/tim/leave-requests/1003/cancel

{
  "reason": "계획 변경"
}
```

**예상 응답:**
```json
{
  "request_status": "cancelled",
  "cancellation_reason": "계획 변경"
}
```

**DB 확인:**
- [ ] HrAnnualLeave.used_days -= 3.0 (복구)
- [ ] HrAnnualLeave.remaining_days += 3.0

#### 2.5.2 pending 상태에서 취소

- [ ] request_status = "cancelled"
- [ ] 연차 변동 없음 (아직 승인 안 됨)

#### 2.5.3 이미 cancelled/rejected 상태에서 취소 시도

```
POST /api/v1/tim/leave-requests/1004/cancel

# 예상: 400 Bad Request
{ "detail": "Cannot cancel rejected request" }
```

---

## 3. Backend API - 연차 관리

### 3.1 연차 잔여 조회

#### 3.1.1 현재 연도

```
GET /api/v1/tim/annual-leave/100?year=2026
```

**예상 응답:**
```json
{
  "employee_id": 100,
  "year": 2026,
  "granted_days": 16.0,
  "used_days": 5.0,
  "carried_over_days": 2.0,
  "remaining_days": 13.0,
  "expiration_date": "2027-12-31"
}
```

**검증:**
- [ ] remaining_days = 16.0 + 2.0 - 5.0 = 13.0
- [ ] 입사 시점에 따른 granted_days 정확성

#### 3.1.2 연차 자동 발생 로직 검증

**시나리오: 다양한 입사 년도 직원**

**직원 A: 2025-05-15 입사 → 2026-01**
```
years_of_service = 2026-01-01 - 2025-05-15 = ~0.6년
→ granted_days = 0.6 * 12 ≈ 7일 (월 1일 단위)
```

**직원 B: 2023-03-01 입사 → 2026-01**
```
years_of_service = 2026-01-01 - 2023-03-01 ≈ 2.83년
→ 1년 이상 3년 미만 → granted_days = 15.0
```

**직원 C: 2020-03-01 입사 → 2026-01**
```
years_of_service = 2026-01-01 - 2020-03-01 ≈ 5.83년
→ 3년 이상 → extra = (5.83 - 3) // 2 = 1 → granted_days = 16.0
```

**직원 D: 2010-01-01 입사 → 2026-01**
```
years_of_service ≈ 16년
→ extra = (16 - 3) // 2 = 6 → 15 + 6 = 21, min(21, 25) = 21.0
```

**테스트:** 각 케이스 계산 정확성 확인
- [ ] A: 7일
- [ ] B: 15일
- [ ] C: 16일
- [ ] D: 21일

### 3.2 연차 이력 조회 (다년도)

```
GET /api/v1/tim/annual-leave/100/history
```

**예상 응답:**
```json
{
  "leaves": [
    { "year": 2026, "granted_days": 16.0, "remaining_days": 13.0 },
    { "year": 2025, "granted_days": 15.0, "remaining_days": 0.0 },
    { "year": 2024, "granted_days": 15.0, "remaining_days": 0.5 }
  ]
}
```

- [ ] 연도별 정렬 (최신순)
- [ ] 모든 연도 데이터 포함

### 3.3 월이월 검증

**시나리오: 2025년 5일 미사용 → 2026 월이월**

**2025년:**
```
granted: 15, used: 10, remaining: 5
```

**2026년 자동 발생 시:**
```
carried_over_days = min(2025_remaining, 5) = 5.0
granted_days = 16.0  # 2026 기본
remaining_days = 16.0 + 5.0 - used = 21.0 (초과 가능)
```

- [ ] carried_over_days = 5.0 (cap 적용)
- [ ] remaining 초기값 = 21.0

---

### 3.4 연차 수동 조정 (관리자)

```
POST /api/v1/tim/annual-leave/100/adjust

{
  "year": 2026,
  "adjustment_days": 3.0,
  "reason": "30일 병가 대체휴가 3일 지급"
}
```

**예상 응답:**
```json
{
  "granted_days": 19.0,
  "remaining_days": 16.0,
  "note": "30일 병가 대체휴가 3일 지급 (adjusted: +3.0d)"
}
```

- [ ] granted_days 증가
- [ ] remaining_days 반영
- [ ] 음수 조정도 지원 (reduction 시나리오)

---

## 4. 근무일 계산 검증

### 4.1 주말 제외

```
신청: 2026-02-23(월) ~ 2026-02-28(토)

계산:
2/23(월) ✓, 2/24(화) ✓, 2/25(수) ✓, 2/26(목) ✓, 2/27(금) ✓
2/28(토) ✗ (주말)

결과: 5일
```

- [ ] leave_days = 5.0

### 4.2 공휴일 제외

**2026년 설날: 2/16(월), 2/17(화), 2/18(수)**

```
신청: 2026-02-16(월) ~ 2026-02-20(금)

계산:
2/16(월) ✗ (공휴일)
2/17(화) ✗ (공휴일)
2/18(수) ✗ (공휴일)
2/19(목) ✓
2/20(금) ✓

결과: 2일
```

- [ ] leave_days = 2.0
- [ ] 연차가 2일만 차감

### 4.3 혼합 (주말 + 공휴일)

```
신청: 2026-02-16(월) ~ 2026-02-22(일)

계산:
2/16(월) ✗ (공휴일)
2/17(화) ✗ (공휴일)
2/18(수) ✗ (공휴일)
2/19(목) ✓
2/20(금) ✓
2/21(토) ✗ (주말)
2/22(일) ✗ (주말)

결과: 2일
```

- [ ] leave_days = 2.0

---

## 5. 권한 제어 테스트

### 5.1 직원 권한

**직원 A (employee):**
- [x] 자신의 휴가신청 가능
- [x] 자신의 신청 조회 가능 (`/my`)
- [x] 자신의 신청 취소 가능 (pending만)
- [ ] 다른 직원 신청 조회 불가 (403)
- [ ] 휴가 승인 불가 (403)

### 5.2 관리자 권한

**관리자 (hr_manager/admin):**
- [x] 전체 휴가신청 조회 가능
- [x] 부서별 신청 조회 가능
- [x] 승인/반려 가능
- [x] 다른 직원 신청 취소 가능
- [x] 연차 수동 조정 가능

### 5.3 무인증 거부

```
GET /api/v1/tim/leave-requests (쿠키 없음)

# 예상: 401 Unauthorized
{ "detail": "Not authenticated" }
```

---

## 6. 성능 테스트

### 6.1 대규모 조회 (2K명 × 50회 신청)

```bash
curl "http://localhost:8000/api/v1/tim/leave-requests?page=1&limit=100" \
  -H "Authorization: Bearer <token>" \
  -w "\nResponse time: %{time_total}s\n"
```

**목표:** < 2초
- [ ] 응답 시간 측정
- [ ] 메모리 급증 확인 (htop 또는 Resource Monitor)

### 6.2 마지막 페이지 접근

```
total_count = 100,000 (가정)
limit = 50
total_pages = 2,000

GET /api/v1/tim/leave-requests?page=2000&limit=50
```

- [ ] 정상 응답
- [ ] 범위 초과 시 에러 또는 empty

### 6.3 동시 신청 처리

**시나리오:**
- 5명이 동시에 휴가신청
- 동시에 승인 시도
- 결과: 모두 성공, 연차 정확하게 차감

**도구:** `ab` 또는 `siege`

```bash
ab -n 100 -c 10 http://localhost:8000/api/v1/tim/leave-requests
```

- [ ] 요청 성공률 100%
- [ ] 중복 신청 없음
- [ ] DB 일관성 유지

---

## 7. 통합 테스트 시나리오

### 시나리오: 월말 휴가 처리 플로우

1. **직원 A:** 3/1~3/5 (금~화, 4일) 휴가신청
2. **직원 B:** 3/1~3/5 (동일 기간) 신청 → 중복 감지? (다른 직원이므로 허용)
3. **관리자:** 두 신청 승인
4. **직원 A:** 3/3(일) 취소 → 연차 1일 복구
5. **월말 정산:** 부서별 휴가 사용률 조회

**흐름:**
```
직원 A 신청 (4일)
  → pending 상태, used_days = 0

직원 B 신청 (4일)
  → pending 상태, used_days = 0

관리자 직원A 승인
  → approved 상태, used_days = 4

관리자 직원B 승인
  → approved 상태, used_days = 4

직원A 취소 (중간에)
  → cancelled 상태, used_days -= 3 (3/1~3/2만)

재계산: remaining = granted - (4 + 4 - 3) = granted - 5
```

**검증:**
- [ ] 각 단계 상태 정확
- [ ] 연차 계산 정확
- [ ] 중복 신청 구분

---

## 8. 에러 처리 테스트

### 8.1 입력 값 검증

```
POST /api/v1/tim/leave-requests

{
  "attendance_code_id": 999,
  "start_date": "2026-03-05",
  "end_date": "2026-03-03",
  "reason": ""
}
```

**예상: 400 Bad Request**
```json
{
  "detail": [
    { "loc": ["body", "attendance_code_id"], "msg": "Code not found" },
    { "loc": ["body", "end_date"], "msg": "end_date must be >= start_date" },
    { "loc": ["body", "reason"], "msg": "reason required" }
  ]
}
```

### 8.2 존재하지 않는 신청

```
GET /api/v1/tim/leave-requests/999999
```

**예상: 404 Not Found**
```json
{ "detail": "Leave request not found" }
```

---

## 9. 데이터베이스 검증

### 9.1 테이블 구조

```bash
# PostgreSQL
SELECT table_name FROM information_schema.tables
WHERE table_name LIKE 'hr_annual_leave%' OR table_name LIKE 'tim_leave%';
```

**검증:**
- [ ] hr_annual_leaves 테이블 존재
- [ ] tim_leave_requests 테이블 확장됨 (새 컬럼)

### 9.2 인덱스 확인

```bash
SELECT indexname FROM pg_indexes WHERE tablename = 'hr_annual_leaves';
SELECT indexname FROM pg_indexes WHERE tablename = 'tim_leave_requests';
```

**검증:**
- [ ] `ix_annual_leave_emp_year` 존재
- [ ] `ix_tim_leave_requests_employee_dates` 존재

### 9.3 시드 데이터

```bash
SELECT COUNT(*) FROM hr_annual_leaves WHERE year = 2026;
```

- [ ] 2,000건 (직원 수)

---

## 10. 테스트 결과 체크리스트

```markdown
# Phase 3 테스트 결과

테스트 일시: 2026-02-25
테스터: [이름]

## API 테스트 (/30)
- [ ] 휴가목록 조회
- [ ] 필터링 (직원/상태/기간)
- [ ] 페이지네이션
- [ ] 휴가신청 (정상)
- [ ] 근무일 계산 (주말/공휴일 제외)
- [ ] 중복 신청 감지
- [ ] 연차 잔여 확인
- [ ] 최소/최대 일수 검증
- [ ] 휴가승인
- [ ] 승인 권한 검증
- [ ] 상태 검증 (pending만)
- [ ] 휴가반려
- [ ] 휴가취소 (연차 복구)
- [ ] 다른 상태 취소 거절
- [ ] 연차 조회
- [ ] 연차 자동 발생 (1년/3년/5년)
- [ ] 월이월 (5일 cap)
- [ ] 연차 조정
- [ ] 역사 조회
- [ ] 무인증 거부
- [ ] 직원 권한 제어
- [ ] 관리자 권한
- [ ] 404 에러
- [ ] 400 입력값 검증
- [ ] 응답 시간 < 2초
- [ ] 동시 요청 처리
- [ ] DB 인덱스
- [ ] 시드 데이터
- [ ] 월이월 검증
- [ ] 통합 시나리오

## Frontend 테스트 (/10)
- [ ] 휴가신청 폼 (직원용)
- [ ] 휴가목록 조회 (직원용 + 관리자용)
- [ ] AG Grid 페이지네이션
- [ ] 승인/반려 버튼 (관리자)
- [ ] 연차 현황 카드
- [ ] 연차 자동 계산 표시
- [ ] 중복 신청 에러 메시지
- [ ] 권한 거절 화면
- [ ] 로딩 상태
- [ ] 성공/실패 토스트

## 권한 & 보안 (/5)
- [ ] 직원 권한 분리
- [ ] 관리자 권한
- [ ] 타 직원 접근 거절
- [ ] CORS 설정
- [ ] Token 검증

## 성능 (/5)
- [ ] 조회 응답 < 2초
- [ ] 메모리 안정성
- [ ] 대규모 페이지네이션
- [ ] 동시 처리
- [ ] DB 쿼리 최적화 (EXPLAIN)

---

총합계: 50개 테스트
통과: __/50 (__%)
```

---

## 11. 주의사항

1. **Time Zone:**
   - UTC 기준 저장 (`default_factory=utc_now`)
   - 클라이언트에서 로컬 타임존 표시

2. **근무일 계산:**
   - `tim_holidays` 데이터 정확성 필수
   - 공휴일 누락 시 일수 오류

3. **동시성:**
   - 낙관적 잠금 (update 충돌은 기대함)
   - 트랜잭션 격리 수준: READ_COMMITTED 이상

4. **근로기준법:**
   - 월이월 5일 cap 엄격 적용
   - 25일 ceiling 확인

5. **디버깅:**
   - Backend 로그: INFO level에서 수행 시간 출력
   - Frontend: Network 탭에서 API 응답 시간 확인
