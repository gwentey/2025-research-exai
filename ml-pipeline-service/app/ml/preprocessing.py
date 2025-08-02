import pandas as pd
import numpy as np
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler, OneHotEncoder, LabelEncoder, MinMaxScaler, RobustScaler
from sklearn.experimental import enable_iterative_imputer  # DOIT être importé EN PREMIER
from sklearn.impute import SimpleImputer, KNNImputer, IterativeImputer
from sklearn.compose import ColumnTransformer
from sklearn.pipeline import Pipeline
from sklearn.ensemble import IsolationForest
from sklearn.covariance import EllipticEnvelope
from sklearn.neighbors import LocalOutlierFactor
from scipy import stats
from typing import Dict, Any, Tuple, List, Optional, Union
import warnings

warnings.filterwarnings('ignore')

class DataQualityAnalyzer:
    """Analyseur de qualité des données pour détecter les problèmes et patterns."""
    
    def __init__(self):
        self.analysis_results = {}
    
    def analyze_missing_data(self, df: pd.DataFrame) -> Dict[str, Any]:
        """
        Analyse complète des données manquantes.
        
        Returns:
            Dict avec statistiques détaillées, patterns et recommandations
        """
        missing_analysis = {
            'total_rows': len(df),
            'total_columns': len(df.columns),
            'columns_with_missing': {},
            'missing_patterns': {},
            'recommendations': {},
            'severity_assessment': {}
        }
        
        # Analyse par colonne
        for column in df.columns:
            missing_count = df[column].isnull().sum()
            missing_percentage = (missing_count / len(df)) * 100
            
            if missing_count > 0:
                column_analysis = {
                    'missing_count': int(missing_count),
                    'missing_percentage': round(missing_percentage, 2),
                    'data_type': str(df[column].dtype),
                    'unique_values': int(df[column].nunique()) if not df[column].isnull().all() else 0,
                    'is_categorical': df[column].dtype == 'object' or df[column].nunique() < 10,
                    'distribution_type': self._analyze_distribution(df[column])
                }
                
                # Recommandations basées sur l'analyse
                column_analysis['recommended_strategy'] = self._recommend_strategy(
                    missing_percentage, 
                    column_analysis['is_categorical'],
                    column_analysis['distribution_type']
                )
                
                missing_analysis['columns_with_missing'][column] = column_analysis
        
        # Analyse des patterns de données manquantes
        missing_analysis['missing_patterns'] = self._analyze_missing_patterns(df)
        
        # Évaluation de la sévérité globale
        missing_analysis['severity_assessment'] = self._assess_overall_severity(missing_analysis)
        
        return missing_analysis
    
    def _analyze_distribution(self, series: pd.Series) -> str:
        """Analyse le type de distribution d'une série numérique."""
        if series.dtype == 'object':
            return 'categorical'
        
        # Nettoyer les valeurs NaN pour l'analyse
        clean_series = series.dropna()
        if len(clean_series) < 10:
            return 'insufficient_data'
        
        # Test de normalité
        try:
            _, p_value = stats.normaltest(clean_series)
            if p_value > 0.05:
                return 'normal'
        except:
            pass
        
        # Test de skewness
        skewness = stats.skew(clean_series)
        if abs(skewness) < 0.5:
            return 'symmetric'
        elif skewness > 1:
            return 'right_skewed'
        elif skewness < -1:
            return 'left_skewed'
        else:
            return 'moderately_skewed'
    
    def _recommend_strategy(self, missing_percentage: float, is_categorical: bool, distribution_type: str) -> Dict[str, Any]:
        """Recommande une stratégie de traitement basée sur l'analyse."""
        recommendations = {
            'primary_strategy': '',
            'alternative_strategies': [],
            'explanation': '',
            'confidence': 0.0
        }
        
        # Règles de décision pour les recommandations
        if missing_percentage > 70:
            recommendations['primary_strategy'] = 'drop_column'
            recommendations['explanation'] = 'Trop de données manquantes (>70%) - recommandé de supprimer la colonne'
            recommendations['confidence'] = 0.9
        elif missing_percentage > 40:
            if is_categorical:
                recommendations['primary_strategy'] = 'mode_imputation'
                recommendations['alternative_strategies'] = ['create_missing_category', 'drop_column']
            else:
                recommendations['primary_strategy'] = 'knn_imputation'
                recommendations['alternative_strategies'] = ['iterative_imputation', 'drop_column']
            recommendations['explanation'] = f'Niveau élevé de données manquantes ({missing_percentage:.1f}%) - imputation sophistiquée recommandée'
            recommendations['confidence'] = 0.7
        elif missing_percentage > 15:
            if is_categorical:
                recommendations['primary_strategy'] = 'mode_imputation'
                recommendations['alternative_strategies'] = ['knn_imputation']
            else:
                if distribution_type == 'normal':
                    recommendations['primary_strategy'] = 'mean_imputation'
                    recommendations['alternative_strategies'] = ['knn_imputation', 'iterative_imputation']
                else:
                    recommendations['primary_strategy'] = 'median_imputation'
                    recommendations['alternative_strategies'] = ['knn_imputation']
            recommendations['explanation'] = f'Niveau modéré de données manquantes ({missing_percentage:.1f}%)'
            recommendations['confidence'] = 0.8
        else:
            if is_categorical:
                recommendations['primary_strategy'] = 'mode_imputation'
            else:
                if distribution_type == 'normal':
                    recommendations['primary_strategy'] = 'mean_imputation'
                else:
                    recommendations['primary_strategy'] = 'median_imputation'
            recommendations['alternative_strategies'] = ['drop_rows']
            recommendations['explanation'] = f'Faible niveau de données manquantes ({missing_percentage:.1f}%) - stratégie simple suffisante'
            recommendations['confidence'] = 0.9
        
        return recommendations
    
    def _analyze_missing_patterns(self, df: pd.DataFrame) -> Dict[str, Any]:
        """Analyse les patterns de données manquantes entre colonnes."""
        # Matrice de corrélation des données manquantes
        missing_df = df.isnull()
        
        patterns = {
            'completely_missing_rows': int(missing_df.all(axis=1).sum()),
            'completely_missing_columns': list(missing_df.columns[missing_df.all()]),
            'correlated_missing': {}
        }
        
        # Colonnes avec des patterns de manquement corrélés
        if len(missing_df.columns) > 1:
            corr_matrix = missing_df.corr()
            high_correlations = []
            for i in range(len(corr_matrix.columns)):
                for j in range(i+1, len(corr_matrix.columns)):
                    corr_value = corr_matrix.iloc[i, j]
                    if abs(corr_value) > 0.7:  # Seuil de corrélation élevée
                        high_correlations.append({
                            'column1': corr_matrix.columns[i],
                            'column2': corr_matrix.columns[j],
                            'correlation': round(corr_value, 3)
                        })
            patterns['correlated_missing'] = high_correlations
        
        return patterns
    
    def _assess_overall_severity(self, analysis: Dict[str, Any]) -> Dict[str, Any]:
        """Évalue la sévérité globale des problèmes de données."""
        severity = {
            'overall_score': 0,  # 0-100 (0 = aucun problème, 100 = problèmes majeurs)
            'level': 'low',  # low, medium, high, critical
            'main_issues': [],
            'action_required': False
        }
        
        columns_with_missing = analysis['columns_with_missing']
        total_columns = analysis['total_columns']
        
        if not columns_with_missing:
            severity['level'] = 'none'
            return severity
        
        # Calcul du score de sévérité
        score = 0
        critical_issues = []
        
        # Pourcentage de colonnes affectées
        affected_columns_ratio = len(columns_with_missing) / total_columns
        score += affected_columns_ratio * 30
        
        # Analyse des pourcentages de données manquantes
        high_missing_columns = sum(1 for col_data in columns_with_missing.values() 
                                 if col_data['missing_percentage'] > 40)
        if high_missing_columns > 0:
            score += (high_missing_columns / total_columns) * 40
            critical_issues.append(f"{high_missing_columns} colonne(s) avec >40% de données manquantes")
        
        # Colonnes complètement vides
        completely_empty = analysis['missing_patterns']['completely_missing_columns']
        if completely_empty:
            score += len(completely_empty) * 10
            critical_issues.append(f"{len(completely_empty)} colonne(s) complètement vide(s)")
        
        # Assignation du niveau
        if score >= 80:
            severity['level'] = 'critical'
            severity['action_required'] = True
        elif score >= 60:
            severity['level'] = 'high'
            severity['action_required'] = True
        elif score >= 30:
            severity['level'] = 'medium'
        else:
            severity['level'] = 'low'
        
        severity['overall_score'] = min(int(score), 100)
        severity['main_issues'] = critical_issues
        
        return severity

class OutlierDetector:
    """Détecteur d'outliers avec différentes méthodes."""
    
    @staticmethod
    def detect_outliers_iqr(df: pd.DataFrame, columns: List[str] = None) -> Dict[str, Any]:
        """Détection d'outliers avec la méthode IQR."""
        if columns is None:
            columns = df.select_dtypes(include=[np.number]).columns.tolist()
        
        outliers_info = {}
        
        for column in columns:
            if column in df.columns:
                Q1 = df[column].quantile(0.25)
                Q3 = df[column].quantile(0.75)
                IQR = Q3 - Q1
                
                lower_bound = Q1 - 1.5 * IQR
                upper_bound = Q3 + 1.5 * IQR
                
                outliers_mask = (df[column] < lower_bound) | (df[column] > upper_bound)
                outliers_count = outliers_mask.sum()
                
                outliers_info[column] = {
                    'method': 'IQR',
                    'outliers_count': int(outliers_count),
                    'outliers_percentage': round((outliers_count / len(df)) * 100, 2),
                    'lower_bound': float(lower_bound),
                    'upper_bound': float(upper_bound),
                    'outliers_indices': df[outliers_mask].index.tolist()
                }
        
        return outliers_info
    
    @staticmethod
    def detect_outliers_zscore(df: pd.DataFrame, columns: List[str] = None, threshold: float = 3) -> Dict[str, Any]:
        """Détection d'outliers avec la méthode Z-score."""
        if columns is None:
            columns = df.select_dtypes(include=[np.number]).columns.tolist()
        
        outliers_info = {}
        
        for column in columns:
            if column in df.columns:
                z_scores = np.abs(stats.zscore(df[column].dropna()))
                outliers_mask = z_scores > threshold
                outliers_count = outliers_mask.sum()
                
                outliers_info[column] = {
                    'method': 'Z-Score',
                    'threshold': threshold,
                    'outliers_count': int(outliers_count),
                    'outliers_percentage': round((outliers_count / len(df.dropna())) * 100, 2),
                    'max_zscore': float(z_scores.max()) if len(z_scores) > 0 else 0
                }
        
        return outliers_info

def detect_column_types(df: pd.DataFrame) -> Dict[str, List[str]]:
    """
    Detect column types in the dataframe
    
    Returns:
        Dict with keys 'numeric', 'categorical', 'datetime', 'target'
    """
    numeric_cols = []
    categorical_cols = []
    datetime_cols = []
    
    for col in df.columns:
        if pd.api.types.is_numeric_dtype(df[col]):
            numeric_cols.append(col)
        elif pd.api.types.is_datetime64_any_dtype(df[col]):
            datetime_cols.append(col)
        else:
            categorical_cols.append(col)
    
    return {
        'numeric': numeric_cols,
        'categorical': categorical_cols,
        'datetime': datetime_cols
    }

def handle_missing_values(df: pd.DataFrame, config: Dict[str, Any]) -> pd.DataFrame:
    """
    Handle missing values based on configuration (fonction legacy maintenue pour compatibilité)
    
    Args:
        df: Input dataframe
        config: Configuration dict with keys:
            - strategy: 'drop', 'mean', 'median', 'mode', 'forward_fill', 'knn', 'iterative'
            - threshold: float (for dropping columns with too many missing values)
            - knn_neighbors: int (for KNN imputation)
            - max_iter: int (for iterative imputation)
    """
    strategy = config.get('strategy', 'mean')
    threshold = config.get('threshold', 0.8)
    
    # Drop columns with too many missing values
    missing_ratio = df.isnull().sum() / len(df)
    cols_to_drop = missing_ratio[missing_ratio > threshold].index.tolist()
    if cols_to_drop:
        df = df.drop(columns=cols_to_drop)
    
    if strategy == 'drop':
        return df.dropna()
    elif strategy == 'forward_fill':
        return df.fillna(method='ffill')
    elif strategy == 'knn':
        # KNN imputation pour les colonnes numériques seulement
        numeric_cols = df.select_dtypes(include=[np.number]).columns
        if len(numeric_cols) > 0:
            n_neighbors = config.get('knn_neighbors', 5)
            imputer = KNNImputer(n_neighbors=n_neighbors)
            df[numeric_cols] = imputer.fit_transform(df[numeric_cols])
    elif strategy == 'iterative':
        # Iterative imputation pour les colonnes numériques
        numeric_cols = df.select_dtypes(include=[np.number]).columns
        if len(numeric_cols) > 0:
            max_iter = config.get('max_iter', 10)
            imputer = IterativeImputer(max_iter=max_iter, random_state=42)
            df[numeric_cols] = imputer.fit_transform(df[numeric_cols])
    
    # For other strategies, we'll handle in the pipeline
    return df

def analyze_dataset_quality(df: pd.DataFrame, target_column: str = None) -> Dict[str, Any]:
    """
    Analyse complète de la qualité du dataset avec recommandations de preprocessing.
    
    Args:
        df: DataFrame à analyser
        target_column: Nom de la colonne cible (optionnel)
    
    Returns:
        Dict avec analyses détaillées et recommandations
    """
    analyzer = DataQualityAnalyzer()
    outlier_detector = OutlierDetector()
    
    # Séparer les features du target si spécifié
    features_df = df.drop(columns=[target_column]) if target_column and target_column in df.columns else df
    
    analysis = {
        'dataset_overview': {
            'total_rows': len(df),
            'total_columns': len(df.columns),
            'memory_usage_mb': round(df.memory_usage(deep=True).sum() / 1024 / 1024, 2),
            'target_column': target_column
        },
        'column_types': detect_column_types(features_df),
        'missing_data_analysis': analyzer.analyze_missing_data(features_df),
        'outliers_analysis': {},
        'data_quality_score': 0,
        'preprocessing_recommendations': {}
    }
    
    # Analyse des outliers pour les colonnes numériques
    numeric_columns = analysis['column_types']['numeric']
    if numeric_columns:
        analysis['outliers_analysis'] = {
            'iqr_method': outlier_detector.detect_outliers_iqr(features_df, numeric_columns),
            'zscore_method': outlier_detector.detect_outliers_zscore(features_df, numeric_columns)
        }
    
    # Calcul du score de qualité global (0-100)
    analysis['data_quality_score'] = _calculate_data_quality_score(analysis)
    
    # Recommandations de preprocessing
    analysis['preprocessing_recommendations'] = _generate_preprocessing_recommendations(analysis)
    
    return analysis

def _calculate_data_quality_score(analysis: Dict[str, Any]) -> int:
    """Calcule un score de qualité des données de 0 à 100."""
    score = 100
    
    # Pénalités pour les données manquantes
    missing_severity = analysis['missing_data_analysis']['severity_assessment']['overall_score']
    score -= missing_severity * 0.5  # Maximum -50 points
    
    # Pénalités pour les outliers
    total_outliers = 0
    total_possible = analysis['dataset_overview']['total_rows']
    
    for method_results in analysis['outliers_analysis'].values():
        for col_result in method_results.values():
            if isinstance(col_result, dict) and 'outliers_percentage' in col_result:
                if col_result['outliers_percentage'] > 10:  # Si plus de 10% d'outliers
                    score -= min(col_result['outliers_percentage'], 20)  # Maximum -20 points par colonne
    
    return max(0, int(score))

def _generate_preprocessing_recommendations(analysis: Dict[str, Any]) -> Dict[str, Any]:
    """Génère des recommandations de preprocessing basées sur l'analyse."""
    recommendations = {
        'priority_actions': [],
        'missing_values_strategy': {},
        'outlier_handling': {},
        'feature_engineering': [],
        'scaling_recommendation': 'standard',  # standard, minmax, robust
        'encoding_recommendation': 'onehot'  # onehot, label, target
    }
    
    # Analyse de la sévérité des données manquantes
    missing_severity = analysis['missing_data_analysis']['severity_assessment']['level']
    
    if missing_severity in ['high', 'critical']:
        recommendations['priority_actions'].append({
            'action': 'handle_missing_values',
            'priority': 'high',
            'description': 'Traiter les données manquantes en priorité'
        })
    
    # Recommandations spécifiques par colonne pour les données manquantes
    for column, col_analysis in analysis['missing_data_analysis']['columns_with_missing'].items():
        recommended = col_analysis['recommended_strategy']
        recommendations['missing_values_strategy'][column] = {
            'strategy': recommended['primary_strategy'],
            'alternatives': recommended['alternative_strategies'],
            'confidence': recommended['confidence'],
            'explanation': recommended['explanation']
        }
    
    # Recommandations pour les outliers
    outlier_issues = []
    for method_name, method_results in analysis['outliers_analysis'].items():
        for column, result in method_results.items():
            if isinstance(result, dict) and result.get('outliers_percentage', 0) > 15:
                outlier_issues.append(column)
    
    if outlier_issues:
        recommendations['priority_actions'].append({
            'action': 'handle_outliers',
            'priority': 'medium',
            'description': f'Gérer les outliers dans {len(set(outlier_issues))} colonne(s)'
        })
        
        recommendations['outlier_handling'] = {
            'affected_columns': list(set(outlier_issues)),
            'recommended_methods': ['iqr_capping', 'zscore_removal', 'isolation_forest'],
            'explanation': 'Plusieurs colonnes contiennent des outliers significatifs'
        }
    
    # Recommandations de scaling basées sur la distribution des données
    numeric_columns = analysis['column_types']['numeric']
    if numeric_columns:
        # Analyse simple: si beaucoup de colonnes ont des échelles différentes, recommander robust scaler
        recommendations['scaling_recommendation'] = 'robust'  # Plus robuste aux outliers
    
    # Recommandations d'encoding basées sur le nombre de catégories
    categorical_columns = analysis['column_types']['categorical']
    if categorical_columns:
        # Si peu de colonnes catégorielles avec peu de catégories, onehot est OK
        # Sinon, target encoding peut être meilleur
        recommendations['encoding_recommendation'] = 'onehot'
    
    return recommendations

def preprocess_data(df: pd.DataFrame, config: Dict[str, Any]) -> Tuple:
    """
    Preprocess data for ML training
    
    Args:
        df: Input dataframe
        config: Configuration dict with keys:
            - target_column: str
            - test_size: float
            - random_state: int
            - missing_values: dict
            - scaling: bool
            - encoding: str ('onehot' or 'label')
            - task_type: str ('classification' or 'regression')
    
    Returns:
        Tuple of (X_train, X_test, y_train, y_test, preprocessing_pipeline)
    """
    # Extract configuration
    target_column = config.get('target_column', df.columns[-1])
    test_size = config.get('test_size', 0.2)
    random_state = config.get('random_state', 42)
    missing_config = config.get('missing_values', {'strategy': 'mean'})
    scaling = config.get('scaling', True)
    encoding = config.get('encoding', 'onehot')
    task_type = config.get('task_type', 'classification')
    
    # Handle missing values at dataframe level
    df = handle_missing_values(df, missing_config)
    
    # Separate features and target
    if target_column not in df.columns:
        raise ValueError(f"Target column '{target_column}' not found in dataframe")
    
    X = df.drop(columns=[target_column])
    y = df[target_column]
    
    # Encode target variable for classification
    if task_type == 'classification' and y.dtype == 'object':
        label_encoder = LabelEncoder()
        y = label_encoder.fit_transform(y)
    
    # Detect column types
    col_types = detect_column_types(X)
    numeric_features = col_types['numeric']
    categorical_features = col_types['categorical']
    
    # Create preprocessing pipelines
    numeric_transformer = Pipeline(steps=[
        ('imputer', SimpleImputer(strategy=missing_config.get('strategy', 'mean')))
    ])
    
    if scaling:
        numeric_transformer.steps.append(('scaler', StandardScaler()))
    
    if encoding == 'onehot':
        categorical_transformer = Pipeline(steps=[
            ('imputer', SimpleImputer(strategy='constant', fill_value='missing')),
            ('onehot', OneHotEncoder(handle_unknown='ignore', sparse_output=False))
        ])
    else:
        # For label encoding, we need a custom transformer
        categorical_transformer = Pipeline(steps=[
            ('imputer', SimpleImputer(strategy='constant', fill_value='missing'))
        ])
    
    # Combine transformers
    preprocessor = ColumnTransformer(
        transformers=[
            ('num', numeric_transformer, numeric_features),
            ('cat', categorical_transformer, categorical_features)
        ],
        remainder='passthrough'  # Keep other columns as is
    )
    
    # Split the data
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=test_size, random_state=random_state, 
        stratify=y if task_type == 'classification' else None
    )
    
    # Fit and transform the data
    X_train = preprocessor.fit_transform(X_train)
    X_test = preprocessor.transform(X_test)
    
    return X_train, X_test, y_train, y_test, preprocessor

def get_preprocessing_info(df: pd.DataFrame) -> Dict[str, Any]:
    """
    Get information about the dataset for preprocessing configuration
    
    Returns:
        Dict with dataset statistics and suggested preprocessing options
    """
    info = {
        'shape': df.shape,
        'columns': df.columns.tolist(),
        'dtypes': df.dtypes.astype(str).to_dict(),
        'missing_values': df.isnull().sum().to_dict(),
        'missing_percentage': (df.isnull().sum() / len(df) * 100).round(2).to_dict()
    }
    
    # Detect column types
    col_types = detect_column_types(df)
    info['column_types'] = col_types
    
    # Suggest target column (last column by default)
    info['suggested_target'] = df.columns[-1]
    
    # Check if classification or regression
    if len(col_types['numeric']) > 0:
        last_col = df.columns[-1]
        if last_col in col_types['numeric']:
            unique_values = df[last_col].nunique()
            info['suggested_task_type'] = 'classification' if unique_values < 20 else 'regression'
        else:
            info['suggested_task_type'] = 'classification'
    else:
        info['suggested_task_type'] = 'classification'
    
    return info 