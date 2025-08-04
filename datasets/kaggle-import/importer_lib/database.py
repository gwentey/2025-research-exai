"""
Gère la connexion à la base de données et la session SQLAlchemy.
"""
import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
import logging

from contextlib import contextmanager

from . import config

logger = logging.getLogger(__name__)

# --- Connexion Synchrone ---
# Utiliser une connexion synchrone est crucial car le script d'import est un
# processus batch qui n'a pas besoin de la boucle d'événements asyncio de FastAPI.
# Tenter de mélanger async et sync peut causer des erreurs complexes comme 'greenlet_spawn'.
try:
    # Construire une URL de base de données synchrone
    sync_db_url = config.DATABASE_URL.replace("postgresql+asyncpg", "postgresql")
    
    engine = create_engine(sync_db_url, pool_pre_ping=True)
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    logger.info(f"Connexion synchrone à la base de données établie : {sync_db_url}")

except Exception as e:
    logger.error(f"Erreur lors de la configuration de la base de données : {e}")
    raise

@contextmanager
def get_db_session():
    """Fournit une session de base de données et la ferme proprement."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
