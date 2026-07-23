"""Adding matches.is_played

Revision ID: 24b2ef53d4d3
Revises: 9041e0a57aa4
Create Date: 2026-07-23 00:00:00.000000

"""

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str | None = "24b2ef53d4d3"
down_revision: str | None = "9041e0a57aa4"
branch_labels: str | None = None
depends_on: str | None = None


def upgrade() -> None:
    op.add_column(
        "matches",
        sa.Column("is_played", sa.Boolean(), nullable=False, server_default=sa.false()),
    )
    op.execute(
        """
        UPDATE matches
        SET is_played = true
        WHERE stage_item_input1_score != 0 OR stage_item_input2_score != 0
        """
    )


def downgrade() -> None:
    op.drop_column("matches", "is_played")
