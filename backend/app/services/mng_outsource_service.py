"""MNG 외주관리 서비스 (외주계약, 외주근태)."""

from __future__ import annotations

from datetime import date, datetime, timezone

from fastapi import HTTPException, status
from sqlmodel import Session, select

from app.models import (
    AuthUser,
    HrEmployee,
    MngOutsourceAttendance,
    MngOutsourceContract,
)
from app.schemas.mng import (
    MngOutsourceAttendanceCreateRequest,
    MngOutsourceAttendanceItem,
    MngOutsourceAttendanceSummaryItem,
    MngOutsourceContractCreateRequest,
    MngOutsourceContractItem,
    MngOutsourceContractUpdateRequest,
)


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


def _resolve_emp(session: Session, employee_id: int) -> tuple[str | None, str | None]:
    emp = session.get(HrEmployee, employee_id)
    if emp is None:
        return None, None
    user = session.get(AuthUser, emp.user_id)
    return (user.display_name if user else None), emp.employee_no


# ── 외주 계약 ──

def _build_contract_item(c: MngOutsourceContract, session: Session) -> MngOutsourceContractItem:
    name, no = _resolve_emp(session, c.employee_id)
    return MngOutsourceContractItem(
        id=c.id,
        employee_id=c.employee_id,
        employee_name=name,
        employee_no=no,
        start_date=c.start_date,
        end_date=c.end_date,
        total_leave_count=c.total_leave_count,
        extra_leave_count=c.extra_leave_count,
        note=c.note,
        is_active=c.is_active,
        created_at=c.created_at,
        updated_at=c.updated_at,
    )


def list_outsource_contracts(
    session: Session,
    *,
    search: str | None = None,
) -> list[MngOutsourceContractItem]:
    stmt = select(MngOutsourceContract).where(MngOutsourceContract.is_active == True).order_by(MngOutsourceContract.id.desc())
    rows = session.exec(stmt).all()
    items = [_build_contract_item(c, session) for c in rows]

    if search:
        keyword = search.strip().lower()
        items = [
            it for it in items
            if (it.employee_name and keyword in it.employee_name.lower())
            or (it.employee_no and keyword in it.employee_no.lower())
        ]
    return items


def get_outsource_contract(session: Session, contract_id: int) -> MngOutsourceContractItem:
    c = session.get(MngOutsourceContract, contract_id)
    if c is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="계약을 찾을 수 없습니다.")
    return _build_contract_item(c, session)


def create_outsource_contract(session: Session, payload: MngOutsourceContractCreateRequest) -> MngOutsourceContractItem:
    emp = session.get(HrEmployee, payload.employee_id)
    if emp is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="사원을 찾을 수 없습니다.")

    if has_duplicate_outsource_contract(session, payload.employee_id, payload.start_date):
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="동일한 사원/시작일 계약이 이미 존재합니다.")

    c = MngOutsourceContract(
        employee_id=payload.employee_id,
        start_date=payload.start_date,
        end_date=payload.end_date,
        total_leave_count=payload.total_leave_count,
        extra_leave_count=payload.extra_leave_count,
        note=payload.note,
        is_active=True,
        created_at=_utc_now(),
        updated_at=_utc_now(),
    )
    session.add(c)
    session.commit()
    session.refresh(c)
    return _build_contract_item(c, session)


def update_outsource_contract(session: Session, contract_id: int, payload: MngOutsourceContractUpdateRequest) -> MngOutsourceContractItem:
    c = session.get(MngOutsourceContract, contract_id)
    if c is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="계약을 찾을 수 없습니다.")

    for field_name in payload.model_fields_set:
        setattr(c, field_name, getattr(payload, field_name))

    c.updated_at = _utc_now()
    session.add(c)
    session.commit()
    session.refresh(c)
    return _build_contract_item(c, session)


def delete_outsource_contracts(session: Session, ids: list[int]) -> int:
    rows = session.exec(select(MngOutsourceContract).where(MngOutsourceContract.id.in_(ids))).all()
    for row in rows:
        session.delete(row)
    session.commit()
    return len(rows)


def has_duplicate_outsource_contract(
    session: Session,
    employee_id: int,
    start_date: date,
    exclude_contract_id: int | None = None,
) -> bool:
    stmt = select(MngOutsourceContract.id).where(
        MngOutsourceContract.employee_id == employee_id,
        MngOutsourceContract.start_date == start_date,
    )
    if exclude_contract_id:
        stmt = stmt.where(MngOutsourceContract.id != exclude_contract_id)
    return session.exec(stmt).first() is not None


# ── 외주 근태 ──

def list_outsource_attendance_summary(session: Session) -> list[MngOutsourceAttendanceSummaryItem]:
    contracts = session.exec(
        select(MngOutsourceContract).where(MngOutsourceContract.is_active == True).order_by(MngOutsourceContract.id.desc())
    ).all()
    result: list[MngOutsourceAttendanceSummaryItem] = []
    for c in contracts:
        att_rows = session.exec(
            select(MngOutsourceAttendance).where(MngOutsourceAttendance.contract_id == c.id)
        ).all()
        used = sum((a.apply_count or 0) for a in att_rows)
        total = c.total_leave_count + c.extra_leave_count
        name, no = _resolve_emp(session, c.employee_id)
        result.append(MngOutsourceAttendanceSummaryItem(
            contract_id=c.id,
            employee_id=c.employee_id,
            employee_name=name,
            employee_no=no,
            start_date=c.start_date,
            end_date=c.end_date,
            total_count=total,
            used_count=used,
            remain_count=max(total - used, 0),
            note=c.note,
        ))
    return result


def list_outsource_attendances(session: Session, contract_id: int) -> list[MngOutsourceAttendanceItem]:
    rows = session.exec(
        select(MngOutsourceAttendance)
        .where(MngOutsourceAttendance.contract_id == contract_id)
        .order_by(MngOutsourceAttendance.start_date.desc())
    ).all()
    return [
        MngOutsourceAttendanceItem(
            id=a.id,
            contract_id=a.contract_id,
            employee_id=a.employee_id,
            attendance_code=a.attendance_code,
            apply_date=a.apply_date,
            status_code=a.status_code,
            start_date=a.start_date,
            end_date=a.end_date,
            apply_count=a.apply_count,
            note=a.note,
            created_at=a.created_at,
            updated_at=a.updated_at,
        )
        for a in rows
    ]


def create_outsource_attendance(session: Session, payload: MngOutsourceAttendanceCreateRequest) -> MngOutsourceAttendanceItem:
    contract = session.get(MngOutsourceContract, payload.contract_id)
    if contract is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="계약을 찾을 수 없습니다.")

    a = MngOutsourceAttendance(
        contract_id=payload.contract_id,
        employee_id=payload.employee_id,
        attendance_code=payload.attendance_code,
        apply_date=payload.apply_date,
        status_code=payload.status_code,
        start_date=payload.start_date,
        end_date=payload.end_date,
        apply_count=payload.apply_count,
        note=payload.note,
        created_at=_utc_now(),
        updated_at=_utc_now(),
    )
    session.add(a)
    session.commit()
    session.refresh(a)
    return MngOutsourceAttendanceItem(
        id=a.id,
        contract_id=a.contract_id,
        employee_id=a.employee_id,
        attendance_code=a.attendance_code,
        apply_date=a.apply_date,
        status_code=a.status_code,
        start_date=a.start_date,
        end_date=a.end_date,
        apply_count=a.apply_count,
        note=a.note,
        created_at=a.created_at,
        updated_at=a.updated_at,
    )


def delete_outsource_attendances(session: Session, ids: list[int]) -> int:
    rows = session.exec(select(MngOutsourceAttendance).where(MngOutsourceAttendance.id.in_(ids))).all()
    for row in rows:
        session.delete(row)
    session.commit()
    return len(rows)
