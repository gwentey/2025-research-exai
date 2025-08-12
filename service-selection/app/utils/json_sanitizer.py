"""
Module de sanitisation JSON pour garantir la compatibilité avec PostgreSQL JSONB.

Ce module résout le problème des valeurs NaN/Infinity de pandas qui ne sont pas 
JSON-compatibles et causent des erreurs d'insertion en base de données.
"""

import math
import json
import logging
from typing import Any, Dict, List, Union
import pandas as pd
import numpy as np

logger = logging.getLogger(__name__)


def sanitize_for_json(obj: Any) -> Any:
    """
    Sanitise récursivement un objet Python pour garantir la compatibilité JSON.
    
    Conversions appliquées :
    - NaN, Infinity, -Infinity → null
    - numpy types → types Python natifs
    - pandas Timestamp → string ISO
    - Objets non sérialisables → string repr
    
    Args:
        obj: Objet à sanitiser
        
    Returns:
        Objet sanitisé compatible JSON
    """
    if obj is None:
        return None
    
    # Gestion des valeurs numériques problématiques
    if isinstance(obj, (int, float, np.integer, np.floating)):
        if pd.isna(obj) or math.isnan(float(obj)) if not isinstance(obj, (int, np.integer)) else False:
            return None
        elif math.isinf(float(obj)):
            return None
        else:
            return float(obj) if isinstance(obj, (float, np.floating)) else int(obj)
    
    # Gestion des types numpy
    if isinstance(obj, np.ndarray):
        return [sanitize_for_json(item) for item in obj.tolist()]
    
    if isinstance(obj, (np.integer, np.floating)):
        return sanitize_for_json(obj.item())
    
    if isinstance(obj, np.bool_):
        return bool(obj)
    
    # Gestion des timestamps pandas
    if isinstance(obj, pd.Timestamp):
        return obj.isoformat() if not pd.isna(obj) else None
    
    # Gestion des chaînes de caractères
    if isinstance(obj, str):
        return obj
    
    if isinstance(obj, bool):
        return obj
    
    # Gestion des listes
    if isinstance(obj, (list, tuple)):
        return [sanitize_for_json(item) for item in obj]
    
    # Gestion des dictionnaires
    if isinstance(obj, dict):
        return {key: sanitize_for_json(value) for key, value in obj.items()}
    
    # Fallback : conversion en string pour les objets non supportés
    try:
        # Tentative de sérialisation JSON pour vérifier la compatibilité
        json.dumps(obj)
        return obj
    except (TypeError, ValueError):
        logger.warning(f"Object not JSON serializable, converting to string: {type(obj)}")
        return str(obj)


def sanitize_column_stats(stats: Dict[str, Any]) -> Dict[str, Any]:
    """
    Sanitise spécifiquement les statistiques de colonnes pour éviter les erreurs JSONB.
    
    Règles spéciales :
    - Si mean/std sont NaN pour une colonne 100% nulle → les supprimer
    - Garder null_percentage même si 100%
    - Convertir unique_count en int
    
    Args:
        stats: Dictionnaire des statistiques de colonne
        
    Returns:
        Dictionnaire sanitisé
    """
    if not isinstance(stats, dict):
        return {}
    
    sanitized = {}
    
    for key, value in stats.items():
        if key in ['mean', 'std'] and (pd.isna(value) or (isinstance(value, float) and math.isnan(value))):
            # Pour les colonnes 100% nulles, ne pas inclure mean/std
            continue
        elif key in ['min', 'max'] and pd.isna(value):
            # min/max peuvent être null pour des colonnes vides
            sanitized[key] = None
        elif key in ['null_count', 'unique_count', 'row_count']:
            # Forcer la conversion en int
            sanitized[key] = int(value) if not pd.isna(value) else 0
        elif key == 'null_percentage':
            # Garder le pourcentage même si 100%
            sanitized[key] = float(value) if not pd.isna(value) else 0.0
        else:
            sanitized[key] = sanitize_for_json(value)
    
    return sanitized


def is_empty_or_unnamed_column(column_name: str, stats: Dict[str, Any]) -> bool:
    """
    Détermine si une colonne est vide ou générée automatiquement (Unnamed:*).
    
    Args:
        column_name: Nom de la colonne
        stats: Statistiques de la colonne
        
    Returns:
        True si la colonne doit être considérée comme vide/inutile
    """
    # Colonnes générées automatiquement par pandas
    if column_name.startswith('Unnamed:'):
        return True
    
    # Colonnes entièrement nulles
    if stats.get('null_percentage', 0) >= 100:
        return True
    
    # Colonnes sans valeurs uniques
    if stats.get('unique_count', 0) == 0:
        return True
    
    return False


def get_column_handling_strategy(column_name: str, stats: Dict[str, Any]) -> str:
    """
    Détermine la stratégie de gestion pour une colonne problématique.
    
    Args:
        column_name: Nom de la colonne
        stats: Statistiques de la colonne
        
    Returns:
        'skip', 'clean', ou 'keep'
    """
    if is_empty_or_unnamed_column(column_name, stats):
        # Colonnes Unnamed:* ou 100% nulles → skip par défaut
        return 'skip'
    
    if stats.get('null_percentage', 0) > 80:
        # Colonnes avec >80% de valeurs manquantes → nettoyer les stats
        return 'clean'
    
    return 'keep'


def create_column_warning(column_name: str, strategy: str, stats: Dict[str, Any]) -> Dict[str, Any]:
    """
    Crée un avertissement structuré pour une colonne problématique.
    
    Args:
        column_name: Nom de la colonne
        strategy: Stratégie appliquée
        stats: Statistiques originales
        
    Returns:
        Dictionnaire d'avertissement structuré
    """
    warning = {
        'column_name': column_name,
        'strategy': strategy,
        'reason': '',
        'impact': '',
        'recommendation': ''
    }
    
    if strategy == 'skip':
        if column_name.startswith('Unnamed:'):
            warning['reason'] = 'Colonne générée automatiquement sans données utiles'
            warning['impact'] = 'Aucun - colonne non significative'
            warning['recommendation'] = 'Vérifier la structure du fichier source'
        else:
            warning['reason'] = f'Colonne 100% vide ({stats.get("null_percentage", 0)}% null)'
            warning['impact'] = 'Aucune information utilisable pour le ML'
            warning['recommendation'] = 'Considérer la suppression de cette colonne'
    
    elif strategy == 'clean':
        warning['reason'] = f'Colonne avec {stats.get("null_percentage", 0)}% de valeurs manquantes'
        warning['impact'] = 'Statistiques partiellement fiables'
        warning['recommendation'] = 'Prétraitement recommandé avant entraînement ML'
    
    return warning


def validate_json_compatibility(obj: Any) -> tuple[bool, List[str]]:
    """
    Valide qu'un objet est entièrement compatible JSON.
    
    Args:
        obj: Objet à valider
        
    Returns:
        (is_valid, error_messages)
    """
    errors = []
    
    try:
        json.dumps(obj)
        return True, []
    except (TypeError, ValueError) as e:
        errors.append(f"JSON serialization error: {str(e)}")
        return False, errors


# Configuration par défaut pour la gestion des colonnes
DEFAULT_COLUMN_CONFIG = {
    'skip_unnamed_columns': True,
    'skip_empty_columns': True,
    'empty_threshold': 100,  # % de valeurs nulles pour considérer comme vide
    'clean_threshold': 80,   # % de valeurs nulles pour nettoyer les stats
    'max_warnings': 10       # Nombre max d'avertissements à générer
}


def process_columns_with_config(
    columns_metadata: List[Dict[str, Any]], 
    config: Dict[str, Any] = None
) -> tuple[List[Dict[str, Any]], List[Dict[str, Any]]]:
    """
    Traite une liste de métadonnées de colonnes selon la configuration.
    
    Args:
        columns_metadata: Liste des métadonnées des colonnes
        config: Configuration de traitement (utilise DEFAULT_COLUMN_CONFIG si None)
        
    Returns:
        (processed_columns, warnings)
    """
    if config is None:
        config = DEFAULT_COLUMN_CONFIG.copy()
    
    processed_columns = []
    warnings = []
    
    for col_meta in columns_metadata:
        column_name = col_meta.get('name', 'Unknown')
        stats = col_meta.get('stats', {})
        
        # Sanitiser les stats en premier
        sanitized_stats = sanitize_column_stats(stats)
        
        # Déterminer la stratégie
        strategy = get_column_handling_strategy(column_name, sanitized_stats)
        
        if strategy == 'skip':
            if config.get('skip_unnamed_columns', True) and column_name.startswith('Unnamed:'):
                warnings.append(create_column_warning(column_name, strategy, stats))
                continue
            elif config.get('skip_empty_columns', True) and sanitized_stats.get('null_percentage', 0) >= config.get('empty_threshold', 100):
                warnings.append(create_column_warning(column_name, strategy, stats))
                continue
        
        elif strategy == 'clean':
            warnings.append(create_column_warning(column_name, strategy, stats))
        
        # Créer la métadonnée nettoyée
        clean_meta = col_meta.copy()
        clean_meta['stats'] = sanitized_stats
        processed_columns.append(clean_meta)
    
    # Limiter le nombre d'avertissements
    max_warnings = config.get('max_warnings', 10)
    if len(warnings) > max_warnings:
        warnings = warnings[:max_warnings]
        warnings.append({
            'column_name': '...',
            'strategy': 'truncated',
            'reason': f'Et {len(warnings) - max_warnings} autres avertissements',
            'impact': 'Voir logs pour détails complets',
            'recommendation': 'Vérifier la qualité globale des données'
        })
    
    return processed_columns, warnings
