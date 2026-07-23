"""Adding matches half time scores

Revision ID: 9041e0a57aa4
Revises: c1ab44651e79
Create Date: 2026-07-22 00:00:00.000000

"""

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str | None = "9041e0a57aa4"
down_revision: str | None = "c1ab44651e79"
branch_labels: str | None = None
depends_on: str | None = None


def upgrade() -> None:
    op.add_column(
        "matches", sa.Column("stage_item_input1_score_half_time", sa.Integer(), nullable=True)
    )
    op.add_column(
        "matches", sa.Column("stage_item_input2_score_half_time", sa.Integer(), nullable=True)
    )


def downgrade() -> None:
    op.drop_column("matches", "stage_item_input2_score_half_time")
    op.drop_column("matches", "stage_item_input1_score_half_time")
