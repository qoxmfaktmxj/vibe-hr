from fastapi import APIRouter, Depends
from sqlmodel import Session

from app.core.auth import get_current_user, require_roles
from app.core.database import get_session
from app.models import AuthUser
from app.schemas.hri_form_type import (
    HriFormTypeBatchRequest,
    HriFormTypeBatchResponse,
    HriFormTypeListResponse,
)
from app.services.hri_form_type_service import batch_save_form_types, list_form_types

router = APIRouter(prefix="/hri/form-types", tags=["hri-form-types"])


@router.get(
    "",
    response_model=HriFormTypeListResponse,
    dependencies=[Depends(require_roles("hr_manager", "admin"))],
)
def get_form_types(session: Session = Depends(get_session)) -> HriFormTypeListResponse:
    items = list_form_types(session)
    return HriFormTypeListResponse(items=items, total_count=len(items))


@router.post(
    "/batch",
    response_model=HriFormTypeBatchResponse,
    dependencies=[Depends(require_roles("hr_manager", "admin"))],
)
def save_form_types_batch(
    payload: HriFormTypeBatchRequest,
    session: Session = Depends(get_session),
    current_user: AuthUser = Depends(get_current_user),
) -> HriFormTypeBatchResponse:
    return batch_save_form_types(session, payload, current_user.id)
