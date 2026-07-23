"""Adding stage_items double_round_robin

Revision ID: a1d4e7c9f2b3
Revises: 7c2e4f9a1d8b
Create Date: 2026-07-23 21:00:00.000000

"""

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str | None = "a1d4e7c9f2b3"
down_revision: str | None = "7c2e4f9a1d8b"
branch_labels: str | None = None
depends_on: str | None = None


def upgrade() -> None:
    op.add_column(
        "stage_items",
        sa.Column("double_round_robin", sa.Boolean(), nullable=False, server_default="false"),
    )


def downgrade() -> None:
    op.drop_column("stage_items", "double_round_robin")
