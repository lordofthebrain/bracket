"""Adding stage_items two_legged, two_legged_final, away_goals_rule

Revision ID: e7a1c8f3b6d2
Revises: 16601fd1fd3c
Create Date: 2026-08-01 13:00:00.000000

"""

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str | None = "e7a1c8f3b6d2"
down_revision: str | None = "16601fd1fd3c"
branch_labels: str | None = None
depends_on: str | None = None


def upgrade() -> None:
    op.add_column(
        "stage_items",
        sa.Column("two_legged", sa.Boolean(), nullable=False, server_default="false"),
    )
    op.add_column(
        "stage_items",
        sa.Column("two_legged_final", sa.Boolean(), nullable=False, server_default="false"),
    )
    op.add_column(
        "stage_items",
        sa.Column("away_goals_rule", sa.Boolean(), nullable=False, server_default="false"),
    )


def downgrade() -> None:
    op.drop_column("stage_items", "away_goals_rule")
    op.drop_column("stage_items", "two_legged_final")
    op.drop_column("stage_items", "two_legged")
