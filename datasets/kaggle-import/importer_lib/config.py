"""
Centralise la configuration du pipeline d'importation Kaggle.

- Chemins des fichiers et répertoires
- URLs des services (MinIO, PostgreSQL)
- Constantes et paramètres (cache, retries)
"""
import os
from pathlib import Path

# --- Chemins du projet ---
# 🛡️ DÉTECTION AUTOMATIQUE DE L'ENVIRONNEMENT (Local vs Container)
def detect_environment_and_paths():
    """
    Détecte automatiquement l'environnement et retourne les chemins appropriés.
    - Local: Structure normale du projet
    - Container: Chemins ajustés pour /app/kaggle-import/
    """
    current_file = Path(__file__).absolute()
    
    # Détection container : si on est dans /app/kaggle-import/
    if "/app/kaggle-import" in str(current_file):
        # ENVIRONNEMENT CONTAINER
        kaggle_import_dir = Path("/app/kaggle-import")
        project_root = Path("/app")
        print(f"🐳 DÉTECTÉ: Environnement Container - Base: {kaggle_import_dir}")
    else:
        # ENVIRONNEMENT LOCAL (structure normale)
        project_root = current_file.parent.parent.parent.parent.absolute()
        kaggle_import_dir = project_root / "datasets" / "kaggle-import"
        print(f"💻 DÉTECTÉ: Environnement Local - Base: {kaggle_import_dir}")
    
    return project_root, kaggle_import_dir

# Initialisation automatique des chemins
PROJECT_ROOT, KAGGLE_IMPORT_DIR = detect_environment_and_paths()
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
