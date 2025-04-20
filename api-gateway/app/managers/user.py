import uuid
from typing import Optional, Union

from fastapi import Request
from fastapi_users import BaseUserManager, UUIDIDMixin
from fastapi_users_db_sqlalchemy import SQLAlchemyUserDatabase

from ..models.user import User
from ..core.config import settings


class UserManager(UUIDIDMixin, BaseUserManager[User, uuid.UUID]):
    reset_password_token_secret = settings.SECRET_KEY
    verification_token_secret = settings.SECRET_KEY

    async def on_after_register(self, user: User, request: Optional[Request] = None):
        """
        Callback exécuté après l'inscription réussie d'un utilisateur.
        Peut être utilisé pour envoyer un email de bienvenue, etc.
        """
        print(f"L'utilisateur {user.id} s'est inscrit.")

    async def on_after_forgot_password(
        self, user: User, token: str, request: Optional[Request] = None
    ):
        """
        Callback exécuté après une demande de réinitialisation de mot de passe.
        Utilisé pour envoyer un email avec le token de réinitialisation.
        """
        print(f"Génération de token de réinitialisation pour {user.id}: {token}")
        # TODO: Envoyer un email avec le token

    async def on_after_request_verify(
        self, user: User, token: str, request: Optional[Request] = None
    ):
        """
        Callback exécuté après une demande de vérification d'email.
        Utilisé pour envoyer un email avec le token de vérification.
        """
        print(f"Génération de token de vérification pour {user.id}: {token}")
        # TODO: Envoyer un email avec le token

    async def on_after_verify(
        self, user: User, request: Optional[Request] = None
    ):
        """
        Callback exécuté après la vérification réussie d'un utilisateur.
        """
        print(f"L'utilisateur {user.id} a été vérifié.")

    async def on_after_update(
        self, user: User, update_dict: dict, request: Optional[Request] = None
    ):
        """
        Callback exécuté après la mise à jour d'un utilisateur.
        """
        print(f"L'utilisateur {user.id} a été mis à jour.") 