"""Adding matches is_return_leg, return_leg_match_id

Revision ID: f4b9d2a7c1e5
Revises: e7a1c8f3b6d2
Create Date: 2026-08-01 13:05:00.000000

"""

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str | None = "f4b9d2a7c1e5"
down_revision: str | None = "e7a1c8f3b6d2"
branch_labels: str | None = None
depends_on: str | None = None


def upgrade() -> None:
    op.add_column(
        "matches",
        sa.Column("is_return_leg", sa.Boolean(), nullable=False, server_default="false"),
    )
    op.add_column(
        "matches", sa.Column("return_leg_match_id", sa.BigInteger(), nullable=True)
    )


def downgrade() -> None:
    op.drop_column("matches", "return_leg_match_id")
    op.drop_column("matches", "is_return_leg")
