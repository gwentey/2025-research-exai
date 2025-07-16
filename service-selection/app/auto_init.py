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

logger = logging.getLogger(__name__)

def should_auto_init() -> bool:
    """
    Vérifie si l'auto-initialisation doit être effectuée.
    
    Returns:
        bool: True si AUTO_INIT_DATA=true, False sinon
    """
    auto_init = os.getenv("AUTO_INIT_DATA", "false").lower()
    return auto_init in ("true", "1", "yes", "on")

def check_data_already_initialized() -> bool:
    """
    Vérifie si les données ont déjà été initialisées en comptant les datasets.
    
    Returns:
        bool: True si des datasets existent déjà, False sinon
    """
    try:
        # Approche hybride pour gérer les imports en local et dans Docker
        try:
            from . import models, database
        except ImportError:
            import models
            import database
        
        # Vérifier s'il y a déjà des datasets dans la base
        with database.SessionLocal() as db:
            dataset_count = db.query(models.Dataset).count()
            logger.info(f"Nombre de datasets existants: {dataset_count}")
            return dataset_count > 0
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
        
        # Lancer le script d'initialisation des datasets "social" (vrais datasets)
        # Utiliser les mêmes variables d'environnement que le service principal
        env = os.environ.copy()
        
        process = subprocess.Popen(
            ["python", "scripts/init_datasets.py", "social"],
            cwd="/app",  # Répertoire de travail
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            env=env  # Hérite des variables d'environnement du service
        )
        
        stdout, stderr = process.communicate()
        
        if process.returncode == 0:
            logger.info("Auto-initialisation des vrais datasets terminée avec succès")
            logger.info(f"Output: {stdout}")
        else:
            logger.error(f"Échec de l'auto-initialisation des datasets")
            logger.error(f"Error: {stderr}")
            
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
    
    if check_data_already_initialized():
        logger.info("Données déjà initialisées - skip auto-initialisation")
        return
    
    logger.info("Conditions remplies pour l'auto-initialisation des vrais datasets")
    
    # Lancer l'initialisation en arrière-plan sans bloquer le démarrage de l'API
    asyncio.create_task(run_data_initialization()) 