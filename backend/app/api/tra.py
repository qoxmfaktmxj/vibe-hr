from __future__ import annotations

from fastapi import APIRouter, Depends, Query
from sqlmodel import Session

from app.core.auth import require_roles
from app.core.database import get_session
from app.schemas.tra import (
    TraApplyCyberResultsRequest,
    TraGenerateElearningWindowsRequest,
    TraGenerateRequiredEventsRequest,
    TraGenerateRequiredTargetsRequest,
    TraGenerationResponse,
    TraResourceBatchRequest,
    TraResourceBatchResponse,
    TraResourceListResponse,
)
from app.services.tra_service import (
    apply_cyber_results,
    batch_save_tra_resource,
    generate_elearning_windows,
    generate_required_events,
    generate_required_targets,
    list_tra_resource,
)

router = APIRouter(prefix="/tra", tags=["tra"])


@router.post(
    "/generate/required-events",
    response_model=TraGenerationResponse,
    dependencies=[Depends(require_roles("hr_manager", "admin"))],
)
def generate_required_events_api(
    payload: TraGenerateRequiredEventsRequest,
    session: Session = Depends(get_session),
) -> TraGenerationResponse:
    processed = generate_required_events(session, payload.year)
    return TraGenerationResponse(processed=processed, message="Required events generated.")


@router.post(
    "/generate/required-targets",
    response_model=TraGenerationResponse,
    dependencies=[Depends(require_roles("hr_manager", "admin"))],
)
def generate_required_targets_api(
    payload: TraGenerateRequiredTargetsRequest,
    session: Session = Depends(get_session),
) -> TraGenerationResponse:
    processed = generate_required_targets(session, payload.year, payload.rule_code)
    return TraGenerationResponse(processed=processed, message="Required targets generated.")


@router.post(
    "/generate/elearning-windows",
    response_model=TraGenerationResponse,
    dependencies=[Depends(require_roles("hr_manager", "admin"))],
)
def generate_elearning_windows_api(
    payload: TraGenerateElearningWindowsRequest,
    session: Session = Depends(get_session),
) -> TraGenerationResponse:
    processed = generate_elearning_windows(session, payload.year, payload.app_count)
    return TraGenerationResponse(processed=processed, message="E-learning windows generated.")


@router.post(
    "/cyber-results/apply",
    response_model=TraGenerationResponse,
    dependencies=[Depends(require_roles("hr_manager", "admin"))],
)
def apply_cyber_results_api(
    payload: TraApplyCyberResultsRequest,
    session: Session = Depends(get_session),
) -> TraGenerationResponse:
    processed = apply_cyber_results(session, payload.upload_ym)
    return TraGenerationResponse(processed=processed, message="Cyber upload results applied.")


@router.get(
    "/{resource}",
    response_model=TraResourceListResponse,
    dependencies=[Depends(require_roles("employee", "hr_manager", "admin"))],
)
def list_resource_api(
    resource: str,
    year: int | None = Query(default=None, ge=2000, le=2100),
    session: Session = Depends(get_session),
) -> TraResourceListResponse:
    items = list_tra_resource(session, resource, year=year)
    return TraResourceListResponse(items=items, total_count=len(items))


@router.post(
    "/{resource}/batch",
    response_model=TraResourceBatchResponse,
    dependencies=[Depends(require_roles("hr_manager", "admin"))],
)
def save_resource_batch_api(
    resource: str,
    payload: TraResourceBatchRequest,
    session: Session = Depends(get_session),
) -> TraResourceBatchResponse:
    result = batch_save_tra_resource(session, resource, payload)
    return TraResourceBatchResponse(**result)
