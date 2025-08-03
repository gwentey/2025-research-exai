import uuid
from fastapi_users_db_sqlalchemy import SQLAlchemyBaseUserTableUUID
from sqlalchemy.orm import Mapped, mapped_column, relationship, declarative_base
from sqlalchemy import UUID as SQLAlchemyUUID, text, String, Boolean, ForeignKey, SmallInteger, DateTime, event
from sqlalchemy.dialects.postgresql import UUID # Assurez-vous que UUID is importé
from typing import List, Optional
from datetime import datetime
from ..db import Base # Un seul niveau pour remonter de models à api_gateway

# Define a local Base for models in this module (and potentially others in app/models)
# This avoids depending on app.db for model definition
# Base = declarative_base() # Cette ligne est probablement incorrecte si Base vient de db.py

# Modèle pour stocker les comptes OAuth (comme Google)
class OAuthAccount(Base):
    __tablename__ = "oauth_account"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        server_default=text("gen_random_uuid()"),
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("user.id"),
        nullable=False,
    )
    oauth_name: Mapped[str] = mapped_column(String(length=100), nullable=False)
    access_token: Mapped[str] = mapped_column(String(length=1024), nullable=False)
    expires_at: Mapped[Optional[int]] = mapped_column(nullable=True)
    refresh_token: Mapped[Optional[str]] = mapped_column(String(length=1024), nullable=True)
    account_id: Mapped[str] = mapped_column(String(length=320), nullable=False)
    account_email: Mapped[str] = mapped_column(String(length=320), nullable=False)

# Modèle de table SQLAlchemy pour l'utilisateur
# Utilise SQLAlchemyBaseUserTableUUID pour un ID de type UUID
class User(SQLAlchemyBaseUserTableUUID, Base):
    __tablename__ = "user"

    # Override the 'id' column from SQLAlchemyBaseUserTableUUID
    # to explicitly set native_uuid=False (Correction: native_uuid is not a constructor arg)
    id: Mapped[UUID] = mapped_column(
        UUID(as_uuid=True), # Spécifie le type PostgreSQL UUID
        primary_key=True,
        server_default=text("gen_random_uuid()"), # Ajout de la valeur par défaut serveur
        index=True, # Gardez index=True si vous l'aviez
        unique=True, # Gardez unique=True si vous l'aviez
        nullable=False # Assurez-vous que nullable=False est présent
    )

    # Ajout du champ pseudo (nom d'utilisateur personnalisé)
    pseudo: Mapped[Optional[str]] = mapped_column(String(length=64), nullable=True, unique=True)
    
    # Champs pour l'intégration Google
    picture: Mapped[Optional[str]] = mapped_column(String(length=1024), nullable=True)
    given_name: Mapped[Optional[str]] = mapped_column(String(length=320), nullable=True)
    family_name: Mapped[Optional[str]] = mapped_column(String(length=320), nullable=True)
    locale: Mapped[Optional[str]] = mapped_column(String(length=10), nullable=True)
    
    # Champs pour l'onboarding
    education_level: Mapped[Optional[str]] = mapped_column(String(length=50), nullable=True)
    age: Mapped[Optional[int]] = mapped_column(SmallInteger, nullable=True)
    ai_familiarity: Mapped[Optional[int]] = mapped_column(SmallInteger, nullable=True)
    
    # Système de crédits
    credits: Mapped[int] = mapped_column(SmallInteger, default=10, server_default=text('10'), nullable=False)
    date_claim: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    
    # Système de rôles
    role: Mapped[str] = mapped_column(String(length=20), default='user', server_default=text("'user'"), nullable=False)
    
    # Relation avec les comptes OAuth
    oauth_accounts: Mapped[List[OAuthAccount]] = relationship(
        "OAuthAccount",
        primaryjoin="User.id==OAuthAccount.user_id",
        cascade="all, delete-orphan",
        lazy="joined",
    )
    
    # is_superuser : propriété calculée basée sur role (plus de colonne DB)
    @property
    def is_superuser(self) -> bool:
        """
        Propriété calculée pour FastAPI-users.
        Un utilisateur est superuser s'il a le rôle 'admin'.
        Single source of truth : role
        """
        return self.role == "admin"
    
    @is_superuser.setter  
    def is_superuser(self, value: bool) -> None:
        """
        Setter pour compatibilité FastAPI-users.
        Modifie le role en conséquence.
        """
        if value:
            self.role = "admin"
        else:
            # Si on retire le statut superuser et que l'utilisateur était admin
            if self.role == "admin":
                self.role = "user"
    
    def __init__(self, **kwargs):
        """
        Constructeur simplifié. 
        Si is_superuser est fourni, on convertit vers role pour cohérence.
        """
        # Si is_superuser est fourni, on convertit vers role (single source of truth)
        if 'is_superuser' in kwargs and 'role' not in kwargs:
            kwargs['role'] = 'admin' if kwargs['is_superuser'] else 'user'
        
        # Retirer is_superuser des kwargs car c'est maintenant une propriété calculée
        kwargs.pop('is_superuser', None)
        
        super().__init__(**kwargs)
