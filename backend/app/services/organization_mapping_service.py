from __future__ import annotations

from sqlmodel import Session, select

from app.models import AppCode, AppCodeGroup, OrgDepartment, OrgMappingTypeItem
from app.schemas.organization import OrganizationLookupItem

MAPPING_TYPE_GROUP_CODE = "ORG_MAPPING_TYPE"


def _lookup_item(code: str, name: str) -> OrganizationLookupItem:
    return OrganizationLookupItem(code=code, name=name)


def _list_mapping_type_codes(session: Session) -> list[OrganizationLookupItem]:
    group = session.exec(
        select(AppCodeGroup).where(AppCodeGroup.code == MAPPING_TYPE_GROUP_CODE, AppCodeGroup.is_active == True)
    ).first()
    if group is None:
        return []

    rows = session.exec(
        select(AppCode)
        .where(AppCode.group_id == group.id, AppCode.is_active == True)
        .order_by(AppCode.sort_order, AppCode.id)
    ).all()
    return [_lookup_item(code=row.code, name=row.name) for row in rows]


def list_mapping_types(session: Session) -> list[OrganizationLookupItem]:
    return _list_mapping_type_codes(session)


def list_mapping_type_options(session: Session) -> list[OrganizationLookupItem]:
    return _list_mapping_type_codes(session)


def list_mapping_item_options(session: Session, *, type_code: str) -> list[OrganizationLookupItem]:
    rows = session.exec(
        select(OrgMappingTypeItem)
        .where(
            OrgMappingTypeItem.type_code == type_code.strip().upper(),
            OrgMappingTypeItem.is_active == True,
        )
        .order_by(OrgMappingTypeItem.sort_order, OrgMappingTypeItem.id)
    ).all()
    return [_lookup_item(code=row.item_code, name=row.name) for row in rows]


def list_department_options(session: Session) -> list[OrganizationLookupItem]:
    rows = session.exec(
        select(OrgDepartment)
        .where(OrgDepartment.is_active == True)
        .order_by(OrgDepartment.code, OrgDepartment.id)
    ).all()
    return [_lookup_item(code=row.code, name=row.name) for row in rows]
