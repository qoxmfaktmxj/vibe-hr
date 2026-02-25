# 근태(TIM) 모듈 개발 계획서

> 작성일: 2026-02-25
> 프로젝트: Vibe-HR (인사관리 시스템)
> 대상 규모: 법인당 최대 6,000명

---

## 1. 개요

### 1.1 목적
대한민국 근로기준법에 부합하는 근태관리 시스템을 구축한다.
기초설정(Phase 1) → 일상근태(Phase 2) → 휴가관리(Phase 3) → 통계/리포트(Phase 4) 순으로 점진 개발한다.

### 1.2 기술 스택
| 구분 | 기술 |
|------|------|
| Frontend | Next.js 16 (App Router), React 19, TypeScript 5, AG Grid 35, shadcn/ui, Tailwind v4 |
| Backend | FastAPI 0.115, SQLModel 0.0.22, Python 3.12 |
| DB | PostgreSQL 16 |
| 인증 | Cookie 기반 JWT (httpOnly), BFF 프록시 패턴 |
| 상태관리 | React Context (MenuProvider, AuthProvider) |

### 1.3 성능 목표
- 6,000명 × 365일 = **연간 219만 건** 근태 레코드 처리
- 부서별/기간별 근태 현황 조회 **2초 이내** 응답
- 동시 접속 200명 이상 처리

---

## 2. Phase 1: 기초설정 ✅ 완료

### 2.1 진행 상태 요약

| 작업 | 상태 | 비고 |
|------|------|------|
| DB 모델 3개 (tim_attendance_codes, tim_work_schedule_codes, tim_holidays) | ✅ 완료 | entities.py에 추가됨 |
| 기존 테이블 복합 인덱스 (tim_attendance_daily, tim_leave_requests) | ✅ 완료 | 6,000명 대비 |
| 커넥션 풀 튜닝 (pool_size=20, max_overflow=30) | ✅ 완료 | database.py |
| Backend Schema (3개 모듈) | ✅ 완료 | schemas/tim_*.py |
| Backend Service (3개 모듈) | ✅ 완료 | services/tim_*_service.py |
| Backend API Router (3개 모듈) | ✅ 완료 | api/tim_*.py |
| 라우터 등록 (main.py) | ✅ 완료 | 3개 라우터 등록 |
| 시드 데이터 (근태코드 18개, 근무코드 8개, 공휴일 2025-2026) | ✅ 완료 | bootstrap.py |
| 메뉴 코드 정리 (hr.leave → tim.holidays 등) | ✅ 완료 | bootstrap.py |
| Frontend 타입 정의 | ✅ 완료 | types/tim.ts |
| BFF 프록시 라우트 (7개) | ✅ 완료 | api/tim/**/*.ts |
| 근태코드관리 화면 (AG Grid) | ✅ 완료 | attendance-code-manager.tsx |
| 근무코드관리 화면 (AG Grid) | ✅ 완료 | work-schedule-manager.tsx |
| 공휴일관리 화면 (AG Grid) | ✅ 완료 | holiday-manager.tsx (정적→DB 전환) |

---

### 2.2 DB 스키마 상세

#### 2.2.1 `tim_attendance_codes` (근태코드)

```
┌─────────────────┬──────────────┬─────────────────────────────────────┐
│ 컬럼            │ 타입         │ 설명                                │
├─────────────────┼──────────────┼─────────────────────────────────────┤
│ id              │ int PK       │ 자동증가                             │
│ code            │ varchar(20)  │ 근태코드 (C01, W01 등) UNIQUE        │
│ name            │ varchar(100) │ 근태명 (연차휴가, 지각 등)            │
│ category        │ varchar(20)  │ 분류: leave/work/special             │
│ unit            │ varchar(20)  │ 단위: day/am/pm/hour                 │
│ is_requestable  │ boolean      │ 직원 신청 가능 여부                   │
│ min_days        │ float NULL   │ 최소 신청일수 (0.5 = 반차)            │
│ max_days        │ float NULL   │ 최대 신청일수                        │
│ deduct_annual   │ boolean      │ 연차 차감 여부                       │
│ is_active       │ boolean      │ 사용 여부                            │
│ sort_order      │ int          │ 정렬 순서                            │
│ description     │ varchar(200) │ 설명                                │
│ created_at      │ datetime     │ 생성일시 (UTC)                       │
│ updated_at      │ datetime     │ 수정일시 (UTC)                       │
└─────────────────┴──────────────┴─────────────────────────────────────┘
```

**시드 데이터 (18개):**

| 코드 | 이름 | 분류 | 단위 | 신청가능 | 연차차감 | 최소 | 최대 |
|------|------|------|------|----------|----------|------|------|
| C01 | 연차휴가 | leave | day | O | O | 1 | 25 |
| C01A | 오전반차 | leave | am | O | O | 0.5 | 0.5 |
| C01B | 오후반차 | leave | pm | O | O | 0.5 | 0.5 |
| C02 | 하계휴가 | leave | day | O | X | 1 | 5 |
| C03 | 대체휴가 | leave | day | O | X | 1 | 100 |
| C04 | 병가 | leave | day | O | X | 1 | 90 |
| C05 | 경조휴가 | leave | day | O | X | 1 | 5 |
| C06 | 공가 | leave | day | O | X | 1 | 10 |
| C07 | 교육 | leave | day | O | X | 1 | 30 |
| C08 | 출산휴가 | leave | day | O | X | 1 | 120 |
| C09 | 육아휴직 | leave | day | O | X | 1 | 365 |
| W01 | 정상출근 | work | day | X | X | - | - |
| W02 | 지각 | work | day | X | X | - | - |
| W03 | 조퇴 | work | day | X | X | - | - |
| W04 | 결근 | work | day | X | X | - | - |
| W05 | 외출 | work | hour | O | X | - | - |
| W06 | 출장 | work | day | O | X | 1 | 30 |
| W07 | 재택근무 | work | day | O | X | 1 | 30 |

#### 2.2.2 `tim_work_schedule_codes` (근무코드)

```
┌─────────────────┬──────────────┬─────────────────────────────────────┐
│ 컬럼            │ 타입         │ 설명                                │
├─────────────────┼──────────────┼─────────────────────────────────────┤
│ id              │ int PK       │ 자동증가                             │
│ code            │ varchar(20)  │ 근무코드 (WS01 등) UNIQUE            │
│ name            │ varchar(100) │ 근무명 (주간근무, 야간근무 등)         │
│ work_start      │ varchar(5)   │ 출근시간 HH:MM (09:00)              │
│ work_end        │ varchar(5)   │ 퇴근시간 HH:MM (18:00)              │
│ break_minutes   │ int          │ 휴게시간 (분)                        │
│ is_overnight    │ boolean      │ 야간(익일) 근무 여부                  │
│ work_hours      │ float        │ 일 소정근로시간                      │
│ is_active       │ boolean      │ 사용 여부                            │
│ sort_order      │ int          │ 정렬 순서                            │
│ description     │ varchar(200) │ 설명                                │
│ created_at      │ datetime     │ 생성일시                             │
│ updated_at      │ datetime     │ 수정일시                             │
└─────────────────┴──────────────┴─────────────────────────────────────┘
```

**시드 데이터 (8개):**

| 코드 | 이름 | 출근 | 퇴근 | 휴게 | 야간 | 소정시간 |
|------|------|------|------|------|------|----------|
| WS01 | 주간근무(표준) | 09:00 | 18:00 | 60분 | X | 8h |
| WS02 | 주간근무(탄력) | 08:00 | 17:00 | 60분 | X | 8h |
| WS03 | 시차출퇴근(A) | 07:00 | 16:00 | 60분 | X | 8h |
| WS04 | 시차출퇴근(B) | 10:00 | 19:00 | 60분 | X | 8h |
| WS05 | 야간근무 | 22:00 | 07:00 | 60분 | O | 8h |
| WS06 | 교대근무(주간) | 06:00 | 14:00 | 30분 | X | 7.5h |
| WS07 | 교대근무(야간) | 14:00 | 22:00 | 30분 | X | 7.5h |
| WS08 | 유연근무 | 06:00 | 22:00 | 60분 | X | 8h |

#### 2.2.3 `tim_holidays` (공휴일)

```
┌─────────────────┬──────────────┬─────────────────────────────────────┐
│ 컬럼            │ 타입         │ 설명                                │
├─────────────────┼──────────────┼─────────────────────────────────────┤
│ id              │ int PK       │ 자동증가                             │
│ holiday_date    │ date         │ 공휴일 날짜 UNIQUE                   │
│ name            │ varchar(100) │ 공휴일명 (신정, 설날 등)              │
│ holiday_type    │ varchar(20)  │ 유형: legal/company/substitute       │
│ is_active       │ boolean      │ 사용 여부                            │
│ created_at      │ datetime     │ 생성일시                             │
│ updated_at      │ datetime     │ 수정일시                             │
└─────────────────┴──────────────┴─────────────────────────────────────┘
```

**시드 데이터:** 2025년 17건 + 2026년 18건 = 총 35건 (법정+대체공휴일)

---

### 2.3 API 엔드포인트 상세

#### 2.3.1 근태코드 API

| Method | Endpoint | 설명 | 권한 |
|--------|----------|------|------|
| GET | `/api/v1/tim/attendance-codes` | 전체 목록 조회 | hr_manager, admin |
| POST | `/api/v1/tim/attendance-codes/batch` | 일괄 저장 (insert/update/delete) | hr_manager, admin |

**GET 응답:**
```json
{
  "items": [
    {
      "id": 1, "code": "C01", "name": "연차휴가",
      "category": "leave", "unit": "day",
      "is_requestable": true, "min_days": 1.0, "max_days": 25.0,
      "deduct_annual": true, "is_active": true, "sort_order": 10,
      "description": null
    }
  ],
  "total_count": 18
}
```

**POST /batch 요청:**
```json
{
  "items": [
    { "id": null, "code": "C10", "name": "보상휴가", "category": "leave", "unit": "day",
      "is_requestable": true, "min_days": 1.0, "max_days": null,
      "deduct_annual": false, "is_active": true, "sort_order": 100, "description": null },
    { "id": 1, "code": "C01", "name": "연차휴가(수정)", "category": "leave", "unit": "day",
      "is_requestable": true, "min_days": 1.0, "max_days": 25.0,
      "deduct_annual": true, "is_active": true, "sort_order": 10, "description": null }
  ],
  "delete_ids": [5, 6]
}
```

#### 2.3.2 근무코드 API

| Method | Endpoint | 설명 | 권한 |
|--------|----------|------|------|
| GET | `/api/v1/tim/work-schedules` | 전체 목록 조회 | hr_manager, admin |
| POST | `/api/v1/tim/work-schedules/batch` | 일괄 저장 | hr_manager, admin |

#### 2.3.3 공휴일 API

| Method | Endpoint | 설명 | 권한 |
|--------|----------|------|------|
| GET | `/api/v1/tim/holidays?year=2026` | 연도별 조회 | hr_manager, admin |
| POST | `/api/v1/tim/holidays/batch?year=2026` | 일괄 저장 | hr_manager, admin |
| POST | `/api/v1/tim/holidays/copy-year` | 전년도 복사 | hr_manager, admin |

**POST /copy-year 요청:**
```json
{ "year_from": 2026, "year_to": 2027 }
```

---

### 2.4 성능 인프라 (완료)

#### 2.4.1 복합 인덱스 추가

```sql
-- tim_attendance_daily (6,000명 × 365일 = 219만 rows/년)
CREATE INDEX ix_tim_attendance_daily_emp_date ON tim_attendance_daily (employee_id, work_date);
CREATE INDEX ix_tim_attendance_daily_date_status ON tim_attendance_daily (work_date, attendance_status);

-- tim_leave_requests
CREATE INDEX ix_tim_leave_requests_emp_status ON tim_leave_requests (employee_id, request_status);
CREATE INDEX ix_tim_leave_requests_dates ON tim_leave_requests (start_date, end_date);
```

#### 2.4.2 커넥션 풀 설정

```python
engine = create_engine(
    settings.database_url,
    echo=False,
    pool_size=20,        # 동시 커넥션 (기본 5 → 20)
    max_overflow=30,     # 초과 허용 (기본 10 → 30)
    pool_pre_ping=True,  # 커넥션 유효성 검사
    pool_recycle=3600,   # 1시간마다 재생성
)
```

---

### 2.5 파일 구조 전체 맵 (최종)

```
backend/app/
├── models/
│   ├── __init__.py                          ✅ TimAttendanceCode, TimWorkScheduleCode, TimHoliday 추가
│   └── entities.py                          ✅ 3개 모델 + 인덱스 추가
├── schemas/
│   ├── tim_attendance_code.py               ✅ 신규 생성
│   ├── tim_work_schedule.py                 ✅ 신규 생성
│   └── tim_holiday.py                       ✅ 신규 생성
├── services/
│   ├── tim_attendance_code_service.py       ✅ 신규 생성
│   ├── tim_work_schedule_service.py         ✅ 신규 생성
│   └── tim_holiday_service.py               ✅ 신규 생성
├── api/
│   ├── tim_attendance_code.py               ✅ 신규 생성
│   ├── tim_work_schedule.py                 ✅ 신규 생성
│   └── tim_holiday.py                       ✅ 신규 생성
├── core/
│   └── database.py                          ✅ pool_size=20 적용
├── main.py                                  ✅ 3개 라우터 등록
└── bootstrap.py                             ✅ 시드 데이터 + 메뉴 코드 정리

frontend/src/
├── types/
│   └── tim.ts                               ✅ 신규 생성
├── app/
│   ├── api/tim/
│   │   ├── attendance-codes/
│   │   │   ├── route.ts                     ✅ GET 프록시
│   │   │   └── batch/route.ts               ✅ POST 프록시
│   │   ├── work-schedules/
│   │   │   ├── route.ts                     ✅ GET 프록시
│   │   │   └── batch/route.ts               ✅ POST 프록시
│   │   └── holidays/
│   │       ├── route.ts                     ✅ GET 프록시 (?year)
│   │       ├── batch/route.ts               ✅ POST 프록시
│   │       └── copy-year/route.ts           ✅ POST 프록시
│   └── tim/
│       ├── codes/page.tsx                   ✅ 서버 shell (AttendanceCodeManager)
│       ├── work-codes/page.tsx              ✅ 서버 shell (WorkScheduleManager)
│       └── holidays/page.tsx                ✅ 서버 shell (HolidayManager)
└── components/tim/
    ├── attendance-code-manager.tsx           ✅ AG Grid 완료
    ├── work-schedule-manager.tsx             ✅ AG Grid 완료
    └── holiday-manager.tsx                   ✅ 정적→AG Grid+DB 전환 완료
```

---

## 3. 개발 내역 상세 (테스트 참고용)

### 3.1 새로 생성된 파일 목록

| 파일 | 역할 |
|------|------|
| `backend/app/schemas/tim_attendance_code.py` | 근태코드 Pydantic 스키마 (요청/응답 모델) |
| `backend/app/schemas/tim_work_schedule.py` | 근무코드 Pydantic 스키마 |
| `backend/app/schemas/tim_holiday.py` | 공휴일 Pydantic 스키마 (copy-year 포함) |
| `backend/app/services/tim_attendance_code_service.py` | 근태코드 비즈니스 로직 (list, batch_save) |
| `backend/app/services/tim_work_schedule_service.py` | 근무코드 비즈니스 로직 |
| `backend/app/services/tim_holiday_service.py` | 공휴일 비즈니스 로직 (list_by_year, copy_year) |
| `backend/app/api/tim_attendance_code.py` | 근태코드 API 라우터 |
| `backend/app/api/tim_work_schedule.py` | 근무코드 API 라우터 |
| `backend/app/api/tim_holiday.py` | 공휴일 API 라우터 |
| `frontend/src/types/tim.ts` | TypeScript 타입 정의 (3개 모듈) |
| `frontend/src/app/api/tim/attendance-codes/route.ts` | BFF GET 프록시 |
| `frontend/src/app/api/tim/attendance-codes/batch/route.ts` | BFF POST 프록시 |
| `frontend/src/app/api/tim/work-schedules/route.ts` | BFF GET 프록시 |
| `frontend/src/app/api/tim/work-schedules/batch/route.ts` | BFF POST 프록시 |
| `frontend/src/app/api/tim/holidays/route.ts` | BFF GET 프록시 (?year 포워딩) |
| `frontend/src/app/api/tim/holidays/batch/route.ts` | BFF POST 프록시 |
| `frontend/src/app/api/tim/holidays/copy-year/route.ts` | BFF POST 프록시 |
| `frontend/src/components/tim/attendance-code-manager.tsx` | 근태코드 AG Grid 화면 |
| `frontend/src/components/tim/work-schedule-manager.tsx` | 근무코드 AG Grid 화면 |

### 3.2 수정된 파일 목록

| 파일 | 변경 내용 |
|------|-----------|
| `backend/app/models/entities.py` | TimAttendanceCode, TimWorkScheduleCode, TimHoliday 3개 테이블 추가; 기존 테이블에 복합 인덱스 추가 |
| `backend/app/models/__init__.py` | 3개 새 모델 import 추가 |
| `backend/app/core/database.py` | 커넥션 풀 pool_size=20, max_overflow=30으로 상향 |
| `backend/app/main.py` | 3개 라우터 등록 |
| `backend/app/bootstrap.py` | 근태코드/근무코드/공휴일 시드 함수 추가; 메뉴 코드 hr.leave→tim.holidays, hr.attendance→tim.codes 수정 |
| `frontend/src/app/tim/codes/page.tsx` | 정적 mock 테이블 → AttendanceCodeManager 서버 shell |
| `frontend/src/app/tim/work-codes/page.tsx` | placeholder → WorkScheduleManager 서버 shell |
| `frontend/src/components/tim/holiday-manager.tsx` | 정적 hardcode 테이블 → AG Grid + DB 기반으로 전면 교체 |

---

### 3.3 각 화면별 기능 설명

#### 3.3.1 근태코드관리 (`/tim/codes`)

**진입 경로:** 좌측 메뉴 > 근태 > 기초설정 > 근태코드관리

**화면 구성:**
```
[검색창: 근태명 입력] [분류 드롭다운: 전체/휴가/근무/특별] [조회]
                                   [입력] [복사] [삭제] [엑셀] [저장]
┌────┬────────┬──────────────┬──────┬──────┬──────┬──────┬──────┬──────┬──────┬──────┐
│상태│ 근태코드 │   근태명     │ 분류 │ 단위 │신청가│최소일│최대일│연차감│정렬순│사용여│
├────┼────────┼──────────────┼──────┼──────┼──────┼──────┼──────┼──────┼──────┼──────┤
│    │ C01    │  연차휴가    │ 휴가 │ 전일 │  O   │  1   │  25  │  O   │  10  │  O   │
│    │ C01A   │  오전반차    │ 휴가 │ 오전 │  O   │  0.5 │  0.5 │  O   │  11  │  O   │
│    │ ...    │              │      │      │      │      │      │      │      │      │
└────┴────────┴──────────────┴──────┴──────┴──────┴──────┴──────┴──────┴──────┴──────┘
```

**주요 기능:**
- **인라인 편집**: 셀을 더블클릭하면 편집 모드로 전환
- **분류/단위/신청가능/연차차감/사용여부**: 드롭다운 셀 에디터 (`agSelectCellEditor`)
- **최소/최대일수, 정렬순서**: 숫자 입력 (`valueParser` 적용)
- **행 상태 추적**: `_status` 필드로 변경 감지
  - 🟢 연두색 행: 새로 추가된 행 (added)
  - 🟡 노란색 행: 수정된 행 (updated)
  - 🔴 빨간색 행: 삭제 예정 행 (deleted, 취소선 표시)
- **[입력]**: 빈 행 하단에 추가
- **[복사]**: 선택한 행 복사하여 추가 (코드를 공백으로 초기화)
- **[삭제]**: 선택한 행 삭제 예약 (저장 전까지 취소 가능)
- **[엑셀]**: 현재 그리드 데이터를 Excel 파일로 다운로드
- **[저장]**: 변경된 모든 행을 batch API로 일괄 저장

**필터 동작:**
- 근태명 입력 후 조회 → 해당 이름 포함 행만 표시
- 분류 선택 후 조회 → 해당 분류의 행만 표시
- 클라이언트 사이드 필터링 (별도 API 호출 없음)

---

#### 3.3.2 근무코드관리 (`/tim/work-codes`)

**진입 경로:** 좌측 메뉴 > 근태 > 기초설정 > 근무코드관리

**화면 구성:**
```
[검색창: 근무명 입력] [조회]
                                   [입력] [복사] [삭제] [엑셀] [저장]
┌────┬────────┬──────────────┬──────┬──────┬──────┬──────┬──────┬──────┬──────┐
│상태│ 근무코드 │   근무명     │출근시│퇴근시│휴게분│야간여│소정시│정렬순│사용여│
├────┼────────┼──────────────┼──────┼──────┼──────┼──────┼──────┼──────┼──────┤
│    │ WS01   │ 주간근무(표준)│09:00 │18:00 │  60  │  N   │  8   │  10  │  O   │
│    │ WS05   │  야간근무    │22:00 │07:00 │  60  │  Y   │  8   │  50  │  O   │
│    │ ...    │              │      │      │      │      │      │      │      │
└────┴────────┴──────────────┴──────┴──────┴──────┴──────┴──────┴──────┴──────┘
```

**주요 기능:**
- **출퇴근시간**: `HH:MM` 형식 텍스트 입력 (예: `09:00`, `22:00`)
- **저장 시 유효성 검증**: 정규식 `/^\d{2}:\d{2}$/` 검사; 형식 오류 시 toast 알림 후 저장 중단
- **야간여부**: Y/N 드롭다운
- **나머지 기능**: 근태코드관리와 동일 (행 추가/복사/삭제/저장/엑셀)

**야간근무 표시:**
- `is_overnight = true` 인 행은 야간여부 컬럼에 "Y" 표시
- WS05 야간근무처럼 퇴근시간이 익일인 경우 야간여부를 Y로 설정

---

#### 3.3.3 공휴일관리 (`/tim/holidays`)

**진입 경로:** 좌측 메뉴 > 근태 > 기초설정 > 공휴일관리

**화면 구성:**
```
[연도: 2026] [조회]    [복사원본연도: 2025] [복사대상연도: 2026] [연도복사]
                                   [입력] [삭제] [엑셀] [저장]
┌────┬──────────────┬──────────────────┬──────────┬──────┐
│상태│    날짜      │    공휴일명      │   유형   │사용여│
├────┼──────────────┼──────────────────┼──────────┼──────┤
│    │  2026-01-01  │       신정       │  법정    │  O   │
│    │  2026-01-28  │ 설날 (음 12.29) │  법정    │  O   │
│    │  2026-01-29  │   설날 연휴     │  법정    │  O   │
│    │  2026-01-30  │       설날       │  법정    │  O   │
│    │  ...         │                 │          │      │
└────┴──────────────┴──────────────────┴──────────┴──────┘
```

**주요 기능:**
- **연도 필터**: 입력창에 연도 입력 후 [조회] → 해당 연도 공휴일만 표시
  - 기본값: 현재 연도 (2026)
  - 이전/다음 연도 전환하여 관리 가능
- **날짜 셀 편집**: 클릭 시 CustomDatePicker 팝업 표시
  - 달력에서 날짜 선택 → `YYYY-MM-DD` 형식으로 저장
  - employee-master-manager의 HireDateCellEditor와 동일 패턴 적용
- **유형**: 법정/회사지정/대체 드롭다운 선택
- **[연도복사] 기능**:
  1. 복사원본연도 입력 (예: 2025)
  2. 복사대상연도 입력 (예: 2026)
  3. [연도복사] 클릭 → `POST /api/tim/holidays/copy-year` 호출
  4. 완료 후 대상연도로 자동 이동하여 복사된 데이터 표시
  5. 이미 해당 날짜에 공휴일이 있으면 skip (중복 방지)
- **날짜 오름차순 정렬**: holiday_date 기준 자동 정렬 (날짜 입력/추가 시 즉시 정렬)
- **행 추가**: 빈 공휴일 행 추가 → 날짜/이름/유형 입력 후 저장

---

### 3.4 공통 UI 패턴

#### 행 상태별 색상
```
🟢 연두색 배경 (vibe-row-added):   새로 추가된 행
🟡 노란색 배경 (vibe-row-updated): 수정된 행
🔴 빨간색 배경 (vibe-row-deleted): 삭제 예정 행 (취소선)
   배경 없음 (clean):              변경 없는 행
```

#### Batch 저장 동작 흐름
```
[저장] 클릭
  → 유효성 검증 (필수값, 형식)
  → 오류 있으면 toast 알림 + 중단
  → API 호출: POST /api/tim/.../batch
    {
      items: [added 행, updated 행],  // id=null이면 insert, id 있으면 update
      delete_ids: [deleted 행의 id들]  // 실제 DB에서 삭제
    }
  → 성공: toast("저장되었습니다.") + 그리드 데이터 재조회
  → 실패: toast(에러 메시지)
```

#### 엑셀 다운로드
- AG Grid 내장 `exportDataAsExcel()` 사용
- 현재 필터 적용 상태의 데이터 기준으로 다운로드
- 파일명: `근태코드_YYYYMMDD.xlsx` 형식

---

## 4. 서비스 기동 방법

### 4.1 Backend 기동

```bash
cd backend

# 환경 변수 설정 (.env 파일)
# DATABASE_URL=postgresql://user:password@localhost:5432/vibe_hr
# SECRET_KEY=your-secret-key

# 패키지 설치
pip install -r requirements.txt

# 기동 (테이블 자동 생성 + 시드 데이터 삽입 포함)
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

**기동 시 자동 실행:**
1. `create_all()` - 새 테이블 3개 생성 (tim_attendance_codes, tim_work_schedule_codes, tim_holidays)
2. `seed_initial_data()` - 시드 데이터 삽입 (이미 있으면 skip)
3. 메뉴 코드 정리 (tim.holidays, tim.codes, tim.work-codes)

### 4.2 Frontend 기동

```bash
cd frontend

# 패키지 설치
npm install

# 개발 서버 기동
npm run dev
# → http://localhost:3000 에서 실행
```

### 4.3 접속 확인

1. `http://localhost:3000` 접속 → 로그인
2. 좌측 메뉴에서 **근태 > 기초설정** 확인
3. 각 화면 접속하여 시드 데이터 표시 확인

---

## 5. 검증 체크리스트

### 5.1 Backend API 검증 (Swagger)

> `http://localhost:8000/docs` 에서 확인

**근태코드 API:**
- [ ] `GET /api/v1/tim/attendance-codes` → 18개 항목 반환 확인
- [ ] `POST /api/v1/tim/attendance-codes/batch` → 신규 항목 추가 테스트
  ```json
  { "items": [{"id": null, "code": "C10", "name": "보상휴가", "category": "leave",
               "unit": "day", "is_requestable": true, "min_days": 1.0,
               "max_days": null, "deduct_annual": false, "is_active": true,
               "sort_order": 200, "description": null}],
    "delete_ids": [] }
  ```
- [ ] 동일 코드 중복 insert → 409 Conflict 에러 확인

**근무코드 API:**
- [ ] `GET /api/v1/tim/work-schedules` → 8개 항목 반환 확인
- [ ] `POST /api/v1/tim/work-schedules/batch` → 신규/수정/삭제 동시 테스트

**공휴일 API:**
- [ ] `GET /api/v1/tim/holidays?year=2025` → 17건 확인
- [ ] `GET /api/v1/tim/holidays?year=2026` → 18건 확인
- [ ] `POST /api/v1/tim/holidays/copy-year` → `{"year_from": 2025, "year_to": 2027}` 테스트
- [ ] 2027년 재조회 → 2025년 데이터가 날짜 연도만 변경되어 복사됨 확인

### 5.2 Frontend 화면 검증

**근태코드관리 (`/tim/codes`):**
- [ ] 화면 진입 시 18개 데이터 그리드에 표시
- [ ] 분류 필터 "휴가"로 변경 후 [조회] → leave 항목만 표시
- [ ] 임의 행 이름 수정 → 행이 노란색으로 변경
- [ ] [저장] 클릭 → 성공 toast → 새로고침 후 수정값 유지
- [ ] [입력] 클릭 → 새 빈 행 추가 → 코드/이름 입력 → [저장]
- [ ] [삭제] 클릭 (행 선택 후) → 빨간색 취소선 → [저장] → 삭제 확인
- [ ] [엑셀] 클릭 → xlsx 파일 다운로드

**근무코드관리 (`/tim/work-codes`):**
- [ ] 화면 진입 시 8개 데이터 표시
- [ ] 출근시간 셀 편집 → `09:30` 형식으로 수정 → 저장
- [ ] 잘못된 시간 형식 입력 (`9시`) → [저장] 시 오류 toast 표시 + 저장 중단
- [ ] 야간근무(WS05) 행의 야간여부 컬럼이 "Y"로 표시되는지 확인

**공휴일관리 (`/tim/holidays`):**
- [ ] 기본 진입 시 2026년 데이터 18건 표시
- [ ] 연도를 "2025"로 변경 후 [조회] → 2025년 데이터 17건 표시
- [ ] [입력] 버튼으로 새 행 추가 → 날짜 셀 클릭 시 달력 팝업 표시 확인
- [ ] 날짜 선택 후 공휴일명, 유형 입력 → [저장]
- [ ] 복사원본: 2025, 복사대상: 2027 입력 후 [연도복사] → 성공 후 2027년으로 이동
- [ ] 2027년 데이터 확인 (날짜 연도만 2027로 변경됨)

### 5.3 메뉴 접근 권한 검증

- [ ] `hr_manager` 역할로 로그인 → 기초설정 3개 메뉴 모두 접근 가능
- [ ] `employee` 역할로 로그인 → 기초설정 메뉴가 사이드바에 미노출

---

## 6. 알려진 제약사항 및 주의사항

### 6.1 공휴일 연도 복사 주의
- `copy-year`는 `holiday_date`의 날짜를 `year_to` 연도로 변경하여 복사
- 예: 2025-01-01 설날 → 2027-01-01 로 복사 (실제 2027년 설날과 다를 수 있음)
- 음력 기준 공휴일(설날, 추석)은 복사 후 날짜를 수동으로 수정해야 함
- 복사 전 대상 연도에 이미 존재하는 날짜는 skip (중복 삽입 안 됨)

### 6.2 근무코드 시간 형식
- `work_start`, `work_end`는 `HH:MM` 문자열로 저장 (DB에서 시간 타입 미사용)
- 저장 전 프론트에서 정규식 검증, 백엔드에서는 별도 검증 없음
- 향후 Phase 2에서 실제 시간 계산 시 파싱 로직 필요

### 6.3 AG Grid 라이선스
- Community 에디션 사용 (무료)
- 엑셀 Export는 Community에서도 지원
- 피벗, 서버 사이드 row model 등 Enterprise 기능은 미사용

---

## 7. Phase 2: 일상 근태 (다음 단계)

> Phase 1 완료 후 진행

### 7.1 출퇴근 기록
| 항목 | 설명 |
|------|------|
| 화면 | `/tim/check-in` |
| 기능 | 직원 본인이 출퇴근 체크 (현재시간 자동입력) |
| DB | `tim_attendance_daily` 활용 |
| 특이사항 | 위치 기반 체크인 옵션 (GPS), 근무코드 자동 매핑 |

### 7.2 근태 현황
| 항목 | 설명 |
|------|------|
| 화면 | `/tim/status` |
| 기능 | 관리자가 부서별/기간별 근태 조회 |
| 성능 | 6,000명 × 30일 = 18만 건 → **서버 사이드 페이지네이션 필수** |
| 필터 | 부서, 기간(시작~종료), 근태상태, 사원번호/이름 |

### 7.3 근태 수정/정정
| 항목 | 설명 |
|------|------|
| 화면 | `/tim/correction` |
| 기능 | 관리자가 근태 기록 수정 (사유 입력 필수) |
| 이력 | 수정 이력 테이블 추가 (`tim_attendance_corrections`) |

### 7.4 추가 DB 테이블 (Phase 2에서 생성)
```
tim_attendance_corrections (근태정정이력)
  - id, attendance_id FK, corrected_by FK,
  - old_status, new_status, old_check_in, new_check_in,
  - reason, corrected_at
```

---

## 8. Phase 3: 휴가 관리

### 8.1 연차 발생/관리
| 항목 | 설명 |
|------|------|
| 화면 | `/tim/annual-leave` |
| 기능 | 직원별 연차 발생/사용/잔여 현황 |
| 계산 로직 | 근로기준법 기반 자동 계산 |

**연차 계산 규칙 (근로기준법 제60조):**
```
입사 1년 미만: 매월 1일 발생 (최대 11일)
입사 1년 이상: 15일 발생
입사 3년 이상: 2년마다 +1일 (최대 25일)

예) 3년차: 16일, 5년차: 17일, 7년차: 18일 ... 21년 이상: 25일
```

### 8.2 휴가 신청
| 항목 | 설명 |
|------|------|
| 화면 | `/tim/leave-request` |
| 기능 | 직원이 연차/반차/병가/경조/출산 등 휴가 신청 |
| 연동 | 근태코드(tim_attendance_codes) 기반 휴가 유형 선택 |
| 검증 | 잔여 연차 확인, 중복 신청 방지, 최소/최대 일수 체크 |

### 8.3 휴가 승인
| 항목 | 설명 |
|------|------|
| 화면 | `/tim/leave-approval` |
| 기능 | 관리자/결재자가 휴가 승인/반려 처리 |
| 상태 | pending → approved/rejected/cancelled |

### 8.4 추가 DB 테이블 (Phase 3에서 생성)
```
tim_annual_leave_grants (연차 발생 이력)
  - id, employee_id FK, grant_year, grant_type(auto/manual/adjustment),
  - granted_days, used_days, remaining_days,
  - grant_date, expire_date, created_at

tim_leave_requests 확장:
  - attendance_code_id FK 추가 (tim_attendance_codes 연동)
  - leave_days float 추가 (실제 차감 일수)
```

---

## 9. Phase 4: 통계 및 리포트

### 9.1 근태 통계 대시보드
- 부서별 출근율/지각율/결근율
- 월별 추이 차트
- 연차 사용율 현황

### 9.2 법정 리포트
- 주 52시간 초과 현황 (법정근로 40h + 연장 12h)
- 야간근로 수당 대상 추출
- 연차 미사용 현황 (연차수당 산정 기초)

### 9.3 Excel 리포트 내보내기
- 기간별 근태 상세 내역
- 부서별 근태 요약
- 개인별 연차 사용 내역

---

## 10. 한국 근로기준법 주요 기준

### 10.1 근로시간
| 구분 | 기준 |
|------|------|
| 법정근로시간 | 주 40시간 (1일 8시간) |
| 연장근로 | 주 12시간 이내 |
| 주 최대 근로시간 | 52시간 (40 + 12) |
| 야간근로 | 22:00 ~ 06:00 (50% 가산) |
| 휴일근로 | 8시간 이내 50%, 초과 100% 가산 |

### 10.2 휴가/휴직
| 구분 | 기준 |
|------|------|
| 연차유급휴가 | 1년 미만: 월 1일, 1년 이상: 15일, 3년+: 2년마다 +1 (최대 25일) |
| 출산휴가 | 90일 (다태아 120일), 출산 전후 분할 가능 |
| 배우자 출산휴가 | 10일 (유급) |
| 육아휴직 | 자녀 만 8세 이하, 최대 1년 |
| 육아기 근로시간 단축 | 주 15~35시간 |
| 가족돌봄휴직 | 연 90일 이내 |
| 경조사휴가 | 결혼 5일, 사망 3~5일 (회사 규정) |
| 공가 | 예비군/민방위 등 (법정) |

### 10.3 대체공휴일
- 설날/추석이 일요일/다른 공휴일과 겹칠 때 → 다음 평일 대체
- 어린이날이 토/일/다른 공휴일과 겹칠 때 → 다음 평일 대체
- 2021년부터 광복절, 개천절, 한글날 등도 대체공휴일 적용

---

## 11. 메뉴 구조

```
근태 (tim)
├── 기초설정 (tim.base)
│   ├── 공휴일관리        /tim/holidays        ✅ Phase 1 완료
│   ├── 근태코드관리      /tim/codes           ✅ Phase 1 완료
│   └── 근무코드관리      /tim/work-codes      ✅ Phase 1 완료
├── 일상근태 (tim.daily)                       ← Phase 2
│   ├── 출퇴근기록        /tim/check-in
│   ├── 근태현황          /tim/status
│   └── 근태수정          /tim/correction
└── 휴가관리 (tim.leave)                       ← Phase 3
    ├── 연차관리          /tim/annual-leave
    ├── 휴가신청          /tim/leave-request
    └── 휴가승인          /tim/leave-approval
```

**역할 권한:**
| 메뉴 | employee | hr_manager | admin |
|------|----------|------------|-------|
| 기초설정 | X | O | O |
| 출퇴근기록 | O | O | O |
| 근태현황 | X (본인만) | O (전체) | O |
| 근태수정 | X | O | O |
| 연차관리 | X (본인만) | O (전체) | O |
| 휴가신청 | O | O | O |
| 휴가승인 | X | O | O |
