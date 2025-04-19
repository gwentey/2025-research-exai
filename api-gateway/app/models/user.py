import uuid
from fastapi_users_db_sqlalchemy import SQLAlchemyBaseUserTableUUID
from sqlalchemy.orm import Mapped, mapped_column, declarative_base
from sqlalchemy import UUID as SQLAlchemyUUID # Import SQLAlchemy's UUID type

# Define a local Base for models in this module (and potentially others in app/models)
# This avoids depending on app.db for model definition
Base = declarative_base()

# Modèle de table SQLAlchemy pour l'utilisateur
# Utilise SQLAlchemyBaseUserTableUUID pour un ID de type UUID
class User(SQLAlchemyBaseUserTableUUID, Base):
    __tablename__ = "user"

    # Override the 'id' column from SQLAlchemyBaseUserTableUUID
    # to explicitly set native_uuid=False (Correction: native_uuid is not a constructor arg)
    id: Mapped[uuid.UUID] = mapped_column(
        SQLAlchemyUUID(as_uuid=True), # Keep as_uuid=True, remove invalid native_uuid arg
        primary_key=True,
        default=uuid.uuid4,
    )

    # Vous pouvez ajouter ici des colonnes spécifiques à votre application
    # Par exemple:
    # first_name: Mapped[str] = mapped_column(nullable=True)
    # last_name: Mapped[str] = mapped_column(nullable=True)
    pass 