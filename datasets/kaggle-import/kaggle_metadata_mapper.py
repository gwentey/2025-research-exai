"""
Mapper pour convertir les métadonnées Kaggle vers la table datasets complète.

Ce module s'occupe de :
1. Extraire les métadonnées de Kaggle
2. Les mapper vers TOUS les champs de la table datasets
3. Appliquer des valeurs par défaut intelligentes selon le domaine (via templates YAML)
"""

from typing import Dict, Any, List
import re
import yaml
from pathlib import Path
from datetime import datetime
import uuid


class KaggleMetadataMapper:
    """Convertit les métadonnées Kaggle vers la structure complète des datasets."""
    
    def __init__(self):
        """Initialise le mapper et charge les templates depuis le fichier YAML."""
        # Auto-initialisation des templates si nécessaire
        self._ensure_templates_initialized()
        self.templates = self._load_ethical_templates()
    
    def _ensure_templates_initialized(self):
        """S'assure que les templates sont initialisés."""
        try:
            from pathlib import Path
            import sys
            
            # Ajouter le répertoire templates au path
            templates_dir = Path(__file__).parent / "templates"
            if str(templates_dir) not in sys.path:
                sys.path.append(str(templates_dir))
            
            # Importer et exécuter l'auto-initialisation
            from auto_init import auto_initialize
            auto_initialize()
            
        except Exception as e:
            print(f"⚠️ Erreur auto-initialisation templates: {e}")
            # Continue quand même avec les templates de fallback
    
    def _load_ethical_templates(self) -> Dict[str, Any]:
        """Charge les templates éthiques depuis le fichier YAML."""
        try:
            templates_path = Path(__file__).parent / "templates" / "ethical_defaults.yaml"
            
            if templates_path.exists():
                with open(templates_path, 'r', encoding='utf-8') as f:
                    templates = yaml.safe_load(f)
                return templates
            else:
                # Fallback si fichier absent
                return self._get_fallback_templates()
                
        except Exception as e:
            print(f"⚠️ Erreur chargement templates YAML: {e}")
            return self._get_fallback_templates()
    
    def _get_fallback_templates(self) -> Dict[str, Any]:
        """Templates de secours si le fichier YAML est absent."""
        return {
            'default': {
                'ethical': {
                    'informed_consent': False,
                    'transparency': True,
                    'anonymization_applied': False,
                    'data_quality_documented': True,
                    'equity_non_discrimination': True,
                    'security_measures_in_place': True,
                    'accountability_defined': True
                },
                'technical': {
                    'representativity_level': 'medium',
                    'sample_balance_level': 'moderate'
                }
            }
        }
    
    def _get_template_for_domain(self, domain: str) -> Dict[str, Any]:
        """Récupère le template pour un domaine donné."""
        # Essayer le domaine spécifique
        if domain in self.templates:
            return self.templates[domain]
        
        # Fallback vers le template par défaut
        return self.templates.get('default', self.templates[list(self.templates.keys())[0]])
    
    def map_kaggle_to_dataset(
        self, 
        dataset_config, 
        kaggle_metadata: Dict[str, Any], 
        file_metadata: Dict[str, Any],
        storage_path: str
    ) -> Dict[str, Any]:
        """
        Mappe les métadonnées Kaggle vers TOUS les champs de la table datasets.
        
        Args:
            dataset_config: Configuration du dataset (nom, domain, etc.)
            kaggle_metadata: Métadonnées de Kaggle
            file_metadata: Métadonnées des fichiers (colonnes, tailles, etc.)
            storage_path: Chemin de stockage
            
        Returns:
            Dict contenant TOUS les champs pour créer un Dataset complet
        """
        
        # Déterminer le domaine principal
        domain_list = [dataset_config.domain] if dataset_config.domain else ['general']
        main_domain = domain_list[0]
        
        # Récupérer le template pour ce domaine depuis YAML
        template = self._get_template_for_domain(main_domain)
        
        # === IDENTIFICATION & INFORMATIONS GÉNÉRALES ===
        dataset_data = {
            'dataset_name': dataset_config.description,
            'year': self._extract_year(kaggle_metadata, dataset_config),
            'objective': self._build_objective(dataset_config, kaggle_metadata),
            'access': 'public',  # Kaggle = public
            'availability': 'online',
            'num_citations': kaggle_metadata.get('usabilityRating', 0),
            'citation_link': f"https://www.kaggle.com/datasets/{dataset_config.kaggle_ref}",
            'sources': f"Kaggle Dataset: {dataset_config.kaggle_ref}",
            'storage_uri': f"https://www.kaggle.com/datasets/{dataset_config.kaggle_ref}",
            'storage_path': storage_path,
        }
        
        # === CARACTÉRISTIQUES TECHNIQUES ===
        dataset_data.update({
            'instances_number': file_metadata.get('total_rows', 0),
            'features_number': file_metadata.get('total_columns', 0),
            'features_description': self._build_features_description(file_metadata),
            'domain': domain_list,
            'task': [dataset_config.ml_task] if dataset_config.ml_task else ['classification'],
            
            # Valeurs intelligentes basées sur l'analyse
            'representativity_description': f"Dataset from Kaggle representing {main_domain} domain data",
            'representativity_level': template['technical']['representativity_level'],
            'sample_balance_description': self._analyze_balance(file_metadata),
            'sample_balance_level': template['technical']['sample_balance_level'],
            'split': False,  # Par défaut non splitté
            
            # Analyse des valeurs manquantes
            'has_missing_values': file_metadata.get('has_missing_values', False),
            'missing_values_description': self._analyze_missing_values(file_metadata),
            'global_missing_percentage': file_metadata.get('missing_percentage', 0.0),
            'missing_values_handling_method': 'none',  # À déterminer par l'utilisateur
            
            # Facteurs temporels
            'temporal_factors': self._detect_temporal_factors(file_metadata),
            'metadata_provided_with_dataset': True,  # Kaggle fournit toujours des métadonnées
            'external_documentation_available': True,
            'documentation_link': f"https://www.kaggle.com/datasets/{dataset_config.kaggle_ref}",
        })
        
        # === CRITÈRES ÉTHIQUES (avec templates intelligents) ===
        ethical_template = template['ethical']
        dataset_data.update({
            'informed_consent': ethical_template['informed_consent'],
            'transparency': ethical_template['transparency'],
            'user_control': ethical_template.get('user_control', False),
            'equity_non_discrimination': ethical_template['equity_non_discrimination'],
            'security_measures_in_place': ethical_template['security_measures_in_place'],
            'data_quality_documented': ethical_template['data_quality_documented'],
            'data_errors_description': template.get('quality', {}).get('data_errors_description', self._analyze_data_quality(file_metadata)),
            'anonymization_applied': ethical_template['anonymization_applied'],
            'record_keeping_policy_exists': ethical_template['record_keeping_policy_exists'],
            'purpose_limitation_respected': ethical_template['purpose_limitation_respected'],
            'accountability_defined': ethical_template['accountability_defined'],
        })
        
        return dataset_data
    
    def _extract_year(self, kaggle_metadata: Dict, dataset_config) -> int:
        """Extrait l'année du dataset."""
        # Essayer d'extraire de différentes sources
        if 'lastUpdated' in kaggle_metadata:
            try:
                return datetime.fromisoformat(kaggle_metadata['lastUpdated']).year
            except:
                pass
        
        # Chercher dans le titre/description
        text = f"{dataset_config.name} {dataset_config.description}"
        years = re.findall(r'\b(20\d{2})\b', text)
        if years:
            return int(years[-1])  # Prendre la dernière année trouvée
        
        return datetime.now().year  # Par défaut année actuelle
    
    def _build_objective(self, dataset_config, kaggle_metadata: Dict) -> str:
        """Construit un objectif détaillé."""
        objective = dataset_config.description
        
        if 'subtitle' in kaggle_metadata:
            objective += f". {kaggle_metadata['subtitle']}"
        
        return objective
    
    def _build_features_description(self, file_metadata: Dict) -> str:
        """Construit une description des features."""
        if 'columns' in file_metadata and file_metadata['columns']:
            columns = file_metadata['columns'][:5]  # Premières 5 colonnes
            desc = f"Principales colonnes: {', '.join(columns)}"
            if len(file_metadata['columns']) > 5:
                desc += f" (et {len(file_metadata['columns']) - 5} autres)"
            return desc
        
        return f"Dataset avec {file_metadata.get('total_columns', 0)} colonnes"
    
    def _analyze_balance(self, file_metadata: Dict) -> str:
        """Analyse l'équilibre des échantillons."""
        # Analyse basique - pourrait être améliorée
        return "Balance des classes à vérifier selon la variable cible"
    
    def _analyze_missing_values(self, file_metadata: Dict) -> str:
        """Analyse les valeurs manquantes."""
        if file_metadata.get('has_missing_values', False):
            pct = file_metadata.get('missing_percentage', 0)
            if pct < 5:
                return f"Faible taux de valeurs manquantes ({pct:.1f}%)"
            elif pct < 20:
                return f"Taux modéré de valeurs manquantes ({pct:.1f}%)"
            else:
                return f"Taux élevé de valeurs manquantes ({pct:.1f}%)"
        
        return "Aucune valeur manquante détectée"
    
    def _detect_temporal_factors(self, file_metadata: Dict) -> bool:
        """Détecte s'il y a des facteurs temporels."""
        if 'columns' in file_metadata:
            temporal_keywords = ['date', 'time', 'year', 'month', 'day', 'timestamp']
            columns_lower = [col.lower() for col in file_metadata['columns']]
            
            return any(
                any(keyword in col for keyword in temporal_keywords)
                for col in columns_lower
            )
        
        return False
    
    def _analyze_data_quality(self, file_metadata: Dict) -> str:
        """Analyse la qualité des données."""
        issues = []
        
        if file_metadata.get('has_missing_values', False):
            issues.append("valeurs manquantes")
        
        if file_metadata.get('has_duplicates', False):
            issues.append("doublons potentiels")
        
        if not issues:
            return "Aucun problème de qualité majeur détecté"
        
        return f"Problèmes détectés: {', '.join(issues)}"


def create_complete_dataset_from_kaggle(
    dataset_config, 
    kaggle_metadata: Dict[str, Any], 
    file_metadata: Dict[str, Any],
    storage_path: str
) -> Dict[str, Any]:
    """
    Fonction principale pour créer un dataset complet depuis Kaggle.
    
    Cette fonction remplace l'ancien code qui ne remplissait que 6 champs.
    Maintenant, TOUS les champs de la table datasets sont remplis intelligemment.
    """
    mapper = KaggleMetadataMapper()
    return mapper.map_kaggle_to_dataset(
        dataset_config, 
        kaggle_metadata, 
        file_metadata, 
        storage_path
    )