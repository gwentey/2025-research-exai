import uuid
from fastapi_users_db_sqlalchemy import SQLAlchemyBaseUserTableUUID
from sqlalchemy.orm import Mapped, mapped_column, declarative_base
from sqlalchemy import UUID as SQLAlchemyUUID, text # Import SQLAlchemy's UUID type and text
from sqlalchemy.dialects.postgresql import UUID # Assurez-vous que UUID is importé
from ..db import Base # Un seul niveau pour remonter de models à api_gateway

# Define a local Base for models in this module (and potentially others in app/models)
# This avoids depending on app.db for model definition
# Base = declarative_base() # Cette ligne est probablement incorrecte si Base vient de db.py

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

    # Vous pouvez ajouter ici des colonnes spécifiques à votre application
    # Par exemple:
    # first_name: Mapped[str] = mapped_column(nullable=True)
    # last_name: Mapped[str] = mapped_column(nullable=True)
    pass 