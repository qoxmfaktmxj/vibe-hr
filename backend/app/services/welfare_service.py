from __future__ import annotations

from datetime import datetime, timezone

from fastapi import HTTPException, status
from sqlmodel import Session, select

from app.models import AuthUser, HrEmployee, OrgDepartment, WelBenefitRequest, WelBenefitType
from app.schemas.welfare import (
    WelBenefitRequestActionResponse,
    WelBenefitRequestApproveRequest,
    WelBenefitRequestCreateRequest,
    WelBenefitRequestItem,
    WelBenefitRequestRejectRequest,
    WelBenefitTypeBatchRequest,
    WelBenefitTypeItem,
)


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


def list_wel_benefit_types(session: Session) -> list[WelBenefitTypeItem]:
    rows = session.exec(
        select(WelBenefitType).order_by(WelBenefitType.sort_order, WelBenefitType.id)
    ).all()
    return [WelBenefitTypeItem.model_validate(row, from_attributes=True) for row in rows]


def list_wel_benefit_requests(session: Session) -> list[WelBenefitRequestItem]:
    rows = session.exec(
        select(WelBenefitRequest).order_by(WelBenefitRequest.requested_at.desc(), WelBenefitRequest.id.desc())
    ).all()
    return [WelBenefitRequestItem.model_validate(row, from_attributes=True) for row in rows]


def batch_save_wel_benefit_types(session: Session, payload: WelBenefitTypeBatchRequest) -> dict[str, int]:
    created = updated = deleted = 0

    for item in payload.items:
        status = item._status or "clean"

        if status == "added":
            row = WelBenefitType(
                code=item.code,
                name=item.name,
                module_path=item.module_path,
                is_deduction=item.is_deduction,
                pay_item_code=item.pay_item_code,
                is_active=item.is_active,
                sort_order=item.sort_order,
            )
            session.add(row)
            created += 1
            continue

        if item.id is None:
            continue

        existing = session.get(WelBenefitType, item.id)
        if existing is None:
            continue

        if status == "deleted":
            session.delete(existing)
            deleted += 1
            continue

        if status == "updated":
            existing.code = item.code
            existing.name = item.name
            existing.module_path = item.module_path
            existing.is_deduction = item.is_deduction
            existing.pay_item_code = item.pay_item_code
            existing.is_active = item.is_active
            existing.sort_order = item.sort_order
            existing.updated_at = _utc_now()
            session.add(existing)
            updated += 1

    session.commit()
    return {"created": created, "updated": updated, "deleted": deleted}


# ─── Write flow helpers ──────────────────────────────────────────────────────


def _generate_request_no(session: Session) -> str:
    """WEL-YYYYMM-NNNNN 형식 신청번호 자동생성."""
    from datetime import date
    ym = date.today().strftime("%Y%m")
    prefix = f"WEL-{ym}-"
    latest = session.exec(
        select(WelBenefitRequest)
        .where(WelBenefitRequest.request_no.startswith(prefix))
        .order_by(WelBenefitRequest.id.desc())
    ).first()
    if latest is None:
        seq = 1
    else:
        try:
            seq = int(latest.request_no.rsplit("-", 1)[-1]) + 1
        except (ValueError, IndexError):
            seq = 1
    return f"{prefix}{seq:05d}"


def _get_employee_info(session: Session, current_user: AuthUser) -> tuple[int, str, str, str]:
    """사용자 → (employee_id, employee_no, employee_name, department_name)."""
    emp = session.exec(select(HrEmployee).where(HrEmployee.user_id == current_user.id)).first()
    if emp is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="사원 프로필을 찾을 수 없습니다.")
    dept = session.get(OrgDepartment, emp.department_id) if emp.department_id else None
    emp_name = current_user.display_name or current_user.username
    return emp.id, emp.employee_no or "", emp_name, dept.name if dept else ""


def _build_request_item(req: WelBenefitRequest) -> WelBenefitRequestItem:
    return WelBenefitRequestItem.model_validate(req, from_attributes=True)


def create_wel_request(
    session: Session,
    payload: WelBenefitRequestCreateRequest,
    current_user: AuthUser,
) -> WelBenefitRequestActionResponse:
    benefit_type = session.exec(
        select(WelBenefitType).where(WelBenefitType.code == payload.benefit_type_code, WelBenefitType.is_active == True)
    ).first()
    if benefit_type is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="복리후생 유형을 찾을 수 없습니다.")

    emp_id, emp_no, emp_name, dept_name = _get_employee_info(session, current_user)
    request_no = _generate_request_no(session)

    req = WelBenefitRequest(
        request_no=request_no,
        benefit_type_code=benefit_type.code,
        benefit_type_name=benefit_type.name,
        employee_id=emp_id,
        employee_no=emp_no,
        employee_name=emp_name,
        department_name=dept_name,
        status_code="submitted",
        requested_amount=payload.requested_amount,
        description=payload.description,
        requested_at=_utc_now(),
    )
    session.add(req)
    session.commit()
    session.refresh(req)
    return WelBenefitRequestActionResponse(item=_build_request_item(req))


def get_my_wel_requests(session: Session, current_user: AuthUser) -> list[WelBenefitRequestItem]:
    emp = session.exec(select(HrEmployee).where(HrEmployee.user_id == current_user.id)).first()
    if emp is None:
        return []
    rows = session.exec(
        select(WelBenefitRequest)
        .where(WelBenefitRequest.employee_id == emp.id)
        .order_by(WelBenefitRequest.requested_at.desc(), WelBenefitRequest.id.desc())
    ).all()
    return [_build_request_item(r) for r in rows]


def approve_wel_request(
    session: Session,
    req_id: int,
    payload: WelBenefitRequestApproveRequest,
) -> WelBenefitRequestActionResponse:
    req = session.get(WelBenefitRequest, req_id)
    if req is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="신청 건을 찾을 수 없습니다.")
    if req.status_code != "submitted":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"승인 대기(submitted) 상태가 아닙니다. 현재 상태: {req.status_code}",
        )
    req.status_code = "approved"
    req.approved_amount = payload.approved_amount
    req.approved_at = _utc_now()
    if payload.note:
        req.description = (req.description or "") + f"\n[승인메모] {payload.note}"
    req.updated_at = _utc_now()
    session.add(req)
    session.commit()
    session.refresh(req)
    return WelBenefitRequestActionResponse(item=_build_request_item(req))


def reject_wel_request(
    session: Session,
    req_id: int,
    payload: WelBenefitRequestRejectRequest,
) -> WelBenefitRequestActionResponse:
    req = session.get(WelBenefitRequest, req_id)
    if req is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="신청 건을 찾을 수 없습니다.")
    if req.status_code not in ("submitted", "draft"):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"반려할 수 없는 상태입니다. 현재 상태: {req.status_code}",
        )
    req.status_code = "rejected"
    if payload.reason:
        req.description = (req.description or "") + f"\n[반려사유] {payload.reason}"
    req.updated_at = _utc_now()
    session.add(req)
    session.commit()
    session.refresh(req)
    return WelBenefitRequestActionResponse(item=_build_request_item(req))


def withdraw_wel_request(
    session: Session,
    req_id: int,
    current_user: AuthUser,
) -> WelBenefitRequestActionResponse:
    req = session.get(WelBenefitRequest, req_id)
    if req is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="신청 건을 찾을 수 없습니다.")

    emp = session.exec(select(HrEmployee).where(HrEmployee.user_id == current_user.id)).first()
    if emp is None or req.employee_id != emp.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="본인의 신청 건만 회수할 수 있습니다.")

    if req.status_code not in ("submitted", "draft"):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"회수할 수 없는 상태입니다. 현재 상태: {req.status_code}",
        )
    req.status_code = "withdrawn"
    req.updated_at = _utc_now()
    session.add(req)
    session.commit()
    session.refresh(req)
    return WelBenefitRequestActionResponse(item=_build_request_item(req))
