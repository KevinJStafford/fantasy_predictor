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
    import random
    import string
    connection = op.get_bind()
    
    # Skip if invite_code already exists (e.g. schema was applied out of order)
    if connection.dialect.name == 'sqlite':
        r = connection.execute(sa.text("PRAGMA table_info(leagues)"))
        cols = [row[1] for row in r.fetchall()]
        has_invite_code = 'invite_code' in cols
    else:
        r = connection.execute(sa.text(
            "SELECT column_name FROM information_schema.columns WHERE table_name = 'leagues' AND column_name = 'invite_code'"
        ))
        has_invite_code = r.fetchone() is not None
    
    if not has_invite_code:
        op.add_column('leagues', sa.Column('invite_code', sa.String(), nullable=True))
    
    # Generate invite codes for existing leagues (if any)
    result = connection.execute(sa.text("SELECT id FROM leagues WHERE invite_code IS NULL"))
    existing_codes = set()
    existing_result = connection.execute(sa.text("SELECT invite_code FROM leagues WHERE invite_code IS NOT NULL"))
    for row in existing_result:
        if row[0]:
            existing_codes.add(row[0])
    
    for row in result:
        league_id = row[0]
        while True:
            code = ''.join(random.choices(string.ascii_uppercase + string.digits, k=6))
            if code not in existing_codes:
                existing_codes.add(code)
                break
        connection.execute(
            sa.text("UPDATE leagues SET invite_code = :code WHERE id = :id"),
            {"code": code, "id": league_id}
        )
    
    if not has_invite_code:
        op.alter_column('leagues', 'invite_code', nullable=False)
    try:
        op.create_unique_constraint('uq_leagues_invite_code', 'leagues', ['invite_code'])
    except Exception:
        pass  # constraint may already exist


def downgrade():
    op.drop_constraint('uq_leagues_invite_code', 'leagues', type_='unique')
    op.drop_column('leagues', 'invite_code')
