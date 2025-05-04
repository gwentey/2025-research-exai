import uuid
import logging
import traceback
from typing import Optional, Union, Dict, Any

from fastapi import Request, HTTPException
from fastapi_users import BaseUserManager, UUIDIDMixin
from fastapi_users.exceptions import UserAlreadyExists
from fastapi_users_db_sqlalchemy import SQLAlchemyUserDatabase

from ..models.user import User
from ..core.config import settings

# Configure le logger
logger = logging.getLogger(__name__)

class UserManager(UUIDIDMixin, BaseUserManager[User, uuid.UUID]):
    reset_password_token_secret = settings.SECRET_KEY
    verification_token_secret = settings.SECRET_KEY

    async def create(
        self, user_create, safe: bool = False, request: Optional[Request] = None
    ) -> User:
        """
        Surcharge de la méthode create pour mieux gérer les erreurs
        et ajouter plus de logs lors de la création d'utilisateur.
        """
        try:
            logger.info(f"Tentative de création d'utilisateur avec l'email: {user_create.email}")
            
            # Vérifier si l'email existe déjà directement dans cette méthode
            try:
                await self.validate_password(user_create.password, user_create)
            except Exception as password_error:
                logger.error(f"Validation du mot de passe échouée: {str(password_error)}")
                raise HTTPException(
                    status_code=400,
                    detail=f"Le mot de passe ne répond pas aux exigences: {str(password_error)}"
                )
                
            try:
                # Vérifier si l'utilisateur existe
                existing_user = await self.user_db.get_by_email(user_create.email)
                if existing_user is not None:
                    logger.warning(f"L'email est déjà utilisé: {user_create.email}")
                    raise UserAlreadyExists()
            except UserAlreadyExists:
                # Propager l'exception si l'utilisateur existe déjà
                raise
            except Exception as get_user_error:
                # Gérer d'autres erreurs possibles lors de la vérification
                logger.error(f"Erreur lors de la vérification de l'email existant: {str(get_user_error)}")
                raise HTTPException(
                    status_code=500, 
                    detail=f"Erreur lors de la vérification de l'email: {str(get_user_error)}"
                )
                
            # Créer l'utilisateur
            try:
                # Appelle la méthode parente pour créer l'utilisateur
                created_user = await super().create(user_create, safe, request)
                logger.info(f"Utilisateur créé avec succès: {created_user.id}")
                return created_user
            except Exception as create_error:
                logger.error(f"Erreur lors de la création de l'utilisateur: {str(create_error)}")
                logger.error(traceback.format_exc())
                raise
                
        except Exception as e:
            logger.error(f"Erreur globale lors de la création d'utilisateur: {str(e)}")
            logger.error(traceback.format_exc())
            # Re-raise l'exception pour la propager
            raise

    async def on_after_register(self, user: User, request: Optional[Request] = None):
        """
        Callback exécuté après l'inscription réussie d'un utilisateur.
        Peut être utilisé pour envoyer un email de bienvenue, etc.
        """
        logger.info(f"L'utilisateur {user.id} s'est inscrit.")

    async def on_after_forgot_password(
        self, user: User, token: str, request: Optional[Request] = None
    ):
        """
        Callback exécuté après une demande de réinitialisation de mot de passe.
        Utilisé pour envoyer un email avec le token de réinitialisation.
        """
        logger.info(f"Génération de token de réinitialisation pour {user.id}: {token}")
        # TODO: Envoyer un email avec le token

    async def on_after_request_verify(
        self, user: User, token: str, request: Optional[Request] = None
    ):
        """
        Callback exécuté après une demande de vérification d'email.
        Utilisé pour envoyer un email avec le token de vérification.
        """
        logger.info(f"Génération de token de vérification pour {user.id}: {token}")
        # TODO: Envoyer un email avec le token

    async def on_after_verify(
        self, user: User, request: Optional[Request] = None
    ):
        """
        Callback exécuté après la vérification réussie d'un utilisateur.
        """
        logger.info(f"L'utilisateur {user.id} a été vérifié.")

    async def on_after_update(
        self, user: User, update_dict: Dict[str, Any], request: Optional[Request] = None
    ):
        """
        Callback exécuté après la mise à jour d'un utilisateur.
        """
        logger.info(f"L'utilisateur {user.id} a été mis à jour.") 