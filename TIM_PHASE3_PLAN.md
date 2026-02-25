# TIM Phase 3 - 휴가 관리 (Leave Management) - 상세 계획서

> 작성일: 2026-02-25
> 대상: 한국 근로기준법 준수 휴가관리 시스템
> 규모: 최대 2,000명, 연간 ~4만 휴가신청 처리

---

## Context

Phase 1~2를 통해 기초설정과 일상근태를 완성했다. Phase 3는 직원의 휴가 신청부터 관리자 승인까지의 **전체 휴가 생명주기**를 관리한다.

**핵심 문제:**
- 연차 잔여일수 추적 (근로기준법 기준)
- 휴가 신청 시 충돌 감지 (중복 신청 방지)
- 승인 프로세스 자동화
- 한국 노동법: 15일 기본 + 매년 1일 가산 (최대 25일), 5일 월이월

**기술 도전:**
- 2,000명 × 연 30회 신청 = ~60,000건 조회 성능 관리
- 날짜 범위 교집합 검사 (overlap detection)
- 근무일/휴무일 계산 (TimHoliday 활용)

---

## 1. 신규 DB 테이블

### 1.1 `HrAnnualLeave` (연차 발생 이력)

```python
class HrAnnualLeave(SQLModel, table=True):
    __tablename__ = "hr_annual_leaves"
    __table_args__ = (
        UniqueConstraint("employee_id", "year", name="uq_annual_leave_emp_year"),
        Index("ix_annual_leave_emp_year", "employee_id", "year"),
        Index("ix_annual_leave_balance", "employee_id", "remaining_days"),
    )

    id: Optional[int] = Field(default=None, primary_key=True)
    employee_id: int = Field(foreign_key="hr_employees.id", index=True)
    year: int = Field(ge=2000, le=2100)                          # 연도 (2026)

    # 발생 현황
    grant_type: str = Field(max_length=20)                      # auto(자동)/manual(수동)/adjustment(조정)
    granted_days: float = Field(ge=0.0)                         # 발생일수 (15.0, 16.0 등)
    grant_date: date                                            # 발생 기준일 (e.g. 입사일, 1/1)

    # 사용 현황
    used_days: float = Field(default=0.0, ge=0.0)              # 사용일수 (합산)
    carried_over_days: float = Field(default=0.0, ge=0.0)      # 전년도 월이월 (최대 5일)
    expiration_date: Optional[date] = None                      # 사용기한

    # 잔여
    remaining_days: float = Field(ge=0.0)  # = granted + carried_over - used

    # 메타
    note: Optional[str] = Field(default=None, max_length=500)
    created_at: datetime = Field(default_factory=utc_now)
    updated_at: datetime = Field(default_factory=utc_now)

    # Relationship
    employee: Optional[HrEmployee] = Relationship(back_populates="annual_leaves")
```

**계산식:**
```
remaining_days = granted_days + carried_over_days - used_days
```

**인덱스 이유:**
- `(employee_id, year)` — 특정 직원의 연도별 잔여일수 조회 (연차 신청 시 매번 확인)
- `(employee_id, remaining_days)` — 남은 휴가 많은 직원 조회 (월말 정산 등)

---

### 1.2 `HrLeaveConflict` (휴가 중복 검사 기록) - 선택사항

```python
class HrLeaveConflict(SQLModel, table=True):
    __tablename__ = "hr_leave_conflicts"

    id: Optional[int] = Field(default=None, primary_key=True)
    leave_request_id: int = Field(foreign_key="tim_leave_requests.id")
    conflict_type: str  # "overlap", "holiday", "max_consecutive", "annual_insufficient"
    conflicting_leave_id: Optional[int] = Field(foreign_key="tim_leave_requests.id", default=None)

    conflict_date: date
    message: str = Field(max_length=500)
    resolved: bool = Field(default=False)
    created_at: datetime = Field(default_factory=utc_now)
```

**비고:** MVP에서는 선택사항 — 단순 validation 로직으로 시작, 필요시 이력 기록으로 확장

---

### 1.3 HrLeaveRequest 확장

기존 테이블에 새 컬럼 추가:

```python
# HrLeaveRequest에 추가
class HrLeaveRequest(SQLModel, table=True):
    # ... 기존 필드 ...

    # 신규 필드
    attendance_code_id: Optional[int] = Field(
        foreign_key="tim_attendance_codes.id", default=None
    )                                                           # 근태코드 링크
    leave_days: Optional[float] = Field(default=None)         # 실제 차감 일수 (0.5 반차 등)

    rejection_reason: Optional[str] = Field(default=None, max_length=500)  # 반려 사유
    cancellation_reason: Optional[str] = Field(default=None, max_length=500)  # 취소 사유

    # Relationship
    attendance_code: Optional[TimAttendanceCode] = Relationship()
    conflicts: list[HrLeaveConflict] = Relationship(back_populates="leave_request")
```

---

## 2. Backend Service Layer

### 2.1 `tim_leave_request_service.py`

```python
from datetime import date, datetime, timedelta
from sqlmodel import Session, select, func

class LeaveRequestService:

    # ===== 조회 =====

    @staticmethod
    def list_leave_requests(
        session: Session,
        start_date: Optional[date] = None,
        end_date: Optional[date] = None,
        employee_id: Optional[int] = None,
        status: Optional[str] = None,
        approval_pending: bool = False,
        page: int = 1,
        limit: int = 50,
    ) -> tuple[list[HrLeaveRequest], int]:
        """
        휴가 신청 목록 (필터 + 페이지네이션)

        Args:
            start_date: 시작일 범위 (신청한 휴가의 시작일)
            end_date: 종료일 범위
            employee_id: 특정 직원만 (또는 None = 모두)
            status: pending/approved/rejected/cancelled
            approval_pending: True면 pending 상태만
            page, limit: 페이지네이션

        Returns:
            (list of HrLeaveRequest, total_count)

        Performance:
            - Use index: (employee_id, request_status)
            - Use index: (employee_id, start_date, end_date) for date range
        """
        query = select(HrLeaveRequest)

        if employee_id:
            query = query.where(HrLeaveRequest.employee_id == employee_id)
        if start_date:
            query = query.where(HrLeaveRequest.start_date >= start_date)
        if end_date:
            query = query.where(HrLeaveRequest.end_date <= end_date)
        if status:
            query = query.where(HrLeaveRequest.request_status == status)
        elif approval_pending:
            query = query.where(HrLeaveRequest.request_status == "pending")

        # 총 건수
        total = session.exec(
            select(func.count(HrLeaveRequest.id)).select_from(
                select(HrLeaveRequest).where(...) # same conditions
            )
        ).one()

        # 페이지네이션 + 정렬
        query = query.order_by(HrLeaveRequest.created_at.desc())
        offset = (page - 1) * limit
        items = session.exec(query.offset(offset).limit(limit)).all()

        return items, total

    # ===== 신청 =====

    @staticmethod
    def create_leave_request(
        session: Session,
        employee_id: int,
        attendance_code_id: int,  # 근태코드 선택
        start_date: date,
        end_date: date,
        reason: str,
    ) -> HrLeaveRequest:
        """
        휴가 신청 생성

        검증:
        1. start_date <= end_date
        2. 중복 신청 체크 (approved/pending 상태)
        3. 연차 신청인 경우 잔여 일수 확인
        4. 최소/최대 일수 확인 (근태코드)
        5. 근무일 수만 계산 (주말/공휴일 제외)

        Raises:
            ValueError: 검증 실패
        """
        # 1. 기본 검증
        if start_date > end_date:
            raise ValueError("start_date must be <= end_date")

        # 2. 근태코드 조회
        code = session.get(TimAttendanceCode, attendance_code_id)
        if not code:
            raise ValueError(f"Attendance code {attendance_code_id} not found")

        if not code.is_requestable:
            raise ValueError(f"Code {code.code} is not requestable by employees")

        # 3. 근무일 수 계산 (주말/공휴일 제외)
        working_days = _calculate_working_days(session, start_date, end_date)

        # 4. 최소/최대 일수 확인
        if working_days < (code.min_days or 0):
            raise ValueError(f"Minimum {code.min_days} days required")
        if code.max_days and working_days > code.max_days:
            raise ValueError(f"Maximum {code.max_days} days allowed")

        # 5. 중복 신청 체크
        conflicts = session.exec(
            select(HrLeaveRequest).where(
                HrLeaveRequest.employee_id == employee_id,
                HrLeaveRequest.request_status.in_(["pending", "approved"]),
                HrLeaveRequest.start_date <= end_date,
                HrLeaveRequest.end_date >= start_date,
            )
        ).all()

        if conflicts:
            raise ValueError(f"Overlapping leave request exists")

        # 6. 연차 신청인 경우 잔여 일수 확인
        if code.deduct_annual:
            balance = _get_annual_leave_balance(session, employee_id)
            if balance.remaining_days < working_days:
                raise ValueError(
                    f"Insufficient annual leave: {balance.remaining_days} days remaining"
                )

        # 생성
        req = HrLeaveRequest(
            employee_id=employee_id,
            attendance_code_id=attendance_code_id,
            leave_type=code.category,  # "leave", "work", "special" from TimAttendanceCode
            start_date=start_date,
            end_date=end_date,
            reason=reason,
            leave_days=working_days,
            request_status="pending",
        )
        session.add(req)
        session.commit()
        session.refresh(req)

        return req

    # ===== 승인/반려 =====

    @staticmethod
    def approve_leave_request(
        session: Session,
        leave_request_id: int,
        approver_employee_id: int,
    ) -> HrLeaveRequest:
        """
        휴가 신청 승인

        처리:
        1. 상태 검증 (pending만 가능)
        2. 상태 업데이트 (approved)
        3. 승인자, 승인시간 기록
        4. 연차인 경우 사용일수 업데이트
        """
        req = session.get(HrLeaveRequest, leave_request_id)
        if not req:
            raise ValueError(f"Leave request {leave_request_id} not found")

        if req.request_status != "pending":
            raise ValueError(f"Can only approve pending requests, current: {req.request_status}")

        req.request_status = "approved"
        req.approver_employee_id = approver_employee_id
        req.approved_at = datetime.now(timezone.utc)

        # 연차 사용일수 업데이트
        if req.attendance_code and req.attendance_code.deduct_annual:
            annual_leave = session.exec(
                select(HrAnnualLeave).where(
                    HrAnnualLeave.employee_id == req.employee_id,
                    HrAnnualLeave.year == req.start_date.year,
                )
            ).first()

            if annual_leave:
                annual_leave.used_days += req.leave_days
                annual_leave.remaining_days = (
                    annual_leave.granted_days
                    + annual_leave.carried_over_days
                    - annual_leave.used_days
                )

        session.add(req)
        session.commit()
        session.refresh(req)

        return req

    @staticmethod
    def reject_leave_request(
        session: Session,
        leave_request_id: int,
        approver_employee_id: int,
        reason: str,
    ) -> HrLeaveRequest:
        """
        휴가 신청 반려
        """
        req = session.get(HrLeaveRequest, leave_request_id)
        if not req:
            raise ValueError(f"Leave request {leave_request_id} not found")

        if req.request_status != "pending":
            raise ValueError(f"Can only reject pending requests")

        req.request_status = "rejected"
        req.approver_employee_id = approver_employee_id
        req.approved_at = datetime.now(timezone.utc)
        req.rejection_reason = reason

        session.add(req)
        session.commit()
        session.refresh(req)

        return req

    @staticmethod
    def cancel_leave_request(
        session: Session,
        leave_request_id: int,
        reason: str,
    ) -> HrLeaveRequest:
        """
        휴가 신청 취소

        주의: approved 상태에서 취소 시 사용일수 복구
        """
        req = session.get(HrLeaveRequest, leave_request_id)
        if not req:
            raise ValueError(f"Leave request {leave_request_id} not found")

        if req.request_status in ["rejected", "cancelled"]:
            raise ValueError(f"Cannot cancel {req.request_status} request")

        # approved 상태에서 취소 시 연차 복구
        if req.request_status == "approved" and req.attendance_code and req.attendance_code.deduct_annual:
            annual_leave = session.exec(
                select(HrAnnualLeave).where(
                    HrAnnualLeave.employee_id == req.employee_id,
                    HrAnnualLeave.year == req.start_date.year,
                )
            ).first()

            if annual_leave:
                annual_leave.used_days -= req.leave_days
                annual_leave.remaining_days = (
                    annual_leave.granted_days
                    + annual_leave.carried_over_days
                    - annual_leave.used_days
                )

        req.request_status = "cancelled"
        req.cancellation_reason = reason

        session.add(req)
        session.commit()
        session.refresh(req)

        return req


def _calculate_working_days(
    session: Session,
    start_date: date,
    end_date: date,
) -> float:
    """
    근무일 수 계산 (주말, 공휴일 제외)

    Logic:
    1. start_date부터 end_date까지 모든 날짜
    2. 토요일/일요일 제외
    3. tim_holidays 테이블의 공휴일 제외
    4. 특별 근로일(공휴일이면서 근무 지정) 포함

    Example:
    - 2026-02-25 (수) ~ 2026-02-27 (금): 주말 없음 → 3일
    - 2026-02-25 (수) ~ 2026-02-28 (토): 토요일 제외 → 3일
    - 2026-02-23 (월) ~ 2026-02-28 (토): 토일, 설날(2/17제외) → 4일
    """
    holidays = session.exec(select(TimHoliday)).all()
    holiday_dates = {h.holiday_date for h in holidays}

    working_days = 0.0
    current = start_date

    while current <= end_date:
        # 주말 제외 (5=월, 6=토, 0=일)
        if current.weekday() < 5:  # 월~금
            # 공휴일 제외
            if current not in holiday_dates:
                working_days += 1.0

        current += timedelta(days=1)

    return working_days


def _get_annual_leave_balance(
    session: Session,
    employee_id: int,
    year: Optional[int] = None,
) -> HrAnnualLeave:
    """
    연도별 연차 잔여일수 조회

    Args:
        year: None이면 올해

    Returns:
        HrAnnualLeave or creates if doesn't exist
    """
    if year is None:
        year = date.today().year

    annual_leave = session.exec(
        select(HrAnnualLeave).where(
            HrAnnualLeave.employee_id == employee_id,
            HrAnnualLeave.year == year,
        )
    ).first()

    if annual_leave is None:
        # 자동 생성 (계산식 적용)
        annual_leave = _auto_grant_annual_leave(session, employee_id, year)

    return annual_leave


def _auto_grant_annual_leave(
    session: Session,
    employee_id: int,
    year: int,
) -> HrAnnualLeave:
    """
    연차 자동 발생 (근로기준법 제60조 기준)

    규칙:
    - 입사 1년 미만: 월 1일 (최대 11일)
    - 입사 1년 이상: 15일
    - 입사 3년 이상: 2년마다 +1일 (최대 25일)
    - 전년도 미사용 분 월이월 (최대 5일)

    Example:
    - 2023-05-15 입사 → 2026-01: 2년 8개월 → 16일 (15 + 1)
    - 2020-03-01 입사 → 2026-01: 5년 10개월 → 17일 (15 + 2)
    - 25일 초과 불가
    """
    employee = session.get(HrEmployee, employee_id)
    if not employee:
        raise ValueError(f"Employee {employee_id} not found")

    years_of_service = (date(year, 1, 1) - employee.hire_date).days / 365.25

    # 발생일수 계산
    if years_of_service < 1.0:
        # 1년 미만: 월 1일 (현재 월까지 누적)
        months_elapsed = (date(year, 1, 1) - employee.hire_date).days / 30
        granted_days = min(months_elapsed, 11.0)
    elif years_of_service < 3.0:
        # 1년 이상 3년 미만: 15일
        granted_days = 15.0
    else:
        # 3년 이상: 15 + ((years - 3) // 2)
        extra = int((years_of_service - 3.0) // 2.0)
        granted_days = min(15.0 + extra, 25.0)

    # 전년도 월이월 (최대 5일)
    carried_over = 0.0
    if year > employee.hire_date.year + 1:
        prev_year_balance = session.exec(
            select(HrAnnualLeave).where(
                HrAnnualLeave.employee_id == employee_id,
                HrAnnualLeave.year == year - 1,
            )
        ).first()

        if prev_year_balance:
            carried_over = min(prev_year_balance.remaining_days, 5.0)

    # 생성
    annual_leave = HrAnnualLeave(
        employee_id=employee_id,
        year=year,
        grant_type="auto",
        granted_days=granted_days,
        grant_date=date(year, 1, 1),
        carried_over_days=carried_over,
        remaining_days=granted_days + carried_over,
    )
    session.add(annual_leave)
    session.commit()
    session.refresh(annual_leave)

    return annual_leave
```

### 2.2 `hr_annual_leave_service.py`

```python
class AnnualLeaveService:

    @staticmethod
    def get_annual_leave_by_year(
        session: Session,
        employee_id: int,
        year: int,
    ) -> HrAnnualLeave:
        """연도별 연차 잔여 조회"""
        return _get_annual_leave_balance(session, employee_id, year)

    @staticmethod
    def list_annual_leaves(
        session: Session,
        employee_id: Optional[int] = None,
        year: Optional[int] = None,
    ) -> list[HrAnnualLeave]:
        """연차 목록 (다년도 조회 지원)"""
        query = select(HrAnnualLeave)
        if employee_id:
            query = query.where(HrAnnualLeave.employee_id == employee_id)
        if year:
            query = query.where(HrAnnualLeave.year == year)

        return session.exec(query.order_by(HrAnnualLeave.year.desc())).all()

    @staticmethod
    def adjust_annual_leave(
        session: Session,
        employee_id: int,
        year: int,
        adjustment_days: float,  # +/- 값
        reason: str,
    ) -> HrAnnualLeave:
        """
        연차 수동 조정 (관리자 기능)
        예: 병가 30일 대체휴가 등
        """
        annual_leave = _get_annual_leave_balance(session, employee_id, year)

        annual_leave.granted_days += adjustment_days
        annual_leave.remaining_days = (
            annual_leave.granted_days
            + annual_leave.carried_over_days
            - annual_leave.used_days
        )
        annual_leave.note = f"{reason} (adjusted: {adjustment_days:+.1f}d)"

        session.add(annual_leave)
        session.commit()
        session.refresh(annual_leave)

        return annual_leave
```

---

## 3. Backend API Endpoints

### 3.1 `backend/app/api/tim_leave_request.py`

```
# 휴가 신청 조회
GET    /tim/leave-requests?start_date=2026-02-01&end_date=2026-02-28&employee_id=100&status=pending&page=1&limit=50
GET    /tim/leave-requests/{id}

# 휴가 신청 생성
POST   /tim/leave-requests
{
  "attendance_code_id": 1,    # 근태코드 ID
  "start_date": "2026-02-25",
  "end_date": "2026-02-27",
  "reason": "회사 행사 참여"
}

# 휴가 승인
POST   /tim/leave-requests/{id}/approve
{ "reason": "승인완료" }  # 선택사항

# 휴가 반려
POST   /tim/leave-requests/{id}/reject
{ "reason": "개인사유 신청은 경영진 승인 필요" }

# 휴가 취소
POST   /tim/leave-requests/{id}/cancel
{ "reason": "계획 변경" }

# 내 휴가 신청 목록 (직원용)
GET    /tim/leave-requests/my?status=pending

# 승인 대기 목록 (관리자용)
GET    /tim/leave-requests/pending-approval?employee_id=10
```

### 3.2 `backend/app/api/hr_annual_leave.py`

```
# 연차 잔여 조회
GET    /tim/annual-leave/{employee_id}?year=2026

# 연차 이력 (다년도)
GET    /tim/annual-leave/{employee_id}/history

# 연차 수동 조정 (관리자)
POST   /tim/annual-leave/{employee_id}/adjust
{
  "year": 2026,
  "adjustment_days": 3.0,
  "reason": "병가 30일 대체휴가 3일 지급"
}
```

---

## 4. Frontend Components

### 4.1 Pages & Components

```
frontend/src/app/tim/leave-request/
├── page.tsx                                   # 서버 shell
└── (직원용 휴가신청)

frontend/src/app/tim/leave-approval/
├── page.tsx                                   # 서버 shell (관리자용)
└── (승인 대기 목록)

frontend/src/app/tim/annual-leave/
├── page.tsx                                   # 서버 shell
└── (연차 현황)

frontend/src/components/tim/
├── leave-request-form.tsx                     # 휴가 신청 폼
├── leave-request-list.tsx                     # 휴가 신청 목록 (AG Grid)
├── leave-approval-manager.tsx                 # 승인 관리 (AG Grid)
└── annual-leave-dashboard.tsx                 # 연차 현황 카드
```

### 4.2 BFF Proxy Routes

```
frontend/src/app/api/tim/leave-requests/route.ts
frontend/src/app/api/tim/leave-requests/[id]/route.ts
frontend/src/app/api/tim/leave-requests/[id]/approve/route.ts
frontend/src/app/api/tim/leave-requests/[id]/reject/route.ts
frontend/src/app/api/tim/leave-requests/[id]/cancel/route.ts
frontend/src/app/api/tim/leave-requests/my/route.ts
frontend/src/app/api/tim/leave-requests/pending-approval/route.ts

frontend/src/app/api/tim/annual-leave/[id]/route.ts
frontend/src/app/api/tim/annual-leave/[id]/history/route.ts
frontend/src/app/api/tim/annual-leave/[id]/adjust/route.ts
```

---

## 5. Implementation Steps

| 단계 | 작업 | 파일 | 우선순위 |
|------|------|------|---------|
| 1 | DB 모델: HrAnnualLeave + HrLeaveRequest 확장 | `entities.py` | High |
| 2 | 서비스: LeaveRequestService (CRUD + 검증) | `tim_leave_request_service.py` | High |
| 3 | 서비스: AnnualLeaveService (발생/조정) | `hr_annual_leave_service.py` | High |
| 4 | 스키마: 요청/응답 타입 | `schemas/tim_leave_request.py`, `schemas/hr_annual_leave.py` | High |
| 5 | API: 휴가 신청 엔드포인트 | `api/tim_leave_request.py` | High |
| 6 | API: 연차 관리 엔드포인트 | `api/hr_annual_leave.py` | High |
| 7 | 라우터 등록 | `main.py` | High |
| 8 | 시드 데이터: 연차 초기화 | `bootstrap.py` | High |
| 9 | Frontend 타입 | `types/tim.ts` 업데이트 | Medium |
| 10 | BFF 프록시 | `app/api/tim/leave-requests/...` | Medium |
| 11 | 휴가신청 폼 컴포넌트 | `components/tim/leave-request-form.tsx` | Medium |
| 12 | 승인관리 AG Grid | `components/tim/leave-approval-manager.tsx` | Medium |
| 13 | 연차현황 대시보드 | `components/tim/annual-leave-dashboard.tsx` | Medium |
| 14 | 메뉴 + 페이지 라우팅 | `bootstrap.py` + page.tsx | Low |

---

## 6. 한국 근로기준법 준수 사항

### 6.1 연차 발생 규칙 (제60조)

```
1년 미만: 월 1일 발생 (최대 11일)
1년 이상: 15일 발생
3년 이상: 2년마다 +1일 (최대 25일)

예시:
- 2023-05-15 입사, 2026-01: 2년 8개월 → 16일
- 2020-03-01 입사, 2026-01: 5년 10개월 → 17일 (15 + 2)
- 2001-01-01 입사, 2026-01: 25년 → 25일 (capped)
```

**구현:** `_auto_grant_annual_leave()` 함수

### 6.2 월이월 규칙 (제60조 3항)

```
미사용 연차 → 다음 연도로 최대 5일까지 월이월
```

**구현:** `HrAnnualLeave.carried_over_days` (max 5.0)

### 6.3 근무일 기준 (제50조)

```
휴가일수 = 근무일 기준 (주말, 공휴일 제외)

예:
- 월~금 3일: 3일
- 월~토 4일: 3일 (토요일 제외)
- 월~일 (공휴일 2일 포함): 2일
```

**구현:** `_calculate_working_days()` 함수

### 6.4 주 52시간 근로 (제50조)

Phase 4에서 구현 (현재는 근무 기록만 추적)

---

## 7. 테스트 전략

테스트 가이드는 `TIM_PHASE3_TEST.md`에 별도 작성:

- Backend API (휴가신청, 승인, 취소)
- 연차 계산 로직 (1년/3년/5년차 케이스)
- 근무일 계산 (주말/공휴일 제외)
- 중복 신청 감지
- 권한 제어 (직원 본인/관리자)
- 성능 (2K명 × 50회 = 100K+ 신청 조회)

---

## 8. 주요 기술 결정

| 결정 | 이유 |
|------|------|
| **연차 자동 발생** | 근로기준법 준수, 신청 시마다 조회 최적화 |
| **근무일 계산** | 공휴일 제외하여 정확한 일수 산출 |
| **동시성 제어** | 낙관적 잠금 (concurrent updates 허용, 최종 값 일치) |
| **중복 신청 방지** | 쿼리 기반 검사 (Lock 최소화, SELECT ... WHERE overlap) |
| **상태 기반 승인** | pending → approved/rejected → cancelled (단방향) |
| **감사 추적** | approver_employee_id + approved_at로 충분 (별도 테이블 미필요) |

---

## 9. 성능 고려사항

### 데이터 규모
- 직원: 2,000명
- 연 신청: ~30회/명 (주 52시간 대비 보수적)
- 연간 신청: ~60,000건
- 조회: 분석/월말 집중

### 인덱스 전략
```python
# HrAnnualLeave
Index("ix_annual_leave_emp_year", "employee_id", "year")
Index("ix_annual_leave_balance", "employee_id", "remaining_days")

# HrLeaveRequest (기존 인덱스)
Index("ix_tim_leave_requests_emp_status", "employee_id", "request_status")
Index("ix_tim_leave_requests_dates", "start_date", "end_date")

# 추가 (overlap 검사용)
Index("ix_tim_leave_requests_employee_dates", "employee_id", "start_date", "end_date")
```

### 페이지네이션
- 기본값: 50건/페이지
- 최대 100건 (관리자 월말 정산)

---

## 10. 위험 및 완화 전략

| 위험 | 영향 | 완화 |
|------|------|------|
| 연차 중복 계산 | 일수 오류 | 트랜잭션 격리, 테스트 |
| 근무일 계산 오류 | 부당 승인/거절 | Holiday 데이터 검증, 단위테스트 |
| 동시 승인 | 연차 과다 차감 | 트랜잭션 일관성, 버전 제어 |
| 대규모 조회 시간초과 | 관리자 불편 | 페이지네이션, 인덱스 |

---

## 11. 다음 단계 (Phase 4)

- 주 52시간 근로 현황 리포트
- 야간/휴일 근로 수당 계산
- 연차 미사용 현황 (수당 산정 기초)
- 근태 통계 대시보드
