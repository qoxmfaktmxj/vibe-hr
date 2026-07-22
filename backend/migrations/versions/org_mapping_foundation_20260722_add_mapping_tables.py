"""mapping models and exact reversible migration

Revision ID: org_mapping_foundation_20260722
Revises: ea501237b804
Create Date: 2026-07-22 00:00:00.000000
"""

from alembic import op
import sqlalchemy as sa


revision = "org_mapping_foundation_20260722"
down_revision = "ea501237b804"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("CREATE EXTENSION IF NOT EXISTS btree_gist")

    op.create_table(
        "org_mapping_type_items",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True, nullable=False),
        sa.Column("type_code", sa.String(length=50), nullable=False),
        sa.Column("item_code", sa.String(length=50), nullable=False),
        sa.Column("name", sa.String(length=100), nullable=False),
        sa.Column("effective_from", sa.Date(), nullable=False),
        sa.Column("effective_to", sa.Date(), nullable=True),
        sa.Column("erp_employee_code", sa.String(length=50), nullable=True),
        sa.Column("cost_center_type", sa.String(length=50), nullable=True),
        sa.Column("remark", sa.String(length=500), nullable=True),
        sa.Column("sort_order", sa.Integer(), nullable=False, server_default=sa.text("0")),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column(
            "created_by",
            sa.Integer(),
            sa.ForeignKey("auth_users.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column(
            "updated_by",
            sa.Integer(),
            sa.ForeignKey("auth_users.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.UniqueConstraint("id", "type_code", name="uq_org_mapping_type_items_id_type"),
        sa.CheckConstraint(
            "effective_to IS NULL OR effective_to >= effective_from",
            name="ck_org_mapping_type_items_date_order",
        ),
    )
    op.create_index(
        "ix_org_mapping_type_items_type_item_from",
        "org_mapping_type_items",
        ["type_code", "item_code", "effective_from"],
    )
    op.execute(
        """
        ALTER TABLE org_mapping_type_items
        ADD CONSTRAINT ex_org_mapping_type_items_period
        EXCLUDE USING gist (
            type_code WITH =,
            item_code WITH =,
            daterange(effective_from, coalesce(effective_to, 'infinity'::date), '[]') WITH &&
        )
        """
    )

    op.create_table(
        "org_mapping_assignments",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True, nullable=False),
        sa.Column(
            "department_id",
            sa.Integer(),
            sa.ForeignKey("org_departments.id", ondelete="RESTRICT"),
            nullable=False,
        ),
        sa.Column("type_code", sa.String(length=50), nullable=False),
        sa.Column("item_id", sa.Integer(), nullable=False),
        sa.Column("effective_from", sa.Date(), nullable=False),
        sa.Column("effective_to", sa.Date(), nullable=True),
        sa.Column(
            "created_by",
            sa.Integer(),
            sa.ForeignKey("auth_users.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column(
            "updated_by",
            sa.Integer(),
            sa.ForeignKey("auth_users.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.CheckConstraint(
            "effective_to IS NULL OR effective_to >= effective_from",
            name="ck_org_mapping_assignments_date_order",
        ),
    )
    op.create_foreign_key(
        "fk_org_mapping_assignments_item_type",
        "org_mapping_assignments",
        "org_mapping_type_items",
        ["item_id", "type_code"],
        ["id", "type_code"],
        ondelete="RESTRICT",
    )
    op.create_index(
        "ix_org_mapping_assignments_department_type_from",
        "org_mapping_assignments",
        ["department_id", "type_code", "effective_from"],
    )
    op.create_index("ix_org_mapping_assignments_item_id", "org_mapping_assignments", ["item_id"])
    op.execute(
        """
        ALTER TABLE org_mapping_assignments
        ADD CONSTRAINT ex_org_mapping_assignments_period
        EXCLUDE USING gist (
            department_id WITH =,
            type_code WITH =,
            daterange(effective_from, coalesce(effective_to, 'infinity'::date), '[]') WITH &&
        )
        """
    )


def downgrade() -> None:
    op.execute("ALTER TABLE org_mapping_assignments DROP CONSTRAINT IF EXISTS ex_org_mapping_assignments_period")
    op.execute("ALTER TABLE org_mapping_type_items DROP CONSTRAINT IF EXISTS ex_org_mapping_type_items_period")
    op.drop_index("ix_org_mapping_assignments_item_id", table_name="org_mapping_assignments")
    op.drop_index("ix_org_mapping_assignments_department_type_from", table_name="org_mapping_assignments")
    op.drop_constraint(
        "fk_org_mapping_assignments_item_type",
        "org_mapping_assignments",
        type_="foreignkey",
    )
    op.drop_table("org_mapping_assignments")
    op.drop_index("ix_org_mapping_type_items_type_item_from", table_name="org_mapping_type_items")
    op.drop_table("org_mapping_type_items")
