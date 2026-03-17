from __future__ import annotations

from fastapi import APIRouter, Depends, Query
from sqlmodel import Session

from app.core.auth import get_current_user, require_roles
from app.core.database import get_session
from app.models import AuthUser
from app.schemas.tra import (
    TraApplyCyberResultsRequest,
    TraApplicationActionResponse,
    TraApplicationCreateRequest,
    TraApplicationListResponse,
    TraApplicationRejectRequest,
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
    approve_tra_application,
    batch_save_tra_resource,
    create_tra_application,
    generate_elearning_windows,
    generate_required_events,
    generate_required_targets,
    get_my_tra_applications,
    list_tra_applications_detail,
    list_tra_resource,
    reject_tra_application,
    withdraw_tra_application,
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
    "/my-applications",
    response_model=TraApplicationListResponse,
    dependencies=[Depends(require_roles("employee", "hr_manager", "admin"))],
)
def my_applications_api(
    session: Session = Depends(get_session),
    current_user: AuthUser = Depends(get_current_user),
) -> TraApplicationListResponse:
    return get_my_tra_applications(session, current_user)


@router.post(
    "/my-applications",
    response_model=TraApplicationActionResponse,
    dependencies=[Depends(require_roles("employee", "hr_manager", "admin"))],
)
def create_application_api(
    payload: TraApplicationCreateRequest,
    session: Session = Depends(get_session),
    current_user: AuthUser = Depends(get_current_user),
) -> TraApplicationActionResponse:
    return create_tra_application(session, payload, current_user)


@router.get(
    "/applications-detail",
    response_model=TraApplicationListResponse,
    dependencies=[Depends(require_roles("hr_manager", "admin"))],
)
def applications_detail_api(
    session: Session = Depends(get_session),
) -> TraApplicationListResponse:
    return list_tra_applications_detail(session)


@router.post(
    "/applications/{app_id}/approve",
    response_model=TraApplicationActionResponse,
    dependencies=[Depends(require_roles("hr_manager", "admin"))],
)
def approve_application_api(
    app_id: int,
    session: Session = Depends(get_session),
) -> TraApplicationActionResponse:
    return approve_tra_application(session, app_id)


@router.post(
    "/applications/{app_id}/reject",
    response_model=TraApplicationActionResponse,
    dependencies=[Depends(require_roles("hr_manager", "admin"))],
)
def reject_application_api(
    app_id: int,
    payload: TraApplicationRejectRequest,
    session: Session = Depends(get_session),
) -> TraApplicationActionResponse:
    return reject_tra_application(session, app_id, payload)


@router.put(
    "/applications/{app_id}/withdraw",
    response_model=TraApplicationActionResponse,
    dependencies=[Depends(require_roles("employee", "hr_manager", "admin"))],
)
def withdraw_application_api(
    app_id: int,
    session: Session = Depends(get_session),
    current_user: AuthUser = Depends(get_current_user),
) -> TraApplicationActionResponse:
    return withdraw_tra_application(session, app_id, current_user)


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
