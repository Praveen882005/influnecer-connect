"""phase5_campaign_forecasting_and_actuals

Revision ID: 8b9f3c1d2e4a
Revises: 7a8e2b9c1d3f
Create Date: 2026-10-24 17:50:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '8b9f3c1d2e4a'
down_revision: Union[str, Sequence[str], None] = '7a8e2b9c1d3f'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'campaign_forecasts',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('campaign_id', sa.Integer(), nullable=True),
        sa.Column('brand_id', sa.Integer(), nullable=False),
        sa.Column('forecast_name', sa.String(length=255), nullable=False, server_default='Campaign Sales Forecast'),
        sa.Column('source_data_origin', sa.String(length=100), nullable=False, server_default='user_assumptions'),
        sa.Column('impressions', sa.Integer(), nullable=False),
        sa.Column('click_through_rate', sa.Float(), nullable=False),
        sa.Column('conversion_rate', sa.Float(), nullable=False),
        sa.Column('average_order_value', sa.Float(), nullable=False),
        sa.Column('campaign_cost', sa.Float(), nullable=False),
        sa.Column('conservative_projection', sa.JSON(), nullable=False),
        sa.Column('baseline_projection', sa.JSON(), nullable=False),
        sa.Column('optimistic_projection', sa.JSON(), nullable=False),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['brand_id'], ['brand_profiles.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['campaign_id'], ['campaigns.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_campaign_forecasts_id'), 'campaign_forecasts', ['id'], unique=False)
    op.create_index(op.f('ix_campaign_forecasts_campaign_id'), 'campaign_forecasts', ['campaign_id'], unique=False)
    op.create_index(op.f('ix_campaign_forecasts_brand_id'), 'campaign_forecasts', ['brand_id'], unique=False)

    op.create_table(
        'campaign_actual_outcomes',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('campaign_id', sa.Integer(), nullable=False),
        sa.Column('brand_id', sa.Integer(), nullable=False),
        sa.Column('actual_impressions', sa.Integer(), nullable=True),
        sa.Column('actual_clicks', sa.Integer(), nullable=True),
        sa.Column('actual_conversions', sa.Integer(), nullable=True),
        sa.Column('actual_gross_revenue', sa.Float(), nullable=True),
        sa.Column('actual_spend', sa.Float(), nullable=True),
        sa.Column('actual_roi_pct', sa.Float(), nullable=True),
        sa.Column('actual_ctr_pct', sa.Float(), nullable=True),
        sa.Column('actual_cvr_pct', sa.Float(), nullable=True),
        sa.Column('actual_cpc', sa.Float(), nullable=True),
        sa.Column('actual_cpa', sa.Float(), nullable=True),
        sa.Column('attribution_provider', sa.String(length=100), nullable=False, server_default='Manual Tracking'),
        sa.Column('tracked_period_start', sa.DateTime(), nullable=True),
        sa.Column('tracked_period_end', sa.DateTime(), nullable=True),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['brand_id'], ['brand_profiles.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['campaign_id'], ['campaigns.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_campaign_actual_outcomes_id'), 'campaign_actual_outcomes', ['id'], unique=False)
    op.create_index(op.f('ix_campaign_actual_outcomes_campaign_id'), 'campaign_actual_outcomes', ['campaign_id'], unique=True)
    op.create_index(op.f('ix_campaign_actual_outcomes_brand_id'), 'campaign_actual_outcomes', ['brand_id'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_campaign_actual_outcomes_brand_id'), table_name='campaign_actual_outcomes')
    op.drop_index(op.f('ix_campaign_actual_outcomes_campaign_id'), table_name='campaign_actual_outcomes')
    op.drop_index(op.f('ix_campaign_actual_outcomes_id'), table_name='campaign_actual_outcomes')
    op.drop_table('campaign_actual_outcomes')

    op.drop_index(op.f('ix_campaign_forecasts_brand_id'), table_name='campaign_forecasts')
    op.drop_index(op.f('ix_campaign_forecasts_campaign_id'), table_name='campaign_forecasts')
    op.drop_index(op.f('ix_campaign_forecasts_id'), table_name='campaign_forecasts')
    op.drop_table('campaign_forecasts')
