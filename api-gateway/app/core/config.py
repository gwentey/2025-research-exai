import os
from pydantic_settings import BaseSettings
from dotenv import load_dotenv

# Charger les variables d'environnement depuis un fichier .env (utile pour le dev local)
load_dotenv()

class Settings(BaseSettings):
    PROJECT_NAME: str = os.getenv("PROJECT_NAME", "EXAI API Gateway")
    API_V1_STR: str = "/api/v1"
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
    # Mettre à jour avec l'URL réelle du composant de callback Angular
    OAUTH_REDIRECT_URL: str = os.getenv("OAUTH_REDIRECT_URL", "http://localhost:8080/authentication/callback")
    
    # Domaines de production pour détection automatique
    PRODUCTION_DOMAINS: list[str] = os.getenv("PRODUCTION_DOMAINS", "exai-pipeline.fr,api.exai-pipeline.fr").split(",")
    
    # CORS Origins (Optionnel, si vous voulez le configurer via env)
    # Séparez les origines par des virgules si plusieurs.
    # Listez TOUTES les origines de frontend autorisées, séparées par des virgules.
    # Pas de "*" autorisé si allow_credentials=True dans main.py.
    BACKEND_CORS_ORIGINS: str = os.getenv(
        "BACKEND_CORS_ORIGINS",
        "http://localhost:8080,https://exai-pipeline.fr,https://www.exai-pipeline.fr" # Local et production
    )

    # URLs des services backend pour le reverse proxy
    # En Kubernetes: utiliser les noms de services internes
    SERVICE_SELECTION_URL: str = os.getenv("SERVICE_SELECTION_URL", "http://service-selection-service")
    ML_PIPELINE_URL: str = os.getenv("ML_PIPELINE_URL", "http://ml-pipeline-service")
    XAI_ENGINE_URL: str = os.getenv("XAI_ENGINE_URL", "http://xai-engine-service")

    class Config:
        # Si vous utilisez un fichier .env pour charger les variables d'environnement
        env_file = ".env"
        env_file_encoding = 'utf-8'

settings = Settings()  