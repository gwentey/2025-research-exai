"""
Module de gestion d'erreurs personnalisées pour l'upload de datasets.
"""

from fastapi import HTTPException
from typing import Optional, Dict, Any
import logging

logger = logging.getLogger(__name__)

class DatasetUploadError(Exception):
    """Exception de base pour les erreurs d'upload de datasets."""
    def __init__(self, message: str, error_code: str = None, details: Dict[str, Any] = None):
        self.message = message
        self.error_code = error_code
        self.details = details or {}
        super().__init__(message)

class FileValidationError(DatasetUploadError):
    """Erreur de validation de fichier."""
    pass

class StorageError(DatasetUploadError):
    """Erreur de stockage."""
    pass

class ConversionError(DatasetUploadError):
    """Erreur de conversion de format."""
    pass

class MetadataValidationError(DatasetUploadError):
    """Erreur de validation des métadonnées."""
    pass

class PermissionDeniedError(DatasetUploadError):
    """Erreur de permissions."""
    pass

def handle_upload_error(
    error: Exception, 
    dataset_id: str = None, 
    storage_path: str = None,
    cleanup_func=None
) -> HTTPException:
    """
    Gestionnaire d'erreurs centralisé pour l'upload de datasets.
    
    Args:
        error: L'exception originale
        dataset_id: ID du dataset (pour le logging)
        storage_path: Chemin de stockage (pour le nettoyage)
        cleanup_func: Fonction de nettoyage optionnelle
    
    Returns:
        HTTPException formatée pour FastAPI
    """
    
    # Déterminer le type d'erreur et le message approprié
    if isinstance(error, FileValidationError):
        status_code = 400
        error_type = "FILE_VALIDATION_ERROR"
        user_message = f"Erreur de validation de fichier: {error.message}"
    
    elif isinstance(error, StorageError):
        status_code = 500
        error_type = "STORAGE_ERROR"
        user_message = "Erreur lors du stockage des fichiers. Veuillez réessayer."
    
    elif isinstance(error, ConversionError):
        status_code = 400
        error_type = "CONVERSION_ERROR"
        user_message = f"Erreur de conversion de fichier: {error.message}"
    
    elif isinstance(error, MetadataValidationError):
        status_code = 400
        error_type = "METADATA_VALIDATION_ERROR"
        user_message = f"Erreur de validation des métadonnées: {error.message}"
    
    elif isinstance(error, PermissionDeniedError):
        status_code = 403
        error_type = "PERMISSION_DENIED"
        user_message = error.message
    
    elif isinstance(error, HTTPException):
        # Re-lever les HTTPException existantes
        return error
    
    else:
        # Erreur générique
        status_code = 500
        error_type = "INTERNAL_ERROR"
        user_message = "Une erreur inattendue s'est produite. Veuillez réessayer."
    
    # Logging détaillé
    log_data = {
        "error_type": error_type,
        "dataset_id": dataset_id,
        "storage_path": storage_path,
        "original_error": str(error),
        "error_class": error.__class__.__name__
    }
    
    if hasattr(error, 'details'):
        log_data["details"] = error.details
    
    logger.error(f"Upload error occurred: {log_data}")
    
    # Tentative de nettoyage si nécessaire
    if cleanup_func and storage_path:
        try:
            cleanup_func(storage_path)
            logger.info(f"Storage cleanup successful for path: {storage_path}")
        except Exception as cleanup_error:
            logger.error(f"Storage cleanup failed for path {storage_path}: {str(cleanup_error)}")
    
    # Créer la réponse d'erreur structurée
    detail = {
        "message": user_message,
        "error_code": error_type,
        "timestamp": str(logger.handlers[0].formatter.formatTime(logger.makeRecord(
            logger.name, logging.ERROR, "", 0, "", (), None
        ))) if logger.handlers else None
    }
    
    # Ajouter des détails supplémentaires pour les erreurs de validation
    if isinstance(error, DatasetUploadError) and error.details:
        detail["details"] = error.details
    
    return HTTPException(status_code=status_code, detail=detail)

def validate_file_format(filename: str, supported_formats: list) -> None:
    """
    Valide le format d'un fichier.
    
    Args:
        filename: Nom du fichier
        supported_formats: Liste des formats supportés
    
    Raises:
        FileValidationError: Si le format n'est pas supporté
    """
    file_extension = filename.lower().split('.')[-1] if '.' in filename else ''
    
    if not file_extension:
        raise FileValidationError(
            "Le fichier doit avoir une extension valide.",
            error_code="NO_FILE_EXTENSION",
            details={"filename": filename}
        )
    
    if file_extension not in supported_formats:
        raise FileValidationError(
            f"Format de fichier non supporté: .{file_extension}. "
            f"Formats supportés: {', '.join(supported_formats)}",
            error_code="UNSUPPORTED_FORMAT",
            details={
                "filename": filename,
                "detected_format": file_extension,
                "supported_formats": supported_formats
            }
        )

def validate_file_size(file_size: int, max_size: int, filename: str) -> None:
    """
    Valide la taille d'un fichier.
    
    Args:
        file_size: Taille du fichier en bytes
        max_size: Taille maximale autorisée en bytes
        filename: Nom du fichier
    
    Raises:
        FileValidationError: Si la taille dépasse la limite
    """
    if file_size > max_size:
        max_size_mb = max_size / (1024 * 1024)
        file_size_mb = file_size / (1024 * 1024)
        
        raise FileValidationError(
            f"Le fichier {filename} est trop volumineux ({file_size_mb:.1f}MB). "
            f"Taille maximale autorisée: {max_size_mb:.0f}MB",
            error_code="FILE_TOO_LARGE",
            details={
                "filename": filename,
                "file_size_mb": round(file_size_mb, 1),
                "max_size_mb": round(max_size_mb, 0)
            }
        )
    
    if file_size == 0:
        raise FileValidationError(
            f"Le fichier {filename} est vide.",
            error_code="EMPTY_FILE",
            details={"filename": filename}
        )

def validate_metadata_required_fields(metadata: dict) -> None:
    """
    Valide les champs obligatoires des métadonnées.
    
    Args:
        metadata: Dictionnaire des métadonnées
    
    Raises:
        MetadataValidationError: Si des champs obligatoires manquent
    """
    required_fields = ['dataset_name']
    missing_fields = []
    
    for field in required_fields:
        if not metadata.get(field) or str(metadata.get(field)).strip() == '':
            missing_fields.append(field)
    
    if missing_fields:
        raise MetadataValidationError(
            f"Champs obligatoires manquants: {', '.join(missing_fields)}",
            error_code="MISSING_REQUIRED_FIELDS",
            details={"missing_fields": missing_fields}
        )

def create_user_friendly_error_message(error_type: str, details: dict = None) -> str:
    """
    Crée un message d'erreur convivial pour l'utilisateur.
    
    Args:
        error_type: Type d'erreur
        details: Détails supplémentaires
    
    Returns:
        Message d'erreur formaté pour l'utilisateur
    """
    messages = {
        "FILE_VALIDATION_ERROR": "Un ou plusieurs fichiers ne respectent pas les critères requis.",
        "STORAGE_ERROR": "Erreur lors de la sauvegarde de vos fichiers. Veuillez réessayer.",
        "CONVERSION_ERROR": "Erreur lors de la conversion de vos fichiers. Vérifiez leur format.",
        "METADATA_VALIDATION_ERROR": "Certaines informations obligatoires sont manquantes ou incorrectes.",
        "PERMISSION_DENIED": "Vous n'avez pas les permissions nécessaires pour cette action.",
        "INTERNAL_ERROR": "Une erreur technique inattendue s'est produite. Notre équipe a été notifiée."
    }
    
    base_message = messages.get(error_type, "Une erreur s'est produite.")
    
    # Ajouter des détails contextuels si disponibles
    if details:
        if error_type == "FILE_VALIDATION_ERROR" and "filename" in details:
            base_message += f" Fichier concerné: {details['filename']}"
        elif error_type == "METADATA_VALIDATION_ERROR" and "missing_fields" in details:
            base_message += f" Champs manquants: {', '.join(details['missing_fields'])}"
    
    return base_message