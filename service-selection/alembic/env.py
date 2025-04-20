import asyncio
import os
import sys
from logging.config import fileConfig

# Add the parent directory (service-selection) to sys.path
sys.path.insert(0, os.path.realpath(os.path.join(os.path.dirname(__file__), '..')))

from sqlalchemy import pool
from sqlalchemy.ext.asyncio import create_async_engine

from alembic import context

# Import your models directly and use their metadata
try:
    # Essayer d'abord l'import direct (quand exécuté depuis le répertoire du service)
    try:
        from app.models import Base, Dataset
        target_metadata = Base.metadata  # Utiliser Base.metadata au lieu de Dataset.metadata
    except ImportError:
        # Si l'import direct échoue, essayer depuis le répertoire courant
        from models import Base, Dataset
        target_metadata = Base.metadata  # Utiliser Base.metadata au lieu de Dataset.metadata
except ImportError as e:
    print(f"Erreur d'importation: {e}")
    print("Could not import Dataset model from app.models or directly from models. Check path and model name.")
    target_metadata = None # Set to None if model cannot be imported

# Alembic Config object
config = context.config

# Interpret the config file for Python logging (commented out)
# if config.config_file_name is not None:
#    fileConfig(config.config_file_name)

def run_migrations_offline() -> None:
    """Run migrations in 'offline' mode."""
    # Get URL from environment for offline mode consistency
    offline_url = os.getenv("DATABASE_URL")
    if not offline_url:
        # Fallback to config file if env var not set for offline
        offline_url = config.get_main_option("sqlalchemy.url")
    
    if target_metadata is None:
        print("ERROR: Target metadata could not be determined. Cannot run offline migrations.")
        return

    context.configure(
        url=offline_url, 
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        version_table=config.get_main_option("version_table", "alembic_version"),
    )

    with context.begin_transaction():
        context.run_migrations()

def do_run_migrations(connection):
    if target_metadata is None:
        # This should ideally not happen in online mode as import error would likely occur earlier
        print("ERROR: Target metadata could not be determined. Cannot run migrations.")
        return
    context.configure(
        connection=connection,
        target_metadata=target_metadata,
        version_table=config.get_main_option("version_table", "alembic_version"),
    )

    with context.begin_transaction():
        context.run_migrations()

async def run_migrations_online() -> None:
    """Run migrations in 'online' mode."""
    if target_metadata is None:
        print("ERROR: Target metadata could not be determined. Cannot run online migrations.")
        return
        
    # Get URL directly from environment variable
    db_url = os.getenv("DATABASE_URL")
    if not db_url:
        raise ValueError("Environment variable DATABASE_URL is not set.")

    print(f"DEBUG [Alembic env.py - service-selection]: Connecting to database with URL: {db_url}")

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
