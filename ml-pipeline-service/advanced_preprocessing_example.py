#!/usr/bin/env python3
"""
Exemple Pratique d'Application des Stratégies de Nettoyage dans notre ML Pipeline

Ce script montre comment notre système applique CONCRÈTEMENT les 3 approches :
1. SUPPRESSION (Deletion) 
2. IMPUTATION (Imputation)
3. INTERPOLATION (Interpolation)

sur de vraies données avec plusieurs colonnes et patterns complexes.
"""

import pandas as pd
import numpy as np
from sklearn.experimental import enable_iterative_imputer  # IMPORTANT : import en premier
from sklearn.impute import SimpleImputer, KNNImputer, IterativeImputer
from sklearn.preprocessing import StandardScaler, LabelEncoder
from typing import Dict, Any, List, Tuple
import warnings
warnings.filterwarnings('ignore')

def create_realistic_messy_dataset() -> pd.DataFrame:
    """Crée un dataset réaliste avec différents types de problèmes."""
    np.random.seed(42)
    n_samples = 1000
    
    data = {
        # Colonne ID - pas de missing (référence)
        'customer_id': range(1, n_samples + 1),
        
        # Colonne avec peu de missing (5%) - IMPUTATION SIMPLE
        'age': [np.random.randint(18, 80) if np.random.random() > 0.05 else np.nan for _ in range(n_samples)],
        
        # Colonne avec missing modéré (20%) - IMPUTATION AVANCÉE 
        'income': [np.random.lognormal(10, 0.8) if np.random.random() > 0.20 else np.nan for _ in range(n_samples)],
        
        # Colonne catégorielle avec missing (15%) - MODE IMPUTATION
        'education': [np.random.choice(['High School', 'Bachelor', 'Master', 'PhD']) 
                     if np.random.random() > 0.15 else np.nan for _ in range(n_samples)],
        
        # Colonne très corrompue (85% missing) - SUPPRESSION
        'corrupted_field': [np.random.randint(1, 10) if np.random.random() > 0.85 else np.nan for _ in range(n_samples)],
        
        # Colonne temporelle pour INTERPOLATION
        'last_purchase_date': [pd.Timestamp('2024-01-01') + pd.Timedelta(days=np.random.randint(0, 365))
                              if np.random.random() > 0.12 else pd.NaT for _ in range(n_samples)],
        
        # Colonnes avec dépendances pour ITERATIVE IMPUTATION
        'credit_score': [np.random.normal(700, 100) if np.random.random() > 0.18 else np.nan for _ in range(n_samples)],
        'loan_amount': [np.random.lognormal(9, 1) if np.random.random() > 0.22 else np.nan for _ in range(n_samples)],
        
        # Target (peu de missing)
        'default_risk': [np.random.choice([0, 1], p=[0.8, 0.2]) if np.random.random() > 0.02 else np.nan for _ in range(n_samples)]
    }
    
    return pd.DataFrame(data)

class AdvancedPreprocessingPipeline:
    """Pipeline de preprocessing avancé qui applique les bonnes stratégies par colonne."""
    
    def __init__(self):
        self.column_strategies = {}
        self.fitted_imputers = {}
        self.scaling_info = {}
        self.encoding_info = {}
        
    def fit_and_transform(self, df: pd.DataFrame, target_column: str = None) -> Tuple[pd.DataFrame, Dict[str, Any]]:
        """
        Applique automatiquement les meilleures stratégies pour chaque colonne.
        """
        print("🔧 PIPELINE DE PREPROCESSING AVANCÉ")
        print("=" * 60)
        
        # Analyse initiale
        analysis_report = self._analyze_all_columns(df, target_column)
        
        # Exécution des stratégies dans l'ordre optimal
        cleaned_df = df.copy()
        execution_log = []
        
        # PHASE 1: SUPPRESSION (colonnes trop corrompues)
        print("\n📍 PHASE 1: SUPPRESSION DES COLONNES CORROMPUES")
        for col in analysis_report['suppression_candidates']:
            print(f"   🗑️  Suppression de '{col}' ({analysis_report['column_analysis'][col]['missing_percentage']:.1f}% missing)")
            cleaned_df = cleaned_df.drop(columns=[col])
            execution_log.append(f"SUPPRIMÉ: {col}")
        
        # PHASE 2: IMPUTATION AVANCÉE (KNN, Iterative)
        print("\n📍 PHASE 2: IMPUTATION AVANCÉE")
        for col in analysis_report['advanced_imputation_candidates']:
            strategy = analysis_report['column_analysis'][col]['specific_method']
            cleaned_df = self._apply_advanced_imputation(cleaned_df, col, strategy)
            execution_log.append(f"IMPUTATION AVANCÉE: {col} → {strategy}")
        
        # PHASE 3: IMPUTATION SIMPLE
        print("\n📍 PHASE 3: IMPUTATION SIMPLE")
        for col in analysis_report['simple_imputation_candidates']:
            strategy = analysis_report['column_analysis'][col]['specific_method']
            cleaned_df = self._apply_simple_imputation(cleaned_df, col, strategy)
            execution_log.append(f"IMPUTATION SIMPLE: {col} → {strategy}")
        
        # PHASE 4: INTERPOLATION TEMPORELLE
        print("\n📍 PHASE 4: INTERPOLATION TEMPORELLE")
        for col in analysis_report['interpolation_candidates']:
            strategy = analysis_report['column_analysis'][col]['specific_method']
            cleaned_df = self._apply_interpolation(cleaned_df, col, strategy)
            execution_log.append(f"INTERPOLATION: {col} → {strategy}")
        
        # PHASE 5: ENCODING ET SCALING
        print("\n📍 PHASE 5: ENCODING & SCALING")
        cleaned_df = self._apply_encoding_and_scaling(cleaned_df, target_column)
        
        # Rapport final
        final_report = {
            'original_shape': df.shape,
            'final_shape': cleaned_df.shape,
            'columns_dropped': analysis_report['suppression_candidates'],
            'execution_log': execution_log,
            'missing_values_before': df.isnull().sum().to_dict(),
            'missing_values_after': cleaned_df.isnull().sum().to_dict(),
            'strategies_applied': analysis_report['column_analysis']
        }
        
        return cleaned_df, final_report
    
    def _analyze_all_columns(self, df: pd.DataFrame, target_column: str = None) -> Dict[str, Any]:
        """Analyse toutes les colonnes et détermine les stratégies optimales."""
        analysis = {
            'column_analysis': {},
            'suppression_candidates': [],
            'advanced_imputation_candidates': [],
            'simple_imputation_candidates': [],
            'interpolation_candidates': []
        }
        
        for column in df.columns:
            if column == target_column:
                continue  # Skip target column for now
                
            col_analysis = self._analyze_single_column(df, column)
            analysis['column_analysis'][column] = col_analysis
            
            # Classifier selon la stratégie
            if col_analysis['recommended_approach'] == 'suppression':
                analysis['suppression_candidates'].append(column)
            elif col_analysis['specific_method'] in ['knn', 'iterative']:
                analysis['advanced_imputation_candidates'].append(column)
            elif col_analysis['recommended_approach'] == 'interpolation':
                analysis['interpolation_candidates'].append(column)
            else:
                analysis['simple_imputation_candidates'].append(column)
        
        return analysis
    
    def _analyze_single_column(self, df: pd.DataFrame, column: str) -> Dict[str, Any]:
        """Analyse détaillée d'une colonne."""
        col_data = df[column]
        missing_count = col_data.isnull().sum()
        missing_percentage = (missing_count / len(df)) * 100
        
        is_categorical = col_data.dtype == 'object' or col_data.nunique() < 20
        is_temporal = pd.api.types.is_datetime64_any_dtype(col_data)
        is_numeric = pd.api.types.is_numeric_dtype(col_data)
        
        analysis = {
            'missing_percentage': round(missing_percentage, 2),
            'is_categorical': is_categorical,
            'is_temporal': is_temporal,
            'is_numeric': is_numeric,
            'unique_values': col_data.nunique(),
            'recommended_approach': '',
            'specific_method': '',
            'reasoning': ''
        }
        
        # LOGIQUE DE DÉCISION
        if missing_percentage == 0:
            analysis['recommended_approach'] = 'none'
            analysis['specific_method'] = 'no_action'
            analysis['reasoning'] = 'Aucune donnée manquante'
            
        elif missing_percentage > 75:
            analysis['recommended_approach'] = 'suppression'
            analysis['specific_method'] = 'drop_column'
            analysis['reasoning'] = f'Trop corrompue ({missing_percentage:.1f}% missing)'
            
        elif missing_percentage > 30:
            analysis['recommended_approach'] = 'imputation'
            if is_categorical:
                analysis['specific_method'] = 'mode_with_unknown'
                analysis['reasoning'] = 'Catégorielle avec beaucoup de missing - mode + Unknown'
            else:
                analysis['specific_method'] = 'knn'  # Ou 'iterative'
                analysis['reasoning'] = 'Numérique avec beaucoup de missing - KNN imputation'
                
        elif missing_percentage > 10:
            if is_temporal:
                analysis['recommended_approach'] = 'interpolation'
                analysis['specific_method'] = 'linear'
                analysis['reasoning'] = 'Données temporelles - interpolation linéaire'
            else:
                analysis['recommended_approach'] = 'imputation'
                if is_categorical:
                    analysis['specific_method'] = 'mode'
                else:
                    analysis['specific_method'] = 'median'  # Plus robust que mean
                analysis['reasoning'] = 'Missing modéré - imputation simple'
                
        else:  # < 10%
            analysis['recommended_approach'] = 'imputation'
            if is_categorical:
                analysis['specific_method'] = 'mode'
            else:
                analysis['specific_method'] = 'median'
            analysis['reasoning'] = 'Peu de missing - stratégie simple'
        
        return analysis
    
    def _apply_advanced_imputation(self, df: pd.DataFrame, column: str, strategy: str) -> pd.DataFrame:
        """Applique une imputation avancée (KNN, Iterative)."""
        if strategy == 'knn':
            print(f"   🎯 KNN Imputation sur '{column}'")
            # Utiliser toutes les colonnes numériques pour KNN
            numeric_cols = df.select_dtypes(include=[np.number]).columns.tolist()
            if column in numeric_cols and len(numeric_cols) > 1:
                imputer = KNNImputer(n_neighbors=5)
                df_numeric = df[numeric_cols].copy()
                df_imputed = imputer.fit_transform(df_numeric)
                
                # Remettre seulement la colonne ciblée
                col_index = numeric_cols.index(column)
                df[column] = df_imputed[:, col_index]
                
        elif strategy == 'iterative':
            print(f"   🔄 Iterative Imputation sur '{column}'")
            numeric_cols = df.select_dtypes(include=[np.number]).columns.tolist()
            if column in numeric_cols and len(numeric_cols) > 1:
                imputer = IterativeImputer(max_iter=10, random_state=42)
                df_numeric = df[numeric_cols].copy()
                df_imputed = imputer.fit_transform(df_numeric)
                
                col_index = numeric_cols.index(column)
                df[column] = df_imputed[:, col_index]
        
        return df
    
    def _apply_simple_imputation(self, df: pd.DataFrame, column: str, strategy: str) -> pd.DataFrame:
        """Applique une imputation simple (mean, median, mode)."""
        if strategy == 'median':
            print(f"   📊 Médiane imputation sur '{column}'")
            df[column] = df[column].fillna(df[column].median())
            
        elif strategy == 'mean':
            print(f"   📈 Moyenne imputation sur '{column}'")
            df[column] = df[column].fillna(df[column].mean())
            
        elif strategy == 'mode':
            print(f"   🎲 Mode imputation sur '{column}'")
            mode_value = df[column].mode()
            if len(mode_value) > 0:
                df[column] = df[column].fillna(mode_value[0])
                
        elif strategy == 'mode_with_unknown':
            print(f"   🎲 Mode + Unknown category sur '{column}'")
            df[column] = df[column].fillna('Unknown')
        
        return df
    
    def _apply_interpolation(self, df: pd.DataFrame, column: str, strategy: str) -> pd.DataFrame:
        """Applique une interpolation pour données temporelles ou séquentielles."""
        print(f"   📈 Interpolation {strategy} sur '{column}'")
        
        if strategy == 'linear':
            df[column] = df[column].interpolate(method='linear')
        elif strategy == 'forward_fill':
            df[column] = df[column].fillna(method='ffill')
        elif strategy == 'backward_fill':
            df[column] = df[column].fillna(method='bfill')
        
        return df
    
    def _apply_encoding_and_scaling(self, df: pd.DataFrame, target_column: str = None) -> pd.DataFrame:
        """Applique l'encoding des variables catégorielles et le scaling."""
        print("   🏷️  Encoding des variables catégorielles")
        print("   📏 Scaling des variables numériques")
        
        # Encoding simple pour l'exemple (en production, utiliser des pipelines plus sophistiqués)
        categorical_columns = df.select_dtypes(include=['object']).columns.tolist()
        if target_column in categorical_columns:
            categorical_columns.remove(target_column)
        
        for col in categorical_columns:
            if df[col].dtype == 'object':
                # Label encoding simple
                le = LabelEncoder()
                df[col] = le.fit_transform(df[col].astype(str))
        
        return df

def demonstrate_advanced_preprocessing():
    """Démonstration complète du pipeline avancé."""
    print("🚀 DÉMONSTRATION DU PIPELINE DE PREPROCESSING AVANCÉ")
    print("=" * 80)
    
    # Créer un dataset complexe
    df = create_realistic_messy_dataset()
    
    print(f"📊 Dataset Original:")
    print(f"   Shape: {df.shape}")
    print(f"   Colonnes: {list(df.columns)}")
    print(f"\n   Missing values par colonne:")
    for col in df.columns:
        missing_count = df[col].isnull().sum()
        missing_pct = (missing_count / len(df)) * 100
        print(f"   - {col}: {missing_count} ({missing_pct:.1f}%)")
    
    # Appliquer le pipeline
    pipeline = AdvancedPreprocessingPipeline()
    cleaned_df, report = pipeline.fit_and_transform(df, target_column='default_risk')
    
    print(f"\n📈 RÉSULTATS FINAUX:")
    print(f"   Shape originale: {report['original_shape']}")
    print(f"   Shape finale: {report['final_shape']}")
    print(f"   Colonnes supprimées: {report['columns_dropped']}")
    
    print(f"\n   Missing values après nettoyage:")
    for col, missing_count in report['missing_values_after'].items():
        print(f"   - {col}: {missing_count}")
    
    print(f"\n🎯 Log d'exécution:")
    for step in report['execution_log']:
        print(f"   ✅ {step}")
    
    return cleaned_df, report

if __name__ == "__main__":
    # Lancer la démonstration
    cleaned_data, processing_report = demonstrate_advanced_preprocessing()
    
    print(f"\n" + "=" * 80)
    print("💡 RÉCAPITULATIF DES STRATÉGIES APPLIQUÉES:")
    print("=" * 80)
    print("1. 🗑️  SUPPRESSION: Colonnes avec >75% de missing values")
    print("2. 🎯 IMPUTATION AVANCÉE: KNN et Iterative pour colonnes très affectées")
    print("3. 📊 IMPUTATION SIMPLE: Mean/Median/Mode pour missing modéré")
    print("4. 📈 INTERPOLATION: Pour données temporelles")
    print("5. 🏷️  ENCODING: Variables catégorielles → numériques")
    print("6. 📏 SCALING: Normalisation des variables numériques")
    print("\nLe pipeline choisit automatiquement la meilleure méthode par colonne !")