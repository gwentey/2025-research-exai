import pandas as pd
import numpy as np
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler, OneHotEncoder, LabelEncoder
from sklearn.impute import SimpleImputer
from sklearn.compose import ColumnTransformer
from sklearn.pipeline import Pipeline
from typing import Dict, Any, Tuple, List, Optional

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
    Handle missing values based on configuration
    
    Args:
        df: Input dataframe
        config: Configuration dict with keys:
            - strategy: 'drop', 'mean', 'median', 'mode', 'forward_fill'
            - threshold: float (for dropping columns with too many missing values)
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
    
    # For other strategies, we'll handle in the pipeline
    return df

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