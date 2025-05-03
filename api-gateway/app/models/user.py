import uuid
from fastapi_users_db_sqlalchemy import SQLAlchemyBaseUserTableUUID
from sqlalchemy.orm import Mapped, mapped_column, relationship, declarative_base
from sqlalchemy import UUID as SQLAlchemyUUID, text, String, Boolean, ForeignKey # Importer ForeignKey
from sqlalchemy.dialects.postgresql import UUID # Assurez-vous que UUID is importé
from typing import List, Optional
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
    
    # Relation avec les comptes OAuth
    oauth_accounts: Mapped[List[OAuthAccount]] = relationship(
        "OAuthAccount",
        primaryjoin="User.id==OAuthAccount.user_id",
        cascade="all, delete-orphan",
        lazy="joined",
    )

    # Vous pouvez ajouter ici des colonnes spécifiques à votre application
    # Par exemple:
    # first_name: Mapped[str] = mapped_column(nullable=True)
    # last_name: Mapped[str] = mapped_column(nullable=True)
    pass 