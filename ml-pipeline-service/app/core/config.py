from pydantic_settings import BaseSettings
from typing import Optional

class Settings(BaseSettings):
    # Database
    DATABASE_URL: str = "postgresql://user:password@postgres:5432/ml_pipeline"
    
    # Celery
    CELERY_BROKER_URL: str = "redis://redis:6379/0"
    CELERY_RESULT_BACKEND: str = "redis://redis:6379/0"
    
    # Storage
    STORAGE_TYPE: str = "minio"  # or "azure"
    MINIO_ENDPOINT: str = "http://minio-service:80"
    MINIO_ACCESS_KEY: str = "minioadmin"
    MINIO_SECRET_KEY: str = "minioadmin"
    MINIO_SECURE: bool = False
    AZURE_STORAGE_CONNECTION_STRING: Optional[str] = None
    
    # Service URLs
    SERVICE_SELECTION_URL: str = "http://service-selection-service:80"
    
    # ML Configuration
    MODEL_STORAGE_PATH: str = "ibis-x-models"
    MAX_TRAINING_TIME: int = 3600  # 1 hour
    DEFAULT_TEST_SIZE: float = 0.2
    
    # API Configuration
    API_V1_STR: str = "/api/v1"
    PROJECT_NAME: str = "ML Pipeline Service"
    
    class Config:
        env_file = ".env"
        case_sensitive = True

settings = Settings() 