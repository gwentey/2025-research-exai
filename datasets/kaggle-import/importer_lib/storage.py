"""
Encapsule la logique d'interaction avec le client de stockage (MinIO/Azure).
"""
import logging
from common.storage_client import get_storage_client

logger = logging.getLogger(__name__)

class StorageManager:
    """Gère l'upload de fichiers vers le stockage d'objets."""

    def __init__(self):
        self._client = None

    @property
    def client(self):
        """Initialise le client de manière paresseuse (lazy)."""
        if self._client is None:
            try:
                self._client = get_storage_client()
                logger.info("Client de stockage initialisé avec succès.")
            except Exception as e:
                logger.error(f"Erreur lors de l'initialisation du client de stockage : {e}")
                raise
        return self._client


    def upload_file(self, file_path: str, object_key: str) -> None:
        """
        Upload un fichier vers le stockage d'objets.

        Args:
            file_path: Le chemin local du fichier à uploader.
            object_key: La clé (chemin complet) de l'objet dans le bucket.
        """
        try:
            with open(file_path, 'rb') as f:
                file_data = f.read()
            
            self.client.upload_file(file_data, object_key)
            logger.info(f"Fichier '{file_path}' uploadé vers '{object_key}'.")
        except FileNotFoundError:
            logger.error(f"Fichier local non trouvé : {file_path}")
            raise
        except Exception as e:
            logger.error(f"Erreur lors de l'upload de '{file_path}' vers '{object_key}': {e}")
            raise


