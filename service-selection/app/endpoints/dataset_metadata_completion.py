"""
Endpoints pour compléter les métadonnées des datasets après import.

Ce module offre une interface simple pour :
1. Voir quels champs sont vides/à vérifier
2. Compléter les métadonnées manquantes
3. Valider les métadonnées existantes
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional, Dict

from app.database import get_db
from app.models import Dataset
from app.schemas import DatasetRead, DatasetUpdate


router = APIRouter(prefix="/api/datasets/metadata", tags=["metadata-completion"])


@router.get("/{dataset_id}/completion-status")
def get_completion_status(dataset_id: str, db: Session = Depends(get_db)):
    """
    Retourne le statut de complétude des métadonnées d'un dataset.
    
    Indique quels champs sont vides, lesquels ont des valeurs par défaut,
    et lesquels nécessitent une validation humaine.
    """
    dataset = db.query(Dataset).filter(Dataset.id == dataset_id).first()
    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset non trouvé")
    
    # Champs obligatoires pour la validation
    required_fields = {
        'ethical': [
            'informed_consent',
            'transparency', 
            'anonymization_applied',
            'data_quality_documented'
        ],
        'technical': [
            'instances_number',
            'features_number',
            'domain',
            'task'
        ],
        'general': [
            'dataset_name',
            'objective',
            'sources'
        ]
    }
    
    # Analyser la complétude
    completion_status = {
        'overall_completion': 0,
        'missing_fields': [],
        'default_values': [],
        'needs_review': [],
        'complete_fields': []
    }
    
    total_fields = 0
    complete_fields = 0
    
    # Vérifier chaque catégorie
    for category, fields in required_fields.items():
        for field in fields:
            total_fields += 1
            value = getattr(dataset, field, None)
            
            if value is None or value == '' or value == []:
                completion_status['missing_fields'].append({
                    'field': field,
                    'category': category,
                    'description': get_field_description(field)
                })
            elif is_default_value(field, value):
                completion_status['default_values'].append({
                    'field': field,
                    'category': category,
                    'value': value,
                    'description': get_field_description(field)
                })
                complete_fields += 0.5  # Demi-point pour valeur par défaut
            else:
                completion_status['complete_fields'].append({
                    'field': field,
                    'category': category,
                    'value': value
                })
                complete_fields += 1
    
    # Champs spéciaux qui nécessitent toujours une révision humaine
    review_fields = [
        'informed_consent',
        'anonymization_applied', 
        'equity_non_discrimination'
    ]
    
    for field in review_fields:
        value = getattr(dataset, field, None)
        if value is not None:
            completion_status['needs_review'].append({
                'field': field,
                'value': value,
                'reason': 'Validation humaine requise pour ce critère éthique'
            })
    
    completion_status['overall_completion'] = int((complete_fields / total_fields) * 100)
    
    return completion_status


@router.get("/{dataset_id}/metadata-form")
def get_metadata_form(dataset_id: str, db: Session = Depends(get_db)):
    """
    Retourne un formulaire pré-rempli pour compléter les métadonnées.
    
    Structure le formulaire par sections pour faciliter la saisie.
    """
    dataset = db.query(Dataset).filter(Dataset.id == dataset_id).first()
    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset non trouvé")
    
    # Structurer le formulaire par sections
    form_structure = {
        'dataset_info': {
            'title': 'Informations Générales',
            'fields': [
                {
                    'name': 'dataset_name',
                    'label': 'Nom du Dataset',
                    'type': 'text',
                    'required': True,
                    'current_value': dataset.dataset_name,
                    'help': 'Nom descriptif et unique du dataset'
                },
                {
                    'name': 'objective',
                    'label': 'Objectif',
                    'type': 'textarea',
                    'required': True,
                    'current_value': dataset.objective,
                    'help': 'Description de l\'objectif et du contexte du dataset'
                },
                {
                    'name': 'domain',
                    'label': 'Domaines',
                    'type': 'multi-select',
                    'required': True,
                    'current_value': dataset.domain or [],
                    'options': ['education', 'healthcare', 'finance', 'social', 'business', 'technology'],
                    'help': 'Domaines d\'application (plusieurs possibles)'
                }
            ]
        },
        'technical_info': {
            'title': 'Caractéristiques Techniques',
            'fields': [
                {
                    'name': 'representativity_level',
                    'label': 'Niveau de Représentativité',
                    'type': 'select',
                    'current_value': dataset.representativity_level,
                    'options': ['high', 'medium', 'low', 'unknown'],
                    'help': 'Dans quelle mesure ce dataset représente la population cible'
                },
                {
                    'name': 'sample_balance_level',
                    'label': 'Équilibre des Classes',
                    'type': 'select',
                    'current_value': dataset.sample_balance_level,
                    'options': ['balanced', 'moderate', 'imbalanced', 'severely_imbalanced'],
                    'help': 'Distribution des classes dans le dataset'
                },
                {
                    'name': 'missing_values_handling_method',
                    'label': 'Traitement des Valeurs Manquantes',
                    'type': 'select',
                    'current_value': dataset.missing_values_handling_method,
                    'options': ['none', 'drop', 'impute_mean', 'impute_median', 'impute_mode', 'forward_fill'],
                    'help': 'Méthode recommandée pour traiter les valeurs manquantes'
                }
            ]
        },
        'ethical_criteria': {
            'title': 'Critères Éthiques (OBLIGATOIRE)',
            'fields': [
                {
                    'name': 'informed_consent',
                    'label': 'Consentement Éclairé',
                    'type': 'radio',
                    'required': True,
                    'current_value': dataset.informed_consent,
                    'options': [
                        {'value': True, 'label': 'Oui - Consentement obtenu'},
                        {'value': False, 'label': 'Non - Données publiques/anonymes'},
                        {'value': None, 'label': 'À vérifier'}
                    ],
                    'help': 'Les sujets ont-ils donné leur consentement éclairé ?'
                },
                {
                    'name': 'anonymization_applied',
                    'label': 'Anonymisation Appliquée',
                    'type': 'radio',
                    'required': True,
                    'current_value': dataset.anonymization_applied,
                    'options': [
                        {'value': True, 'label': 'Oui - Données anonymisées'},
                        {'value': False, 'label': 'Non - Identifiants préservés'},
                        {'value': None, 'label': 'À vérifier'}
                    ],
                    'help': 'Les données personnelles ont-elles été anonymisées ?'
                },
                {
                    'name': 'transparency',
                    'label': 'Transparence',
                    'type': 'radio',
                    'required': True,
                    'current_value': dataset.transparency,
                    'options': [
                        {'value': True, 'label': 'Oui - Méthode de collecte documentée'},
                        {'value': False, 'label': 'Non - Collecte non documentée'},
                        {'value': None, 'label': 'À vérifier'}
                    ],
                    'help': 'La méthode de collecte est-elle transparente et documentée ?'
                },
                {
                    'name': 'equity_non_discrimination',
                    'label': 'Équité et Non-Discrimination',
                    'type': 'radio',
                    'required': True,
                    'current_value': dataset.equity_non_discrimination,
                    'options': [
                        {'value': True, 'label': 'Oui - Pas de biais discriminatoire'},
                        {'value': False, 'label': 'Non - Biais potentiels identifiés'},
                        {'value': None, 'label': 'À évaluer'}
                    ],
                    'help': 'Le dataset est-il exempt de biais discriminatoires ?'
                }
            ]
        }
    }
    
    return {
        'dataset_id': dataset_id,
        'dataset_name': dataset.dataset_name,
        'form_structure': form_structure,
        'completion_status': get_completion_status(dataset_id, db)
    }


@router.put("/{dataset_id}/complete")
def complete_metadata(
    dataset_id: str,
    updates: Dict,
    db: Session = Depends(get_db)
):
    """
    Met à jour les métadonnées d'un dataset.
    
    Permet de compléter les champs manquants ou corriger les valeurs existantes.
    """
    dataset = db.query(Dataset).filter(Dataset.id == dataset_id).first()
    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset non trouvé")
    
    # Valider que les champs obligatoires sont présents
    required_ethical_fields = [
        'informed_consent',
        'transparency',
        'anonymization_applied',
        'equity_non_discrimination'
    ]
    
    for field in required_ethical_fields:
        if field in updates and updates[field] is None:
            raise HTTPException(
                status_code=400,
                detail=f"Le champ éthique '{field}' est obligatoire et ne peut pas être vide"
            )
    
    # Appliquer les mises à jour
    update_count = 0
    for field, value in updates.items():
        if hasattr(dataset, field):
            setattr(dataset, field, value)
            update_count += 1
    
    db.commit()
    
    # Recalculer le statut de complétude
    new_status = get_completion_status(dataset_id, db)
    
    return {
        'message': f'{update_count} champs mis à jour avec succès',
        'completion_status': new_status,
        'dataset_id': dataset_id
    }


def get_field_description(field: str) -> str:
    """Retourne une description d'aide pour un champ."""
    descriptions = {
        'informed_consent': 'Indique si les sujets ont donné leur consentement éclairé pour l\'utilisation des données',
        'transparency': 'Documente si la méthode de collecte des données est transparente et accessible',
        'anonymization_applied': 'Précise si des techniques d\'anonymisation ont été appliquées aux données',
        'data_quality_documented': 'Indique si la qualité des données a été évaluée et documentée',
        'equity_non_discrimination': 'Évalue si le dataset est exempt de biais discriminatoires',
        'instances_number': 'Nombre total de lignes/observations dans le dataset',
        'features_number': 'Nombre total de colonnes/variables dans le dataset',
        'domain': 'Domaines d\'application du dataset (éducation, santé, finance, etc.)',
        'task': 'Types de tâches de machine learning possibles (classification, régression, etc.)'
    }
    
    return descriptions.get(field, 'Description non disponible')


def is_default_value(field: str, value) -> bool:
    """Détermine si une valeur est une valeur par défaut qui nécessite validation."""
    # Valeurs par défaut typiques qui nécessitent révision
    default_patterns = {
        'representativity_level': ['medium'],
        'sample_balance_level': ['balanced', 'moderate'],
        'informed_consent': [True],  # Vrai par défaut mais doit être vérifié
        'transparency': [True],
    }
    
    return field in default_patterns and value in default_patterns[field]