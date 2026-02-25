from fastapi import APIRouter, Depends
from sqlmodel import Session

from app.core.auth import require_roles
from app.core.database import get_session
from app.schemas.hri_approval_template import (
    HriApprovalTemplateBatchRequest,
    HriApprovalTemplateBatchResponse,
    HriApprovalTemplateListResponse,
)
from app.services.hri_approval_template_service import (
    batch_save_approval_templates,
    list_approval_templates,
)

router = APIRouter(prefix="/hri/approval-templates", tags=["hri-approval-templates"])


@router.get(
    "",
    response_model=HriApprovalTemplateListResponse,
    dependencies=[Depends(require_roles("hr_manager", "admin"))],
)
def get_approval_templates(session: Session = Depends(get_session)) -> HriApprovalTemplateListResponse:
    items = list_approval_templates(session)
    return HriApprovalTemplateListResponse(items=items, total_count=len(items))


@router.post(
    "/batch",
    response_model=HriApprovalTemplateBatchResponse,
    dependencies=[Depends(require_roles("hr_manager", "admin"))],
)
def save_approval_templates_batch(
    payload: HriApprovalTemplateBatchRequest,
    session: Session = Depends(get_session),
) -> HriApprovalTemplateBatchResponse:
    return batch_save_approval_templates(session, payload)
