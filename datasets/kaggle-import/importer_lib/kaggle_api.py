"""
Gère les interactions avec l'API Kaggle.

- Authentification
- Récupération des métadonnées
- Téléchargement des datasets
"""
import kaggle
import logging
import time
from pathlib import Path
from typing import Dict, Any, List

from . import config

logger = logging.getLogger(__name__)

class KaggleAPI:
    """Wrapper pour l'API Kaggle."""

    def __init__(self):
        self._authenticate()

    def _authenticate(self):
        """Authentifie le client auprès de l'API Kaggle."""
        try:
            kaggle.api.authenticate()
            logger.info("Authentification Kaggle réussie.")
        except Exception as e:
            logger.error(f"Échec de l'authentification Kaggle: {e}")
            logger.error("Veuillez vous assurer que votre fichier kaggle.json est correctement configuré.")
            raise

    def get_metadata(self, kaggle_ref: str) -> Dict[str, Any]:
        """
        Récupère les métadonnées d'un dataset depuis Kaggle avec une politique de re-essai.

        Args:
            kaggle_ref: La référence du dataset (ex: 'user/dataset-name').

        Returns:
            Un dictionnaire contenant les métadonnées du dataset.
        """
        logger.info(f"Récupération des métadonnées pour '{kaggle_ref}'...")
        for attempt in range(config.MAX_KAGGLE_API_RETRIES):
            try:
                # La méthode dataset_metadata télécharge un fichier metadata.json
                # dans le path spécifié.
                temp_dir = Path(config.CACHE_DIR) / "tmp_meta"
                temp_dir.mkdir(exist_ok=True)
                
                # kaggle.api.dataset_metadata est déprécié, mais toujours utilisé par la lib.
                # La nouvelle approche est d'utiliser dataset_view, mais l'ancienne fonctionne encore.
                dataset_info = kaggle.api.dataset_metadata(kaggle_ref, path=str(temp_dir))

                # Nettoyer les fichiers temporaires
                for item in temp_dir.iterdir():
                    item.unlink()
                temp_dir.rmdir()
                
                # Extraire les métadonnées pertinentes de l'objet retourné
                return self._extract_relevant_metadata(dataset_info)

            except Exception as e:
                logger.warning(f"Tentative {attempt + 1}/{config.MAX_KAGGLE_API_RETRIES} échouée pour '{kaggle_ref}': {e}")
                if attempt + 1 == config.MAX_KAGGLE_API_RETRIES:
                    logger.error(f"Toutes les tentatives ont échoué pour la récupération des métadonnées de '{kaggle_ref}'.")
                    return {'title': kaggle_ref, 'error': str(e)}
                time.sleep(2 ** attempt)  # Backoff exponentiel
        return {} # Devrait être inatteignable

    def download_files(self, kaggle_ref: str, download_path: Path) -> List[Path]:
        """
        Télécharge et dézippe les fichiers d'un dataset Kaggle.

        Args:
            kaggle_ref: La référence du dataset.
            download_path: Le répertoire de destination pour les fichiers téléchargés.

        Returns:
            La liste des chemins des fichiers CSV téléchargés.
        """
        logger.info(f"Téléchargement du dataset '{kaggle_ref}' vers '{download_path}'...")
        try:
            kaggle.api.dataset_download_files(
                kaggle_ref,
                path=str(download_path),
                unzip=True,
                quiet=False
            )
            
            # Recherche récursive des fichiers .csv
            downloaded_files = list(download_path.glob("**/*.csv"))
            logger.info(f"{len(downloaded_files)} fichier(s) CSV téléchargé(s) pour '{kaggle_ref}'.")
            return downloaded_files
        except Exception as e:
            error_msg = str(e).lower()
            
            # Gestion spécifique des erreurs 403 pour les datasets de compétition
            if "403" in error_msg or "forbidden" in error_msg:
                if kaggle_ref.startswith("c/"):
                    logger.warning(f"⚠️  DATASET DE COMPÉTITION NON ACCESSIBLE : '{kaggle_ref}'")
                    logger.warning("   → Ce dataset de compétition Kaggle n'est plus accessible via l'API")
                    logger.warning("   → Raison possible : compétition terminée, accès restreint, ou permissions insuffisantes")
                    logger.warning("   → SOLUTION : Remplacer par un dataset public équivalent ou contacter l'administrateur Kaggle")
                else:
                    logger.warning(f"⚠️  ACCÈS REFUSÉ : '{kaggle_ref}' - Vérifiez vos permissions Kaggle")
                
                # Retourner une liste vide au lieu de faire échouer le processus
                logger.info(f"🔄 CONTINUE : Passer au dataset suivant...")
                return []
            else:
                # Pour les autres erreurs, continuer à les propager
                logger.error(f"❌ Erreur lors du téléchargement de '{kaggle_ref}': {e}")
                raise

    def _extract_relevant_metadata(self, dataset_info: object) -> Dict[str, Any]:
        """Extrait les métadonnées utiles de l'objet retourné par l'API Kaggle."""
        
        def safe_getattr(obj, attr, default=None):
            """Récupère un attribut en toute sécurité."""
            value = getattr(obj, attr, default)
            # Si c'est une méthode, on l'appelle
            if callable(value) and not isinstance(value, type):
                try:
                    return value()
                except Exception:
                    return default
            return value

        return {
            'title': safe_getattr(dataset_info, 'title', ''),
            'subtitle': safe_getattr(dataset_info, 'subtitle', ''),
            'description': safe_getattr(dataset_info, 'description', ''),
            'usabilityRating': safe_getattr(dataset_info, 'usabilityRating', 0.0),
            'lastUpdated': safe_getattr(dataset_info, 'lastUpdated', ''),
            'downloadCount': safe_getattr(dataset_info, 'downloadCount', 0),
            'voteCount': safe_getattr(dataset_info, 'voteCount', 0),
            'size': safe_getattr(dataset_info, 'size', ''),
            'licenseName': safe_getattr(dataset_info, 'licenseName', 'unknown'),
            'keywords': safe_getattr(dataset_info, 'keywords', []),
            'ownerName': safe_getattr(dataset_info, 'ownerName', ''),
        }


