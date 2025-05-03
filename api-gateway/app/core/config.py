import os
from pydantic_settings import BaseSettings
from dotenv import load_dotenv

# Charger les variables d'environnement depuis un fichier .env (utile pour le dev local)
load_dotenv()

class Settings(BaseSettings):
    # ATTENTION: Clé secrète pour JWT. DOIT être gardée secrète et idéalement chargée depuis l'environnement.
    # Pour le développement, une clé fixe est utilisée ici, mais elle devra être remplacée.
    # Générer une clé robuste avec: openssl rand -hex 32
    SECRET_KEY: str = os.getenv("SECRET_KEY", "09d25e094faa6ca2556c818166b7a9563b93f7099f6f0f4caa6cf63b88e8d3e7")
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30  # Durée de validité du token en minutes

    # Configuration Base de données (sera utilisée par fastapi-users)
    # Exemple: DATABASE_URL="postgresql+asyncpg://user:password@host:port/db"
    # Sera chargée depuis l'environnement ou un fichier .env
    DATABASE_URL: str = os.getenv("DATABASE_URL", "postgresql+asyncpg://user:password@localhost:5432/db") # Dev default

    # Configuration OAuth pour Google
    GOOGLE_OAUTH_CLIENT_ID: str = os.getenv("GOOGLE_OAUTH_CLIENT_ID", "")
    GOOGLE_OAUTH_CLIENT_SECRET: str = os.getenv("GOOGLE_OAUTH_CLIENT_SECRET", "")
    
    # URL de redirection après authentification OAuth (frontend)
    # Par exemple: http://localhost:4200/auth/callback
    OAUTH_REDIRECT_URL: str = os.getenv("OAUTH_REDIRECT_URL", "http://localhost:4200/auth/callback")

    class Config:
        # Si vous utilisez un fichier .env pour charger les variables d'environnement
        env_file = ".env" 
        env_file_encoding = 'utf-8'

settings = Settings() 