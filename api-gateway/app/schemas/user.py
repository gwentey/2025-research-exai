import uuid
from fastapi_users import schemas
from typing import Optional, List
from pydantic import BaseModel, EmailStr, Field, validator
from datetime import datetime
from enum import Enum

# Enum pour les rôles utilisateur
class UserRole(str, Enum):
    ADMIN = "admin"
    CONTRIBUTOR = "contributor"
    USER = "user"

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
    # Champs onboarding
    education_level: Optional[str] = None
    age: Optional[int] = None
    ai_familiarity: Optional[int] = None
    # Système de crédits
    credits: int
    date_claim: Optional[datetime] = None
    # Système de rôles
    role: UserRole = UserRole.USER

    class Config:
        from_attributes = True
        
    @classmethod
    def from_orm_user(cls, user):
        """Méthode utilitaire pour convertir un utilisateur SQLAlchemy en UserRead"""
        oauth_accounts_data = []
        for oauth_account in user.oauth_accounts:
            oauth_accounts_data.append(OAuthAccountRead(
                id=oauth_account.id,
                oauth_name=oauth_account.oauth_name,
                account_id=oauth_account.account_id,
                account_email=oauth_account.account_email
            ))
        
        return cls(
            id=user.id,
            email=user.email,
            is_active=user.is_active,
            is_superuser=user.is_superuser,
            is_verified=user.is_verified,
            pseudo=user.pseudo,
            picture=user.picture,
            given_name=user.given_name,
            family_name=user.family_name,
            locale=user.locale,
            oauth_accounts=oauth_accounts_data,
            education_level=user.education_level,
            age=user.age,
            ai_familiarity=user.ai_familiarity,
            credits=user.credits,
            date_claim=user.date_claim,
            role=user.role
        )

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
    # Champs onboarding
    education_level: Optional[str] = None
    age: Optional[int] = None
    ai_familiarity: Optional[int] = None
    # Système de crédits
    credits: Optional[int] = 10
    # Système de rôles (seuls les admins peuvent assigner des rôles lors de la création)
    role: Optional[UserRole] = UserRole.USER
    
    class Config:
        json_schema_extra = {
            "example": {
                "email": "user@example.com",
                "password": "password123",
                "pseudo": "string",
                "picture": "string",
                "given_name": "string",
                "family_name": "string",
                "locale": "string",
                "credits": 10
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
    # Champs onboarding
    education_level: Optional[str] = None
    age: Optional[int] = None
    ai_familiarity: Optional[int] = None
    # Système de crédits
    credits: Optional[int] = None
    date_claim: Optional[datetime] = None
    # Système de rôles (modification restreinte aux admins)
    role: Optional[UserRole] = None

# Schéma spécifique pour la mise à jour du profil (sans mot de passe)
class UserProfileUpdate(BaseModel):
    pseudo: Optional[str] = None
    given_name: Optional[str] = None
    family_name: Optional[str] = None
    locale: Optional[str] = None
    # Champs onboarding
    education_level: Optional[str] = None
    age: Optional[int] = None
    ai_familiarity: Optional[int] = None
    # Système de crédits
    credits: Optional[int] = None
    date_claim: Optional[datetime] = None
    # Système de rôles (modification restreinte aux admins)
    role: Optional[UserRole] = None

    class Config:
        json_schema_extra = {
            "example": {
                "pseudo": "nouveau_pseudo",
                "given_name": "Nouveau Prénom",
                "family_name": "Nouveau Nom",
                "locale": "fr"
            }
        }

# Schéma pour le changement de mot de passe
class PasswordUpdate(BaseModel):
    current_password: str
    new_password: str

    class Config:
        json_schema_extra = {
            "example": {
                "current_password": "ancien_mot_de_passe",
                "new_password": "nouveau_mot_de_passe_securise"
            }
        }

# Schéma pour l'upload d'image de profil
class ProfilePictureUpdate(BaseModel):
    picture: str  # Base64 encoded image ou URL

    class Config:
        json_schema_extra = {
            "example": {
                "picture": "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD..."
            }
        }

# Schéma pour les données d'onboarding
class OnboardingData(BaseModel):
    education_level: str = Field(..., description="Niveau d'éducation")
    age: int = Field(..., ge=13, le=120, description="Âge de l'utilisateur")
    ai_familiarity: int = Field(..., ge=1, le=5, description="Familiarité avec l'IA (1-5)")

    class Config:
        json_schema_extra = {
            "example": {
                "education_level": "bachelor",
                "age": 25,
                "ai_familiarity": 3
            }
        }

# Schéma pour la suppression de compte
class AccountDeletionRequest(BaseModel):
    email_confirmation: str = Field(..., description="Adresse email pour confirmer la suppression (insensible à la casse)")

    class Config:
        json_schema_extra = {
            "example": {
                "email_confirmation": "user@example.com"
            }
        } 
