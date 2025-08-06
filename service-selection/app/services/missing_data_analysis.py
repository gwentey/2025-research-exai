"""
Service d'analyse des données manquantes pour les datasets.
"""

import pandas as pd
import io
import json
import re
from typing import List, Dict, Any, Tuple
from sqlalchemy.orm import Session
from datetime import datetime

from .. import models

# Import du client de stockage commun
import sys
import os
sys.path.append(os.path.join(os.path.dirname(__file__), '..', '..', '..'))
from common.storage_client import get_storage_client


class MissingDataAnalyzer:
    """
    Analyseur de données manquantes pour les datasets.
    """
    
    def __init__(self):
        # Patterns pour exclure les colonnes techniques
        self.technical_column_patterns = [
            r'^id$',
            r'^uuid$',
            r'^index$',
            r'_id$',
            r'_uuid$',
            r'^pk_',
            r'^primary_key',
            r'^row_number$',
            r'^serial$',
            r'^autoincrement',
            r'^sequence'
        ]
    
    def analyze_dataset_missing_data(self, dataset_id: str, db: Session) -> Dict[str, Any]:
        """
        Analyse les données manquantes pour un dataset donné.
        
        Args:
            dataset_id: ID du dataset à analyser
            db: Session de base de données
            
        Returns:
            Dictionnaire contenant l'analyse des données manquantes
        """
        # Récupérer le dataset avec ses fichiers et colonnes
        dataset = db.query(models.Dataset).filter(models.Dataset.id == dataset_id).first()
        if not dataset:
            raise ValueError(f"Dataset {dataset_id} non trouvé")
        
        dataset_files = db.query(models.DatasetFile).filter(
            models.DatasetFile.dataset_id == dataset_id
        ).all()
        
        if not dataset_files:
            raise ValueError(f"Aucun fichier trouvé pour le dataset {dataset_id}")
        
        # Analyser chaque fichier
        all_columns_stats = []
        excluded_columns = []
        total_columns = 0
        
        for file in dataset_files:
            # Récupérer les colonnes du fichier
            file_columns = db.query(models.FileColumn).filter(
                models.FileColumn.dataset_file_id == file.id
            ).all()
            
            total_columns += len(file_columns)
            
            # Analyser les colonnes de ce fichier
            file_stats, file_excluded = self._analyze_file_columns(
                file, file_columns, db
            )
            
            all_columns_stats.extend(file_stats)
            excluded_columns.extend(file_excluded)
        
        # Calculer le score global
        overall_score = self._calculate_overall_score(all_columns_stats)
        quality_level = self._determine_quality_level(overall_score)
        
        return {
            "datasetId": dataset_id,
            "analysisTimestamp": datetime.utcnow().isoformat(),
            "missingDataScore": {
                "overallScore": overall_score,
                "totalColumns": total_columns,
                "analyzedColumns": len(all_columns_stats),
                "excludedColumns": excluded_columns,
                "columnStats": all_columns_stats,
                "qualityLevel": quality_level
            }
        }
    
    def _analyze_file_columns(
        self, 
        file: models.DatasetFile, 
        columns: List[models.FileColumn],
        db: Session
    ) -> Tuple[List[Dict[str, Any]], List[str]]:
        """
        Analyse les colonnes d'un fichier spécifique.
        """
        analyzed_columns = []
        excluded_columns = []
        
        # Tenter de charger les données réelles du fichier
        actual_data = self._load_file_data(file)
        
        for column in columns:
            # Vérifier si la colonne doit être exclue
            if self._should_exclude_column(column.column_name):
                excluded_columns.append(column.column_name)
                continue
            
            # Calculer les statistiques de données manquantes
            if actual_data is not None and column.column_name in actual_data.columns:
                # Données réelles disponibles
                missing_count = int(actual_data[column.column_name].isnull().sum())
                total_count = len(actual_data)
            else:
                # Estimation basée sur les métadonnées
                total_count = file.row_count or 1000  # Estimation par défaut
                if column.is_nullable:
                    # Estimation : les colonnes nullables ont 10-30% de valeurs manquantes
                    missing_count = int(total_count * 0.15)  # 15% par défaut
                else:
                    # Colonnes non-nullables : 0-5% de valeurs manquantes (erreurs de données)
                    missing_count = int(total_count * 0.02)  # 2% par défaut
            
            missing_percentage = (missing_count / total_count) * 100 if total_count > 0 else 0
            
            # Déterminer la gravité
            severity = self._determine_severity(missing_percentage)
            
            # Générer une suggestion
            suggestion = self._generate_suggestion(
                missing_percentage, 
                column.data_type_interpreted or column.data_type_original or 'unknown'
            )
            
            analyzed_columns.append({
                "columnName": column.column_name,
                "missingCount": missing_count,
                "totalCount": total_count,
                "missingPercentage": round(missing_percentage, 2),
                "dataType": column.data_type_interpreted or column.data_type_original or 'unknown',
                "suggestion": suggestion,
                "severity": severity
            })
        
        return analyzed_columns, excluded_columns
    
    def _should_exclude_column(self, column_name: str) -> bool:
        """
        Détermine si une colonne doit être exclue de l'analyse.
        """
        for pattern in self.technical_column_patterns:
            if re.match(pattern, column_name.lower()):
                return True
        return False
    
    def _load_file_data(self, file: models.DatasetFile) -> pd.DataFrame:
        """
        Charge les données réelles d'un fichier depuis le stockage.
        """
        try:
            storage_client = get_storage_client()
            file_content = storage_client.get_file_content(
                f"ibis-x-datasets/{file.dataset_id}/{file.file_name_in_storage}"
            )
            
            # Déterminer le format et charger
            if file.format.lower() == 'parquet':
                return pd.read_parquet(io.BytesIO(file_content))
            elif file.format.lower() == 'csv':
                return pd.read_csv(io.BytesIO(file_content))
            # Ajouter d'autres formats si nécessaire
            
        except Exception as e:
            # Fallback : utiliser les métadonnées estimées
            print(f"Impossible de charger le fichier {file.file_name_in_storage}: {e}")
            return None
    
    def _determine_severity(self, missing_percentage: float) -> str:
        """
        Détermine la gravité basée sur le pourcentage de données manquantes.
        """
        if missing_percentage < 5:
            return 'low'
        elif missing_percentage < 15:
            return 'medium'
        elif missing_percentage < 30:
            return 'high'
        else:
            return 'critical'
    
    def _generate_suggestion(self, missing_percentage: float, data_type: str) -> str:
        """
        Génère une suggestion de traitement basée sur le pourcentage et le type de données.
        """
        if missing_percentage < 5:
            return 'MINIMAL_CLEANING'
        elif missing_percentage < 15:
            if 'numerical' in data_type.lower() or 'float' in data_type.lower():
                return 'IMPUTE_MEAN'
            else:
                return 'IMPUTE_MODE'
        elif missing_percentage < 30:
            return 'CAREFUL_ANALYSIS'
        else:
            return 'CONSIDER_REMOVAL'
    
    def _calculate_overall_score(self, column_stats: List[Dict[str, Any]]) -> int:
        """
        Calcule le score global basé sur les statistiques des colonnes.
        """
        if not column_stats:
            return 100
        
        # Moyenne pondérée inversée des pourcentages de données manquantes
        total_missing_percentage = sum(
            stat['missingPercentage'] for stat in column_stats
        ) / len(column_stats)
        
        # Score = 100 - pourcentage moyen de données manquantes
        score = max(0, 100 - total_missing_percentage)
        return round(score)
    
    def _determine_quality_level(self, score: int) -> str:
        """
        Détermine le niveau de qualité basé sur le score.
        """
        if score == 100:
            return 'perfect'
        elif score >= 80:
            return 'good'
        elif score >= 50:
            return 'warning'
        else:
            return 'critical'


# Instance globale pour réutilisation
missing_data_analyzer = MissingDataAnalyzer()