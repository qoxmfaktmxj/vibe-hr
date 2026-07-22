from app.models import OrgMappingAssignment, OrgMappingTypeItem


def constraint_names(table) -> set[str]:
    return {constraint.name for constraint in table.constraints if constraint.name}


def foreign_key_names(table) -> set[str]:
    return {constraint.name for constraint in table.foreign_key_constraints if constraint.name}


def index_names(table) -> set[str]:
    return {index.name for index in table.indexes if index.name}


def test_mapping_metadata_has_composite_item_key_and_assignment_fk() -> None:
    assert ["id"] == list(OrgMappingTypeItem.__table__.primary_key.columns.keys())
    assert "uq_org_mapping_type_items_id_type" in constraint_names(OrgMappingTypeItem.__table__)
    assert "fk_org_mapping_assignments_item_type" in foreign_key_names(OrgMappingAssignment.__table__)


def test_mapping_period_date_order_and_indexes_are_declared() -> None:
    assert "ck_org_mapping_type_items_date_order" in constraint_names(OrgMappingTypeItem.__table__)
    assert "ix_org_mapping_assignments_item_id" in index_names(OrgMappingAssignment.__table__)
