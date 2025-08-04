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

from sqlalchemy.orm import Session
from .database import get_db_session
from models import Dataset, DatasetFile, FileColumn

logger = logging.getLogger(__name__)

class DatabaseManager:
    """Gère la persistance des métadonnées du dataset en base."""

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
        logger.info(f"Sauvegarde du dataset '{dataset_name}' en base de données (UUID: {dataset_uuid})...")
        
        with get_db_session() as db:
            try:
                # 1. Créer l'enregistrement du Dataset
                dataset_record = self._create_dataset_record(
                    db,
                    dataset_name,
                    dataset_config,
                    kaggle_metadata,
                    storage_path,
                    dataset_uuid,
                    files_metadata
                )
                
                # 2. Créer les enregistrements pour chaque fichier et ses colonnes
                for file_meta in files_metadata:
                    self._create_file_and_columns_records(
                        db,
                        dataset_record.id,
                        file_meta,
                        file_uuid_mapping
                    )

                db.commit()
                logger.info(f"Dataset '{dataset_name}' sauvegardé avec succès en base de données.")

            except Exception as e:
                logger.error(f"Erreur lors de la sauvegarde en base de données pour le dataset '{dataset_name}': {e}")
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
            'task': dataset_config.get('ml_task', []),
            'storage_path': storage_path,
            'instances_number': total_rows,
            'features_number': total_features,
            # 'is_public' n'est pas un champ du modèle Dataset
            **self._extract_ethical_guidelines(dataset_config)
        }

        dataset = Dataset(**dataset_data)
        db.add(dataset)
        db.flush() # Pour s'assurer que l'ID est disponible pour les relations
        return dataset

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
            column_record = FileColumn(
                dataset_file_id=file_record.id,
                **col_info
            )
            db.add(column_record)

    def _extract_ethical_guidelines(self, config: Dict[str, Any]) -> Dict[str, Any]:
        """Extrait les directives éthiques depuis la configuration."""
        # Valeurs par défaut prudentes
        return {
            'anonymization_applied': config.get('ethical_guidelines', {}).get('anonymization_applied', False),
            'informed_consent': config.get('ethical_guidelines', {}).get('informed_consent', False),
        }


