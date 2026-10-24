"""phase16_two_sided_workflow

Revision ID: 4b2e1a8f9c3d
Revises: 199a36f38b39
Create Date: 2026-10-22 23:45:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '4b2e1a8f9c3d'
down_revision: Union[str, Sequence[str], None] = '199a36f38b39'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Update shortlists table
    with op.batch_alter_table('shortlists', schema=None) as batch_op:
        batch_op.add_column(sa.Column('campaign_id', sa.Integer(), nullable=True))
        batch_op.add_column(sa.Column('status', sa.String(length=50), nullable=False, server_default='considering'))
        batch_op.add_column(sa.Column('updated_at', sa.DateTime(), nullable=False, server_default=sa.func.now()))
        batch_op.create_foreign_key('fk_shortlists_campaign_id', 'campaigns', ['campaign_id'], ['id'], ondelete='CASCADE')
        batch_op.create_index(batch_op.f('ix_shortlists_campaign_id'), ['campaign_id'], unique=False)
        batch_op.create_index(batch_op.f('ix_shortlists_status'), ['status'], unique=False)

    # 2. Update invitations table
    with op.batch_alter_table('invitations', schema=None) as batch_op:
        batch_op.add_column(sa.Column('compensation_offered', sa.Float(), nullable=True))
        batch_op.add_column(sa.Column('deliverables_requested', sa.JSON(), nullable=True))
        batch_op.add_column(sa.Column('expires_at', sa.DateTime(), nullable=True))
        batch_op.add_column(sa.Column('responded_at', sa.DateTime(), nullable=True))
        batch_op.add_column(sa.Column('decline_reason', sa.Text(), nullable=True))
        batch_op.add_column(sa.Column('updated_at', sa.DateTime(), nullable=False, server_default=sa.func.now()))

    # 3. Update notifications table
    with op.batch_alter_table('notifications', schema=None) as batch_op:
        batch_op.add_column(sa.Column('data', sa.JSON(), nullable=True))
        batch_op.add_column(sa.Column('read_at', sa.DateTime(), nullable=True))

    # 4. Create creator_opportunity_interactions table
    op.create_table(
        'creator_opportunity_interactions',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('creator_id', sa.Integer(), nullable=False),
        sa.Column('campaign_id', sa.Integer(), nullable=False),
        sa.Column('status', sa.String(length=50), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.ForeignKeyConstraint(['campaign_id'], ['campaigns.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['creator_id'], ['creator_profiles.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('creator_id', 'campaign_id', name='uq_creator_campaign_interaction'),
    )
    with op.batch_alter_table('creator_opportunity_interactions', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_creator_opportunity_interactions_id'), ['id'], unique=False)
        batch_op.create_index(batch_op.f('ix_creator_opportunity_interactions_creator_id'), ['creator_id'], unique=False)
        batch_op.create_index(batch_op.f('ix_creator_opportunity_interactions_campaign_id'), ['campaign_id'], unique=False)
        batch_op.create_index(batch_op.f('ix_creator_opportunity_interactions_status'), ['status'], unique=False)


def downgrade() -> None:
    op.drop_table('creator_opportunity_interactions')

    with op.batch_alter_table('notifications', schema=None) as batch_op:
        batch_op.drop_column('read_at')
        batch_op.drop_column('data')

    with op.batch_alter_table('invitations', schema=None) as batch_op:
        batch_op.drop_column('updated_at')
        batch_op.drop_column('decline_reason')
        batch_op.drop_column('responded_at')
        batch_op.drop_column('expires_at')
        batch_op.drop_column('deliverables_requested')
        batch_op.drop_column('compensation_offered')

    with op.batch_alter_table('shortlists', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_shortlists_status'))
        batch_op.drop_index(batch_op.f('ix_shortlists_campaign_id'))
        batch_op.drop_constraint('fk_shortlists_campaign_id', type_='foreignkey')
        batch_op.drop_column('updated_at')
        batch_op.drop_column('status')
        batch_op.drop_column('campaign_id')
