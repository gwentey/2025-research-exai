#!/usr/bin/env python3
"""
Point d'entrée principal pour l'importation de datasets Kaggle.

Ce script orchestre le pipeline d'importation en utilisant les modules
de 'importer_lib' pour une meilleure séparation des préoccupations.
"""
import os
import argparse
import logging
import logging.config
import sys
import yaml
import uuid
import tempfile
from pathlib import Path
from typing import Dict, Any

# --- Initialisation des chemins et imports ---
# Cette section est cruciale pour que le script puisse trouver les modules
# de l'application, qu'il soit lancé depuis la racine ou son répertoire.
try:
    # Le setup des chemins doit être la TOUTE PREMIÈRE chose à faire
    from importer_lib.utils import setup_paths
    setup_paths()

    from importer_lib.config import (
        CACHE_DIR, CACHE_DURATION_DAYS, CONFIG_FILE, LOGGING_CONFIG,
        MINIO_ENDPOINT_URL, DATABASE_URL
    )
    from importer_lib.kaggle_api import KaggleAPI
    from importer_lib.file_processor import FileProcessor
    from importer_lib.db_manager import DatabaseManager
    from importer_lib.storage import StorageManager
    from kaggle_metadata_mapper_v2 import KaggleMetadataMapperV2
except ImportError as e:
    print(f"Erreur d'importation initiale. Tentative d'ajustement des chemins... Error: {e}")
    # Ajustement dynamique si le script n'est pas lancé comme un module
    import sys
    from pathlib import Path
    # Remonter au dossier 'datasets/kaggle-import/' pour trouver 'importer_lib'
    importer_dir = Path(__file__).parent.absolute()
    if str(importer_dir) not in sys.path:
        sys.path.insert(0, str(importer_dir))
    
    project_root = importer_dir.parent.parent
    # Ajouter la racine du projet et les dossiers de services
    sys.path.insert(0, str(project_root))
    sys.path.insert(0, str(project_root / "common"))
    sys.path.insert(0, str(project_root / "service-selection" / "app"))
    
    # Ré-importer après ajustement
    from importer_lib.config import (
        CACHE_DIR, CACHE_DURATION_DAYS, CONFIG_FILE, LOGGING_CONFIG,
        MINIO_ENDPOINT_URL, DATABASE_URL
    )
    from importer_lib.kaggle_api import KaggleAPI
    from importer_lib.file_processor import FileProcessor
    from importer_lib.db_manager import DatabaseManager
    from importer_lib.storage import StorageManager

# Configuration du logging
logging.config.dictConfig(LOGGING_CONFIG)
logger = logging.getLogger(__name__)

# --- Configuration de l'environnement pour l'exécution locale ---
# C'est l'étape CRUCIALE pour s'assurer que le storage_client (et d'autres)
# utilise les adresses locales définies via kubectl port-forward, et non les
# adresses internes au cluster Kubernetes.
os.environ["MINIO_ENDPOINT"] = MINIO_ENDPOINT_URL
os.environ["DATABASE_URL"] = DATABASE_URL
logger.info(f"Environnement local configuré : MINIO_ENDPOINT={MINIO_ENDPOINT_URL}")



import importer_lib.storage
from datetime import timedelta

class MainImporter:
    """Orchestre le processus d'importation de datasets."""

    def __init__(self, config_path: Path, force_refresh: bool = False):
        self.force_refresh = force_refresh
        self.config = self._load_yaml_config(config_path)
        
        # Instanciation centralisée des managers
        self.cache_manager = CacheManager(
            CACHE_DIR,
            self.config.get('settings', {}).get('cache_duration_days', CACHE_DURATION_DAYS)
        )
        self.storage_manager = StorageManager()
        self.kaggle_api = KaggleAPI()
        self.file_processor = FileProcessor()
        self.db_manager = DatabaseManager()
        self.metadata_mapper = KaggleMetadataMapperV2()

    def _load_yaml_config(self, path: Path) -> Dict[str, Any]:
        """Charge le fichier de configuration YAML."""
        logger.info(f"Chargement de la configuration depuis : {path}")
        try:
            with open(path, 'r', encoding='utf-8') as f:
                return yaml.safe_load(f)
        except (FileNotFoundError, yaml.YAMLError) as e:
            logger.critical(f"Impossible de charger ou de parser le fichier de configuration : {e}")
            sys.exit(1)

    def run(self, specific_dataset: str = None):
        """Lance l'importation pour un ou tous les datasets."""
        datasets_to_import = self._get_datasets_to_import(specific_dataset)
        
        if not datasets_to_import:
            logger.warning("Aucun dataset à importer.")
            return

        for name, conf in datasets_to_import.items():
            self.import_single_dataset(name, conf)

    def _prompt_for_confirmation(self, name: str, files_metadata: list) -> bool:
        """Affiche un résumé et demande confirmation avant l'import."""
        print("\\n" + "="*50)
        print(f"  RÉSUMÉ DE L'IMPORT POUR '{name}'")
        print("="*50)
        
        total_rows = sum(f.get('row_count', 0) for f in files_metadata)
        total_files = len(files_metadata)
        
        print(f"  Nombre de fichiers à importer : {total_files}")
        print(f"  Nombre total de lignes       : {total_rows}")
        
        for i, meta in enumerate(files_metadata):
            print(f"\\n  Fichier {i+1}: {meta['original_filename']}")
            print(f"    - Lignes  : {meta['row_count']}")
            print(f"    - Colonnes: {meta['column_count']}")
        
        print("\\n" + "="*50)
        
        if self.force_refresh: # Ajout pour bypasser le prompt
            logger.warning("Confirmation automatique car --force-refresh est activé.")
            return True

        answer = input("Voulez-vous procéder à l'importation ? (oui/non) : ").lower()
        return answer in ['oui', 'o', 'yes', 'y']

    def import_single_dataset(self, name: str, config: Dict[str, Any]):
        """Gère l'importation complète d'un seul dataset."""
        logger.info(f"--- Début de l'importation pour : {name} ---")
        
        if not self.force_refresh and self.cache_manager.is_cache_valid(name):
            logger.info(f"Cache valide trouvé pour '{name}'. Importation ignorée. Utilisez --force-refresh pour forcer.")
            return

        with tempfile.TemporaryDirectory() as temp_dir_str:
            temp_dir = Path(temp_dir_str)
            try:
                # 1. Téléchargement depuis Kaggle
                csv_files = self.kaggle_api.download_files(config['kaggle_ref'], temp_dir)
                if not csv_files:
                    raise ValueError("Aucun fichier CSV n'a été téléchargé.")

                # 2. Analyse des fichiers
                files_metadata = [self.file_processor.analyze_csv(f) for f in csv_files]

                # 3. Demander confirmation
                if not self._prompt_for_confirmation(name, files_metadata):
                    logger.warning(f"Importation de '{name}' annulée par l'utilisateur.")
                    return

                # 4. Conversion en Parquet
                parquet_files = self.file_processor.convert_to_parquet(csv_files, temp_dir)

                # 5. Génération des UUIDs et Upload
                dataset_uuid = str(uuid.uuid4())
                file_uuid_mapping = {f.name.replace('.parquet', '.csv'): str(uuid.uuid4()) for f in parquet_files}
                
                storage_path = f"datasets/{dataset_uuid}"
                for parquet_file in parquet_files:
                    original_csv_name = parquet_file.name.replace('.parquet', '.csv')
                    file_uuid = file_uuid_mapping[original_csv_name]
                    object_key = f"{storage_path}/{file_uuid}.parquet"
                    self.storage_manager.upload_file(str(parquet_file), object_key)

                # 6. Génération des métadonnées enrichies avec KaggleMetadataMapper
                kaggle_metadata = self.kaggle_api.get_metadata(config['kaggle_ref'])
                
                # Préparer les métadonnées des fichiers pour le mapper
                aggregated_file_metadata = {
                    'total_rows': sum(f.get('row_count', 0) for f in files_metadata),
                    'total_columns': files_metadata[0].get('column_count', 0) if files_metadata else 0,
                    'has_missing_values': any(f.get('has_missing_values', False) for f in files_metadata),
                    'files_count': len(files_metadata),
                    'column_details': []
                }
                
                # Collecter tous les détails de colonnes
                for file_meta in files_metadata:
                    aggregated_file_metadata['column_details'].extend(file_meta.get('column_details', []))
                
                # Créer un objet config compatible avec KaggleMetadataMapper
                class DatasetConfig:
                    def __init__(self, config_dict, dataset_name):
                        self.domain = config_dict.get('domain', 'general')
                        self.ml_task = config_dict.get('ml_task', 'classification')
                        self.description = config_dict.get('description', '')
                        self.kaggle_ref = config_dict.get('kaggle_ref', '')
                        self.name = dataset_name
                
                dataset_config_obj = DatasetConfig(config, name)
                
                # Générer les métadonnées enrichies
                enriched_metadata = self.metadata_mapper.map_kaggle_to_dataset(
                    dataset_config_obj,
                    kaggle_metadata,
                    aggregated_file_metadata,
                    storage_path
                )
                
                logger.info(f"✅ Métadonnées enrichies générées avec {len(enriched_metadata)} champs")
                
                # 7. Sauvegarde en base de données avec métadonnées enrichies
                self.db_manager.save_dataset_metadata(
                    name,
                    config,
                    kaggle_metadata,
                    files_metadata,
                    storage_path,
                    dataset_uuid,
                    file_uuid_mapping,
                    enriched_metadata
                )

                # 8. Mise à jour du cache
                self.cache_manager.update_cache(name, {'status': 'success'})
                logger.info(f"--- Importation de '{name}' terminée avec succès (UUID: {dataset_uuid}) ---")

            except Exception as e:
                logger.error(f"Échec de l'importation pour '{name}': {e}", exc_info=True)



    def _get_datasets_to_import(self, specific_dataset: str) -> Dict[str, Any]:
        """Retourne un dictionnaire des datasets à importer."""
        if specific_dataset:
            if specific_dataset in self.config['datasets']:
                return {specific_dataset: self.config['datasets'][specific_dataset]}
            else:
                logger.error(f"Le dataset '{specific_dataset}' n'est pas dans le fichier de configuration.")
                return {}
        return self.config.get('datasets', {})



class CacheManager:
    """Gère le cache pour éviter les re-téléchargements inutiles."""
    def __init__(self, cache_dir: Path, duration_days: int):
        self.cache_dir = cache_dir
        self.duration = timedelta(days=duration_days)
        self.cache_dir.mkdir(exist_ok=True)

    def _get_cache_path(self, name: str) -> Path:
        return self.cache_dir / f"{name}_cache.json"
        
    def is_cache_valid(self, name: str) -> bool:
        """Vérifie si le cache existe et n'a pas expiré."""
        cache_file = self._get_cache_path(name)
        if not cache_file.exists():
            return False
        
        try:
            with open(cache_file, 'r') as f:
                import json
                from datetime import datetime
                
                cache_data = json.load(f)
                cache_time = datetime.fromisoformat(cache_data['timestamp'])
                
                if datetime.now() - cache_time < self.duration:
                    return True
                else:
                    logger.info(f"Cache expiré pour '{name}'.")
                    return False
        except (KeyError, json.JSONDecodeError):
            logger.warning(f"Fichier de cache corrompu pour '{name}'.")
            return False

    def update_cache(self, name: str, data: Dict):
        """Met à jour le fichier de cache avec un timestamp."""
        from datetime import datetime
        import json

        cache_file = self._get_cache_path(name)
        cache_data = {
            'timestamp': datetime.now().isoformat(),
            'data': data
        }
        with open(cache_file, 'w') as f:
            json.dump(cache_data, f, indent=2)


def entry_point():
    """Point d'entrée pour la ligne de commande."""
    parser = argparse.ArgumentParser(description="Importateur de datasets Kaggle pour IBIS-X.")
    parser.add_argument(
        "--dataset",
        type=str,
        help="Importer un dataset spécifique par son nom (défini dans le YAML)."
    )
    parser.add_argument(
        "--force-refresh",
        action="store_true",
        help="Forcer le re-téléchargement même si un cache valide existe."
    )
    parser.add_argument(
        "--config",
        type=Path,
        default=CONFIG_FILE,
        help=f"Chemin vers le fichier de configuration YAML (défaut: {CONFIG_FILE})."
    )
    args = parser.parse_args()

    importer = MainImporter(args.config, args.force_refresh)
    importer.run(args.dataset)

if __name__ == "__main__":
    entry_point()
