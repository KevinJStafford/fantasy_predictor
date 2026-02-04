"""expand _password_hash to 255 chars so bcrypt hashes are not truncated

Revision ID: g3e4f5a6b7c8
Revises: d4e5f6a7b8c9
Create Date: 2025-01-15 12:00:00.000000

Bcrypt hashes are 60 characters. If the column was too short (e.g. default 50),
the hash was truncated and login would fail after the first time.
"""
from alembic import op
import sqlalchemy as sa


revision = 'g3e4f5a6b7c8'
down_revision = 'd4e5f6a7b8c9'
branch_labels = None
depends_on = None


def upgrade():
    # Ensure _password_hash can store full bcrypt hash (60 chars); use 255 to be safe
    with op.batch_alter_table('users', schema=None) as batch_op:
        batch_op.alter_column(
            '_password_hash',
            existing_type=sa.String(),
            type_=sa.String(255),
            existing_nullable=True,
        )


def downgrade():
    with op.batch_alter_table('users', schema=None) as batch_op:
        batch_op.alter_column(
            '_password_hash',
            existing_type=sa.String(255),
            type_=sa.String(),
            existing_nullable=True,
        )
