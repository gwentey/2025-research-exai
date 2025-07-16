#!/usr/bin/env python3
"""
Script d'importation automatique de datasets depuis Kaggle API.

Ce script :
1. Lit la configuration des datasets Kaggle
2. Télécharge les datasets via l'API Kaggle
3. Convertit en format Parquet optimisé
4. Upload vers le stockage d'objets (MinIO/Azure)
5. Insert les métadonnées en base de données
6. Gère le cache pour éviter les re-téléchargements

Usage:
    python kaggle_importer.py                    # Import tous les datasets
    python kaggle_importer.py --dataset student_performance  # Import spécifique
    python kaggle_importer.py --force-refresh    # Force re-téléchargement
"""

import os
import sys
import json
import yaml
import argparse
import tempfile
import shutil
from pathlib import Path
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any
import asyncio
import logging
from dataclasses import dataclass

# Dépendances externes
import kaggle
import pandas as pd
import pyarrow as pa
import pyarrow.parquet as pq
from tqdm import tqdm

# Import modules EXAI
# Dans le conteneur : /app/kaggle-import/kaggle_importer.py -> ajouter /app/ au PYTHONPATH
sys.path.append(str(Path(__file__).parent.parent))
from common.storage_client import get_storage_client
from database import SessionLocal
from models import Dataset
from schemas import DatasetCreate

# Configuration logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('kaggle_import.log'),
        logging.StreamHandler(sys.stdout)
    ]
)
logger = logging.getLogger(__name__)

@dataclass
class DatasetConfig:
    """Configuration d'un dataset Kaggle."""
    name: str
    kaggle_ref: str
    domain: str
    description: str
    ml_task: str
    target_column: str
    large_dataset: bool = False
    multi_file: bool = False

class KaggleImporter:
    """Classe principale pour l'import des datasets Kaggle."""
    
    def __init__(self, config_path: str = "kaggle_datasets_config.yaml"):
        """Initialise l'importeur Kaggle."""
        self.config_path = Path(config_path)
        self.config = self._load_config()
        self.storage_client = get_storage_client()
        self.cache_dir = Path("cache")
        self.cache_dir.mkdir(exist_ok=True)
        
        # Vérifier les credentials Kaggle
        self._verify_kaggle_credentials()
    
    def _load_config(self) -> Dict[str, Any]:
        """Charge la configuration des datasets."""
        try:
            with open(self.config_path, 'r', encoding='utf-8') as f:
                return yaml.safe_load(f)
        except FileNotFoundError:
            logger.error(f"Fichier de configuration non trouvé: {self.config_path}")
            sys.exit(1)
        except yaml.YAMLError as e:
            logger.error(f"Erreur de parsing YAML: {e}")
            sys.exit(1)
    
    def _verify_kaggle_credentials(self):
        """Vérifie que les credentials Kaggle sont configurés."""
        try:
            kaggle.api.authenticate()
            logger.info("✅ Credentials Kaggle authentifiés")
        except Exception as e:
            logger.error(f"❌ Erreur d'authentification Kaggle: {e}")
            logger.error("Assurez-vous d'avoir configuré votre kaggle.json")
            sys.exit(1)
    
    def _get_cache_path(self, dataset_name: str) -> Path:
        """Retourne le chemin de cache pour un dataset."""
        return self.cache_dir / f"{dataset_name}_cache.json"
    
    def _is_cache_valid(self, dataset_name: str) -> bool:
        """Vérifie si le cache est encore valide."""
        cache_path = self._get_cache_path(dataset_name)
        if not cache_path.exists():
            return False
        
        try:
            with open(cache_path, 'r') as f:
                cache_data = json.load(f)
            
            cache_date = datetime.fromisoformat(cache_data['download_date'])
            cache_duration = timedelta(days=self.config['config']['cache_duration_days'])
            
            return datetime.now() - cache_date < cache_duration
        except (json.JSONDecodeError, KeyError, ValueError):
            return False
    
    def _update_cache(self, dataset_name: str, metadata: Dict[str, Any]):
        """Met à jour le cache pour un dataset."""
        cache_path = self._get_cache_path(dataset_name)
        
        # Convertir les types NumPy/Pandas en types Python natifs pour JSON
        import numpy as np
        def convert_numpy_types(obj):
            if isinstance(obj, (np.integer, np.int64)):
                return int(obj)
            elif isinstance(obj, (np.floating, np.float64)):
                return float(obj)
            elif isinstance(obj, np.ndarray):
                return obj.tolist()
            elif hasattr(obj, 'item'):  # Autres types NumPy scalaires
                return obj.item()
            elif isinstance(obj, dict):
                return {k: convert_numpy_types(v) for k, v in obj.items()}
            elif isinstance(obj, list):
                return [convert_numpy_types(v) for v in obj]
            return obj
        
        cache_data = {
            'download_date': datetime.now().isoformat(),
            'metadata': convert_numpy_types(metadata)
        }
        
        with open(cache_path, 'w') as f:
            json.dump(cache_data, f, indent=2)
    
    def _download_kaggle_dataset(self, kaggle_ref: str, temp_dir: Path) -> List[Path]:
        """Télécharge un dataset depuis Kaggle."""
        logger.info(f"📥 Téléchargement de {kaggle_ref}")
        
        try:
            # Télécharger avec l'API Kaggle
            kaggle.api.dataset_download_files(
                kaggle_ref,
                path=str(temp_dir),
                unzip=True
            )
            
            # Lister les fichiers téléchargés
            downloaded_files = list(temp_dir.glob("*.csv"))
            if not downloaded_files:
                # Chercher dans les sous-dossiers
                downloaded_files = list(temp_dir.glob("**/*.csv"))
            
            logger.info(f"✅ {len(downloaded_files)} fichiers téléchargés")
            return downloaded_files
            
        except Exception as e:
            logger.error(f"❌ Erreur téléchargement {kaggle_ref}: {e}")
            raise
    
    def _analyze_csv_file(self, file_path: Path) -> Dict[str, Any]:
        """Analyse un fichier CSV pour extraire des métadonnées."""
        logger.info(f"🔍 Analyse de {file_path.name}")
        
        try:
            # Lecture d'un échantillon pour l'analyse
            sample_df = pd.read_csv(file_path, nrows=1000)
            
            metadata = {
                'filename': file_path.name,
                'rows': len(pd.read_csv(file_path, usecols=[0])),  # Count rapide
                'columns': len(sample_df.columns),
                'size_mb': file_path.stat().st_size / (1024 * 1024),
                'column_types': {},
                'missing_values': {},
                'sample_data': sample_df.head().to_dict('records')
            }
            
            # Analyse des types de colonnes
            for col in sample_df.columns:
                dtype = str(sample_df[col].dtype)
                metadata['column_types'][col] = dtype
                metadata['missing_values'][col] = sample_df[col].isnull().sum()
            
            return metadata
            
        except Exception as e:
            logger.error(f"❌ Erreur analyse {file_path}: {e}")
            return {'error': str(e)}
    
    def _convert_to_parquet(self, csv_files: List[Path], output_dir: Path) -> List[Path]:
        """Convertit les fichiers CSV en Parquet optimisé."""
        parquet_files = []
        
        for csv_file in csv_files:
            logger.info(f"🔄 Conversion {csv_file.name} → Parquet")
            
            try:
                # Lecture avec optimisations
                df = pd.read_csv(csv_file)
                
                # Optimisations types automatiques
                for col in df.columns:
                    if df[col].dtype == 'object':
                        # Essayer de convertir en catégorie si peu de valeurs uniques
                        if df[col].nunique() / len(df) < 0.5:
                            df[col] = df[col].astype('category')
                
                # Sauvegarde Parquet avec compression
                parquet_path = output_dir / f"{csv_file.stem}.parquet"
                df.to_parquet(
                    parquet_path,
                    compression='snappy',
                    index=False
                )
                
                parquet_files.append(parquet_path)
                
                # Log des gains de taille
                original_size = csv_file.stat().st_size / (1024 * 1024)
                compressed_size = parquet_path.stat().st_size / (1024 * 1024)
                compression_ratio = original_size / compressed_size if compressed_size > 0 else 0
                
                logger.info(f"✅ {csv_file.name}: {original_size:.1f}MB → {compressed_size:.1f}MB (gain: {compression_ratio:.1f}x)")
                
            except Exception as e:
                logger.error(f"❌ Erreur conversion {csv_file}: {e}")
                continue
        
        return parquet_files
    
    def _upload_to_storage(self, parquet_files: List[Path], dataset_id: str) -> str:
        """Upload les fichiers Parquet vers le stockage d'objets."""
        logger.info(f"☁️ Upload vers stockage d'objets: {dataset_id}")
        
        storage_path = f"datasets/{dataset_id}"
        
        try:
            for parquet_file in parquet_files:
                object_key = f"{storage_path}/{parquet_file.name}"
                
                # Lire le fichier et le passer en bytes
                with open(parquet_file, 'rb') as f:
                    file_data = f.read()
                
                self.storage_client.upload_file(
                    file_data,
                    object_key
                )
                
                logger.info(f"✅ Uploadé: {object_key}")
            
            return storage_path
            
        except Exception as e:
            logger.error(f"❌ Erreur upload {dataset_id}: {e}")
            raise
    
    def _save_to_database(self, dataset_config: DatasetConfig, metadata: Dict[str, Any], storage_path: str):
        """Sauvegarde les métadonnées en base de données."""
        logger.info(f"💾 Sauvegarde en BDD: {dataset_config.name}")
        
        try:
            with SessionLocal() as db:
                # Créer l'objet dataset
                dataset_create = DatasetCreate(
                    dataset_name=dataset_config.description,
                    domain=[dataset_config.domain],
                    task=[dataset_config.ml_task],
                    features_number=metadata.get('total_columns', 0),
                    instances_number=metadata.get('total_rows', 0),
                    storage_uri=storage_path,
                    sources=f"https://www.kaggle.com/datasets/{dataset_config.kaggle_ref}",
                    objective=dataset_config.description
                )
                
                # Sauvegarder en BDD
                dataset = Dataset(**dataset_create.model_dump())
                db.add(dataset)
                db.commit()
                db.refresh(dataset)
                
                logger.info(f"✅ Dataset sauvegardé avec ID: {dataset.id}")
                return dataset.id
                
        except Exception as e:
            logger.error(f"❌ Erreur sauvegarde BDD {dataset_config.name}: {e}")
            raise
    
    def import_dataset(self, dataset_name: str, force_refresh: bool = False) -> bool:
        """Importe un dataset spécifique depuis Kaggle."""
        if dataset_name not in self.config['datasets']:
            logger.error(f"❌ Dataset '{dataset_name}' non trouvé dans la configuration")
            return False
        
        # Vérifier le cache
        if not force_refresh and self._is_cache_valid(dataset_name):
            logger.info(f"⚡ Cache valide pour {dataset_name}, import ignoré")
            return True
        
        dataset_config = DatasetConfig(
            name=dataset_name,
            **self.config['datasets'][dataset_name]
        )
        
        logger.info(f"🚀 Import de {dataset_name} depuis {dataset_config.kaggle_ref}")
        
        with tempfile.TemporaryDirectory() as temp_dir:
            temp_path = Path(temp_dir)
            
            try:
                # 1. Télécharger depuis Kaggle
                csv_files = self._download_kaggle_dataset(dataset_config.kaggle_ref, temp_path)
                
                # 2. Analyser les fichiers
                files_metadata = []
                total_rows = 0
                total_columns = 0
                total_size_mb = 0.0
                
                for csv_file in csv_files:
                    file_meta = self._analyze_csv_file(csv_file)
                    files_metadata.append(file_meta)
                    total_rows += file_meta.get('rows', 0)
                    total_columns = max(total_columns, file_meta.get('columns', 0))
                    total_size_mb += file_meta.get('size_mb', 0.0)
                
                # 3. Convertir en Parquet
                parquet_dir = temp_path / "parquet"
                parquet_dir.mkdir()
                parquet_files = self._convert_to_parquet(csv_files, parquet_dir)
                
                if not parquet_files:
                    logger.error(f"❌ Aucun fichier Parquet généré pour {dataset_name}")
                    return False
                
                # 4. Upload vers stockage
                storage_path = self._upload_to_storage(parquet_files, dataset_name)
                
                # 5. Préparer métadonnées complètes
                complete_metadata = {
                    'files': files_metadata,
                    'total_rows': total_rows,
                    'total_columns': total_columns,
                    'total_size_mb': total_size_mb,
                    'parquet_files': [f.name for f in parquet_files],
                    'data_types': {},  # TODO: Agréger les types
                    'kaggle_ref': dataset_config.kaggle_ref
                }
                
                # 6. Sauvegarder en BDD
                dataset_id = self._save_to_database(dataset_config, complete_metadata, storage_path)
                
                # 7. Mettre à jour le cache
                self._update_cache(dataset_name, complete_metadata)
                
                logger.info(f"🎉 Import réussi: {dataset_name} (ID: {dataset_id})")
                return True
                
            except Exception as e:
                logger.error(f"❌ Échec import {dataset_name}: {e}")
                return False
    
    def import_all_datasets(self, force_refresh: bool = False) -> Dict[str, bool]:
        """Importe tous les datasets configurés."""
        logger.info(f"🚀 Import de {len(self.config['datasets'])} datasets depuis Kaggle")
        
        results = {}
        success_count = 0
        
        for dataset_name in self.config['datasets']:
            logger.info(f"\n{'='*50}")
            logger.info(f"Dataset {len(results)+1}/{len(self.config['datasets'])}: {dataset_name}")
            logger.info(f"{'='*50}")
            
            try:
                success = self.import_dataset(dataset_name, force_refresh)
                results[dataset_name] = success
                if success:
                    success_count += 1
            except KeyboardInterrupt:
                logger.info("❌ Import interrompu par l'utilisateur")
                break
            except Exception as e:
                logger.error(f"❌ Erreur inattendue pour {dataset_name}: {e}")
                results[dataset_name] = False
        
        # Résumé final
        logger.info(f"\n{'='*50}")
        logger.info(f"📊 RÉSUMÉ FINAL")
        logger.info(f"{'='*50}")
        logger.info(f"✅ Succès: {success_count}/{len(self.config['datasets'])}")
        logger.info(f"❌ Échecs: {len(self.config['datasets']) - success_count}")
        
        for dataset_name, success in results.items():
            status = "✅" if success else "❌"
            logger.info(f"{status} {dataset_name}")
        
        return results

def main():
    """Point d'entrée principal."""
    parser = argparse.ArgumentParser(description="Import de datasets depuis Kaggle")
    parser.add_argument(
        '--dataset',
        help="Nom du dataset spécifique à importer"
    )
    parser.add_argument(
        '--force-refresh',
        action='store_true',
        help="Force le re-téléchargement même si le cache est valide"
    )
    parser.add_argument(
        '--config',
        default="kaggle_datasets_config.yaml",
        help="Chemin vers le fichier de configuration"
    )
    
    args = parser.parse_args()
    
    # Créer l'importeur
    importer = KaggleImporter(args.config)
    
    if args.dataset:
        # Import d'un dataset spécifique
        success = importer.import_dataset(args.dataset, args.force_refresh)
        sys.exit(0 if success else 1)
    else:
        # Import de tous les datasets
        results = importer.import_all_datasets(args.force_refresh)
        success_count = sum(results.values())
        sys.exit(0 if success_count == len(results) else 1)

if __name__ == "__main__":
    main() 