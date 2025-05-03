import uuid
from fastapi import FastAPI, Depends, status
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Annotated
from contextlib import asynccontextmanager

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

# Lifespan manager (si vous en avez un)
@asynccontextmanager
async def lifespan(app: FastAPI):
    # ... code de démarrage ...
    yield
    # ... code d'arrêt ...

app = FastAPI(
    title=settings.PROJECT_NAME,
    openapi_url=f"{settings.API_V1_STR}/openapi.json",
    lifespan=lifespan # Utilisez lifespan si défini
)

# Configuration CORS
# ATTENTION: Pour la production, soyez plus restrictif avec les origines autorisées.
# Utilisez settings.BACKEND_CORS_ORIGINS si défini dans votre config.
origins = [
    "http://localhost:8080", # Origine du frontend Angular en développement
    # Ajoutez d'autres origines si nécessaire (ex: l'URL de production de votre frontend)
]
# Utiliser les origines depuis les settings si possible, sinon la liste par défaut
if settings.BACKEND_CORS_ORIGINS:
    origins = [str(origin).strip("/") for origin in settings.BACKEND_CORS_ORIGINS.split(",")]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True, # Important pour les cookies/auth
    allow_methods=["*"], # Ou spécifiez des méthodes: ["GET", "POST", ...]
    allow_headers=["*"], # Ou spécifiez des en-têtes: ["Content-Type", "Authorization"]
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

# Route racine simple (optionnel)
@app.get("/")
def read_root():
    return {"message": f"Welcome to {settings.PROJECT_NAME}"}

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

# Example Protected Route
@app.get("/users/me", tags=["users"])
def read_users_me(current_user: UserModel = Depends(current_active_user)):
    """
    Renvoie les informations de l'utilisateur actuellement authentifié.
    """
    return current_user
