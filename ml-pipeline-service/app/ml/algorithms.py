from sklearn.tree import DecisionTreeClassifier, DecisionTreeRegressor
from sklearn.ensemble import RandomForestClassifier, RandomForestRegressor
import numpy as np
from typing import Dict, Any, Optional, Union

class BaseModelWrapper:
    """Base class for sklearn model wrappers"""
    
    def __init__(self, **kwargs):
        self.model = None
        self.hyperparameters = kwargs
        self.is_fitted = False
        
    def fit(self, X, y):
        """Train the model"""
        self.model.fit(X, y)
        self.is_fitted = True
        return self
        
    def predict(self, X):
        """Make predictions"""
        if not self.is_fitted:
            raise ValueError("Model must be fitted before making predictions")
        return self.model.predict(X)
        
    def predict_proba(self, X):
        """Get prediction probabilities (for classifiers)"""
        if not self.is_fitted:
            raise ValueError("Model must be fitted before making predictions")
        if hasattr(self.model, 'predict_proba'):
            return self.model.predict_proba(X)
        raise NotImplementedError("This model doesn't support probability predictions")
        
    def get_feature_importance(self) -> Optional[Dict[str, Any]]:
        """Get feature importance scores"""
        if not self.is_fitted:
            return None
        if hasattr(self.model, 'feature_importances_'):
            importances = self.model.feature_importances_
            indices = np.argsort(importances)[::-1]
            return {
                'features': [f'feature_{i}' for i in indices],
                'importance': importances[indices].tolist()
            }
        return None

class DecisionTreeWrapper(BaseModelWrapper):
    """Wrapper for Decision Tree models"""
    
    def __init__(self, task_type: str = 'classification', **kwargs):
        super().__init__(**kwargs)
        
        # Filter valid parameters
        valid_params = {}
        for param in ['criterion', 'max_depth', 'min_samples_split', 
                     'min_samples_leaf', 'max_features', 'random_state']:
            if param in kwargs:
                valid_params[param] = kwargs[param]
        
        # Set defaults
        if 'random_state' not in valid_params:
            valid_params['random_state'] = 42
            
        if task_type == 'classification':
            self.model = DecisionTreeClassifier(**valid_params)
        else:
            # For regression, criterion must be appropriate
            if 'criterion' in valid_params and valid_params['criterion'] in ['gini', 'entropy']:
                valid_params['criterion'] = 'squared_error'
            self.model = DecisionTreeRegressor(**valid_params)
            
        self.task_type = task_type

class RandomForestWrapper(BaseModelWrapper):
    """Wrapper for Random Forest models"""
    
    def __init__(self, task_type: str = 'classification', **kwargs):
        super().__init__(**kwargs)
        
        # Filter valid parameters
        valid_params = {}
        for param in ['n_estimators', 'max_depth', 'min_samples_split', 
                     'min_samples_leaf', 'max_features', 'bootstrap', 
                     'random_state', 'n_jobs']:
            if param in kwargs:
                valid_params[param] = kwargs[param]
        
        # Set defaults
        if 'random_state' not in valid_params:
            valid_params['random_state'] = 42
        if 'n_jobs' not in valid_params:
            valid_params['n_jobs'] = -1  # Use all available cores
            
        if task_type == 'classification':
            self.model = RandomForestClassifier(**valid_params)
        else:
            self.model = RandomForestRegressor(**valid_params)
            
        self.task_type = task_type 