"""phase2_rich_influencer_profiles

Revision ID: 7a8e2b9c1d3f
Revises: 4b2e1a8f9c3d
Create Date: 2026-10-24 16:40:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '7a8e2b9c1d3f'
down_revision: Union[str, Sequence[str], None] = '4b2e1a8f9c3d'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    with op.batch_alter_table('creator_profiles', schema=None) as batch_op:
        batch_op.add_column(sa.Column('profile_url', sa.String(length=500), nullable=True))
        batch_op.add_column(sa.Column('audience_description', sa.Text(), nullable=True))
        batch_op.add_column(sa.Column('avg_likes', sa.Integer(), nullable=True))
        batch_op.add_column(sa.Column('avg_comments', sa.Integer(), nullable=True))
        batch_op.add_column(sa.Column('avg_views', sa.Integer(), nullable=True))
        batch_op.add_column(sa.Column('brand_suitability', sa.JSON(), nullable=True))
        batch_op.add_column(sa.Column('content_categories', sa.JSON(), nullable=True))
        batch_op.add_column(sa.Column('past_campaigns_count', sa.Integer(), nullable=False, server_default='0'))
        batch_op.add_column(sa.Column('on_time_delivery_rate', sa.Float(), nullable=True))
        batch_op.add_column(sa.Column('delivery_history', sa.JSON(), nullable=True))


def downgrade() -> None:
    with op.batch_alter_table('creator_profiles', schema=None) as batch_op:
        batch_op.drop_column('delivery_history')
        batch_op.drop_column('on_time_delivery_rate')
        batch_op.drop_column('past_campaigns_count')
        batch_op.drop_column('content_categories')
        batch_op.drop_column('brand_suitability')
        batch_op.drop_column('avg_views')
        batch_op.drop_column('avg_comments')
        batch_op.drop_column('avg_likes')
        batch_op.drop_column('audience_description')
        batch_op.drop_column('profile_url')
