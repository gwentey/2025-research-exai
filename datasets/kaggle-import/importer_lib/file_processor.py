"""
Contient la logique de traitement des fichiers :
- Analyse de fichiers CSV pour extraire des métadonnées
- Conversion de CSV en Parquet optimisé
"""
import logging
import re
from pathlib import Path
from typing import List, Dict, Any

import pandas as pd
import pyarrow as pa
import pyarrow.parquet as pq

logger = logging.getLogger(__name__)

class FileProcessor:
    """Traite les fichiers de dataset."""

    def convert_to_parquet(self, csv_files: List[Path], output_dir: Path) -> List[Path]:
        """Convertit une liste de fichiers CSV en format Parquet."""
        parquet_files = []
        output_dir.mkdir(exist_ok=True)

        for csv_file in csv_files:
            try:
                df = pd.read_csv(csv_file)
                parquet_path = output_dir / f"{csv_file.stem}.parquet"
                
                # Sauvegarde en Parquet avec compression Snappy
                df.to_parquet(parquet_path, compression='snappy', index=False)
                parquet_files.append(parquet_path)
                
                original_size_mb = csv_file.stat().st_size / (1024 * 1024)
                compressed_size_mb = parquet_path.stat().st_size / (1024 * 1024)
                ratio = original_size_mb / compressed_size_mb if compressed_size_mb > 0 else 0
                
                logger.info(f"Conversion réussie : {csv_file.name} ({original_size_mb:.2f}MB) -> {parquet_path.name} ({compressed_size_mb:.2f}MB, gain x{ratio:.1f})")

            except Exception as e:
                logger.error(f"Échec de la conversion de {csv_file.name} en Parquet: {e}")
                continue
        
        return parquet_files

    def analyze_csv(self, file_path: Path) -> Dict[str, Any]:
        """Analyse un fichier CSV et retourne des métadonnées complètes."""
        logger.info(f"Analyse du fichier CSV : {file_path.name}")
        try:
            df = pd.read_csv(file_path, low_memory=False)
            
            metadata = {
                'original_filename': file_path.name,
                'row_count': len(df),
                'column_count': len(df.columns),
                'size_mb': file_path.stat().st_size / (1024 * 1024),
                'column_details': [],
            }

            for idx, col_name in enumerate(df.columns):
                col_data = df[col_name]
                col_type = self._interpret_column_type(col_data)
                
                column_info = {
                    'column_name': col_name,
                    'position': idx,
                    'data_type_original': str(col_data.dtype),
                    'data_type_interpreted': col_type,
                    'is_nullable': bool(col_data.isnull().any()),
                    'is_pii': self._detect_pii(col_name, col_data),
                    'description': f"Colonne '{col_name}' de type {col_type}.",
                    'example_values': col_data.dropna().head(3).astype(str).tolist(),
                    'stats': self._calculate_column_stats(col_data, col_type),
                }
                metadata['column_details'].append(column_info)

            logger.info(f"Analyse de {file_path.name} terminée : {metadata['row_count']} lignes, {metadata['column_count']} colonnes.")
            return metadata

        except Exception as e:
            logger.error(f"Échec de l'analyse de {file_path.name}: {e}")
            return {'error': str(e), 'original_filename': file_path.name}

    def _interpret_column_type(self, col_data: pd.Series) -> str:
        """Détermine le type sémantique d'une colonne."""
        if pd.api.types.is_numeric_dtype(col_data):
            return "numerical_integer" if pd.api.types.is_integer_dtype(col_data) else "numerical_float"
        
        try:
            # Tente de convertir une partie en datetime
            pd.to_datetime(col_data.dropna().head(100), errors='raise')
            return "temporal"
        except (ValueError, TypeError):
            pass

        # Si le ratio de valeurs uniques est faible, c'est probablement catégoriel
        unique_ratio = col_data.nunique() / len(col_data) if len(col_data) > 0 else 0
        if unique_ratio < 0.1 and col_data.nunique() < 50:
            return "categorical"
            
        return "text"

    def _detect_pii(self, col_name: str, col_data: pd.Series) -> bool:
        """Détecte les colonnes contenant potentiellement des informations personnelles."""
        pii_keywords = ['email', 'phone', 'name', 'address', 'id', 'ssn', 'credit_card']
        if any(keyword in col_name.lower() for keyword in pii_keywords):
            return True
        
        # Simple regex pour les emails
        if col_data.dtype == 'object':
            sample = col_data.dropna().head(10).astype(str)
            if any(re.match(r"[^@]+@[^@]+\.[^@]+", val) for val in sample):
                return True
        return False

    def _calculate_column_stats(self, col_data: pd.Series, col_type: str) -> Dict[str, Any]:
        """Calcule des statistiques de base pour une colonne."""
        stats = {}
        if 'numerical' in col_type:
            stats = {
                'mean': col_data.mean(),
                'median': col_data.median(),
                'std': col_data.std(),
                'min': col_data.min(),
                'max': col_data.max(),
            }
        elif col_type == 'categorical':
            value_counts = col_data.value_counts()
            stats = {
                'most_frequent': value_counts.index[0] if not value_counts.empty else None,
                'unique_count': col_data.nunique(),
            }
        # Supprimer les NaN/NaT pour la sérialisation JSON
        return {k: (None if pd.isna(v) else v) for k, v in stats.items()}


