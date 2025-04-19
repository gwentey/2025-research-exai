from typing import AsyncGenerator

from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.ext.declarative import declarative_base

from app.core.config import settings

# Création de la base déclarative SQLAlchemy
Base = declarative_base()

# Moteur de base de données asynchrone
# Note: echo=True affiche les requêtes SQL générées, utile pour le debug
engine = create_async_engine(settings.DATABASE_URL, echo=False, future=True)

# Fabrique de session asynchrone
async_session_maker = sessionmaker(
    engine, class_=AsyncSession, expire_on_commit=False
)

# Fonction de dépendance FastAPI pour obtenir une session BDD
async def get_async_session() -> AsyncGenerator[AsyncSession, None]:
    async with async_session_maker() as session:
        yield session 