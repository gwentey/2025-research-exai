"""
Gère le chargement des métadonnées enrichies spécifiques par dataset.

Ce module remplace l'ancien système de templates génériques par un système
de métadonnées spécifiques stockées dans des fichiers JSON.
"""
import json
import logging
from pathlib import Path
from typing import Dict, Any, Optional
from datetime import datetime

logger = logging.getLogger(__name__)

try:
    import jsonschema
    HAS_JSONSCHEMA = True
except ImportError:
    HAS_JSONSCHEMA = False
    logger.warning("jsonschema non disponible - validation de schéma désactivée")


class DatasetMetadataLoader:
    """Charge les métadonnées enrichies spécifiques depuis les fichiers JSON."""
    
    def __init__(self):
        """Initialise le loader avec les chemins vers les métadonnées."""
        # Chemin vers le répertoire des métadonnées enrichies
        self.metadata_dir = Path(__file__).parent.parent / "enriched_metadata"
        self.datasets_dir = self.metadata_dir / "datasets"
        self.templates_dir = self.metadata_dir / "templates"
        self.schema_path = self.metadata_dir / "schema.json"
        
        # Charger le schéma de validation
        self._schema = self._load_validation_schema()
        
        logger.info(f"DatasetMetadataLoader initialisé avec répertoire: {self.metadata_dir}")
    
    def _load_validation_schema(self) -> Dict[str, Any]:
        """Charge le schéma de validation JSON."""
        try:
            if self.schema_path.exists():
                with open(self.schema_path, 'r', encoding='utf-8') as f:
                    schema = json.load(f)
                logger.info("Schéma de validation chargé avec succès")
                return schema
            else:
                logger.warning(f"Fichier de schéma non trouvé: {self.schema_path}")
                return {}
        except Exception as e:
            logger.error(f"Erreur lors du chargement du schéma: {e}")
            return {}
    
    def load_dataset_metadata(self, dataset_name: str) -> Dict[str, Any]:
        """
        Charge les métadonnées enrichies pour un dataset spécifique.
        
        Args:
            dataset_name: Nom du dataset (clé dans kaggle_datasets_config.yaml)
            
        Returns:
            Dict contenant les métadonnées enrichies prêtes pour l'insertion
            
        Raises:
            FileNotFoundError: Si le fichier de métadonnées n'existe pas
            ValueError: Si les métadonnées sont invalides
        """
        logger.info(f"Chargement des métadonnées pour le dataset: {dataset_name}")
        
        # Chemin vers le fichier de métadonnées spécifique
        metadata_file = self.datasets_dir / f"{dataset_name}.json"
        
        if not metadata_file.exists():
            error_msg = f"Fichier de métadonnées non trouvé: {metadata_file}"
            logger.error(error_msg)
            raise FileNotFoundError(error_msg)
        
        try:
            # Charger le fichier JSON
            with open(metadata_file, 'r', encoding='utf-8') as f:
                metadata_content = json.load(f)
            
            # Valider contre le schéma
            self._validate_metadata(metadata_content, dataset_name)
            
            # Extraire les métadonnées enrichies
            enriched_metadata = metadata_content.get('enriched_metadata', {})
            
            # Effectuer les transformations nécessaires
            processed_metadata = self._process_metadata(enriched_metadata)
            
            logger.info(f"✅ Métadonnées chargées avec succès pour {dataset_name} ({len(processed_metadata)} champs)")
            return processed_metadata
            
        except json.JSONDecodeError as e:
            error_msg = f"Erreur de parsing JSON pour {dataset_name}: {e}"
            logger.error(error_msg)
            raise ValueError(error_msg)
        except Exception as e:
            error_msg = f"Erreur lors du chargement des métadonnées pour {dataset_name}: {e}"
            logger.error(error_msg)
            raise
    
    def _validate_metadata(self, metadata_content: Dict[str, Any], dataset_name: str) -> None:
        """Valide les métadonnées contre le schéma JSON."""
        if not self._schema:
            logger.warning("Aucun schéma de validation disponible - validation ignorée")
            return
        
        if not HAS_JSONSCHEMA:
            logger.warning("jsonschema non disponible - validation de schéma ignorée")
            return
        
        try:
            jsonschema.validate(metadata_content, self._schema)
            logger.debug(f"Validation réussie pour {dataset_name}")
        except jsonschema.ValidationError as e:
            error_msg = f"Métadonnées invalides pour {dataset_name}: {e.message}"
            logger.error(error_msg)
            raise ValueError(error_msg)
        except Exception as e:
            logger.warning(f"Erreur lors de la validation pour {dataset_name}: {e}")
    
    def _process_metadata(self, enriched_metadata: Dict[str, Any]) -> Dict[str, Any]:
        """
        Traite et nettoie les métadonnées pour l'insertion en base.
        
        - Convertit les types si nécessaire
        - Supprime les champs vides ou None
        - Applique des transformations spécifiques
        """
        processed = {}
        
        for key, value in enriched_metadata.items():
            # Ignorer les valeurs null explicites ou les chaînes vides de template
            if value is None or value == "" or (isinstance(value, str) and value.startswith("FILL_")):
                continue
            
            # Traitement spécifique par type de champ
            if key in ['domain', 'task'] and isinstance(value, list):
                # S'assurer que les listes ne sont pas vides
                if value:
                    processed[key] = value
            elif key in ['year'] and isinstance(value, int):
                # Valider l'année
                if 1900 <= value <= 2100:
                    processed[key] = value
            elif key in ['global_missing_percentage'] and isinstance(value, (int, float)):
                # Valider les pourcentages
                if 0 <= value <= 100:
                    processed[key] = float(value)
            elif key in ['num_citations', 'instances_number', 'features_number'] and isinstance(value, int):
                # S'assurer que les entiers sont positifs
                if value >= 0:
                    processed[key] = value
            else:
                # Garder la valeur telle quelle pour les autres champs
                processed[key] = value
        
        return processed
    
    def dataset_metadata_exists(self, dataset_name: str) -> bool:
        """Vérifie si un fichier de métadonnées existe pour un dataset."""
        metadata_file = self.datasets_dir / f"{dataset_name}.json"
        return metadata_file.exists()
    
    def get_available_datasets(self) -> list[str]:
        """Retourne la liste des datasets pour lesquels des métadonnées sont disponibles."""
        if not self.datasets_dir.exists():
            return []
        
        dataset_files = self.datasets_dir.glob("*.json")
        return [f.stem for f in dataset_files]
    
    def load_template_metadata(self, domain: str = "default") -> Dict[str, Any]:
        """
        Charge un template de métadonnées pour un domaine donné.
        
        Args:
            domain: Domaine pour lequel charger le template
            
        Returns:
            Dict contenant le template de métadonnées
        """
        template_file = self.templates_dir / f"{domain}_template.json"
        
        if not template_file.exists():
            # Fallback vers le template par défaut
            template_file = self.templates_dir / "default_template.json"
            
        if not template_file.exists():
            logger.error(f"Aucun template trouvé pour le domaine {domain}")
            raise FileNotFoundError(f"Template {domain} non trouvé")
        
        try:
            with open(template_file, 'r', encoding='utf-8') as f:
                template_content = json.load(f)
            
            logger.info(f"Template chargé pour le domaine: {domain}")
            return template_content
            
        except Exception as e:
            logger.error(f"Erreur lors du chargement du template {domain}: {e}")
            raise
    
    def create_metadata_from_template(
        self, 
        dataset_name: str, 
        domain: str = "default",
        kaggle_ref: str = "",
        **overrides
    ) -> Dict[str, Any]:
        """
        Crée des métadonnées en se basant sur un template et des overrides.
        
        Args:
            dataset_name: Nom du dataset
            domain: Domaine pour le template de base
            kaggle_ref: Référence Kaggle du dataset
            **overrides: Champs à remplacer dans le template
            
        Returns:
            Dict contenant les métadonnées créées
        """
        # Charger le template de base
        template = self.load_template_metadata(domain)
        
        # Mettre à jour les informations de base
        template['dataset_info']['name'] = dataset_name
        if kaggle_ref:
            template['dataset_info']['kaggle_ref'] = kaggle_ref
            template['enriched_metadata']['storage_uri'] = f"https://www.kaggle.com/datasets/{kaggle_ref}"
            template['enriched_metadata']['documentation_link'] = f"https://www.kaggle.com/datasets/{kaggle_ref}"
        
        # Appliquer les overrides
        for key, value in overrides.items():
            if key in template['enriched_metadata']:
                template['enriched_metadata'][key] = value
        
        return template


class MetadataValidationError(Exception):
    """Exception levée lors d'erreurs de validation des métadonnées."""
    pass