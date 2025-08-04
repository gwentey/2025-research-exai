"""
Centralise la configuration du pipeline d'importation Kaggle.

- Chemins des fichiers et répertoires
- URLs des services (MinIO, PostgreSQL)
- Constantes et paramètres (cache, retries)
"""
import os
from pathlib import Path

# --- Chemins du projet ---
# Racine du projet (remonte de datasets/kaggle-import/importer_lib)
PROJECT_ROOT = Path(__file__).parent.parent.parent.parent.absolute()
KAGGLE_IMPORT_DIR = PROJECT_ROOT / "datasets" / "kaggle-import"
CONFIG_FILE = KAGGLE_IMPORT_DIR / "kaggle_datasets_config.yaml"
CACHE_DIR = KAGGLE_IMPORT_DIR / "cache"
LOG_FILE = KAGGLE_IMPORT_DIR / "kaggle_import.log"

# --- Configuration des services locaux (via port-forward) ---
MINIO_ENDPOINT_URL = os.getenv("MINIO_ENDPOINT", "http://localhost:6700")
DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://ibis_x_user:password@localhost:5432/ibis_x_db")

# --- Paramètres de l'application ---
CACHE_DURATION_DAYS = 7  # Durée de validité du cache en jours
MAX_KAGGLE_API_RETRIES = 3 # Nombre maximum de tentatives pour l'API Kaggle

# --- Configuration du logging ---
LOGGING_CONFIG = {
    'version': 1,
    'disable_existing_loggers': False,
    'formatters': {
        'default': {
            'format': '%(asctime)s - %(levelname)s - %(name)s - %(message)s',
        },
    },
    'handlers': {
        'console': {
            'class': 'logging.StreamHandler',
            'formatter': 'default',
            'level': 'INFO',
        },
        'file': {
            'class': 'logging.FileHandler',
            'formatter': 'default',
            'level': 'INFO',
            'filename': LOG_FILE,
            'encoding': 'utf-8',
        },
    },
    'root': {
        'handlers': ['console', 'file'],
        'level': 'INFO',
    },
}

# Assurer que le répertoire de cache existe
CACHE_DIR.mkdir(exist_ok=True)
