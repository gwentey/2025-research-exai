import uuid
from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.ext.asyncio import AsyncSession

from fastapi_users import FastAPIUsers
from fastapi_users.authentication import AuthenticationBackend, BearerTransport, JWTStrategy
from fastapi_users_db_sqlalchemy import SQLAlchemyUserDatabase

from .core.config import settings
from .db import get_async_session # Retirons l'import de User depuis db
from .schemas.user import UserCreate, UserRead, UserUpdate
from .models.user import User as UserModel # Import correct du modèle User

# 1. Database Adapter
async def get_user_db(session: AsyncSession = Depends(get_async_session)):
    yield SQLAlchemyUserDatabase(session, UserModel)

# 2. JWT Strategy
def get_jwt_strategy() -> JWTStrategy:
    return JWTStrategy(secret=settings.SECRET_KEY, lifetime_seconds=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60)

# 3. Authentication Backend
bearer_transport = BearerTransport(tokenUrl="auth/jwt/login")
auth_backend = AuthenticationBackend(
    name="jwt",
    transport=bearer_transport,
    get_strategy=get_jwt_strategy,
)

# 4. FastAPIUsers Initialization - Corrigé pour la version 14.0.1
# Création d'une instance FastAPIUsers avec seulement les arguments nécessaires
fastapi_users = FastAPIUsers[UserModel, uuid.UUID](
    get_user_db,
    [auth_backend],
)

current_active_user = fastapi_users.current_user(active=True)

# FastAPI App Initialization
app = FastAPI(
    title="EXAI API Gateway",
    # Add other FastAPI options like description, version, etc. if needed
)

# Configuration CORS
origins = [
    "*",  # Autorise toutes les origines (à restreindre en production)
    # Exemple si le frontend Angular tourne sur localhost:4200 :
    # "http://localhost:4200",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,  # Autorise les cookies (si nécessaire pour JWT)
    allow_methods=["*"],  # Autorise toutes les méthodes (GET, POST, etc.)
    allow_headers=["*"],  # Autorise tous les en-têtes
)

# Include FastAPI-Users routers
# Auth routes (login, logout)
app.include_router(
    fastapi_users.get_auth_router(auth_backend),
    prefix="/auth/jwt",
    tags=["auth"],
)
# Registration routes
app.include_router(
    fastapi_users.get_register_router(UserRead, UserCreate),
    prefix="/auth",
    tags=["auth"],
)
# User management routes (optional, for superusers/admins usually)
# app.include_router(
#     fastapi_users.get_users_router(UserRead, UserUpdate),
#     prefix="/users",
#     tags=["users"],
# )

# Test route (ping)
@app.get("/ping")
def ping():
    return {"message": "pong from API Gateway"}

# Example Protected Route
@app.get("/users/me")
def read_users_me(current_user: UserModel = Depends(current_active_user)):
    # Using the current_active_user dependency to ensure the user is authenticated
    return current_user
