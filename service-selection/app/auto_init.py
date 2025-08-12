"""
Module d'auto-initialisation des datasets au démarrage du service.
Exécute automatiquement l'initialisation des vrais datasets si la variable 
d'environnement AUTO_INIT_DATA est définie à "true".
"""

import os
import logging
import subprocess
import asyncio
from typing import Optional
from datetime import datetime

logger = logging.getLogger(__name__)

def should_auto_init() -> bool:
    """
    Vérifie si l'auto-initialisation doit être effectuée.
    DÉSACTIVÉ par défaut - ne s'active qu'explicitement en production.
    
    Returns:
        bool: True si AUTO_INIT_DATA=true explicitement, False sinon
    """
    # Auto-init désactivé par défaut pour éviter les conflits avec make dev
    # Ne s'active qu'avec AUTO_INIT_DATA=true explicite (production Azure)
    auto_init = os.getenv("AUTO_INIT_DATA", "false").lower()
    
    # DÉSACTIVÉ TEMPORAIREMENT pour éviter les conflits avec make dev
    logger.info("🚫 Auto-init désactivé temporairement - utiliser make dev pour l'initialisation")
    return False

def check_data_already_initialized() -> bool:
    """
    Vérifie si les données ont déjà été initialisées en vérifiant 
    la présence des datasets Kaggle spécifiques.
    
    Returns:
        bool: True si au moins 5 des 7 datasets Kaggle existent, False sinon
    """
    # Variable pour forcer l'initialisation même si les données existent
    force_init = os.getenv("FORCE_INIT_DATA", "false").lower() in ("true", "1", "yes", "on")
    if force_init:
        logger.info("🔄 FORCE_INIT_DATA activé - bypass de la vérification d'initialisation")
        return False
    
    try:
        # Approche hybride pour gérer les imports en local et dans Docker
        try:
            from . import models, database
        except ImportError:
            import models, database
        
        # Vérifier la présence des datasets Kaggle spécifiques
        expected_kaggle_datasets = [
            "social_media_addiction",
            "student_performance", 
            "academic_performance",
            "student_stress",
            "student_depression",
            "riiid_answer_prediction",
            "oulad_dataset"
        ]
        
        with database.SessionLocal() as db:
            # Compter les datasets qui ont un storage_path (indicateur de datasets Kaggle réels)
            datasets_with_storage = db.query(models.Dataset).filter(
                models.Dataset.storage_path.isnot(None),
                models.Dataset.storage_path != ''
            ).count()
            
            total_datasets = db.query(models.Dataset).count()
            
            logger.info(f"Datasets avec storage_path (Kaggle): {datasets_with_storage}")
            logger.info(f"Total datasets en base: {total_datasets}")
            
            # Si on a au moins 5 des 7 datasets Kaggle, considérer comme initialisé
            return datasets_with_storage >= 5
            
    except Exception as e:
        logger.warning(f"Impossible de vérifier l'état des datasets: {e}")
        return False

async def run_data_initialization():
    """
    Lance l'initialisation des vrais datasets en arrière-plan.
    """
    try:
        logger.info("Démarrage de l'auto-initialisation des vrais datasets...")
        
        # Attendre un peu pour que les services soient complètement démarrés
        await asyncio.sleep(5)
        
        # Lancer l'import automatique des vrais datasets depuis Kaggle
        # Utiliser les mêmes variables d'environnement que le service principal
        env = os.environ.copy()
        
        # Configurer les credentials Kaggle depuis les variables d'environnement sécurisées
        kaggle_username = os.getenv("KAGGLE_USERNAME")
        kaggle_key = os.getenv("KAGGLE_KEY")
        
        if not kaggle_username or not kaggle_key:
            logger.error("Credentials Kaggle manquants. Vérifiez les variables KAGGLE_USERNAME et KAGGLE_KEY.")
            return
            
        env["KAGGLE_USERNAME"] = kaggle_username
        env["KAGGLE_KEY"] = kaggle_key
        
        # Importer TOUS les 7 vrais datasets automatiquement depuis Kaggle
        datasets_to_import = [
            "social_media_addiction",      # Students' Social Media Addiction (2025)
            "student_performance",         # Students Performance in Exams (2018)  
            "academic_performance",        # Student Academic Performance Dataset (2025)
            "student_stress",              # Student Stress Factors (2023)
            "student_depression",          # Student Depression Dataset (2024)  
            "riiid_answer_prediction",     # EdNet (Riiid Answer Correctness) (2020)
            "oulad_dataset"               # OULAD (2014)
        ]
        
        logger.info(f"Import automatique de {len(datasets_to_import)} vrais datasets depuis Kaggle...")
        
        # Importer chaque dataset
        all_success = True
        for dataset_name in datasets_to_import:
            logger.info(f"Import en cours: {dataset_name}")
            process = subprocess.Popen(
                ["python", "kaggle-import/kaggle_importer.py", "--dataset", dataset_name, "--config", "kaggle-import/kaggle_datasets_config.yaml"],
                cwd="/app",  # Répertoire de travail
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True,
                env=env  # Hérite des variables d'environnement + Kaggle
            )
            
            stdout, stderr = process.communicate()
            
            if process.returncode == 0:
                logger.info(f"✅ Dataset {dataset_name} importé avec succès")
                logger.info(f"Output: {stdout[:200]}...")  # Premiers 200 caractères
            else:
                logger.error(f"❌ Échec import dataset {dataset_name}")
                logger.error(f"Error: {stderr}")
                all_success = False
        
        # Résumé final
        if all_success:
            logger.info("🎉 Tous les vrais datasets importés avec succès depuis Kaggle")
        else:
            logger.warning("⚠️ Certains datasets n'ont pas pu être importés")
            
    except Exception as e:
        logger.error(f"Erreur lors de l'auto-initialisation: {e}")

async def auto_init_startup():
    """
    Fonction de startup pour l'auto-initialisation.
    À appeler dans un event handler FastAPI startup.
    """
    if not should_auto_init():
        logger.info("AUTO_INIT_DATA non activé - pas d'auto-initialisation")
        return
    
    # Vérification robuste anti-doublons
    if check_data_already_initialized():
        logger.info("🛡️  Données déjà initialisées - skip auto-initialisation pour éviter les doublons")
        return
    
    # Vérifier qu'on n'est pas déjà en train d'importer (protection contre double exécution)
    import tempfile
    import os
    lock_file = os.path.join(tempfile.gettempdir(), "ibis_x_auto_init.lock")
    
    if os.path.exists(lock_file):
        logger.warning("🔒 Auto-initialisation déjà en cours (fichier lock détecté)")
        return
    
    # Créer le fichier lock
    try:
        with open(lock_file, "w") as f:
            f.write(f"Auto-init started at {datetime.now().isoformat()}")
        
        logger.info("🚀 Conditions remplies pour l'auto-initialisation des 7 vrais datasets")
        logger.info("📚 Initialisation des vrais datasets avec leurs métadonnées complètes...")
        
        # Utiliser le script d'initialisation avec les vrais noms des datasets
        # et ensuite importer les vraies données Kaggle
        current_dir = os.path.dirname(os.path.abspath(__file__))
        service_dir = os.path.dirname(current_dir)
        scripts_dir = os.path.join(service_dir, "scripts")
        init_script = os.path.join(scripts_dir, "init_datasets.py")
        
        # Vérifier si le script existe, sinon utiliser le chemin Docker
        if not os.path.exists(init_script):
            # Dans le conteneur Docker, utiliser le chemin absolu
            scripts_dir = "/app/scripts"
            init_script = "/app/scripts/init_datasets.py"
        
        logger.info(f"🔍 Utilisation du script: {init_script}")
        
        # Étape 1: Initialiser les 7 datasets avec leurs vrais noms et métadonnées
        logger.info("🔄 Étape 1: Initialisation des datasets avec vrais noms...")
        result = subprocess.run([
            "python", init_script, "all"  # Importer tous les 7 datasets avec leurs vrais noms
        ], cwd=scripts_dir, capture_output=True, text=True, timeout=60)
        
        if result.returncode == 0:
            logger.info("✅ Datasets initialisés avec vrais noms")
            logger.info(f"Output: {result.stdout}")
        else:
            logger.error(f"❌ Erreur initialisation datasets: {result.stderr}")
            return
        
        # Étape 2: Importer les vraies données Kaggle disponibles
        logger.info("🔄 Étape 2: Import des vraies données Kaggle...")
        
        # Importer les datasets Kaggle disponibles avec vrais credentials
        datasets_kaggle_disponibles = [
            "social_media_addiction",      # Students' Social Media Addiction (2025)
            "student_performance",         # Students Performance in Exams (2018)  
            "academic_performance",        # Student Academic Performance Dataset (2025)
            "student_stress",              # Student Stress Factors (2023)
            "student_depression",          # Student Depression Dataset (2024)
        ]
        
        kaggle_import_dir = os.path.join(service_dir, "..", "datasets", "kaggle-import")
        kaggle_script = os.path.join(kaggle_import_dir, "kaggle_importer.py")
        
        # Vérifier que le script Kaggle existe
        if os.path.exists(kaggle_script):
            for dataset_name in datasets_kaggle_disponibles:
                logger.info(f"Import en cours: {dataset_name}")
                try:
                    result = subprocess.run([
                        "python", kaggle_script, "--dataset", dataset_name
                    ], cwd=kaggle_import_dir, capture_output=True, text=True, timeout=120)
                    
                    if result.returncode == 0:
                        logger.info(f"✅ Dataset {dataset_name} importé avec succès")
                        logger.info(f"Output: {result.stdout}")
                    else:
                        logger.error(f"❌ Échec import dataset {dataset_name}")
                        logger.error(f"Error: {result.stderr}")
                        
                except subprocess.TimeoutExpired:
                    logger.error(f"⏱️ Timeout import dataset {dataset_name}")
                except Exception as e:
                    logger.error(f"❌ Exception import {dataset_name}: {e}")
        else:
            logger.warning("⚠️ Script d'import Kaggle non trouvé, utilisation des données échantillons")
        
        logger.info("🎉 Auto-initialisation terminée avec succès !")
        
    except Exception as e:
        logger.error(f"❌ Erreur durant l'auto-initialisation: {e}")
    
    finally:
        # Supprimer le fichier lock
        if os.path.exists(lock_file):
            os.remove(lock_file)
            logger.info("🔓 Fichier lock supprimé") 
