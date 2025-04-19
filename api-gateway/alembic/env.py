import asyncio
import os
import sys
from logging.config import fileConfig

# Add the parent directory (api-gateway) to sys.path
sys.path.insert(0, os.path.realpath(os.path.join(os.path.dirname(__file__), '..')))

from sqlalchemy import pool
from sqlalchemy.ext.asyncio import create_async_engine

from alembic import context

# Import your models directly and use their metadata
from app.models.user import User # Import your User model

# Use metadata directly from the imported User model
target_metadata = User.metadata

# Alembic Config object
config = context.config

# Interpret the config file for Python logging (commented out)
# if config.config_file_name is not None:
#    fileConfig(config.config_file_name)

def run_migrations_offline() -> None:
    """Run migrations in 'offline' mode."""
    # Get URL from config for offline mode
    offline_url = os.getenv("DATABASE_URL") # Read from env for offline too
    if not offline_url:
        # Fallback to config file if env var not set for offline?
        offline_url = config.get_main_option("sqlalchemy.url") 
    
    context.configure(
        url=offline_url, 
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )

    with context.begin_transaction():
        context.run_migrations()

def do_run_migrations(connection):
    context.configure(connection=connection, target_metadata=target_metadata)

    with context.begin_transaction():
        context.run_migrations()

async def run_migrations_online() -> None:
    """Run migrations in 'online' mode."""
    # Get URL directly from environment variable
    db_url = os.getenv("DATABASE_URL")
    if not db_url:
        raise ValueError("Environment variable DATABASE_URL is not set.")

    print(f"DEBUG [Alembic env.py]: Connecting to database with URL: {db_url}")

    # Create an async engine specifically for Alembic online mode
    connectable = create_async_engine(
        db_url, # Use the retrieved URL from environment
        poolclass=pool.NullPool,
    )

    async with connectable.connect() as connection:
        await connection.run_sync(do_run_migrations)

    await connectable.dispose()

# Determine mode and run migrations
if context.is_offline_mode():
    run_migrations_offline()
else:
    asyncio.run(run_migrations_online())
