import uuid
from fastapi_users import schemas
from typing import Optional, List
from pydantic import BaseModel, EmailStr

# Modèle Pydantic pour les comptes OAuth
class OAuthAccountRead(BaseModel):
    id: uuid.UUID
    oauth_name: str
    account_id: str
    account_email: str

# Schéma Pydantic pour la lecture d'un utilisateur (sans le mot de passe)
class UserRead(schemas.BaseUser[uuid.UUID]):
    # Inclut par défaut: id, email, is_active, is_superuser, is_verified
    pseudo: Optional[str] = None
    picture: Optional[str] = None
    given_name: Optional[str] = None
    family_name: Optional[str] = None
    locale: Optional[str] = None
    oauth_accounts: List[OAuthAccountRead] = []

    class Config:
        from_attributes = True

# Schéma Pydantic pour la création d'un utilisateur
class UserCreate(schemas.BaseUserCreate):
    # Inclut par défaut: email, password
    email: EmailStr
    password: str
    pseudo: Optional[str] = None
    picture: Optional[str] = None
    given_name: Optional[str] = None
    family_name: Optional[str] = None
    locale: Optional[str] = None
    
    class Config:
        json_schema_extra = {
            "example": {
                "email": "user@example.com",
                "password": "password123",
                "pseudo": "string",
                "picture": "string",
                "given_name": "string",
                "family_name": "string",
                "locale": "string"
            }
        }

# Schéma Pydantic pour la mise à jour d'un utilisateur (par l'utilisateur lui-même)
class UserUpdate(schemas.BaseUserUpdate):
    # Permet la mise à jour du mot de passe (optionnel)
    pseudo: Optional[str] = None
    picture: Optional[str] = None
    given_name: Optional[str] = None
    family_name: Optional[str] = None
    locale: Optional[str] = None 