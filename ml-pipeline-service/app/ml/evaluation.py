import numpy as np
import pandas as pd
from sklearn.metrics import (
    accuracy_score, precision_score, recall_score, f1_score,
    confusion_matrix, classification_report, roc_auc_score, roc_curve,
    mean_absolute_error, mean_squared_error, r2_score
)
from sklearn.model_selection import cross_val_score, StratifiedKFold, KFold
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import seaborn as sns
import io
import base64
from typing import Dict, Any, Optional, Union, List

def evaluate_classification_model(model, X_test, y_test, average='weighted') -> Dict[str, Any]:
    """
    Evaluate a classification model
    
    Returns:
        Dict with metrics: accuracy, precision, recall, f1, confusion_matrix, etc.
    """
    y_pred = model.predict(X_test)
    
    metrics = {
        'accuracy': float(accuracy_score(y_test, y_pred)),
        'precision': float(precision_score(y_test, y_pred, average=average, zero_division=0)),
        'recall': float(recall_score(y_test, y_pred, average=average, zero_division=0)),
        'f1_score': float(f1_score(y_test, y_pred, average=average, zero_division=0)),
        'confusion_matrix': confusion_matrix(y_test, y_pred).tolist()
    }
    
    # Add ROC AUC if binary classification and model supports probabilities
    if len(np.unique(y_test)) == 2 and hasattr(model, 'predict_proba'):
        try:
            y_proba = model.predict_proba(X_test)[:, 1]
            metrics['roc_auc'] = float(roc_auc_score(y_test, y_proba))
        except:
            pass
    
    # Add classification report - Convert NumPy types
    try:
        report = classification_report(y_test, y_pred, output_dict=True, zero_division=0)
        # Convertir récursivement les types NumPy dans le rapport
        def convert_numpy_recursive(obj):
            if isinstance(obj, np.number):
                return float(obj)
            elif isinstance(obj, dict):
                return {k: convert_numpy_recursive(v) for k, v in obj.items()}
            elif isinstance(obj, list):
                return [convert_numpy_recursive(item) for item in obj]
            else:
                return obj
        metrics['classification_report'] = convert_numpy_recursive(report)
    except:
        pass
    
    return metrics

def evaluate_regression_model(model, X_test, y_test) -> Dict[str, Any]:
    """
    Evaluate a regression model
    
    Returns:
        Dict with metrics: mae, mse, rmse, r2
    """
    y_pred = model.predict(X_test)
    
    metrics = {
        'mae': float(mean_absolute_error(y_test, y_pred)),
        'mse': float(mean_squared_error(y_test, y_pred)),
        'rmse': float(np.sqrt(mean_squared_error(y_test, y_pred))),
        'r2': float(r2_score(y_test, y_pred))
    }
    
    return metrics

def evaluate_model(model, X_test, y_test, task_type='classification') -> Dict[str, Any]:
    """
    Evaluate a model based on task type
    """
    if task_type == 'classification':
        return evaluate_classification_model(model, X_test, y_test)
    else:
        return evaluate_regression_model(model, X_test, y_test)

def cross_validate_model(model, X, y, task_type='classification', cv=5) -> Dict[str, Any]:
    """
    Perform cross-validation
    """
    if task_type == 'classification':
        cv_strategy = StratifiedKFold(n_splits=cv, shuffle=True, random_state=42)
        scoring = 'accuracy'
    else:
        cv_strategy = KFold(n_splits=cv, shuffle=True, random_state=42)
        scoring = 'neg_mean_squared_error'
    
    scores = cross_val_score(model, X, y, cv=cv_strategy, scoring=scoring)
    
    return {
        'cv_scores': scores.tolist(),
        'cv_mean': float(scores.mean()),
        'cv_std': float(scores.std())
    }

def plot_confusion_matrix(y_true, y_pred, labels=None) -> str:
    """
    Plot confusion matrix and return as base64 encoded image
    """
    cm = confusion_matrix(y_true, y_pred)
    
    plt.figure(figsize=(8, 6))
    sns.heatmap(cm, annot=True, fmt='d', cmap='Blues', 
                xticklabels=labels, yticklabels=labels)
    plt.title('Matrice de Confusion')
    plt.ylabel('Vraie Classe')
    plt.xlabel('Classe Prédite')
    
    # Save to buffer
    buffer = io.BytesIO()
    plt.savefig(buffer, format='png', dpi=150, bbox_inches='tight')
    plt.close()
    
    # Encode to base64
    buffer.seek(0)
    image_base64 = base64.b64encode(buffer.getvalue()).decode()
    
    return image_base64

def plot_feature_importance(feature_importance: Dict[str, float], top_n=20) -> str:
    """
    Plot feature importance and return as base64 encoded image
    """
    # Sort features by importance
    sorted_features = sorted(feature_importance.items(), key=lambda x: x[1], reverse=True)[:top_n]
    features, importance = zip(*sorted_features) if sorted_features else ([], [])
    
    plt.figure(figsize=(10, 8))
    y_pos = np.arange(len(features))
    plt.barh(y_pos, importance, align='center')
    plt.yticks(y_pos, features)
    plt.xlabel('Importance')
    plt.title(f'Top {top_n} Features les Plus Importantes')
    plt.tight_layout()
    
    # Save to buffer
    buffer = io.BytesIO()
    plt.savefig(buffer, format='png', dpi=150, bbox_inches='tight')
    plt.close()
    
    # Encode to base64
    buffer.seek(0)
    image_base64 = base64.b64encode(buffer.getvalue()).decode()
    
    return image_base64

def plot_roc_curve(y_true, y_scores) -> str:
    """
    Plot ROC curve for binary classification
    """
    fpr, tpr, _ = roc_curve(y_true, y_scores)
    roc_auc = roc_auc_score(y_true, y_scores)
    
    plt.figure(figsize=(8, 6))
    plt.plot(fpr, tpr, color='darkorange', lw=2, 
             label=f'Courbe ROC (AUC = {roc_auc:.2f})')
    plt.plot([0, 1], [0, 1], color='navy', lw=2, linestyle='--')
    plt.xlim([0.0, 1.0])
    plt.ylim([0.0, 1.05])
    plt.xlabel('Taux de Faux Positifs')
    plt.ylabel('Taux de Vrais Positifs')
    plt.title('Courbe ROC (Receiver Operating Characteristic)')
    plt.legend(loc="lower right")
    
    # Save to buffer
    buffer = io.BytesIO()
    plt.savefig(buffer, format='png', dpi=150, bbox_inches='tight')
    plt.close()
    
    # Encode to base64
    buffer.seek(0)
    image_base64 = base64.b64encode(buffer.getvalue()).decode()
    
    return image_base64

def plot_regression_results(y_true, y_pred) -> str:
    """
    Plot regression results: actual vs predicted
    """
    plt.figure(figsize=(8, 6))
    plt.scatter(y_true, y_pred, alpha=0.5)
    plt.plot([y_true.min(), y_true.max()], [y_true.min(), y_true.max()], 
             'r--', lw=2)
    plt.xlabel('Valeurs Réelles')
    plt.ylabel('Valeurs Prédites')
    plt.title('Prédictions vs Valeurs Réelles')
    
    # Save to buffer
    buffer = io.BytesIO()
    plt.savefig(buffer, format='png', dpi=150, bbox_inches='tight')
    plt.close()
    
    # Encode to base64
    buffer.seek(0)
    image_base64 = base64.b64encode(buffer.getvalue()).decode()
    
    return image_base64

def generate_visualizations(model, X_test, y_test, feature_names=None, 
                          task_type='classification') -> Dict[str, Dict[str, str]]:
    """
    Generate all visualizations for the model
    
    Returns:
        Dict with visualization names as keys and dict with 'image' key containing base64 data
    """
    visualizations = {}
    
    try:
        if task_type == 'classification':
            # Confusion matrix
            y_pred = model.predict(X_test)
            cm_image = plot_confusion_matrix(y_test, y_pred)
            visualizations['confusion_matrix'] = {'image': cm_image}
            
            # ROC curve for binary classification
            if len(np.unique(y_test)) == 2 and hasattr(model, 'predict_proba'):
                y_scores = model.predict_proba(X_test)[:, 1]
                roc_image = plot_roc_curve(y_test, y_scores)
                visualizations['roc_curve'] = {'image': roc_image}
        else:
            # Regression plots
            y_pred = model.predict(X_test)
            reg_image = plot_regression_results(y_test, y_pred)
            visualizations['regression_plot'] = {'image': reg_image}
        
        # Feature importance
        if hasattr(model, 'get_feature_importance'):
            importance_data = model.get_feature_importance()
            if importance_data is not None:
                features = importance_data.get('features', [])
                importance = importance_data.get('importance', [])
                
                # Use actual feature names if provided
                if feature_names is not None and len(feature_names) == len(features):
                    feature_importance_dict = dict(zip(feature_names, importance))
                else:
                    feature_importance_dict = dict(zip(features, importance))
                
                if feature_importance_dict:
                    fi_image = plot_feature_importance(feature_importance_dict)
                    visualizations['feature_importance'] = {'image': fi_image}
    
    except Exception as e:
        print(f"Error generating visualizations: {str(e)}")
    
    return visualizations 