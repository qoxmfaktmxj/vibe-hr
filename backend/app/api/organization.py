from __future__ import annotations

from datetime import date

from fastapi import APIRouter, Depends, Query, Response, status
from sqlmodel import Session

from app.core.auth import get_current_user, require_roles
from app.core.database import get_session
from app.models import AuthUser
from app.schemas.organization import (
    OrgDeptChangeHistoryListResponse,
    OrgRestructureApplyResponse,
    OrgRestructurePlanCreateRequest,
    OrgRestructurePlanItem as OrgRestructurePlanItemSchema,
    OrgRestructurePlanItemCreateRequest,
    OrgRestructurePlanItemDetail,
    OrgRestructurePlanItemListResponse,
    OrgRestructurePlanItemUpdateRequest,
    OrgRestructurePlanListResponse,
    OrgRestructurePlanUpdateRequest,
    OrgMappingAssignmentCreateRequest,
    OrgMappingAssignmentDetailResponse,
    OrgMappingAssignmentListResponse,
    OrgMappingAssignmentUploadConfirmResponse,
    OrgMappingAssignmentUploadPreviewResponse,
    OrgMappingAssignmentUploadRequest,
    OrgMappingAssignmentUploadTemplateResponse,
    OrgMappingAssignmentUpdateRequest,
    OrgMappingPersonalStatusListResponse,
    OrgMappingTypeItemCreateRequest,
    OrgMappingTypeItemDetailResponse,
    OrgMappingTypeItemListResponse,
    OrgMappingTypeItemUpdateRequest,
    OrganizationLookupItemsResponse,
    OrganizationChartResponse,
    OrganizationCorporationCreateRequest,
    OrganizationCorporationDetailResponse,
    OrganizationCorporationListResponse,
    OrganizationCorporationUpdateRequest,
    OrganizationDepartmentCreateRequest,
    OrganizationDepartmentDetailResponse,
    OrganizationDepartmentListResponse,
    OrganizationDepartmentUpdateRequest,
)
from app.services.organization_mapping_service import (
    create_mapping_assignment,
    confirm_mapping_assignment_upload,
    create_mapping_type_item,
    delete_mapping_assignment,
    list_department_options,
    list_mapping_assignments,
    list_mapping_item_options,
    list_mapping_type_options,
    list_mapping_types,
    list_mapping_personal_status,
    list_mapping_type_items,
    preview_mapping_assignment_upload,
    update_mapping_assignment,
    delete_mapping_type_item,
    update_mapping_type_item,
)
from app.services.org_restructure_service import (
    add_plan_item,
    apply_restructure_plan,
    create_restructure_plan,
    delete_plan_item,
    delete_restructure_plan,
    list_dept_change_history,
    list_plan_items,
    list_restructure_plans,
    update_plan_item,
    update_restructure_plan,
)
from app.services.organization_service import (
    create_corporation,
    create_department,
    delete_corporation,
    delete_department,
    list_chart_departments,
    list_corporations,
    list_departments,
    update_corporation,
    update_department,
)
from app.services.menu_service import require_menu_action_for_user

router = APIRouter(prefix="/org", tags=["organization"])


@router.get(
    "/corporations",
    response_model=OrganizationCorporationListResponse,
    dependencies=[Depends(require_roles("hr_manager", "admin"))],
)
def organization_corporations(
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=100, ge=1, le=1000),
    all: bool = Query(default=False),
    enter_cd: str | None = Query(default=None),
    company_code: str | None = Query(default=None),
    corporation_name: str | None = Query(default=None),
    session: Session = Depends(get_session),
) -> OrganizationCorporationListResponse:
    if all:
        corporations, total_count = list_corporations(
            session,
            enter_cd=enter_cd,
            company_code=company_code,
            corporation_name=corporation_name,
        )
        return OrganizationCorporationListResponse(
            corporations=corporations,
            total_count=total_count,
        )

    corporations, total_count = list_corporations(
        session,
        page=page,
        limit=limit,
        enter_cd=enter_cd,
        company_code=company_code,
        corporation_name=corporation_name,
    )
    return OrganizationCorporationListResponse(
        corporations=corporations,
        total_count=total_count,
        page=page,
        limit=limit,
    )


@router.post(
    "/corporations",
    response_model=OrganizationCorporationDetailResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_roles("hr_manager", "admin"))],
)
def organization_corporation_create(
    payload: OrganizationCorporationCreateRequest,
    session: Session = Depends(get_session),
) -> OrganizationCorporationDetailResponse:
    corporation = create_corporation(session, payload)
    return OrganizationCorporationDetailResponse(corporation=corporation)


@router.put(
    "/corporations/{corporation_id}",
    response_model=OrganizationCorporationDetailResponse,
    dependencies=[Depends(require_roles("hr_manager", "admin"))],
)
def organization_corporation_update(
    corporation_id: int,
    payload: OrganizationCorporationUpdateRequest,
    session: Session = Depends(get_session),
) -> OrganizationCorporationDetailResponse:
    corporation = update_corporation(session, corporation_id, payload)
    return OrganizationCorporationDetailResponse(corporation=corporation)


@router.delete(
    "/corporations/{corporation_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(require_roles("hr_manager", "admin"))],
)
def organization_corporation_delete(
    corporation_id: int,
    session: Session = Depends(get_session),
) -> Response:
    delete_corporation(session, corporation_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get(
    "/departments",
    response_model=OrganizationDepartmentListResponse,
    dependencies=[Depends(require_roles("hr_manager", "admin"))],
)
def organization_departments(
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=100, ge=1, le=1000),
    all: bool = Query(default=False),
    code: str | None = Query(default=None),
    name: str | None = Query(default=None),
    organization_type: str | None = Query(default=None),
    cost_center_code: str | None = Query(default=None),
    reference_date: date | None = Query(default=None),
    session: Session = Depends(get_session),
    current_user: AuthUser = Depends(get_current_user),
) -> OrganizationDepartmentListResponse:
    require_menu_action_for_user(session, user_id=current_user.id, path="/org/departments", action_code="query")
    if all:
        departments, total_count = list_departments(
            session,
            code=code,
            name=name,
            organization_type=organization_type,
            cost_center_code=cost_center_code,
        )
        return OrganizationDepartmentListResponse(
            departments=departments,
            total_count=total_count,
            reference_date=reference_date,
        )

    departments, total_count = list_departments(
        session,
        page=page,
        limit=limit,
        code=code,
        name=name,
        organization_type=organization_type,
        cost_center_code=cost_center_code,
    )
    return OrganizationDepartmentListResponse(
        departments=departments,
        total_count=total_count,
        reference_date=reference_date,
        page=page,
        limit=limit,
    )


@router.get(
    "/chart",
    response_model=OrganizationChartResponse,
)
def organization_chart(
    session: Session = Depends(get_session),
    current_user: AuthUser = Depends(get_current_user),
) -> OrganizationChartResponse:
    require_menu_action_for_user(session, user_id=current_user.id, path="/org/chart", action_code="query")
    departments, total_count = list_chart_departments(session)
    return OrganizationChartResponse(departments=departments, total_count=total_count)


@router.get(
    "/mapping-types",
    response_model=OrganizationLookupItemsResponse,
    dependencies=[Depends(require_roles("hr_manager", "admin"))],
)
def mapping_types(
    session: Session = Depends(get_session),
    current_user: AuthUser = Depends(get_current_user),
) -> OrganizationLookupItemsResponse:
    require_menu_action_for_user(session, user_id=current_user.id, path="/org/type-items", action_code="query")
    return OrganizationLookupItemsResponse(items=list_mapping_types(session))


@router.get(
    "/mapping-assignments",
    response_model=OrgMappingAssignmentListResponse,
    dependencies=[Depends(require_roles("hr_manager", "admin"))],
)
def mapping_assignments(
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=100, ge=1, le=1000),
    department_id: int | None = Query(default=None),
    type_code: str | None = Query(default=None),
    reference_date: date | None = Query(default=None),
    session: Session = Depends(get_session),
    current_user: AuthUser = Depends(get_current_user),
) -> OrgMappingAssignmentListResponse:
    require_menu_action_for_user(session, user_id=current_user.id, path="/org/types", action_code="query")
    items, total_count = list_mapping_assignments(
        session,
        page=page,
        limit=limit,
        department_id=department_id,
        type_code=type_code,
        reference_date=reference_date,
    )
    return OrgMappingAssignmentListResponse(items=items, total_count=total_count, page=page, limit=limit)


@router.post(
    "/mapping-assignments",
    response_model=OrgMappingAssignmentDetailResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_roles("hr_manager", "admin"))],
)
def mapping_assignment_create(
    payload: OrgMappingAssignmentCreateRequest,
    session: Session = Depends(get_session),
    current_user: AuthUser = Depends(get_current_user),
) -> OrgMappingAssignmentDetailResponse:
    require_menu_action_for_user(session, user_id=current_user.id, path="/org/types", action_code="save")
    return OrgMappingAssignmentDetailResponse(item=create_mapping_assignment(session, payload))


@router.get(
    "/mapping-assignments/upload-template",
    response_model=OrgMappingAssignmentUploadTemplateResponse,
    dependencies=[Depends(require_roles("hr_manager", "admin"))],
)
def mapping_assignment_upload_template(
    session: Session = Depends(get_session),
    current_user: AuthUser = Depends(get_current_user),
) -> OrgMappingAssignmentUploadTemplateResponse:
    require_menu_action_for_user(
        session,
        user_id=current_user.id,
        path="/org/type-upload",
        action_code="template_download",
    )
    return OrgMappingAssignmentUploadTemplateResponse(
        headers=["조직코드", "유형코드", "항목코드", "시작일", "종료일"],
    )


@router.post(
    "/mapping-assignments/upload-preview",
    response_model=OrgMappingAssignmentUploadPreviewResponse,
    dependencies=[Depends(require_roles("hr_manager", "admin"))],
)
def mapping_assignment_upload_preview(
    payload: OrgMappingAssignmentUploadRequest,
    session: Session = Depends(get_session),
    current_user: AuthUser = Depends(get_current_user),
) -> OrgMappingAssignmentUploadPreviewResponse:
    require_menu_action_for_user(session, user_id=current_user.id, path="/org/type-upload", action_code="upload")
    return preview_mapping_assignment_upload(session, payload.rows)


@router.post(
    "/mapping-assignments/upload-confirm",
    response_model=OrgMappingAssignmentUploadConfirmResponse,
    dependencies=[Depends(require_roles("hr_manager", "admin"))],
)
def mapping_assignment_upload_confirm(
    payload: OrgMappingAssignmentUploadRequest,
    session: Session = Depends(get_session),
    current_user: AuthUser = Depends(get_current_user),
) -> OrgMappingAssignmentUploadConfirmResponse:
    require_menu_action_for_user(session, user_id=current_user.id, path="/org/type-upload", action_code="upload")
    return confirm_mapping_assignment_upload(session, payload.rows, actor_id=int(current_user.id))


@router.put(
    "/mapping-assignments/{assignment_id}",
    response_model=OrgMappingAssignmentDetailResponse,
    dependencies=[Depends(require_roles("hr_manager", "admin"))],
)
def mapping_assignment_update(
    assignment_id: int,
    payload: OrgMappingAssignmentUpdateRequest,
    session: Session = Depends(get_session),
    current_user: AuthUser = Depends(get_current_user),
) -> OrgMappingAssignmentDetailResponse:
    require_menu_action_for_user(session, user_id=current_user.id, path="/org/types", action_code="save")
    return OrgMappingAssignmentDetailResponse(item=update_mapping_assignment(session, assignment_id, payload))


@router.delete(
    "/mapping-assignments/{assignment_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(require_roles("hr_manager", "admin"))],
)
def mapping_assignment_delete(
    assignment_id: int,
    session: Session = Depends(get_session),
    current_user: AuthUser = Depends(get_current_user),
) -> Response:
    require_menu_action_for_user(session, user_id=current_user.id, path="/org/types", action_code="save")
    delete_mapping_assignment(session, assignment_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get(
    "/mapping-personal-status",
    response_model=OrgMappingPersonalStatusListResponse,
    dependencies=[Depends(require_roles("hr_manager", "admin"))],
)
def mapping_personal_status(
    reference_date: date = Query(...),
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=100, ge=1, le=1000),
    session: Session = Depends(get_session),
    current_user: AuthUser = Depends(get_current_user),
) -> OrgMappingPersonalStatusListResponse:
    require_menu_action_for_user(session, user_id=current_user.id, path="/org/type-personal-status", action_code="query")
    return list_mapping_personal_status(
        session,
        reference_date=reference_date,
        page=page,
        limit=limit,
    )


@router.get(
    "/mapping-type-items",
    response_model=OrgMappingTypeItemListResponse,
    dependencies=[Depends(require_roles("hr_manager", "admin"))],
)
def mapping_type_items(
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=100, ge=1, le=1000),
    type_code: str | None = Query(default=None),
    reference_date: date | None = Query(default=None),
    session: Session = Depends(get_session),
    current_user: AuthUser = Depends(get_current_user),
) -> OrgMappingTypeItemListResponse:
    require_menu_action_for_user(session, user_id=current_user.id, path="/org/type-items", action_code="query")
    items, total_count = list_mapping_type_items(
        session,
        page=page,
        limit=limit,
        type_code=type_code,
        reference_date=reference_date,
    )
    return OrgMappingTypeItemListResponse(items=items, total_count=total_count, page=page, limit=limit)


@router.post(
    "/mapping-type-items",
    response_model=OrgMappingTypeItemDetailResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_roles("hr_manager", "admin"))],
)
def mapping_type_item_create(
    payload: OrgMappingTypeItemCreateRequest,
    session: Session = Depends(get_session),
    current_user: AuthUser = Depends(get_current_user),
) -> OrgMappingTypeItemDetailResponse:
    require_menu_action_for_user(session, user_id=current_user.id, path="/org/type-items", action_code="save")
    return OrgMappingTypeItemDetailResponse(item=create_mapping_type_item(session, payload))


@router.put(
    "/mapping-type-items/{item_id}",
    response_model=OrgMappingTypeItemDetailResponse,
    dependencies=[Depends(require_roles("hr_manager", "admin"))],
)
def mapping_type_item_update(
    item_id: int,
    payload: OrgMappingTypeItemUpdateRequest,
    session: Session = Depends(get_session),
    current_user: AuthUser = Depends(get_current_user),
) -> OrgMappingTypeItemDetailResponse:
    require_menu_action_for_user(session, user_id=current_user.id, path="/org/type-items", action_code="save")
    return OrgMappingTypeItemDetailResponse(item=update_mapping_type_item(session, item_id, payload))


@router.delete(
    "/mapping-type-items/{item_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(require_roles("hr_manager", "admin"))],
)
def mapping_type_item_delete(
    item_id: int,
    session: Session = Depends(get_session),
    current_user: AuthUser = Depends(get_current_user),
) -> Response:
    require_menu_action_for_user(session, user_id=current_user.id, path="/org/type-items", action_code="save")
    delete_mapping_type_item(session, item_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get(
    "/mapping-type-options",
    response_model=OrganizationLookupItemsResponse,
    dependencies=[Depends(require_roles("hr_manager", "admin"))],
)
def mapping_type_options(
    session: Session = Depends(get_session),
    current_user: AuthUser = Depends(get_current_user),
) -> OrganizationLookupItemsResponse:
    require_menu_action_for_user(session, user_id=current_user.id, path="/org/types", action_code="query")
    return OrganizationLookupItemsResponse(items=list_mapping_type_options(session))


@router.get(
    "/mapping-item-options",
    response_model=OrganizationLookupItemsResponse,
    dependencies=[Depends(require_roles("hr_manager", "admin"))],
)
def mapping_item_options(
    type_code: str = Query(..., min_length=1),
    session: Session = Depends(get_session),
    current_user: AuthUser = Depends(get_current_user),
) -> OrganizationLookupItemsResponse:
    require_menu_action_for_user(session, user_id=current_user.id, path="/org/types", action_code="query")
    return OrganizationLookupItemsResponse(items=list_mapping_item_options(session, type_code=type_code))


@router.get(
    "/department-options",
    response_model=OrganizationLookupItemsResponse,
    dependencies=[Depends(require_roles("hr_manager", "admin"))],
)
def department_options(
    session: Session = Depends(get_session),
    current_user: AuthUser = Depends(get_current_user),
) -> OrganizationLookupItemsResponse:
    require_menu_action_for_user(session, user_id=current_user.id, path="/org/types", action_code="query")
    return OrganizationLookupItemsResponse(items=list_department_options(session))


@router.post(
    "/departments",
    response_model=OrganizationDepartmentDetailResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_roles("hr_manager", "admin"))],
)
def organization_department_create(
    payload: OrganizationDepartmentCreateRequest,
    session: Session = Depends(get_session),
    current_user: AuthUser = Depends(get_current_user),
) -> OrganizationDepartmentDetailResponse:
    require_menu_action_for_user(session, user_id=current_user.id, path="/org/departments", action_code="save")
    department = create_department(session, payload)
    return OrganizationDepartmentDetailResponse(department=department)


@router.put(
    "/departments/{department_id}",
    response_model=OrganizationDepartmentDetailResponse,
    dependencies=[Depends(require_roles("hr_manager", "admin"))],
)
def organization_department_update(
    department_id: int,
    payload: OrganizationDepartmentUpdateRequest,
    session: Session = Depends(get_session),
    current_user: AuthUser = Depends(get_current_user),
) -> OrganizationDepartmentDetailResponse:
    require_menu_action_for_user(session, user_id=current_user.id, path="/org/departments", action_code="save")
    department = update_department(session, department_id, payload, changed_by=current_user.id)
    return OrganizationDepartmentDetailResponse(department=department)


@router.delete(
    "/departments/{department_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(require_roles("hr_manager", "admin"))],
)
def organization_department_delete(
    department_id: int,
    session: Session = Depends(get_session),
    current_user: AuthUser = Depends(get_current_user),
) -> Response:
    require_menu_action_for_user(session, user_id=current_user.id, path="/org/departments", action_code="save")
    delete_department(session, department_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


# ---------------------------------------------------------------------------
# B안: 부서 변경 이력 조회
# ---------------------------------------------------------------------------
@router.get(
    "/dept-history",
    response_model=OrgDeptChangeHistoryListResponse,
    dependencies=[Depends(require_roles("hr_manager", "admin"))],
)
def get_dept_change_history(
    department_id: int | None = Query(default=None),
    limit: int = Query(default=200, ge=1, le=1000),
    session: Session = Depends(get_session),
) -> OrgDeptChangeHistoryListResponse:
    return list_dept_change_history(session, department_id=department_id, limit=limit)


# ---------------------------------------------------------------------------
# A안: 조직개편안 (Plan) CRUD
# ---------------------------------------------------------------------------
@router.get(
    "/restructure/plans",
    response_model=OrgRestructurePlanListResponse,
    dependencies=[Depends(require_roles("hr_manager", "admin"))],
)
def get_restructure_plans(
    status_filter: str | None = Query(default=None, alias="status"),
    session: Session = Depends(get_session),
) -> OrgRestructurePlanListResponse:
    return list_restructure_plans(session, status_filter=status_filter)


@router.post(
    "/restructure/plans",
    response_model=OrgRestructurePlanItemSchema,
    dependencies=[Depends(require_roles("hr_manager", "admin"))],
)
def create_plan(
    payload: OrgRestructurePlanCreateRequest,
    session: Session = Depends(get_session),
    current_user: AuthUser = Depends(get_current_user),
) -> OrgRestructurePlanItemSchema:
    return create_restructure_plan(session, payload, current_user.id)


@router.put(
    "/restructure/plans/{plan_id}",
    response_model=OrgRestructurePlanItemSchema,
    dependencies=[Depends(require_roles("hr_manager", "admin"))],
)
def update_plan(
    plan_id: int,
    payload: OrgRestructurePlanUpdateRequest,
    session: Session = Depends(get_session),
) -> OrgRestructurePlanItemSchema:
    return update_restructure_plan(session, plan_id, payload)


@router.delete(
    "/restructure/plans/{plan_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(require_roles("hr_manager", "admin"))],
)
def delete_plan(
    plan_id: int,
    session: Session = Depends(get_session),
) -> Response:
    delete_restructure_plan(session, plan_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post(
    "/restructure/plans/{plan_id}/apply",
    response_model=OrgRestructureApplyResponse,
    dependencies=[Depends(require_roles("hr_manager", "admin"))],
)
def apply_plan(
    plan_id: int,
    session: Session = Depends(get_session),
    current_user: AuthUser = Depends(get_current_user),
) -> OrgRestructureApplyResponse:
    return apply_restructure_plan(session, plan_id, current_user.id)


# ---------------------------------------------------------------------------
# A안: 개편안 항목 (Plan Items) CRUD
# ---------------------------------------------------------------------------
@router.get(
    "/restructure/plans/{plan_id}/items",
    response_model=OrgRestructurePlanItemListResponse,
    dependencies=[Depends(require_roles("hr_manager", "admin"))],
)
def get_plan_items(
    plan_id: int,
    session: Session = Depends(get_session),
) -> OrgRestructurePlanItemListResponse:
    return list_plan_items(session, plan_id)


@router.post(
    "/restructure/plans/{plan_id}/items",
    response_model=OrgRestructurePlanItemDetail,
    dependencies=[Depends(require_roles("hr_manager", "admin"))],
)
def create_plan_item(
    plan_id: int,
    payload: OrgRestructurePlanItemCreateRequest,
    session: Session = Depends(get_session),
) -> OrgRestructurePlanItemDetail:
    return add_plan_item(session, plan_id, payload)


@router.put(
    "/restructure/plans/{plan_id}/items/{item_id}",
    response_model=OrgRestructurePlanItemDetail,
    dependencies=[Depends(require_roles("hr_manager", "admin"))],
)
def update_plan_item_endpoint(
    plan_id: int,
    item_id: int,
    payload: OrgRestructurePlanItemUpdateRequest,
    session: Session = Depends(get_session),
) -> OrgRestructurePlanItemDetail:
    return update_plan_item(session, plan_id, item_id, payload)


@router.delete(
    "/restructure/plans/{plan_id}/items/{item_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(require_roles("hr_manager", "admin"))],
)
def delete_plan_item_endpoint(
    plan_id: int,
    item_id: int,
    session: Session = Depends(get_session),
) -> Response:
    delete_plan_item(session, plan_id, item_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
