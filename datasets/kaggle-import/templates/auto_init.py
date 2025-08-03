#!/usr/bin/env python3
"""
Auto-initialisation des templates éthiques.

Ce script est appelé automatiquement au démarrage pour s'assurer que
le fichier de templates éthiques existe avec des valeurs par défaut.
"""

import yaml
from pathlib import Path
import logging

# Configuration du logger
logger = logging.getLogger(__name__)

def ensure_templates_file_exists():
    """S'assure que le fichier de templates éthiques existe."""
    
    templates_path = Path(__file__).parent / "ethical_defaults.yaml"
    
    # Si le fichier existe déjà, ne rien faire
    if templates_path.exists():
        logger.info(f"✅ Fichier de templates trouvé: {templates_path}")
        return True
    
    logger.info(f"📝 Création du fichier de templates par défaut: {templates_path}")
    
    # Créer le contenu par défaut
    default_content = get_default_templates_content()
    
    try:
        # Créer le répertoire si nécessaire
        templates_path.parent.mkdir(parents=True, exist_ok=True)
        
        # Écrire le fichier
        with open(templates_path, 'w', encoding='utf-8') as f:
            f.write(default_content)
        
        logger.info(f"✅ Fichier de templates créé avec succès")
        return True
        
    except Exception as e:
        logger.error(f"❌ Erreur lors de la création du fichier de templates: {e}")
        return False


def get_default_templates_content() -> str:
    """Retourne le contenu par défaut du fichier de templates."""
    
    return """# =====================================
# TEMPLATES DE MÉTADONNÉES ÉTHIQUES
# =====================================
# 
# Ce fichier est géré automatiquement par l'interface web d'administration.
# Modifiez les templates via : /admin/ethical-templates
#
# Dernière mise à jour : Généré automatiquement

# Template par défaut (fallback)
default:
  ethical:
    informed_consent: false
    transparency: true
    user_control: false
    equity_non_discrimination: true
    security_measures_in_place: true
    data_quality_documented: true
    anonymization_applied: false
    record_keeping_policy_exists: true
    purpose_limitation_respected: true
    accountability_defined: true
  technical:
    representativity_level: "medium"
    sample_balance_level: "moderate"
  quality:
    data_errors_description: "Qualité à vérifier selon la source"

# Template pour domaine ÉDUCATION
education:
  ethical:
    informed_consent: true   # Recherche = consentement éclairé
    transparency: true       # Recherche = transparence obligatoire
    user_control: false     # Kaggle = pas de contrôle post-publication
    equity_non_discrimination: true  # Éducation = équité prioritaire
    security_measures_in_place: true
    data_quality_documented: true   # Recherche = qualité documentée
    anonymization_applied: true     # Éducation = anonymisation standard
    record_keeping_policy_exists: true
    purpose_limitation_respected: true  # Recherche = usage spécifique
    accountability_defined: true
  technical:
    representativity_level: "high"     # Recherche = échantillons représentatifs
    sample_balance_level: "balanced"   # Études = équilibre recherché
  quality:
    data_errors_description: "Dataset éducatif - qualité académique attendue"

# Template pour domaine SANTÉ
healthcare:
  ethical:
    informed_consent: true   # Santé = consentement OBLIGATOIRE
    transparency: true       # Santé = transparence éthique critique
    user_control: true      # Santé = contrôle utilisateur important
    equity_non_discrimination: true  # Santé = équité vitale
    security_measures_in_place: true  # Santé = sécurité renforcée
    data_quality_documented: true     # Santé = qualité vitale
    anonymization_applied: true       # Santé = anonymisation OBLIGATOIRE
    record_keeping_policy_exists: true
    purpose_limitation_respected: true # Santé = usage strictement défini
    accountability_defined: true
  technical:
    representativity_level: "high"     # Santé = représentativité critique
    sample_balance_level: "moderate"   # Santé = équilibre selon pathologies
  quality:
    data_errors_description: "Dataset santé - qualité médicale vérifiée obligatoire"

# Template pour domaine BUSINESS
business:
  ethical:
    informed_consent: false  # Business = souvent données publiques
    transparency: true       # Business = processus documentés
    user_control: false
    equity_non_discrimination: true  # Business = éviter discrimination commerciale
    security_measures_in_place: true
    data_quality_documented: true
    anonymization_applied: false    # Business = souvent données agrégées
    record_keeping_policy_exists: true
    purpose_limitation_respected: true
    accountability_defined: true
  technical:
    representativity_level: "high"      # Business = échantillons complets
    sample_balance_level: "imbalanced"  # Business = déséquilibres naturels
  quality:
    data_errors_description: "Dataset business - vérifier cohérence métiers"
"""


def validate_templates_file():
    """Valide que le fichier de templates est correct."""
    
    templates_path = Path(__file__).parent / "ethical_defaults.yaml"
    
    if not templates_path.exists():
        return False, "Fichier de templates non trouvé"
    
    try:
        with open(templates_path, 'r', encoding='utf-8') as f:
            templates = yaml.safe_load(f)
        
        # Vérifications basiques
        if not isinstance(templates, dict):
            return False, "Structure YAML invalide"
        
        if 'default' not in templates:
            return False, "Template 'default' manquant"
        
        # Vérifier que chaque template a les sections requises
        for domain, template in templates.items():
            if 'ethical' not in template:
                return False, f"Section 'ethical' manquante pour {domain}"
            
            if 'technical' not in template:
                return False, f"Section 'technical' manquante pour {domain}"
        
        return True, f"Fichier valide avec {len(templates)} templates"
        
    except yaml.YAMLError as e:
        return False, f"Erreur YAML: {e}"
    except Exception as e:
        return False, f"Erreur de validation: {e}"


def auto_initialize():
    """Fonction principale d'auto-initialisation."""
    
    logger.info("🚀 Auto-initialisation des templates éthiques...")
    
    # 1. S'assurer que le fichier existe
    if not ensure_templates_file_exists():
        logger.error("❌ Échec de la création du fichier de templates")
        return False
    
    # 2. Valider le fichier
    is_valid, message = validate_templates_file()
    if not is_valid:
        logger.error(f"❌ Fichier de templates invalide: {message}")
        # Tenter de recréer le fichier
        logger.info("🔄 Tentative de recréation du fichier...")
        Path(__file__).parent / "ethical_defaults.yaml".unlink(missing_ok=True)
        return ensure_templates_file_exists()
    
    logger.info(f"✅ Templates éthiques prêts: {message}")
    return True


if __name__ == "__main__":
    # Exécution directe du script
    import sys
    
    success = auto_initialize()
    sys.exit(0 if success else 1)