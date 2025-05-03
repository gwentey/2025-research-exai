import uuid
from fastapi import FastAPI, Depends, status
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Annotated

from fastapi_users import FastAPIUsers
from fastapi_users.authentication import AuthenticationBackend, BearerTransport, JWTStrategy
from fastapi_users_db_sqlalchemy import SQLAlchemyUserDatabase

from httpx_oauth.clients.google import GoogleOAuth2

from .core.config import settings
from .db import get_async_session
from .schemas.user import UserCreate, UserRead, UserUpdate
from .models.user import User as UserModel, OAuthAccount
from .managers.user import UserManager

# 1. Database Adapter
async def get_user_db(session: AsyncSession = Depends(get_async_session)):
    yield SQLAlchemyUserDatabase(session, UserModel, OAuthAccount)

# 2. UserManager dépendant de get_user_db
async def get_user_manager(user_db=Depends(get_user_db)):
    yield UserManager(user_db)

# 3. JWT Strategy
def get_jwt_strategy() -> JWTStrategy:
    return JWTStrategy(secret=settings.SECRET_KEY, lifetime_seconds=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60)

# 4. Authentication Backend
bearer_transport = BearerTransport(tokenUrl="auth/jwt/login")
auth_backend = AuthenticationBackend(
    name="jwt",
    transport=bearer_transport,
    get_strategy=get_jwt_strategy,
)

# 5. Client OAuth Google
google_oauth_client = GoogleOAuth2(
    settings.GOOGLE_OAUTH_CLIENT_ID,
    settings.GOOGLE_OAUTH_CLIENT_SECRET
)

# 6. FastAPIUsers Initialization
fastapi_users = FastAPIUsers[UserModel, uuid.UUID](
    get_user_manager,
    [auth_backend],
)

# Dependency for checking if a user is authenticated and active
current_active_user = fastapi_users.current_user(active=True)
# Dependency for checking if a user is authenticated, active, and a superuser
current_superuser = fastapi_users.current_user(active=True, superuser=True)

# FastAPI App Initialization
app = FastAPI(
    title="EXAI API Gateway",
    description="API Gateway pour le projet EXAI - Plateforme d'Explainable AI",
    version="0.1.0",
)

# Simple health check endpoint
@app.get("/health", tags=["status"], status_code=status.HTTP_200_OK)
async def health_check(session: AsyncSession = Depends(get_async_session)):
    """Vérifie la disponibilité du service et la connexion DB de base."""
    try:
        # Tente d'obtenir une connexion pour vérifier la dispo de la DB
        await session.connection()
        return {"status": "ok", "database": "connected"}
    except Exception:
        # Si la connexion échoue, on peut le signaler
        # Mais la sonde devrait quand même retourner 200 pour que le service ne soit pas tué
        # sauf si la DB est absolument critique pour le démarrage même du service.
        # Pour une sonde readiness/liveness, un simple 200 est souvent suffisant.
        return {"status": "ok", "database": "error"}

# Configuration CORS
origins = [
    "https://exai-pipeline.fr", # Origine du Frontend
    "https://api.exai-pipeline.fr", # Origine de l'API elle-même (par sécurité)
    "http://localhost:4200",
    "http://localhost:8080", # Ajout pour le frontend Angular local
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
# Reset password routes
app.include_router(
    fastapi_users.get_reset_password_router(),
    prefix="/auth",
    tags=["auth"],
)
# Verify email routes
app.include_router(
    fastapi_users.get_verify_router(UserRead),
    prefix="/auth",
    tags=["auth"],
)
# User management routes (protected by superuser requirement)
app.include_router(
    fastapi_users.get_users_router(UserRead, UserUpdate),
    prefix="/users",
    tags=["users"],
    dependencies=[Depends(current_superuser)],
)

# Google OAuth routes
app.include_router(
    fastapi_users.get_oauth_router(
        google_oauth_client,
        auth_backend,
        settings.SECRET_KEY,
        redirect_url=settings.OAUTH_REDIRECT_URL
    ),
    prefix="/auth/google",
    tags=["auth"],
)

# Test route (ping)
@app.get("/ping", tags=["status"])
def ping():
    return {"message": "pong from API Gateway"}

# Example Protected Route
@app.get("/users/me", tags=["users"])
def read_users_me(current_user: UserModel = Depends(current_active_user)):
    """
    Renvoie les informations de l'utilisateur actuellement authentifié.
    """
    return current_user
