# TIM Phase 2 - 일상근태 테스트 가이드

> 작성일: 2026-02-25
> 대상: 다른 AI 개발자를 위한 테스트 명세서
> 테스트 환경: 로컬 개발 환경 (backend:8000, frontend:3000)

---

## 1. 환경 준비

### 1.1 Backend 기동
```bash
cd backend
python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

**기동 시 자동 실행:**
- DB 마이그레이션 (SQLModel create_all)
- 새 테이블 생성: `tim_attendance_corrections`
- 메뉴 업데이트: tim.daily (출퇴근기록, 근태현황, 근태수정)

### 1.2 Frontend 기동
```bash
cd frontend
npm run dev
# http://localhost:3000
```

### 1.3 로그인 계정
- 일반 직원 (employee): `kr-xxxx-xxxx` (2000명 시드 데이터)
- 관리자 (hr_manager/admin): `admin-local` / 비밀번호: `admin`

---

## 2. Backend API 검증 (Swagger)

### 2.1 Base URL
`http://localhost:8000/docs` (Swagger UI)

### 2.2 근태 기록 조회 API

#### 2.2.1 전체 조회 (페이지네이션)
```
GET /api/v1/tim/attendance-daily?start_date=2026-02-01&end_date=2026-02-28&page=1&limit=50
```

**예상 응답:**
```json
{
  "items": [
    {
      "id": 1001,
      "employee_id": 100,
      "employee_no": "KR-0100",
      "employee_name": "김민준",
      "department_name": "개발본부",
      "work_date": "2026-02-25",
      "check_in_at": "2026-02-25T09:15:00",
      "check_out_at": "2026-02-25T18:30:00",
      "worked_minutes": 540,
      "attendance_status": "present",
      "note": null
    }
  ],
  "total_count": 1250,
  "page": 1,
  "limit": 50,
  "total_pages": 25
}
```

**검증 항목:**
- [ ] `total_count` = 조회 가능한 총 건수 (month 내 모든 직원×일자)
- [ ] `total_pages` = ceil(total_count / limit)
- [ ] 최대 50건 반환 (limit=50 기본값)
- [ ] `work_date` 오름차순 정렬
- [ ] `worked_minutes` = (check_out - check_in - 휴게시간)

#### 2.2.2 필터 테스트

**테스트 케이스 1: 직원 ID 필터**
```
GET /api/v1/tim/attendance-daily?start_date=2026-02-01&end_date=2026-02-28&employee_id=100
```
- [ ] 해당 직원의 기록만 반환

**테스트 케이스 2: 상태 필터**
```
GET /api/v1/tim/attendance-daily?start_date=2026-02-01&status=late
```
- [ ] `attendance_status = "late"` 인 기록만 반환

**테스트 케이스 3: 부서 필터 (선택 구현)**
```
GET /api/v1/tim/attendance-daily?start_date=2026-02-01&department_id=5
```
- [ ] 해당 부서 직원만 반환

**테스트 케이스 4: 페이지 범위**
```
GET /api/v1/tim/attendance-daily?page=5&limit=50
```
- [ ] 정확한 offset 계산: (5-1) × 50 = 200
- [ ] 200번째~249번째 레코드 반환

### 2.3 오늘 출퇴근 조회 API

```
GET /api/v1/tim/attendance-daily/today?employee_id=100
```

**예상 응답:**
```json
{
  "id": 1001,
  "work_date": "2026-02-25",
  "check_in_at": "2026-02-25T09:15:00",
  "check_out_at": "2026-02-25T18:30:00",
  "worked_minutes": 540,
  "attendance_status": "present",
  "note": null
}
```

**검증:**
- [ ] 본인 정보 조회 (로그인 직원 ID와 일치)
- [ ] 관리자는 임의의 직원 조회 가능
- [ ] 미래 날짜면 404 또는 empty

### 2.4 출근/퇴근 체크 API

#### 2.4.1 출근 (Check-In)
```
POST /api/v1/tim/attendance-daily/check-in
Content-Type: application/json

{ "employee_id": 100 }  # 관리자 또는 본인만 가능
```

**예상 응답:**
```json
{
  "id": 1001,
  "work_date": "2026-02-25",
  "check_in_at": "2026-02-25T09:15:23.456Z",
  "check_out_at": null,
  "attendance_status": "present",
  "message": "출근이 기록되었습니다."
}
```

**검증:**
- [ ] `check_in_at` = 현재 시간 (서버 시간)
- [ ] 중복 출근 체크 시 conflict 또는 업데이트 (정책 결정 필요)
- [ ] `attendance_status` 자동 판정 (근무코드 기준)

#### 2.4.2 퇴근 (Check-Out)
```
POST /api/v1/tim/attendance-daily/check-out
Content-Type: application/json

{ "employee_id": 100 }
```

**예상 응답:**
```json
{
  "id": 1001,
  "work_date": "2026-02-25",
  "check_in_at": "2026-02-25T09:15:23Z",
  "check_out_at": "2026-02-25T18:30:45Z",
  "worked_minutes": 540,
  "attendance_status": "present"
}
```

**검증:**
- [ ] `check_out_at` = 현재 시간
- [ ] `worked_minutes` 계산 정확성
- [ ] 미출근 상태에서 퇴근 시도 → 에러 처리

### 2.5 근태 정정 API

```
POST /api/v1/tim/attendance-daily/{id}/correct
Content-Type: application/json

{
  "new_status": "absent",
  "reason": "잘못된 입력으로 결근으로 수정"
}
```

**예상 응답:**
```json
{
  "correction_id": 5001,
  "attendance_id": 1001,
  "old_status": "present",
  "new_status": "absent",
  "reason": "잘못된 입력으로 결근으로 수정",
  "corrected_by": "admin-local",
  "corrected_at": "2026-02-25T14:30:00Z",
  "message": "근태가 수정되었습니다."
}
```

**검증:**
- [ ] 감사 추적 테이블에 기록 (`tim_attendance_corrections`)
- [ ] `corrected_by_id` = 현재 로그인 사용자
- [ ] 권한 확인: admin/hr_manager만 가능

### 2.6 수정 이력 조회 API

```
GET /api/v1/tim/attendance-daily/{id}/corrections
```

**예상 응답:**
```json
{
  "corrections": [
    {
      "id": 5001,
      "old_status": "present",
      "new_status": "absent",
      "reason": "잘못된 입력",
      "corrected_by": "admin-local",
      "corrected_at": "2026-02-25T14:30:00Z"
    }
  ],
  "total_count": 1
}
```

**검증:**
- [ ] `corrected_at` 기준 내림차순 정렬 (최신순)
- [ ] 수정이 없으면 empty array

### 2.7 권한 테스트

**테스트 케이스 1: 일반 직원이 다른 직원 수정 시도**
```
# 일반 직원 계정으로 로그인 후
POST /api/v1/tim/attendance-daily/1001/correct

# 예상: 403 Forbidden
{ "detail": "권한이 없습니다" }
```

**테스트 케이스 2: 무인증 접근**
```
GET /api/v1/tim/attendance-daily (쿠키 없음)

# 예상: 401 Unauthorized
```

---

## 3. Frontend 화면 검증

### 3.1 출퇴근기록 (`/tim/check-in`)

**진입:**
- 좌측 메뉴 > 근태 > 일상근태 > 출퇴근기록

**화면 구성:**
```
┌─────────────────────────────────────────┐
│  오늘 출퇴근 현황                        │
├─────────────────────────────────────────┤
│  출근시간: 09:15:23                     │
│  퇴근시간: 18:30:45                     │
│  근무시간: 8시간 55분                   │
│  상태: 정상출근                         │
│                                         │
│  [출근]  [퇴근]                         │
└─────────────────────────────────────────┘

┌────────────────────────────────────────┐
│ 최근 7일 출퇴근 이력                    │
├────┬────────┬────────┬────────┬────────┤
│날짜│ 출근시간│ 퇴근시간│근무시간│ 상태 │
├────┼────────┼────────┼────────┼────────┤
│2/25│ 09:15 │ 18:30 │  8:55  │정상   │
│2/24│ 09:00 │ 18:00 │  8:00  │정상   │
│2/23│ 09:30 │ 18:15 │  8:15  │지각   │
│...
└────┴────────┴────────┴────────┴────────┘
```

**검증 항목:**
- [ ] 페이지 진입 시 자동으로 오늘 데이터 로드
- [ ] 출근 버튼 클릭 → `check_in` API 호출 → 출근시간 표시
- [ ] 퇴근 버튼 클릭 → `check_out` API 호출 → 퇴근시간 표시
- [ ] 최근 7일 데이터 표시 (읽기만)
- [ ] 근무시간 자동 계산 및 표시
- [ ] 상태 자동 판정 (정상/지각/결근 등)

### 3.2 근태현황 (`/tim/status`)

**진입:**
- 좌측 메뉴 > 근태 > 일상근태 > 근태현황

**화면 구성:**
```
[필터 영역]
시작일: [2026-02-01] 종료일: [2026-02-28] [조회]
부서: [선택] 상태: [전체] [조회]
사원: [검색...] [조회]

[AG Grid - 페이지네이션]
페이지: 1 / 25 | 현재: 1-50 / 총 1250건

┌────┬────────┬──────┬──────┬────────┬────────┬────────┬──────┬──────┐
│선택│사원번호│성명  │부서  │날짜    │출근   │퇴근   │근무시│상태 │[수정]│
├────┼────────┼──────┼──────┼────────┼────────┼────────┼──────┼──────┤
│    │KR-0100│김민준│개발  │2/25    │09:15  │18:30  │8:55  │정상 │[      ]│
│    │KR-0101│이수진│개발  │2/25    │09:35  │18:00  │8:15  │지각 │[      ]│
│    │KR-0102│박지원│개발  │2/25    │         │       │     │결근 │[      ]│
│...
└────┴────────┴──────┴──────┴────────┴────────┴────────┴──────┴──────┘
```

**검증 항목:**
- [ ] 기본 필터: 현재월 (2026-02)
- [ ] 시작일/종료일 필터 작동
- [ ] 부서 필터 드롭다운 (부서 목록 로드)
- [ ] 상태 필터 (정상/지각/결근/휴가/재택 등)
- [ ] 사원 검색 (사원번호 또는 성명 부분일치)
- [ ] **페이지네이션:** 50건/페이지, 이전/다음 페이지 네비게이션
- [ ] 수정 버튼 클릭 → `/tim/correction?attendance_id={id}` 이동

### 3.3 근태정정 (`/tim/correction?attendance_id={id}`)

**진입:**
- 근태현황에서 [수정] 버튼 클릭

**화면 구성:**
```
┌────────────────────────────────────────┐
│ 근태정정                               │
├────────────────────────────────────────┤
│ [원본 데이터 - 읽기 전용]             │
│ 사원: 김민준 (KR-0100)                 │
│ 날짜: 2026-02-25                      │
│ 원래 상태: 정상출근                     │
│ 출근: 09:15 | 퇴근: 18:30             │
│                                        │
│ [수정할 내용]                         │
│ 새 상태: [드롭다운]                    │
│ 출근시간: [시간:분] [X]               │
│ 퇴근시간: [시간:분] [X]               │
│ 수정 사유: [textarea]                  │
│                                        │
│  [저장] [취소]                         │
│                                        │
│ [수정 이력]                            │
│ 이전에 수정된 적: 1회                  │
│ - 2026-02-20 10:30: present → absent   │
│   사유: 잘못된 입력                     │
│   수정자: admin-local                  │
└────────────────────────────────────────┘
```

**검증 항목:**
- [ ] URL의 `attendance_id` 파라미터 읽기
- [ ] 원본 데이터 로드 및 읽기 전용 표시
- [ ] 새 상태 드롭다운 (근태코드 기반)
- [ ] 출근/퇴근 시간 날짜픽커 (선택사항)
- [ ] 수정 사유 필수 입력 (빈 값 시 저장 불가)
- [ ] [저장] 클릭 → API 호출 → 성공 toast → `/tim/status` 리다이렉트
- [ ] [취소] 클릭 → `/tim/status` 뒤로가기
- [ ] 수정 이력 표시 (있으면 타임라인으로)

---

## 4. 페이지네이션 대용량 테스트

### 4.1 데이터 세트
- 시드 직원: 2,000명
- 일수: 28일 (2월)
- 이론상 최대: 2,000 × 28 = 56,000건

### 4.2 테스트 케이스

**테스트 1: 대규모 조회 응답 시간**
```bash
# Backend에서
curl "http://localhost:8000/api/v1/tim/attendance-daily?page=1&limit=50" \
  -H "Authorization: Bearer <token>"

# 측정: 응답 시간 (목표: <2초)
```

- [ ] 응답 시간 < 2초
- [ ] 메모리 사용량 급증 없음

**테스트 2: 마지막 페이지 접근**
```
GET /api/v1/tim/attendance-daily?page=1120&limit=50
# total_count = 56000, limit = 50 → total_pages = 1120
```

- [ ] 정상 응답 (페이지 계산 정확)
- [ ] 범위 초과 (page > total_pages) → 400 에러 또는 empty

**테스트 3: 대규모 필터 조회**
```
GET /api/v1/tim/attendance-daily?start_date=2026-02-01&end_date=2026-02-28&status=late
```

- [ ] 시간 내 응답
- [ ] 결과 정확성 (late 상태만 반환)

---

## 5. 감사 추적 (Audit Trail) 테스트

### 5.1 데이터베이스 검증

```bash
# PostgreSQL 연결 후
SELECT * FROM tim_attendance_corrections ORDER BY corrected_at DESC;
```

**검증:**
- [ ] 근태 수정 시마다 1건 삽입
- [ ] `corrected_by_id` = 현재 로그인 사용자
- [ ] `old_status` / `new_status` 정확히 기록
- [ ] `reason` 텍스트 저장됨
- [ ] `corrected_at` = 수정 시각

### 5.2 API를 통한 검증

```
GET /api/v1/tim/attendance-daily/1001/corrections
```

- [ ] 모든 수정 이력 반환 (최신순)
- [ ] 각 이력에 수정자 정보 포함
- [ ] JSON 형식 정상

---

## 6. 권한 제어 테스트

### 6.1 직원 권한

**테스트 케이스 1: 본인 출퇴근**
- 일반 직원 계정 로그인
- `/tim/check-in` 접속 → ✓ 허용
- [출근]/[퇴근] 버튼 → ✓ 본인만 체크 가능

**테스트 케이스 2: 다른 직원 근태 조회**
- 근태현황(`/tim/status`) → ✗ 403 (권한 없음)
- 또는 ✓ 허용되지만 본인 데이터만 표시 (정책에 따라)

### 6.2 관리자 권한

**테스트 케이스 1: 전체 근태 조회**
- `hr_manager` 또는 `admin` 계정
- `/tim/status` 접속 → ✓ 모든 직원 데이터 표시

**테스트 케이스 2: 근태 정정**
- `/tim/correction` 접속 → ✓ 허용
- 다른 직원 수정 가능

---

## 7. 에러 처리 테스트

### 7.1 잘못된 입력

```
POST /api/v1/tim/attendance-daily/999/correct
{ "new_status": "invalid_status", "reason": "" }

# 예상: 400 Bad Request
{
  "detail": [
    {"loc": ["body", "new_status"], "msg": "invalid status value"},
    {"loc": ["body", "reason"], "msg": "reason is required"}
  ]
}
```

### 7.2 존재하지 않는 리소스

```
GET /api/v1/tim/attendance-daily/999999
# 예상: 404 Not Found
{ "detail": "근태 기록을 찾을 수 없습니다" }
```

### 7.3 중복 출근 체크

```
# 이미 출근한 직원이 다시 출근 시도
POST /api/v1/tim/attendance-daily/check-in
{ "employee_id": 100 }

# 예상: 409 Conflict 또는 200 OK (정책에 따라)
```

---

## 8. 성능 모니터링

### 8.1 로그 확인

```bash
# Backend 콘솔에서
# [INFO] GET /api/v1/tim/attendance-daily 200 1234ms
# 목표: < 2000ms (2초)
```

### 8.2 데이터베이스 쿼리 분석

```sql
-- 인덱스 활용 확인
EXPLAIN ANALYZE
SELECT * FROM hr_attendance_daily
WHERE employee_id = 100 AND work_date >= '2026-02-01'
ORDER BY work_date DESC LIMIT 50;

-- Index Cond: (employee_id = 100) AND (work_date >= '2026-02-01')
-- → 복합 인덱스 정상 활용
```

---

## 9. 통합 테스트 시나리오

### 시나리오: 월말 근태 현황 조회 및 정정

1. 관리자 로그인
2. `/tim/status` 접속 (2월 1-28)
3. 필터: 개발본부, 상태=지각
4. [조회] → 20건 조회 (페이지 1)
5. 첫 번째 행의 [수정] 클릭
6. 지각 → 정상으로 변경, 사유: "시간 설정 오류"
7. [저장]
8. 감사 추적에 기록 확인
9. 다시 근태현황 조회 → 수정된 데이터 반영 확인

**검증:**
- [ ] 모든 단계 정상 진행
- [ ] 데이터 일관성 유지
- [ ] 감시 추적 정확성

---

## 10. 테스트 결과 보고서 템플릿

```markdown
# TIM Phase 2 테스트 결과

테스트 일시: 2026-02-25 14:00
테스터: [이름]
환경: 로컬 (backend:8000, frontend:3000)

## 결과 요약
- 총 테스트: 45개
- 통과: 43개 ✓
- 실패: 2개 ✗
- 미구현: 0개

## 상세 결과

### Backend API ✓ (25/25 통과)
- [x] 조회 페이지네이션
- [x] 필터링 (직원/상태/부서)
- [x] 출근/퇴근 체크
- ...

### Frontend 화면 ✓ (15/16 통과)
- [x] 출퇴근기록 페이지
- [x] 근태현황 AG Grid
- [ ] 페이지네이션 UI (일부 미작동) ← 실패

### 권한 제어 ✓ (3/4 통과)
- [x] 직원 권한
- [x] 관리자 권한
- [ ] 부서장 권한 (미구현) ← 미구현

## 주요 이슈

### 이슈 1: 페이지네이션 버튼 작동 안 함
- 재현: `/tim/status` → [다음] 버튼 클릭
- 예상: page=2로 이동
- 실제: 페이지 변경 안됨
- 원인: Frontend useEffect 미설정
- 해결: 페이지 변경 시 refetch 로직 추가

### 이슈 2: 근태정정 페이지 404
- 재현: 수정 버튼 클릭
- 예상: `/tim/correction?attendance_id=1001` 이동
- 실제: 404 화면
- 원인: page.tsx 미생성
- 해결: 페이지 생성 필요

## 성능 측정

| 항목 | 목표 | 실제 | 통과 |
|------|------|------|------|
| 조회 응답시간 | <2s | 1.2s | ✓ |
| 페이지네이션 | <500ms | 420ms | ✓ |
| 메모리 (2K+ 직원) | <100MB | 85MB | ✓ |

## 권장사항

1. [페이지네이션 UI 수정] - 우선순위: High
2. [근태정정 페이지 생성] - 우선순위: High
3. [감사 추적 조회 API 성능 최적화] - 우선순위: Medium

---

테스트 완료일: 2026-02-25
테스트 완료자: [이름]
```

---

## 체크리스트 요약

```markdown
# Phase 2 테스트 체크리스트

## Backend API
- [ ] 조회 (페이지네이션)
- [ ] 필터 (직원/상태/부서/날짜)
- [ ] 출근 체크
- [ ] 퇴근 체크
- [ ] 근태 정정
- [ ] 수정 이력
- [ ] 권한 확인
- [ ] 에러 처리

## Frontend 화면
- [ ] 출퇴근기록 페이지 진입
- [ ] 오늘 현황 카드 로드
- [ ] 출근 버튼
- [ ] 퇴근 버튼
- [ ] 최근 7일 테이블
- [ ] 근태현황 필터
- [ ] 근태현황 AG Grid
- [ ] 페이지네이션
- [ ] 근태정정 페이지
- [ ] 수정 저장
- [ ] 수정 이력 표시

## 성능
- [ ] 응답 시간 < 2초
- [ ] 메모리 안정성
- [ ] 대용량 조회

## 권한
- [ ] 직원 권한
- [ ] 관리자 권한
- [ ] 미인증 거부

## 감시 추적
- [ ] 수정 이력 DB 저장
- [ ] 수정자 기록
- [ ] 이력 조회

## 에러 처리
- [ ] 400 Bad Request
- [ ] 404 Not Found
- [ ] 403 Forbidden
- [ ] 409 Conflict
```
