#!/usr/bin/env python3
"""
CLI pour gérer les métadonnées enrichies des datasets.

Ce script permet de :
- Valider les fichiers de métadonnées existants
- Générer des nouveaux fichiers à partir de templates
- Lister les datasets disponibles
- Vérifier la conformité avec le schéma
"""

import argparse
import json
import sys
from pathlib import Path
from typing import Dict, Any, List
import yaml
import logging

# Configuration du logging
logging.basicConfig(level=logging.INFO, format='%(levelname)s: %(message)s')
logger = logging.getLogger(__name__)

# Ajout du chemin pour les imports
sys.path.insert(0, str(Path(__file__).parent))

from importer_lib.metadata_loader import DatasetMetadataLoader, MetadataValidationError


class MetadataManager:
    """Gestionnaire CLI pour les métadonnées enrichies."""
    
    def __init__(self):
        """Initialise le gestionnaire."""
        self.loader = DatasetMetadataLoader()
        self.config_file = Path(__file__).parent / "kaggle_datasets_config.yaml"
        
    def validate_all(self) -> bool:
        """Valide tous les fichiers de métadonnées disponibles."""
        logger.info("🔍 Validation de tous les fichiers de métadonnées...")
        
        datasets = self.loader.get_available_datasets()
        if not datasets:
            logger.warning("Aucun fichier de métadonnées trouvé")
            return True
        
        errors = []
        
        for dataset_name in datasets:
            try:
                metadata = self.loader.load_dataset_metadata(dataset_name)
                logger.info(f"✅ {dataset_name}: OK ({len(metadata)} champs)")
            except Exception as e:
                error_msg = f"❌ {dataset_name}: {e}"
                logger.error(error_msg)
                errors.append(error_msg)
        
        if errors:
            logger.error(f"\\n{'='*50}")
            logger.error(f"ERREURS DE VALIDATION ({len(errors)}):")
            for error in errors:
                logger.error(f"  {error}")
            return False
        
        logger.info(f"\\n✅ Tous les fichiers sont valides ({len(datasets)} datasets)")
        return True
    
    def validate_single(self, dataset_name: str) -> bool:
        """Valide un fichier de métadonnées spécifique."""
        logger.info(f"🔍 Validation du dataset: {dataset_name}")
        
        try:
            metadata = self.loader.load_dataset_metadata(dataset_name)
            logger.info(f"✅ {dataset_name}: OK ({len(metadata)} champs)")
            
            # Afficher un résumé des métadonnées
            logger.info("\\n📋 Résumé des métadonnées:")
            logger.info(f"  - Nom: {metadata.get('dataset_name', 'N/A')}")
            logger.info(f"  - Domaine: {metadata.get('domain', 'N/A')}")
            logger.info(f"  - Tâche: {metadata.get('task', 'N/A')}")
            logger.info(f"  - Instances: {metadata.get('instances_number', 'N/A')}")
            logger.info(f"  - Features: {metadata.get('features_number', 'N/A')}")
            
            return True
            
        except Exception as e:
            logger.error(f"❌ Erreur de validation pour {dataset_name}: {e}")
            return False
    
    def list_datasets(self):
        """Liste tous les datasets configurés et leur statut."""
        logger.info("📋 Liste des datasets:")
        
        # Charger la configuration
        try:
            with open(self.config_file, 'r', encoding='utf-8') as f:
                config = yaml.safe_load(f)
            configured_datasets = list(config.get('datasets', {}).keys())
        except Exception as e:
            logger.error(f"Erreur lors du chargement de la configuration: {e}")
            configured_datasets = []
        
        # Récupérer les métadonnées disponibles
        available_datasets = self.loader.get_available_datasets()
        
        logger.info(f"\\n{'Dataset':<25} {'Configuré':<10} {'Métadonnées':<12} {'Statut'}")
        logger.info("="*70)
        
        all_datasets = set(configured_datasets + available_datasets)
        
        for dataset in sorted(all_datasets):
            configured = "✅" if dataset in configured_datasets else "❌"
            has_metadata = "✅" if dataset in available_datasets else "❌"
            
            if dataset in configured_datasets and dataset in available_datasets:
                status = "✅ Prêt"
            elif dataset in configured_datasets:
                status = "⚠️ Manque métadonnées"
            else:
                status = "⚠️ Non configuré"
            
            logger.info(f"{dataset:<25} {configured:<10} {has_metadata:<12} {status}")
    
    def generate_metadata_from_template(
        self, 
        dataset_name: str, 
        domain: str = "default",
        kaggle_ref: str = "",
        force: bool = False
    ) -> bool:
        """Génère un fichier de métadonnées à partir d'un template."""
        
        metadata_file = self.loader.datasets_dir / f"{dataset_name}.json"
        
        if metadata_file.exists() and not force:
            logger.error(f"❌ Le fichier {metadata_file} existe déjà. Utilisez --force pour l'écraser.")
            return False
        
        try:
            # Créer les métadonnées à partir du template
            metadata = self.loader.create_metadata_from_template(
                dataset_name=dataset_name,
                domain=domain,
                kaggle_ref=kaggle_ref
            )
            
            # Créer le répertoire si nécessaire
            metadata_file.parent.mkdir(parents=True, exist_ok=True)
            
            # Sauvegarder le fichier
            with open(metadata_file, 'w', encoding='utf-8') as f:
                json.dump(metadata, f, indent=2, ensure_ascii=False)
            
            logger.info(f"✅ Fichier généré: {metadata_file}")
            logger.info(f"📝 Vous devez maintenant éditer le fichier pour remplir les champs FILL_*")
            
            return True
            
        except Exception as e:
            logger.error(f"❌ Erreur lors de la génération: {e}")
            return False
    
    def show_template_fields(self):
        """Affiche les champs qui doivent être remplis dans les templates."""
        logger.info("📝 Champs à remplir dans les templates:")
        logger.info("")
        
        template_fields = [
            "FILL_DATASET_TITLE",
            "FILL_SPECIFIC_OBJECTIVE",
            "FILL_SOURCE_DESCRIPTION", 
            "FILL_FEATURES_DESCRIPTION",
            "FILL_REPRESENTATIVITY_ANALYSIS",
            "FILL_BALANCE_ANALYSIS",
            "FILL_MISSING_VALUES_ANALYSIS",
            "FILL_DATA_QUALITY_ANALYSIS",
        ]
        
        for field in template_fields:
            logger.info(f"  - {field}")
        
        logger.info("")
        logger.info("💡 Conseils:")
        logger.info("  - Utilisez des descriptions spécifiques et détaillées")
        logger.info("  - Basez-vous sur la documentation Kaggle du dataset")
        logger.info("  - Vérifiez les métadonnées avec: python metadata_manager.py validate <dataset>")
    
    def check_missing_fields(self, dataset_name: str) -> bool:
        """Vérifie s'il y a des champs FILL_* non remplis."""
        try:
            metadata_file = self.loader.datasets_dir / f"{dataset_name}.json"
            
            if not metadata_file.exists():
                logger.error(f"❌ Fichier non trouvé: {metadata_file}")
                return False
            
            with open(metadata_file, 'r', encoding='utf-8') as f:
                content = f.read()
            
            # Chercher les champs FILL_*
            import re
            fill_fields = re.findall(r'"(FILL_[^"]*)"', content)
            
            if fill_fields:
                logger.warning(f"⚠️ Champs non remplis dans {dataset_name}:")
                for field in fill_fields:
                    logger.warning(f"  - {field}")
                return False
            else:
                logger.info(f"✅ Tous les champs sont remplis dans {dataset_name}")
                return True
                
        except Exception as e:
            logger.error(f"❌ Erreur lors de la vérification: {e}")
            return False


def main():
    """Point d'entrée principal du CLI."""
    parser = argparse.ArgumentParser(
        description="Gestionnaire CLI pour les métadonnées enrichies des datasets IBIS-X",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Exemples d'utilisation:
  python metadata_manager.py list                              # Lister tous les datasets
  python metadata_manager.py validate                          # Valider tous les fichiers
  python metadata_manager.py validate student_performance      # Valider un dataset spécifique
  python metadata_manager.py generate new_dataset --domain education --kaggle-ref user/dataset
  python metadata_manager.py check-fills student_performance   # Vérifier les champs non remplis
  python metadata_manager.py show-fields                       # Afficher les champs de template
        """
    )
    
    subparsers = parser.add_subparsers(dest='command', help='Commandes disponibles')
    
    # Commande list
    subparsers.add_parser('list', help='Lister tous les datasets et leur statut')
    
    # Commande validate
    validate_parser = subparsers.add_parser('validate', help='Valider les métadonnées')
    validate_parser.add_argument('dataset', nargs='?', help='Dataset spécifique à valider (optionnel)')
    
    # Commande generate
    generate_parser = subparsers.add_parser('generate', help='Générer un fichier de métadonnées')
    generate_parser.add_argument('dataset_name', help='Nom du dataset')
    generate_parser.add_argument('--domain', default='default', help='Domaine pour le template (default: default)')
    generate_parser.add_argument('--kaggle-ref', default='', help='Référence Kaggle (user/dataset-name)')
    generate_parser.add_argument('--force', action='store_true', help='Écraser le fichier existant')
    
    # Commande check-fills
    check_parser = subparsers.add_parser('check-fills', help='Vérifier les champs FILL_* non remplis')
    check_parser.add_argument('dataset_name', help='Nom du dataset')
    
    # Commande show-fields
    subparsers.add_parser('show-fields', help='Afficher les champs de template à remplir')
    
    args = parser.parse_args()
    
    if not args.command:
        parser.print_help()
        return
    
    manager = MetadataManager()
    
    try:
        if args.command == 'list':
            manager.list_datasets()
            
        elif args.command == 'validate':
            if args.dataset:
                success = manager.validate_single(args.dataset)
            else:
                success = manager.validate_all()
            sys.exit(0 if success else 1)
            
        elif args.command == 'generate':
            success = manager.generate_metadata_from_template(
                args.dataset_name,
                args.domain,
                args.kaggle_ref,
                args.force
            )
            sys.exit(0 if success else 1)
            
        elif args.command == 'check-fills':
            success = manager.check_missing_fields(args.dataset_name)
            sys.exit(0 if success else 1)
            
        elif args.command == 'show-fields':
            manager.show_template_fields()
            
    except KeyboardInterrupt:
        logger.info("\\n⏹️ Opération interrompue par l'utilisateur")
        sys.exit(1)
    except Exception as e:
        logger.error(f"❌ Erreur inattendue: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()