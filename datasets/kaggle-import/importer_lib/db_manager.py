"""
Gère les opérations de base de données pour l'importation.

- Création des enregistrements de dataset
- Création des enregistrements de fichiers et de colonnes
- Mapping des métadonnées vers les modèles SQLAlchemy
"""
import logging
from typing import Dict, Any, List
from pathlib import Path
import uuid
import json
import numpy as np

from sqlalchemy.orm import Session
from .database import get_db_session
from models import Dataset, DatasetFile, FileColumn

logger = logging.getLogger(__name__)

class DatabaseManager:
    """Gère la persistance des métadonnées du dataset en base."""

    def _convert_numpy_types(self, obj: Any) -> Any:
        """Convertit récursivement les types numpy en types Python pour sérialisation JSON."""
        if isinstance(obj, np.integer):
            return int(obj)
        elif isinstance(obj, np.floating):
            return float(obj)
        elif isinstance(obj, np.ndarray):
            return obj.tolist()
        elif isinstance(obj, dict):
            return {key: self._convert_numpy_types(value) for key, value in obj.items()}
        elif isinstance(obj, list):
            return [self._convert_numpy_types(item) for item in obj]
        elif isinstance(obj, np.bool_):
            return bool(obj)
        else:
            return obj

    def save_dataset_metadata(
        self,
        dataset_name: str,
        dataset_config: Dict[str, Any],
        kaggle_metadata: Dict[str, Any],
        files_metadata: List[Dict[str, Any]],
        storage_path: str,
        dataset_uuid: str,
        file_uuid_mapping: Dict[str, str]
    ) -> None:
        """
        Sauvegarde l'ensemble des métadonnées pour un dataset et ses fichiers.
        """
        logger.info(f"=== DÉBUT SAUVEGARDE DATASET '{dataset_name}' (UUID: {dataset_uuid}) ===")
        logger.info(f"Config reçue: {dataset_config}")
        logger.info(f"Metadata Kaggle: {kaggle_metadata}")
        logger.info(f"Files metadata: {files_metadata}")
        
        with get_db_session() as db:
            try:
                # 1. Créer l'enregistrement du Dataset
                logger.info("=== Étape 1: Création de l'enregistrement Dataset ===")
                dataset_record = self._create_dataset_record(
                    db,
                    dataset_name,
                    dataset_config,
                    kaggle_metadata,
                    storage_path,
                    dataset_uuid,
                    files_metadata
                )
                logger.info(f"Dataset record créé avec ID: {dataset_record.id}")
                
                # 2. Créer les enregistrements pour chaque fichier et ses colonnes
                logger.info("=== Étape 2: Création des enregistrements de fichiers ===")
                for file_meta in files_metadata:
                    logger.info(f"Création enregistrement pour fichier: {file_meta}")
                    self._create_file_and_columns_records(
                        db,
                        dataset_record.id,
                        file_meta,
                        file_uuid_mapping
                    )

                logger.info("=== Étape 3: Commit de la transaction ===")
                db.commit()
                logger.info(f"✅ SUCCESS: Dataset '{dataset_name}' sauvegardé avec succès en base de données.")

            except Exception as e:
                logger.error(f"❌ ERREUR lors de la sauvegarde en base de données pour le dataset '{dataset_name}': {e}")
                logger.error(f"Type d'erreur: {type(e).__name__}")
                logger.error(f"Détails de l'erreur: {str(e)}")
                import traceback
                logger.error(f"Traceback complet: {traceback.format_exc()}")
                db.rollback()
                raise

    def _create_dataset_record(
        self,
        db: Session,
        dataset_name: str,
        dataset_config: Dict[str, Any],
        kaggle_metadata: Dict[str, Any],
        storage_path: str,
        dataset_uuid: str,
        files_metadata: List[Dict[str, Any]]
    ) -> Dataset:
        """Crée l'enregistrement principal pour le Dataset."""
        
        total_rows = sum(f.get('row_count', 0) for f in files_metadata)
        # Supposons que le nombre de features est le nombre de colonnes du premier fichier
        total_features = files_metadata[0].get('column_count', 0) if files_metadata else 0

        dataset_data = {
            'id': dataset_uuid,
            'dataset_name': dataset_name,
            'objective': kaggle_metadata.get('description', dataset_config.get('description', '')),
            'storage_uri': f"https://www.kaggle.com/datasets/{dataset_config.get('kaggle_ref', '')}",
            'domain': dataset_config.get('domain', []),
            'task': dataset_config.get('ml_task', []),  # 'task' est le bon nom de champ
            'storage_path': storage_path,
            'instances_number': total_rows,
            'features_number': total_features,
            **self._extract_ethical_guidelines(dataset_config)
        }
        
        logger.info(f"=== DONNÉES POUR CRÉATION DATASET ===")
        logger.info(f"dataset_data complet: {dataset_data}")
        
        try:
            dataset = Dataset(**dataset_data)
            logger.info(f"Objet Dataset SQLAlchemy créé avec succès")
            db.add(dataset)
            logger.info(f"Dataset ajouté à la session SQLAlchemy")
            db.flush() # Pour s'assurer que l'ID est disponible pour les relations
            logger.info(f"Flush réussi, Dataset ID: {dataset.id}")
            return dataset
        except Exception as e:
            logger.error(f"❌ ERREUR lors de la création du Dataset: {e}")
            logger.error(f"Type d'erreur: {type(e).__name__}")
            import traceback
            logger.error(f"Traceback: {traceback.format_exc()}")
            raise

    def _create_file_and_columns_records(
        self,
        db: Session,
        dataset_id: str,
        file_meta: Dict[str, Any],
        file_uuid_mapping: Dict[str, str]
    ) -> None:
        """Crée les enregistrements pour un fichier et toutes ses colonnes."""
        
        original_filename = file_meta['original_filename']
        file_uuid = file_uuid_mapping[original_filename]
        
        file_record = DatasetFile(
            id=file_uuid,
            dataset_id=dataset_id,
            original_filename=original_filename,
            file_name_in_storage=f"{file_uuid}.parquet",
            format="parquet",
            size_bytes=int(file_meta.get('size_mb', 0) * 1024 * 1024),
            row_count=file_meta.get('row_count', 0),
        )
        db.add(file_record)
        db.flush()

        for col_info in file_meta.get('column_details', []):
            # Nettoyer les stats pour la sérialisation JSON
            clean_col_info = self._convert_numpy_types(col_info)
            logger.info(f"Création colonne '{clean_col_info['column_name']}' avec stats: {clean_col_info.get('stats', {})}")
            
            column_record = FileColumn(
                dataset_file_id=file_record.id,
                **clean_col_info
            )
            db.add(column_record)

    def _extract_ethical_guidelines(self, config: Dict[str, Any]) -> Dict[str, Any]:
        """Extrait les directives éthiques depuis la configuration."""
        # Valeurs par défaut prudentes
        return {
            'anonymization_applied': config.get('ethical_guidelines', {}).get('anonymization_applied', False),
            'informed_consent': config.get('ethical_guidelines', {}).get('informed_consent', False),
        }


