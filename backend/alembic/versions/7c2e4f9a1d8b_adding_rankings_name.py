"""Adding rankings name

Revision ID: 7c2e4f9a1d8b
Revises: f3a5c9d21b6e
Create Date: 2026-07-23 20:30:00.000000

"""

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str | None = "7c2e4f9a1d8b"
down_revision: str | None = "f3a5c9d21b6e"
branch_labels: str | None = None
depends_on: str | None = None


def upgrade() -> None:
    op.add_column(
        "rankings",
        sa.Column("name", sa.String(), nullable=False, server_default=""),
    )


def downgrade() -> None:
    op.drop_column("rankings", "name")
