"""Adding stage_items round_name_pattern

Revision ID: b2e5f8d1c4a7
Revises: a1d4e7c9f2b3
Create Date: 2026-07-25 10:00:00.000000

"""

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str | None = "b2e5f8d1c4a7"
down_revision: str | None = "a1d4e7c9f2b3"
branch_labels: str | None = None
depends_on: str | None = None


def upgrade() -> None:
    op.add_column(
        "stage_items",
        sa.Column(
            "round_name_pattern", sa.String(), nullable=False, server_default="Round {02d}"
        ),
    )


def downgrade() -> None:
    op.drop_column("stage_items", "round_name_pattern")
