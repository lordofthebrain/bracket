"""Adding teams.country

Revision ID: 539758e5f1fc
Revises: f4b9d2a7c1e5
Create Date: 2026-08-03 00:00:00.000000

"""

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str | None = "539758e5f1fc"
down_revision: str | None = "f4b9d2a7c1e5"
branch_labels: str | None = None
depends_on: str | None = None


def upgrade() -> None:
    op.add_column("teams", sa.Column("country", sa.String(), nullable=True))


def downgrade() -> None:
    op.drop_column("teams", "country")
