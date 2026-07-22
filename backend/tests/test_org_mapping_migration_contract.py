from pathlib import Path

from app.models import OrgMappingAssignment, OrgMappingTypeItem


def constraint_names(table) -> set[str]:
    return {constraint.name for constraint in table.constraints if constraint.name}


def foreign_key_constraint(table, name: str):
    for constraint in table.foreign_key_constraints:
        if constraint.name == name:
            return constraint
    raise AssertionError(name)


def index_names(table) -> set[str]:
    return {index.name for index in table.indexes if index.name}


def server_default_text(column) -> str:
    assert column.server_default is not None
    return str(column.server_default.arg).lower()


def assert_source_order(source: str, snippets: list[str]) -> None:
    cursor = -1
    for snippet in snippets:
        position = source.index(snippet)
        assert position > cursor
        cursor = position


def test_mapping_metadata_has_exact_fks_checks_indexes_and_defaults() -> None:
    item_table = OrgMappingTypeItem.__table__
    assignment_table = OrgMappingAssignment.__table__

    assert ["id"] == list(item_table.primary_key.columns.keys())
    assert "uq_org_mapping_type_items_id_type" in constraint_names(item_table)
    assert "ck_org_mapping_type_items_date_order" in constraint_names(item_table)
    assert "ix_org_mapping_type_items_type_item_from" in index_names(item_table)

    assert foreign_key_constraint(item_table, "fk_org_mapping_type_items_created_by").elements[0].ondelete == "SET NULL"
    assert foreign_key_constraint(item_table, "fk_org_mapping_type_items_updated_by").elements[0].ondelete == "SET NULL"
    assert item_table.c.sort_order.nullable is False
    assert server_default_text(item_table.c.sort_order) == "0"
    assert item_table.c.is_active.nullable is False
    assert server_default_text(item_table.c.is_active) == "true"
    assert item_table.c.created_at.type.timezone is True
    assert server_default_text(item_table.c.created_at) == "now()"
    assert item_table.c.updated_at.type.timezone is True
    assert server_default_text(item_table.c.updated_at) == "now()"

    assert "ck_org_mapping_assignments_date_order" in constraint_names(assignment_table)
    assert "ix_org_mapping_assignments_department_type_from" in index_names(assignment_table)
    assert "ix_org_mapping_assignments_item_id" in index_names(assignment_table)
    assert foreign_key_constraint(assignment_table, "fk_org_mapping_assignments_item_type").elements[0].ondelete == "RESTRICT"
    assert foreign_key_constraint(assignment_table, "fk_org_mapping_assignments_department").elements[0].ondelete == "RESTRICT"
    assert foreign_key_constraint(assignment_table, "fk_org_mapping_assignments_created_by").elements[0].ondelete == "SET NULL"
    assert foreign_key_constraint(assignment_table, "fk_org_mapping_assignments_updated_by").elements[0].ondelete == "SET NULL"
    assert assignment_table.c.created_at.type.timezone is True
    assert server_default_text(assignment_table.c.created_at) == "now()"
    assert assignment_table.c.updated_at.type.timezone is True
    assert server_default_text(assignment_table.c.updated_at) == "now()"


def test_mapping_downgrade_reverse_order_is_explicit() -> None:
    source = Path(__file__).resolve().parents[1] / "migrations" / "versions" / "org_mapping_foundation_20260722_add_mapping_tables.py"
    text = source.read_text(encoding="utf-8")
    assert_source_order(
        text,
        [
            'op.execute("ALTER TABLE org_mapping_assignments DROP CONSTRAINT IF EXISTS ex_org_mapping_assignments_period")',
            'op.execute("ALTER TABLE org_mapping_type_items DROP CONSTRAINT IF EXISTS ex_org_mapping_type_items_period")',
            'op.drop_index("ix_org_mapping_assignments_item_id", table_name="org_mapping_assignments")',
            'op.drop_index("ix_org_mapping_assignments_department_type_from", table_name="org_mapping_assignments")',
            'op.drop_index("ix_org_mapping_type_items_type_item_from", table_name="org_mapping_type_items")',
            'op.drop_constraint(\n        "fk_org_mapping_assignments_item_type",\n        "org_mapping_assignments",\n        type_="foreignkey",\n    )',
            'op.drop_constraint(\n        "fk_org_mapping_assignments_created_by",\n        "org_mapping_assignments",\n        type_="foreignkey",\n    )',
            'op.drop_constraint(\n        "fk_org_mapping_assignments_updated_by",\n        "org_mapping_assignments",\n        type_="foreignkey",\n    )',
            'op.drop_constraint(\n        "fk_org_mapping_assignments_department",\n        "org_mapping_assignments",\n        type_="foreignkey",\n    )',
            'op.drop_constraint(\n        "ck_org_mapping_assignments_date_order",\n        "org_mapping_assignments",\n        type_="check",\n    )',
            'op.drop_table("org_mapping_assignments")',
            'op.drop_constraint(\n        "fk_org_mapping_type_items_created_by",\n        "org_mapping_type_items",\n        type_="foreignkey",\n    )',
            'op.drop_constraint(\n        "fk_org_mapping_type_items_updated_by",\n        "org_mapping_type_items",\n        type_="foreignkey",\n    )',
            'op.drop_constraint(\n        "ck_org_mapping_type_items_date_order",\n        "org_mapping_type_items",\n        type_="check",\n    )',
            'op.drop_table("org_mapping_type_items")',
        ],
    )


def test_mapping_exclusion_constraints_are_explicit_in_source() -> None:
    source = Path(__file__).resolve().parents[1] / "migrations" / "versions" / "org_mapping_foundation_20260722_add_mapping_tables.py"
    text = source.read_text(encoding="utf-8")

    assert "ex_org_mapping_type_items_period" in text
    assert "ex_org_mapping_assignments_period" in text
    assert text.count("EXCLUDE USING gist") == 2
    assert text.count("daterange(effective_from, coalesce(effective_to, 'infinity'::date), '[]') WITH &&") == 2
