# Vibe-HR 코드 품질 개선 계획서 (로직/소스 관점)

> **범위**: 인프라 보안, 배포, 마이그레이션 전략(Alembic 등)은 **제외**
> **대상**: 로직 버그 가능성, 성능, 구조적 일관성
> **작성일**: 2026-02-26

---

## PR-1. 날짜/시간 기준 통일 — `date.today()` vs `datetime.now(tz)` 혼용 제거

### 문제

`date.today()`(서버 로컬 TZ)와 `datetime.now(timezone.utc)`(UTC)가 **같은 서비스 파일 안에서도** 혼용됨.
KST 자정 전후에 출퇴근/휴가/결재 날짜가 하루 어긋날 수 있음.

### 영향 파일 (date.today 사용처 — 총 11개)

| 파일 | 라인 |
|---|---|
| `backend/app/services/tim_attendance_daily_service.py` | 111 (`today = date.today()`) |
| `backend/app/services/dashboard_service.py` | 11 |
| `backend/app/services/auth_service.py` | 154 |
| `backend/app/services/employee_service.py` | 141 |
| `backend/app/services/hri_request_service.py` | 204 |
| `backend/app/services/tim_schedule_service.py` | 161 |
| `backend/app/api/tim_attendance_daily.py` | 76 |
| `backend/app/api/tim_holiday.py` | 34, 50 |
| `backend/app/api/tim_leave.py` | 38, 43, 62 |
| `backend/app/api/tim_report.py` | 25 |
| `backend/app/bootstrap.py` | 853, 1318 (시드 — 우선순위 낮음) |

### 수정 계획

#### 1단계: `backend/app/core/time_utils.py` 신규 생성

```python
from datetime import datetime, date, timezone
from zoneinfo import ZoneInfo

APP_TZ = ZoneInfo("Asia/Seoul")

def now_utc() -> datetime:
    """UTC 기준 현재 시각 (DB 저장용 타임스탬프)"""
    return datetime.now(timezone.utc)

def now_local() -> datetime:
    """업무 기준 타임존(KST) 현재 시각"""
    return now_utc().astimezone(APP_TZ)

def business_today() -> date:
    """업무 기준 '오늘' 날짜 (KST 기준)"""
    return now_local().date()
```

#### 2단계: 전체 `date.today()` → `business_today()` 치환

- 위 11개 파일에서 `from datetime import date` → `from app.core.time_utils import business_today`
- `date.today()` → `business_today()`로 1:1 교체
- `datetime.now(timezone.utc)` → `now_utc()`로 교체 (선택, 일관성용)

#### 3단계: `tim_attendance_daily_service.py` 핵심 수정

현재 (111행):
```python
today = date.today()
```
변경:
```python
from app.core.time_utils import business_today
today = business_today()
```

현재 (128행):
```python
now = datetime.now(timezone.utc)
```
변경:
```python
from app.core.time_utils import now_utc
now = now_utc()
```

### 완료 기준

- [ ] 프로젝트 전체에서 `date.today()` 직접 호출이 0건 (bootstrap.py 시드 제외)
- [ ] KST 23:59 / 00:01 시점 체크인이 올바른 날짜로 귀속 확인
- [ ] `datetime.now(timezone.utc)` → `now_utc()` 통일 (optional)

---

## PR-2. 근태 API target employee_id 경계 분리

### 문제

`resolve_target_employee_id()` 함수가 `requested_employee_id`가 넘어오면 검증 없이 그대로 반환.
일반 사용자 API(체크인/체크아웃/오늘 근태)에서도 타인의 employee_id로 조회/처리 가능한 구조.

### 영향 파일

| 파일 | 라인 | 내용 |
|---|---|---|
| `backend/app/services/tim_attendance_daily_service.py` | 43-51 | `_resolve_employee_id()` 헬퍼 |
| `backend/app/services/tim_attendance_daily_service.py` | 281-282 | `resolve_target_employee_id()` |
| `backend/app/api/tim_attendance_daily.py` | 65, 75, 165, 175 | 호출처 (today/schedule/check-in/out) |

### 수정 계획 — 안2 (기존 엔드포인트 유지, resolve 강제 검증)

> 안1(API 분리)은 프론트 라우트 변경이 크므로, 현 단계에서는 안2로 진행.

#### `_resolve_employee_id()` 수정 (43-51행)

```python
def _resolve_employee_id(
    session: Session,
    current_user: AuthUser,
    requested_employee_id: int | None,
) -> int:
    my_employee_id = _get_my_employee_id(session, current_user)

    # 요청 employee_id가 없거나 본인이면 → 본인
    if requested_employee_id is None or requested_employee_id == my_employee_id:
        return my_employee_id

    # 타인 → HR/Admin role 필수
    allowed_roles = {"ADMIN", "HR_MANAGER"}
    user_roles = {r.role_code for r in current_user.roles} if current_user.roles else set()
    if not user_roles & allowed_roles:
        raise HTTPException(status_code=403, detail="타인 근태 조회/처리 권한이 없습니다.")

    return requested_employee_id
```

### 완료 기준

- [ ] 일반 사용자 토큰 + 타인 employee_id → 403 반환
- [ ] ADMIN/HR_MANAGER 토큰 + 타인 employee_id → 정상 처리
- [ ] employee_id 미전달 → 항상 본인

---

## PR-3. 휴가 일수 계산 일원화 + 사유 필드 구조화

### 문제 A: 표시 일수 vs 차감 일수 불일치

- `_to_leave_item()` (22행): `leave_days = (end_date - start_date).days + 1` → **캘린더 일수**
- 연차 차감: `_working_days()` (132-141행) → **근무일수** (주말+공휴일 제외)
- 화면에 "3일 휴가"로 보이는데 연차는 1일만 차감되는 케이스 발생 가능

### 문제 B: 사유 필드 오염

- 반려 시 (224행): `row.reason = f"{row.reason or ''} | 반려사유: {reason}".strip()`
- 취소 시 (324행): `row.reason = f"{row.reason or ''} | 취소사유: {reason}".strip()`
- 신청 사유와 처리 코멘트가 하나의 필드에 누적 → 검색/리포트 불가능

### 영향 파일

| 파일 | 라인 | 내용 |
|---|---|---|
| `backend/app/services/tim_leave_service.py` | 22 | `leave_days` 계산 (캘린더) |
| `backend/app/services/tim_leave_service.py` | 132-141 | `_working_days()` (근무일 기준) |
| `backend/app/services/tim_leave_service.py` | 161, 232, 312 | `_working_days()` 호출처 |
| `backend/app/services/tim_leave_service.py` | 224, 324 | reason 필드 concat |

### 수정 계획

#### A. 일수 계산 일원화

1. `_to_leave_item()` 응답 DTO 변경:
```python
# Before
leave_days=float((row.end_date - row.start_date).days + 1)

# After
calendar_days=float((row.end_date - row.start_date).days + 1),
deduction_days=_working_days(session, row.start_date, row.end_date),
leave_days=_working_days(session, row.start_date, row.end_date),  # 차감 기준으로 통일
```

2. 프론트 스키마(LeaveRequestItem 등)에 `calendar_days`, `deduction_days` 필드 추가
3. 프론트 표시: 필요에 따라 둘 다 노출 가능

#### B. 사유 필드 분리

1. `tim_leave_requests` 테이블에 컬럼 추가:
   - `decision_comment: str | None` — 승인/반려/취소 처리자 코멘트
   - `decided_by: int | None` — 처리자 employee_id
   - `decided_at: datetime | None` — 처리 시각

2. 반려/취소 로직 변경:
```python
# Before (224행)
row.reason = f"{row.reason or ''} | 반려사유: {reason}".strip()

# After
row.decision_comment = reason
row.decided_by = current_employee_id
row.decided_at = now_utc()
```

3. 응답 DTO에 `decision_comment`, `decided_by`, `decided_at` 필드 추가

### 완료 기준

- [ ] 휴가 목록/상세에서 `leave_days`가 근무일 기준으로 일관되게 표시
- [ ] `calendar_days`(캘린더 일수)도 별도 필드로 조회 가능
- [ ] 반려/취소 시 원래 `reason`이 보존되고 `decision_comment`에만 코멘트 기록

---

## PR-4. 리스트/조회 성능 개선 — 페이징 + N+1 제거

### 문제

| 유형 | 파일 | 라인 | 설명 |
|---|---|---|---|
| **len(all())** | `tim_attendance_daily_service.py` | 78-79 | 전체 로우 fetch 후 len() |
| **len(items)** | `hri_approval_template_service.py` | 166 | 전체 fetch 후 len() |
| **len(items)** | `hri_form_type_service.py` | 103 | 〃 |
| **len(items)** | `tim_attendance_code_service.py` | 114 | 〃 |
| **len(items)** | `tim_holiday_service.py` | 95 | 〃 |
| **len(items)** | `tim_schedule_service.py` | 261 | 〃 |
| **len(items)** | `tim_work_schedule_service.py` | 102 | 〃 |
| **len(items)** | `pay_setup_service.py` | 115, 198, 280, 400 | 4곳 |
| **N+1** | `mng_dev_service.py` | 99, 242, 337, 404, 440 | 루프 내 session.get() 반복 |
| **N+1** | `tim_schedule_service.py` | 96-98 | 루프 내 session.get(Pattern) |
| **Python필터** | `auth_service.py` | 49-81 | 전체 유저 로딩 후 파이썬 필터 |

### 수정 계획

#### A. 공통 `paginate()` 유틸 생성

`backend/app/core/pagination.py`:
```python
from sqlalchemy import func, select
from sqlmodel import Session

def paginate(session: Session, stmt, page: int, size: int):
    page = max(page, 1)
    size = min(max(size, 1), 200)
    offset = (page - 1) * size

    total = session.exec(
        select(func.count()).select_from(stmt.subquery())
    ).one()
    items = session.exec(stmt.offset(offset).limit(size)).all()
    return items, total
```

#### B. 각 서비스 적용 (len() 패턴 → paginate())

총 10개 서비스 파일의 `total_count=len(items)` 패턴을 `paginate()` 호출로 교체.

**가장 중요한 1곳** — `tim_attendance_daily_service.py` (78-79행):
```python
# Before
rows_all = session.exec(base).all()
total_count = len(rows_all)

# After
from app.core.pagination import paginate
items, total_count = paginate(session, base, page, size)
```

#### C. N+1 제거 — `mng_dev_service.py`

**현재** (99행 등):
```python
rows = session.exec(stmt).all()
return [_build_dev_request_item(r, session) for r in rows]
# _build_dev_request_item → session.get(MngCompany, ...) 매번 호출
```

**변경**: Bulk load + dict lookup
```python
rows = session.exec(stmt).all()

# 1) company_id들 모아서 한 번에 조회
company_ids = {r.company_id for r in rows if r.company_id}
companies = {c.id: c for c in session.exec(
    select(MngCompany).where(MngCompany.id.in_(company_ids))
).all()} if company_ids else {}

# 2) employee_id들 모아서 한 번에 조회
emp_ids = {r.manager_employee_id for r in rows if r.manager_employee_id}
employees = {e.id: e for e in session.exec(
    select(HrEmployee).where(HrEmployee.id.in_(emp_ids))
).all()} if emp_ids else {}

# 3) dict lookup으로 build
return [_build_dev_request_item(r, companies, employees) for r in rows]
```

#### D. 임퍼소네이션 검색 DB화 — `auth_service.py` (49-81행)

```python
# Before: 전체 유저 로딩 + 파이썬 필터
users = session.exec(select(AuthUser).where(...)).all()
for user in users:
    if normalized_query not in haystack:
        continue

# After: DB ILIKE 필터 + limit
stmt = select(AuthUser).where(
    AuthUser.is_active == True,
    AuthUser.id != current_user_id,
)
if normalized_query:
    stmt = stmt.where(
        or_(
            AuthUser.login_id.ilike(f"%{normalized_query}%"),
            AuthUser.display_name.ilike(f"%{normalized_query}%"),
            AuthUser.email.ilike(f"%{normalized_query}%"),
        )
    )
stmt = stmt.order_by(AuthUser.login_id).limit(max_limit)
users = session.exec(stmt).all()
```

### 완료 기준

- [ ] 목록 API 모두 DB 레벨 COUNT + offset/limit 페이징
- [ ] `mng_dev_service.py` 목록에서 DB 쿼리 수가 데이터 건수와 무관 (최대 3회)
- [ ] 임퍼소네이션 검색이 DB ILIKE + LIMIT으로 동작

---

## PR-5. 결재 라인 승인자 resolve — 직책 문자열 의존 제거

### 문제

`_resolve_role_actor_user_id()` (hri_request_service.py 80-134행)에서
`position_title.contains("팀장")`, `"부서장"`, `"CEO"` 같은 텍스트 매칭으로 승인자를 결정.

- 직책 명칭 변경/오탈자 시 결재 라인 오작동
- 여러 명 매칭 시 `order_by(id).first()` → "가장 먼저 생성된 사람"이라는 우연 규칙
- 매칭 실패 시 조용히 None 반환 → 결재 생성은 되는데 승인자가 없는 상태

### 영향 파일

| 파일 | 라인 | 내용 |
|---|---|---|
| `backend/app/services/hri_request_service.py` | 80-134 | `_resolve_role_actor_user_id()` |
| `backend/app/services/hri_request_service.py` | 94 | `contains("팀장")` |
| `backend/app/services/hri_request_service.py` | 108-110 | `contains("부서장"/"본부장"/"실장")` |
| `backend/app/services/hri_request_service.py` | 124-126 | `contains("대표"/"CEO"/"사장")` |

### 수정 계획 — 1단계 (현 구조에서 안정화)

> 2단계(OrgDepartment.leader_employee_id 등 조직 데이터 명시 매핑)는
> 조직 관리 화면 기획과 함께 진행하는 것을 권장.

#### A. resolve 함수 중앙화 + 방어 로직 추가

```python
def _resolve_role_actor_user_id(
    session: Session,
    role_code: str,
    requester_emp: HrEmployee,
) -> int | None:
    """역할 기반 승인자 resolve. 매칭 실패/다건 매칭 시 명확한 처리."""

    candidates = _find_candidates_for_role(session, role_code, requester_emp)

    if len(candidates) == 0:
        raise HTTPException(
            status_code=400,
            detail=f"결재 역할 [{role_code}]에 해당하는 승인자를 찾을 수 없습니다. "
                   f"(부서: {requester_emp.department_name or 'N/A'}) "
                   f"조직 설정을 확인해 주세요.",
        )

    if len(candidates) > 1:
        # 로그 경고 + position_level(또는 hire_date) 기준 정렬로 1명 선택
        logger.warning(
            f"결재 역할 [{role_code}] 후보가 {len(candidates)}명: "
            f"{[c.employee_name for c in candidates]}"
        )

    return candidates[0].auth_user_id
```

#### B. 매칭 키워드를 설정으로 분리 (하드코딩 제거)

`backend/app/core/constants.py` (또는 DB 공통코드)에:
```python
APPROVAL_ROLE_POSITION_KEYWORDS: dict[str, list[str]] = {
    "TEAM_LEADER": ["팀장", "파트장", "그룹장"],
    "DEPT_HEAD": ["부서장", "본부장", "실장", "센터장"],
    "CEO": ["대표", "CEO", "사장", "대표이사"],
}
```

- 새 직책 명칭이 생기면 이 설정만 추가하면 됨
- 나중에 DB 공통코드로 옮기기도 쉬움

#### C. 매칭 실패 시 명확한 에러 + 결재 생성 차단

현재: resolve 실패 → None → 결재는 생성되지만 승인자 없음
변경: resolve 실패 → HTTPException 400 → "승인자 미설정" 안내 메시지

### 완료 기준

- [ ] 직책 키워드가 설정(상수/공통코드)으로 관리되어 코드 변경 없이 추가 가능
- [ ] 후보 0명 → 400 에러 + 안내 메시지
- [ ] 후보 2명 이상 → 경고 로그 + 규칙 기반 1명 선택 (id order 아닌 명시 기준)
- [ ] 기존 테스트 케이스에서 결재 라인이 정상 동작

---

## 작업 순서 (권장)

| 순서 | PR | 사유 |
|---|---|---|
| 1 | **PR-1** 시간 기준 통일 | 도메인 전체 파급, 빨리 잡을수록 이득 |
| 2 | **PR-2** 근태 target 경계 | 기능 확장 전에 구조 정리 |
| 3 | **PR-3** 휴가 일수/사유 | 사용자 체감 + 데이터 정합성 |
| 4 | **PR-4** 페이징/N+1 | 데이터 늘기 전에 선제 대응 |
| 5 | **PR-5** 결재 resolve | 조직 화면과 연계, 단계적 진행 |

---

## 프론트엔드 변경 요약

| PR | 프론트 변경 | 내용 |
|---|---|---|
| PR-1 | 없음 | 백엔드 유틸 교체만 |
| PR-2 | 없음 | API 시그니처 동일 유지 |
| PR-3 | `types/` + 그리드 컬럼 | `calendar_days`, `deduction_days`, `decision_comment` 필드 추가 |
| PR-4 | 없음 | 응답 구조 동일 (total_count + items) |
| PR-5 | 없음 | 결재 생성 실패 시 에러 메시지 표시만 (기존 핸들링) |
