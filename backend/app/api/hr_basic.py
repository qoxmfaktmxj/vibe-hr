from fastapi import APIRouter, Depends
from sqlmodel import Session

from app.core.auth import require_roles
from app.core.database import get_session
from app.schemas.hr_basic import HrBasicDetailResponse
from app.services.hr_basic_service import get_hr_basic_detail

router = APIRouter(prefix="/hr/basic", tags=["hr-basic"])


@router.get(
    "/{employee_id}",
    response_model=HrBasicDetailResponse,
    dependencies=[Depends(require_roles("hr_manager", "admin"))],
)
def hr_basic_detail(employee_id: int, session: Session = Depends(get_session)) -> HrBasicDetailResponse:
    return get_hr_basic_detail(session, employee_id)
