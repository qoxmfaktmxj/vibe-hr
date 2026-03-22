from __future__ import annotations

from fastapi import HTTPException, status
from sqlmodel import Session

from app.schemas.employee import EmployeeBatchRequest, EmployeeBatchResponse
from app.services.employee_command_service import (
    create_employee_no_commit,
    delete_employees_no_commit,
    update_employee_no_commit,
)
from app.services.employee_service_shared import BATCH_DELETE_CHUNK_SIZE, chunked


def batch_save_employees(session: Session, payload: EmployeeBatchRequest) -> EmployeeBatchResponse:
    if payload.mode != "atomic":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Unsupported batch mode.")

    delete_ids = sorted({employee_id for employee_id in payload.delete if employee_id > 0})
    update_items = payload.update
    insert_items = payload.insert

    for index, row in enumerate(update_items, start=1):
        if row.id is None or row.id <= 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"update[{index}] requires valid id.",
            )

    inserted_count = 0
    updated_count = 0
    deleted_count = 0

    try:
        if delete_ids:
            for delete_chunk in chunked(delete_ids, BATCH_DELETE_CHUNK_SIZE):
                deleted_count += delete_employees_no_commit(session, delete_chunk)

        for row in update_items:
            update_employee_no_commit(session, row.id, row)
            updated_count += 1

        for row in insert_items:
            create_employee_no_commit(session, row)
            inserted_count += 1

        session.commit()
    except HTTPException:
        session.rollback()
        raise
    except ValueError as exc:
        session.rollback()
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    except RuntimeError as exc:
        session.rollback()
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from exc
    except IntegrityError as exc:
        session.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Cannot delete employee linked to existing attendance/leave/payroll or related records.",
        ) from exc
    except Exception as exc:
        session.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Batch save failed: {str(exc)}",
        ) from exc

    return EmployeeBatchResponse(
        inserted_count=inserted_count,
        updated_count=updated_count,
        deleted_count=deleted_count,
    )
