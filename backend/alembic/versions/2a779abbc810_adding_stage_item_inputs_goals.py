"""Adding stage_item_inputs goals_for/goals_against

Revision ID: 2a779abbc810
Revises: 24b2ef53d4d3
Create Date: 2026-07-23 00:30:00.000000

"""

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str | None = "2a779abbc810"
down_revision: str | None = "24b2ef53d4d3"
branch_labels: str | None = None
depends_on: str | None = None


def upgrade() -> None:
    op.add_column(
        "stage_item_inputs",
        sa.Column("goals_for", sa.Integer(), nullable=False, server_default="0"),
    )
    op.add_column(
        "stage_item_inputs",
        sa.Column("goals_against", sa.Integer(), nullable=False, server_default="0"),
    )


def downgrade() -> None:
    op.drop_column("stage_item_inputs", "goals_against")
    op.drop_column("stage_item_inputs", "goals_for")
