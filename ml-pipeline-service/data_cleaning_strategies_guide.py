#!/usr/bin/env python3
"""
Guide Complet des Stratégies de Nettoyage de Données Multi-Colonnes et Multi-Fichiers

Ce script démontre comment notre système gère intelligemment les 3 approches principales :
1. 🗑️  SUPPRESSION (Deletion)
2. 🔧  IMPUTATION (Imputation) 
3. 📈  INTERPOLATION (Interpolation)

Et leurs sous-méthodes pour chaque colonne selon leur contexte.
"""

import pandas as pd
import numpy as np
from typing import Dict, List, Any, Tuple
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class AdvancedDataCleaningStrategy:
    """
    Gestionnaire intelligent des stratégies de nettoyage multi-colonnes/multi-fichiers.
    """
    
    def __init__(self):
        self.strategies_hierarchy = {
            'suppression': {
                'drop_rows': 'Supprimer lignes avec missing values',
                'drop_columns': 'Supprimer colonnes avec trop de missing values', 
                'drop_outliers': 'Supprimer les outliers détectés'
            },
            'imputation': {
                'simple': {
                    'mean': 'Moyenne (distribution normale)',
                    'median': 'Médiane (distribution asymétrique)', 
                    'mode': 'Mode (données catégorielles)',
                    'constant': 'Valeur constante (ex: 0, "Unknown")'
                },
                'advanced': {
                    'knn': 'K-Nearest Neighbors (similarité)',
                    'iterative': 'Iterative/MICE (dépendances)',
                    'regression': 'Régression basée sur autres colonnes'
                }
            },
            'interpolation': {
                'linear': 'Interpolation linéaire (séries temporelles)',
                'polynomial': 'Interpolation polynomiale',
                'spline': 'Spline interpolation', 
                'forward_fill': 'Forward fill (ffill)',
                'backward_fill': 'Backward fill (bfill)'
            }
        }
    
    def analyze_multi_column_strategy(self, df: pd.DataFrame) -> Dict[str, Any]:
        """
        Analyse chaque colonne et recommande la meilleure stratégie.
        """
        print("🔍 ANALYSE MULTI-COLONNES - Recommandations par Colonne")
        print("=" * 80)
        
        strategies_per_column = {}
        global_recommendations = {
            'suppression_candidates': [],
            'imputation_candidates': [],
            'interpolation_candidates': [],
            'complex_cases': []
        }
        
        for column in df.columns:
            col_analysis = self._analyze_single_column(df, column)
            strategies_per_column[column] = col_analysis
            
            # Classer selon stratégie principale recommandée
            primary_strategy = col_analysis['recommended_approach']
            if primary_strategy == 'suppression':
                global_recommendations['suppression_candidates'].append(column)
            elif primary_strategy == 'imputation':
                global_recommendations['imputation_candidates'].append(column)
            elif primary_strategy == 'interpolation':
                global_recommendations['interpolation_candidates'].append(column)
            
            # Cas complexes (multiple stratégies possibles)
            if len(col_analysis['alternative_methods']) > 2:
                global_recommendations['complex_cases'].append(column)
        
        return {
            'per_column_strategies': strategies_per_column,
            'global_recommendations': global_recommendations,
            'execution_order': self._determine_execution_order(strategies_per_column)
        }
    
    def _analyze_single_column(self, df: pd.DataFrame, column: str) -> Dict[str, Any]:
        """Analyse approfondie d'une seule colonne."""
        col_data = df[column]
        missing_count = col_data.isnull().sum()
        missing_percentage = (missing_count / len(df)) * 100
        
        analysis = {
            'column_name': column,
            'missing_count': missing_count,
            'missing_percentage': round(missing_percentage, 2),
            'data_type': str(col_data.dtype),
            'is_categorical': col_data.dtype == 'object' or col_data.nunique() < 10,
            'is_temporal': pd.api.types.is_datetime64_any_dtype(col_data),
            'unique_values': col_data.nunique(),
            'recommended_approach': '',
            'specific_method': '',
            'alternative_methods': [],
            'reasoning': '',
            'confidence_score': 0.0
        }
        
        # LOGIQUE DE DÉCISION INTELLIGENTE
        if missing_percentage == 0:
            analysis['recommended_approach'] = 'aucune_action'
            analysis['specific_method'] = 'Aucun nettoyage nécessaire'
            analysis['confidence_score'] = 1.0
            analysis['reasoning'] = 'Aucune donnée manquante détectée'
            
        elif missing_percentage > 70:
            # ★ SUPPRESSION - Colonne trop corrompue
            analysis['recommended_approach'] = 'suppression'
            analysis['specific_method'] = 'drop_columns'
            analysis['alternative_methods'] = ['imputation_advanced']
            analysis['confidence_score'] = 0.9
            analysis['reasoning'] = f'Plus de 70% de données manquantes ({missing_percentage:.1f}%) - suppression recommandée'
            
        elif missing_percentage > 40:
            # ★ IMPUTATION AVANCÉE - Niveau critique
            analysis['recommended_approach'] = 'imputation'
            if analysis['is_categorical']:
                analysis['specific_method'] = 'mode_with_unknown_category'
                analysis['alternative_methods'] = ['knn', 'drop_columns']
                analysis['reasoning'] = 'Données catégorielles avec niveau élevé de manquement - mode + catégorie "Unknown"'
            else:
                analysis['specific_method'] = 'knn'
                analysis['alternative_methods'] = ['iterative', 'median', 'drop_columns']
                analysis['reasoning'] = 'Données numériques avec niveau élevé de manquement - KNN recommandé'
            analysis['confidence_score'] = 0.7
            
        elif missing_percentage > 15:
            # ★ IMPUTATION MODÉRÉE - Niveau moyen
            analysis['recommended_approach'] = 'imputation'
            if analysis['is_categorical']:
                analysis['specific_method'] = 'mode'
                analysis['alternative_methods'] = ['knn']
            elif analysis['is_temporal']:
                analysis['recommended_approach'] = 'interpolation'
                analysis['specific_method'] = 'linear'
                analysis['alternative_methods'] = ['forward_fill', 'backward_fill']
                analysis['reasoning'] = 'Données temporelles - interpolation linéaire recommandée'
            else:
                # Analyser la distribution pour choisir mean vs median
                if self._is_normal_distribution(col_data):
                    analysis['specific_method'] = 'mean'
                    analysis['alternative_methods'] = ['median', 'knn']
                    analysis['reasoning'] = 'Distribution normale détectée - moyenne recommandée'
                else:
                    analysis['specific_method'] = 'median'
                    analysis['alternative_methods'] = ['mean', 'knn']
                    analysis['reasoning'] = 'Distribution asymétrique - médiane recommandée'
            analysis['confidence_score'] = 0.8
            
        elif missing_percentage > 0:
            # ★ STRATÉGIE SIMPLE - Faible niveau
            if analysis['is_temporal']:
                analysis['recommended_approach'] = 'interpolation'
                analysis['specific_method'] = 'forward_fill'
                analysis['alternative_methods'] = ['linear', 'drop_rows']
            else:
                analysis['recommended_approach'] = 'imputation'
                if analysis['is_categorical']:
                    analysis['specific_method'] = 'mode'
                else:
                    analysis['specific_method'] = 'median' if not self._is_normal_distribution(col_data) else 'mean'
                analysis['alternative_methods'] = ['drop_rows']
            analysis['confidence_score'] = 0.9
            analysis['reasoning'] = f'Faible niveau de manquement ({missing_percentage:.1f}%) - stratégie simple suffisante'
        
        return analysis
    
    def _is_normal_distribution(self, series: pd.Series) -> bool:
        """Teste si la distribution est approximativement normale."""
        try:
            from scipy import stats
            # Supprimer les NaN pour l'analyse
            clean_data = series.dropna()
            if len(clean_data) < 3:
                return False
            
            # Test de Shapiro-Wilk (pour petits échantillons)
            if len(clean_data) <= 5000:
                stat, p_value = stats.shapiro(clean_data)
                return p_value > 0.05
            else:
                # Pour gros échantillons, utiliser skewness et kurtosis
                skewness = abs(stats.skew(clean_data))
                kurtosis = abs(stats.kurtosis(clean_data))
                return skewness < 0.5 and kurtosis < 0.5
        except:
            return False
    
    def _determine_execution_order(self, strategies: Dict[str, Any]) -> List[str]:
        """Détermine l'ordre optimal d'exécution des stratégies."""
        # 1. D'abord les suppressions (colonnes)
        # 2. Puis les imputations complexes
        # 3. Enfin les imputations simples et interpolations
        
        suppression_cols = []
        complex_imputation_cols = []
        simple_cleaning_cols = []
        
        for col, analysis in strategies.items():
            if analysis['recommended_approach'] == 'suppression':
                suppression_cols.append(col)
            elif analysis['specific_method'] in ['knn', 'iterative']:
                complex_imputation_cols.append(col)
            else:
                simple_cleaning_cols.append(col)
        
        return suppression_cols + complex_imputation_cols + simple_cleaning_cols

def demonstrate_multi_file_strategy():
    """Démontre la gestion de plusieurs fichiers CSV avec stratégies coordonnées."""
    print("\n🗂️  GESTION MULTI-FICHIERS")
    print("=" * 80)
    
    # Simuler 3 fichiers CSV avec différents patterns de données manquantes
    files_data = {
        'customers.csv': {
            'customer_id': range(1, 1001),
            'age': [np.random.randint(18, 80) if np.random.random() > 0.1 else np.nan for _ in range(1000)],
            'income': [np.random.randint(20000, 100000) if np.random.random() > 0.15 else np.nan for _ in range(1000)],
            'category': [np.random.choice(['A', 'B', 'C']) if np.random.random() > 0.05 else np.nan for _ in range(1000)]
        },
        'transactions.csv': {
            'transaction_id': range(1, 5001),
            'customer_id': [np.random.randint(1, 1001) for _ in range(5000)],
            'amount': [np.random.lognormal(3, 1) if np.random.random() > 0.08 else np.nan for _ in range(5000)],
            'timestamp': [pd.Timestamp('2024-01-01') + pd.Timedelta(hours=np.random.randint(0, 8760)) 
                         if np.random.random() > 0.02 else pd.NaT for _ in range(5000)]
        },
        'products.csv': {
            'product_id': range(1, 501),
            'price': [np.random.lognormal(2, 0.5) if np.random.random() > 0.3 else np.nan for _ in range(500)],  # 30% missing
            'category': [np.random.choice(['Electronics', 'Clothing', 'Home']) if np.random.random() > 0.8 else np.nan for _ in range(500)],  # 80% missing
            'rating': [np.random.uniform(1, 5) if np.random.random() > 0.12 else np.nan for _ in range(500)]
        }
    }
    
    strategy_manager = AdvancedDataCleaningStrategy()
    
    for filename, data in files_data.items():
        print(f"\n📄 Analyse de {filename}")
        print("-" * 40)
        
        df = pd.DataFrame(data)
        analysis = strategy_manager.analyze_multi_column_strategy(df)
        
        print(f"   Colonnes à supprimer: {analysis['global_recommendations']['suppression_candidates']}")
        print(f"   Colonnes à imputer: {analysis['global_recommendations']['imputation_candidates']}")
        print(f"   Colonnes à interpoler: {analysis['global_recommendations']['interpolation_candidates']}")
        print(f"   Cas complexes: {analysis['global_recommendations']['complex_cases']}")
        print(f"   Ordre d'exécution: {analysis['execution_order']}")

def demonstrate_strategy_application():
    """Démontre l'application concrète des stratégies."""
    print("\n⚙️  APPLICATION CONCRÈTE DES STRATÉGIES")
    print("=" * 80)
    
    # Créer un dataset de test avec différents types de problèmes
    np.random.seed(42)
    data = {
        'id': range(1, 1001),
        'age': [np.random.randint(18, 80) if np.random.random() > 0.1 else np.nan for _ in range(1000)],
        'salary': [np.random.lognormal(10, 0.5) if np.random.random() > 0.15 else np.nan for _ in range(1000)],
        'department': [np.random.choice(['IT', 'Sales', 'HR', 'Finance']) if np.random.random() > 0.05 else np.nan for _ in range(1000)],
        'corrupted_col': [np.nan] * 900 + [1] * 100,  # 90% missing - candidat à suppression
        'temporal_data': [pd.Timestamp('2024-01-01') + pd.Timedelta(days=i) if np.random.random() > 0.08 else pd.NaT for i in range(1000)]
    }
    
    df = pd.DataFrame(data)
    strategy_manager = AdvancedDataCleaningStrategy()
    
    print("📊 Dataset Original:")
    print(f"   Shape: {df.shape}")
    print(f"   Missing values par colonne:")
    for col in df.columns:
        missing_pct = (df[col].isnull().sum() / len(df)) * 100
        print(f"   - {col}: {missing_pct:.1f}%")
    
    # Analyser et appliquer les stratégies
    analysis = strategy_manager.analyze_multi_column_strategy(df)
    
    print(f"\n🎯 Stratégies Recommandées:")
    for col, col_analysis in analysis['per_column_strategies'].items():
        print(f"   • {col}:")
        print(f"     - Approche: {col_analysis['recommended_approach']}")
        print(f"     - Méthode: {col_analysis['specific_method']}")
        print(f"     - Confiance: {col_analysis['confidence_score']:.1%}")
        print(f"     - Raison: {col_analysis['reasoning']}")
    
    print(f"\n📋 Plan d'Exécution Global:")
    execution_order = analysis['execution_order']
    for i, col in enumerate(execution_order, 1):
        strategy = analysis['per_column_strategies'][col]
        print(f"   {i}. {col} → {strategy['specific_method']}")

def main():
    """Fonction principale de démonstration."""
    print("🧹 GUIDE COMPLET - STRATÉGIES DE NETTOYAGE MULTI-COLONNES")
    print("=" * 80)
    print("Ce guide montre comment notre système gère intelligemment :")
    print("1. 🗑️  SUPPRESSION : drop_rows, drop_columns, drop_outliers")
    print("2. 🔧  IMPUTATION : mean, median, mode, KNN, iterative")
    print("3. 📈  INTERPOLATION : linear, polynomial, forward/backward fill")
    print("=" * 80)
    
    # Démonstration des stratégies
    demonstrate_strategy_application()
    
    # Démonstration multi-fichiers
    demonstrate_multi_file_strategy()
    
    print("\n" + "=" * 80)
    print("💡 RÉSUMÉ DES RÈGLES DE DÉCISION :")
    print("=" * 80)
    print("📊 POURCENTAGE DE MISSING VALUES :")
    print("   • >70% → 🗑️  SUPPRESSION de la colonne")
    print("   • 40-70% → 🔧 IMPUTATION AVANCÉE (KNN, Iterative)")
    print("   • 15-40% → 🔧 IMPUTATION MODÉRÉE (mean/median/mode)")
    print("   • <15% → 🔧 IMPUTATION SIMPLE ou 📈 INTERPOLATION")
    print("")
    print("🎯 TYPE DE DONNÉES :")
    print("   • Catégorielles → mode, create_unknown_category")
    print("   • Numériques normales → mean, KNN")
    print("   • Numériques asymétriques → median, KNN")
    print("   • Temporelles → 📈 interpolation linéaire, forward_fill")
    print("")
    print("⚡ ORDRE D'EXÉCUTION :")
    print("   1. Suppression des colonnes corrompues")
    print("   2. Imputation avancée (KNN, Iterative)")
    print("   3. Imputation simple et interpolation")

if __name__ == "__main__":
    main()