"""Adding extra time and penalties scores to matches

Revision ID: c3f6a9e2d5b8
Revises: b2e5f8d1c4a7
Create Date: 2026-07-26 01:00:00.000000

"""

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str | None = "c3f6a9e2d5b8"
down_revision: str | None = "b2e5f8d1c4a7"
branch_labels: str | None = None
depends_on: str | None = None


def upgrade() -> None:
    op.add_column("matches", sa.Column("stage_item_input1_score_extra_time_half", sa.Integer(), nullable=True))
    op.add_column("matches", sa.Column("stage_item_input2_score_extra_time_half", sa.Integer(), nullable=True))
    op.add_column("matches", sa.Column("stage_item_input1_score_after_extra_time", sa.Integer(), nullable=True))
    op.add_column("matches", sa.Column("stage_item_input2_score_after_extra_time", sa.Integer(), nullable=True))
    op.add_column("matches", sa.Column("stage_item_input1_score_penalties", sa.Integer(), nullable=True))
    op.add_column("matches", sa.Column("stage_item_input2_score_penalties", sa.Integer(), nullable=True))


def downgrade() -> None:
    op.drop_column("matches", "stage_item_input1_score_extra_time_half")
    op.drop_column("matches", "stage_item_input2_score_extra_time_half")
    op.drop_column("matches", "stage_item_input1_score_after_extra_time")
    op.drop_column("matches", "stage_item_input2_score_after_extra_time")
    op.drop_column("matches", "stage_item_input1_score_penalties")
    op.drop_column("matches", "stage_item_input2_score_penalties")
