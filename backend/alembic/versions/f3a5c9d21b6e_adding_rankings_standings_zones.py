"""Adding rankings standings_zones

Revision ID: f3a5c9d21b6e
Revises: 2a779abbc810
Create Date: 2026-07-23 20:00:00.000000

"""

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

# revision identifiers, used by Alembic.
revision: str | None = "f3a5c9d21b6e"
down_revision: str | None = "2a779abbc810"
branch_labels: str | None = None
depends_on: str | None = None


def upgrade() -> None:
    op.add_column(
        "rankings",
        sa.Column(
            "standings_zones",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False,
            server_default="[]",
        ),
    )


def downgrade() -> None:
    op.drop_column("rankings", "standings_zones")
