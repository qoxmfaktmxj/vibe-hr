"""add severance calcs and item rules

Revision ID: 46507f02680a
Revises: 7e248ebed919
Create Date: 2026-07-09 11:21:15.584401

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
import sqlmodel

# revision identifiers, used by Alembic.
revision: str = '46507f02680a'
down_revision: Union[str, Sequence[str], None] = '7e248ebed919'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table('pay_severance_item_rules',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('pay_item_code', sqlmodel.sql.sqltypes.AutoString(length=30), nullable=False),
    sa.Column('include_type', sqlmodel.sql.sqltypes.AutoString(length=20), nullable=False),
    sa.Column('note', sqlmodel.sql.sqltypes.AutoString(length=200), nullable=True),
    sa.Column('is_active', sa.Boolean(), nullable=False),
    sa.Column('created_at', sa.DateTime(), nullable=False),
    sa.Column('updated_at', sa.DateTime(), nullable=False),
    sa.CheckConstraint("include_type IN ('full', 'prorate_12', 'exclude')", name='ck_pay_severance_item_rules_include_type'),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('pay_item_code', name='uq_pay_severance_item_rules_item_code')
    )
    op.create_index(op.f('ix_pay_severance_item_rules_pay_item_code'), 'pay_severance_item_rules', ['pay_item_code'], unique=False)
    op.create_table('hr_severance_calcs',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('retire_case_id', sa.Integer(), nullable=False),
    sa.Column('employee_id', sa.Integer(), nullable=False),
    sa.Column('hire_date', sa.Date(), nullable=False),
    sa.Column('retire_date', sa.Date(), nullable=False),
    sa.Column('service_days', sa.Integer(), nullable=False),
    sa.Column('avg_wage_base_from', sa.Date(), nullable=True),
    sa.Column('avg_wage_base_to', sa.Date(), nullable=True),
    sa.Column('wage_total_3m', sa.Float(), nullable=False),
    sa.Column('base_days_3m', sa.Integer(), nullable=False),
    sa.Column('avg_daily_wage', sa.Float(), nullable=False),
    sa.Column('severance_amount', sa.Float(), nullable=False),
    sa.Column('adjustment_amount', sa.Float(), nullable=False),
    sa.Column('adjustment_reason', sqlmodel.sql.sqltypes.AutoString(length=500), nullable=True),
    sa.Column('final_amount', sa.Float(), nullable=False),
    sa.Column('status', sqlmodel.sql.sqltypes.AutoString(length=20), nullable=False),
    sa.Column('warning', sqlmodel.sql.sqltypes.AutoString(length=500), nullable=True),
    sa.Column('calculated_at', sa.DateTime(), nullable=True),
    sa.Column('confirmed_by', sa.Integer(), nullable=True),
    sa.Column('confirmed_at', sa.DateTime(), nullable=True),
    sa.Column('created_at', sa.DateTime(), nullable=False),
    sa.Column('updated_at', sa.DateTime(), nullable=False),
    sa.CheckConstraint("status IN ('draft', 'reviewed', 'confirmed')", name='ck_hr_severance_calcs_status'),
    sa.ForeignKeyConstraint(['confirmed_by'], ['auth_users.id'], ),
    sa.ForeignKeyConstraint(['employee_id'], ['hr_employees.id'], ),
    sa.ForeignKeyConstraint(['retire_case_id'], ['hr_retire_cases.id'], ),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('retire_case_id', name='uq_hr_severance_calcs_retire_case_id')
    )
    op.create_index(op.f('ix_hr_severance_calcs_employee_id'), 'hr_severance_calcs', ['employee_id'], unique=False)
    op.create_index('ix_hr_severance_calcs_employee_status', 'hr_severance_calcs', ['employee_id', 'status'], unique=False)
    op.create_index(op.f('ix_hr_severance_calcs_retire_case_id'), 'hr_severance_calcs', ['retire_case_id'], unique=False)
    op.create_index(op.f('ix_hr_severance_calcs_retire_date'), 'hr_severance_calcs', ['retire_date'], unique=False)


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index(op.f('ix_hr_severance_calcs_retire_date'), table_name='hr_severance_calcs')
    op.drop_index(op.f('ix_hr_severance_calcs_retire_case_id'), table_name='hr_severance_calcs')
    op.drop_index('ix_hr_severance_calcs_employee_status', table_name='hr_severance_calcs')
    op.drop_index(op.f('ix_hr_severance_calcs_employee_id'), table_name='hr_severance_calcs')
    op.drop_table('hr_severance_calcs')
    op.drop_index(op.f('ix_pay_severance_item_rules_pay_item_code'), table_name='pay_severance_item_rules')
    op.drop_table('pay_severance_item_rules')
