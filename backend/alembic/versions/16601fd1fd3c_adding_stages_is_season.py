"""Adding stages is_season

Revision ID: 16601fd1fd3c
Revises: c3f6a9e2d5b8
Create Date: 2026-07-31 22:45:00.000000

"""

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str | None = "16601fd1fd3c"
down_revision: str | None = "c3f6a9e2d5b8"
branch_labels: str | None = None
depends_on: str | None = None


def upgrade() -> None:
    op.add_column(
        "stages",
        sa.Column("is_season", sa.Boolean(), nullable=False, server_default="true"),
    )


def downgrade() -> None:
    op.drop_column("stages", "is_season")
