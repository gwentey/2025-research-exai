import asyncio
import os
import sys
from logging.config import fileConfig

# Add the parent directory (api-gateway) to sys.path
sys.path.insert(0, os.path.realpath(os.path.join(os.path.dirname(__file__), '..')))

from sqlalchemy import pool
from sqlalchemy.ext.asyncio import create_async_engine

from alembic import context

# Essayer d'importer les modèles depuis différents chemins possibles
# (flexibilité pour environnement local vs Kubernetes)
try:
    # Chemin pour Kubernetes où le code est dans /app
    sys.path.insert(0, "/app")
    
    try:
        from app.models.user import User, Base
        from app.core.config import settings
        print("Importation réussie depuis /app/app/models")
    except ImportError:
        # Essayer une autre structure
        from models.user import User, Base
        from core.config import settings
        print("Importation réussie depuis /app/models")
        
    target_metadata = Base.metadata
    
except ImportError as e:
    print(f"Import depuis /app a échoué: {e}")
    
    try:
        # Chemin pour environnement local
        from app.models.user import User, Base
        from app.core.config import settings
        print("Importation réussie depuis le chemin local app/models")
        target_metadata = Base.metadata
    except ImportError as e:
        print(f"Erreur d'importation locale: {e}")
        # Dernière tentative avec un autre chemin
        try:
            from api_gateway.models.user import User, Base
            from api_gateway.core.config import settings
            print("Importation réussie depuis api_gateway.models")
            target_metadata = Base.metadata
        except ImportError as e:
            print(f"Toutes les tentatives d'importation ont échoué: {e}")
            print("ERREUR: Impossible d'importer les modèles. Vérifiez la structure des répertoires.")
            target_metadata = None

# Alembic Config object
config = context.config

# Interpret the config file for Python logging
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

def run_migrations_offline() -> None:
    """Run migrations in 'offline' mode."""
    # Get URL from config for offline mode
    offline_url = os.getenv("DATABASE_URL")
    if not offline_url and 'settings' in locals():
        offline_url = settings.DATABASE_URL
    
    if not offline_url:
        # Fallback to config file if env var not set
        offline_url = config.get_main_option("sqlalchemy.url")
    
    if target_metadata is None:
        print("ERREUR: Les métadonnées n'ont pas pu être déterminées. Impossible d'exécuter les migrations.")
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
        print("ERREUR: Les métadonnées n'ont pas pu être déterminées. Impossible d'exécuter les migrations.")
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
        print("ERREUR: Les métadonnées n'ont pas pu être déterminées. Impossible d'exécuter les migrations en ligne.")
        return
    
    # Get URL from env or settings
    db_url = os.getenv("DATABASE_URL")
    if not db_url and 'settings' in locals():
        db_url = settings.DATABASE_URL
    
    if not db_url:
        raise ValueError("DATABASE_URL n'est pas défini dans l'environnement ou les paramètres.")

    print(f"DEBUG [Alembic env.py - api-gateway]: Connecting to database with URL: {db_url}")

    # Create an async engine specifically for Alembic online mode
    connectable = create_async_engine(
        db_url,
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
