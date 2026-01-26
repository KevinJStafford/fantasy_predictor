"""add invite_code to leagues

Revision ID: f2a3b4c5d6e7
Revises: e1f2a3b4c5d6
Create Date: 2025-01-09 18:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'f2a3b4c5d6e7'
down_revision = 'e1f2a3b4c5d6'
branch_labels = None
depends_on = None


def upgrade():
    # Add invite_code column to leagues table (nullable first)
    op.add_column('leagues', sa.Column('invite_code', sa.String(), nullable=True))
    
    # Generate invite codes for existing leagues (if any)
    import random
    import string
    connection = op.get_bind()
    
    # Get all leagues without codes
    result = connection.execute(sa.text("SELECT id FROM leagues WHERE invite_code IS NULL"))
    existing_codes = set()
    
    # First, get all existing codes (should be none, but just in case)
    existing_result = connection.execute(sa.text("SELECT invite_code FROM leagues WHERE invite_code IS NOT NULL"))
    for row in existing_result:
        if row[0]:
            existing_codes.add(row[0])
    
    # Generate unique codes for leagues without codes
    for row in result:
        league_id = row[0]
        # Generate a 6-character code
        while True:
            code = ''.join(random.choices(string.ascii_uppercase + string.digits, k=6))
            if code not in existing_codes:
                existing_codes.add(code)
                break
        
        connection.execute(
            sa.text("UPDATE leagues SET invite_code = :code WHERE id = :id"),
            {"code": code, "id": league_id}
        )
    
    # Now make it NOT NULL and unique
    op.alter_column('leagues', 'invite_code', nullable=False)
    op.create_unique_constraint('uq_leagues_invite_code', 'leagues', ['invite_code'])


def downgrade():
    op.drop_constraint('uq_leagues_invite_code', 'leagues', type_='unique')
    op.drop_column('leagues', 'invite_code')
