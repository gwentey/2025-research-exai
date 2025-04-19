import uuid
from fastapi_users import schemas

# Schéma Pydantic pour la lecture d'un utilisateur (sans le mot de passe)
class UserRead(schemas.BaseUser[uuid.UUID]):
    # Inclut par défaut: id, email, is_active, is_superuser, is_verified
    # Ajoutez ici les champs supplémentaires du modèle User si nécessaire
    # first_name: str | None = None
    # last_name: str | None = None
    pass

# Schéma Pydantic pour la création d'un utilisateur
class UserCreate(schemas.BaseUserCreate):
    # Inclut par défaut: email, password
    # Ajoutez ici les champs supplémentaires requis à la création
    # first_name: str
    # last_name: str
    pass

# Schéma Pydantic pour la mise à jour d'un utilisateur (par l'utilisateur lui-même)
class UserUpdate(schemas.BaseUserUpdate):
    # Permet la mise à jour du mot de passe (optionnel)
    # Ajoutez ici les champs supplémentaires modifiables
    # first_name: str | None = None
    # last_name: str | None = None
    pass 