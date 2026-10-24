"""phase10_profiles_fields

Revision ID: 383692fab161
Revises: e5f6a5def397
Create Date: 2026-10-22 14:53:48.898048

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '383692fab161'
down_revision: Union[str, Sequence[str], None] = 'e5f6a5def397'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Update brand_profiles with logo_url and location
    with op.batch_alter_table('brand_profiles', schema=None) as batch_op:
        batch_op.add_column(sa.Column('logo_url', sa.String(length=500), nullable=True))
        batch_op.add_column(sa.Column('location', sa.String(length=100), nullable=True))

    # 2. Update creator_profiles with Phase 10 fields
    with op.batch_alter_table('creator_profiles', schema=None) as batch_op:
        batch_op.add_column(sa.Column('profile_image_url', sa.String(length=500), nullable=True))
        batch_op.add_column(sa.Column('content_niches', sa.JSON(), nullable=True))
        batch_op.add_column(sa.Column('supported_platforms', sa.JSON(), nullable=True))
        batch_op.add_column(sa.Column('language', sa.String(length=50), nullable=True, server_default='English'))
        batch_op.add_column(sa.Column('collaboration_preferences', sa.JSON(), nullable=True))
        batch_op.add_column(sa.Column('following_count', sa.Integer(), nullable=True))
        batch_op.add_column(sa.Column('posts_count', sa.Integer(), nullable=True))
        batch_op.add_column(sa.Column('data_source', sa.String(length=100), nullable=True, server_default='user_manual'))
        batch_op.add_column(sa.Column('last_fetched_at', sa.DateTime(), nullable=True))
        batch_op.add_column(sa.Column('freshness_status', sa.String(length=50), nullable=True, server_default='manual'))
        batch_op.add_column(sa.Column('is_platform_verified', sa.Boolean(), nullable=True, server_default='0'))
        batch_op.add_column(sa.Column('connected_platforms', sa.JSON(), nullable=True))


def downgrade() -> None:
    with op.batch_alter_table('creator_profiles', schema=None) as batch_op:
        batch_op.drop_column('connected_platforms')
        batch_op.drop_column('is_platform_verified')
        batch_op.drop_column('freshness_status')
        batch_op.drop_column('last_fetched_at')
        batch_op.drop_column('data_source')
        batch_op.drop_column('posts_count')
        batch_op.drop_column('following_count')
        batch_op.drop_column('collaboration_preferences')
        batch_op.drop_column('language')
        batch_op.drop_column('supported_platforms')
        batch_op.drop_column('content_niches')
        batch_op.drop_column('profile_image_url')

    with op.batch_alter_table('brand_profiles', schema=None) as batch_op:
        batch_op.drop_column('location')
        batch_op.drop_column('logo_url')
