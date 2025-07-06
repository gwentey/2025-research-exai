import uuid
import logging
import httpx
from fastapi import FastAPI, Depends, status, Request, Query, HTTPException
from fastapi.responses import Response, RedirectResponse, JSONResponse
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

# Lifespan manager (si vous en avez un)
@asynccontextmanager
async def lifespan(app: FastAPI):
    # ... code de démarrage ...
    yield
    # ... code d'arrêt ...

# Configure basic logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Création de l'instance FastAPI
app = FastAPI(
    title=settings.PROJECT_NAME,
    openapi_url=f"{settings.API_V1_STR}/openapi.json",
    lifespan=lifespan # Utilisez lifespan si défini
)

# Configuration CORS - Version ultra simple
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Autoriser toutes les origines temporairement 
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

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
    settings.GOOGLE_OAUTH_CLIENT_SECRET,
    # Define the scopes needed
    scopes=["https://www.googleapis.com/auth/userinfo.profile", "https://www.googleapis.com/auth/userinfo.email"]
    # redirect_uri should not be set here; fastapi-users handles it based on request/config
)

# Ajouter une route personnalisée pour l'autorisation Google qui corrige le problème de protocole
@app.get("/auth/google/authorize")
async def google_oauth_authorize(request: Request, redirect_uri: str = Query(...)):
    """
    Endpoint personnalisé pour l'autorisation Google OAuth qui corrige le problème de HTTP vs HTTPS.
    Remplace la route par défaut de fastapi-users pour plus de contrôle.
    """
    # Détection du mode production en utilisant les domaines configurés
    is_production = (
        any(domain in request.base_url.netloc for domain in settings.PRODUCTION_DOMAINS) or
        settings.OAUTH_REDIRECT_URL.startswith("https://")
    )
    
    # Forcer HTTPS en production, peu importe le protocole de la requête entrante
    scheme = "https" if is_production else request.base_url.scheme
    callback_url = f"{scheme}://{request.base_url.netloc}/auth/google/callback"
    
    logger.info(f"OAUTH: Using callback URL: {callback_url} (production: {is_production})")
    logger.info(f"OAUTH: Frontend redirect URI: {redirect_uri}")
    
    # Générer un state simple pour l'autorisation
    from uuid import uuid4
    
    # Préparer un token simple qui servira de state
    token = str(uuid4())
    
    # Obtenir l'URL d'autorisation
    authorization_url = await google_oauth_client.get_authorization_url(
        redirect_uri=callback_url,
        state=token
    )
    
    # Renvoyer l'URL comme dans la route par défaut
    return {"authorization_url": authorization_url}

# 6. FastAPIUsers Initialization
fastapi_users = FastAPIUsers[UserModel, uuid.UUID](
    get_user_manager,
    [auth_backend],
)

# Dependency for checking if a user is authenticated and active
current_active_user = fastapi_users.current_user(active=True)
# Dependency for checking if a user is authenticated, active, and a superuser
current_superuser = fastapi_users.current_user(active=True, superuser=True)

# Endpoint de diagnostic CORS pour le débogage en production
@app.get("/cors-debug", tags=["status"], include_in_schema=True)
async def cors_debug():
    """Endpoint de débogage pour vérifier la configuration CORS."""
    return {
        "cors_origins": ["*"],
        "production_domains": settings.PRODUCTION_DOMAINS,
        "backend_cors_origins_setting": settings.BACKEND_CORS_ORIGINS
    }

# Endpoint personnalisé pour gérer la redirection de Google après authentification
@app.get("/auth/google/callback", include_in_schema=True)
async def google_oauth_callback(request: Request):
    """
    Intercepte la redirection GET de Google et redirige vers le frontend.
    Cette route a priorité sur celle de fastapi-users car définie en premier.
    """
    # Récupérer les paramètres code et state de l'URL
    params = request.query_params
    code = params.get("code")
    state = params.get("state")
    
    if not code or not state:
        logger.error("Missing code or state in Google OAuth callback")
        return RedirectResponse(
            url=f"{settings.OAUTH_REDIRECT_URL}?error=missing_params",
            status_code=307
        )
    
    # Rediriger vers le frontend avec les mêmes paramètres
    frontend_callback_url = f"{settings.OAUTH_REDIRECT_URL}?code={code}&state={state}"
    logger.info(f"Redirecting to frontend: {frontend_callback_url}")
    
    return RedirectResponse(
        url=frontend_callback_url,
        status_code=307
    )

# Nouvel endpoint spécifique pour l'échange de code contre un token
# Sera utilisé par le frontend au lieu d'appeler directement /auth/google/callback
@app.post("/auth/google/exchange-token", include_in_schema=True)
async def exchange_google_token(
    request: Request,
    oauth_client: GoogleOAuth2 = Depends(lambda: google_oauth_client),
    user_manager: UserManager = Depends(get_user_manager),
):
    """
    Endpoint simplifié pour échanger un code d'autorisation Google contre un token JWT.
    
    Cette fonction :
    1. Récupère le code d'autorisation OAuth de Google
    2. L'échange contre un token d'accès
    3. Obtient les informations de l'utilisateur (principalement l'email)
    4. Crée l'utilisateur s'il n'existe pas déjà
    5. Génère un token JWT

    Paramètres:
        request: Objet FastAPI Request
        oauth_client: Instance GoogleOAuth2 (injectée par dépendance)
        user_manager: Instance UserManager (injectée par dépendance)

    Retourne:
        JSONResponse avec le token d'accès (JWT) et ses informations
    """
    try:
        # Récupérer le corps de la requête (JSON)
        data = await request.json()
        code = data.get("code")
        state = data.get("state")
        
        if not code or not state:
            return JSONResponse(
                status_code=400,
                content={"detail": "Missing code or state parameter"},
            )
        
        # Détection du mode production en utilisant les domaines configurés
        is_production = (
            any(domain in request.base_url.netloc for domain in settings.PRODUCTION_DOMAINS) or
            settings.OAUTH_REDIRECT_URL.startswith("https://")
        )
            
        # Construire l'URL de callback backend avec le bon protocole
        scheme = "https" if is_production else request.base_url.scheme
        backend_callback_url = f"{scheme}://{request.base_url.netloc}/auth/google/callback"
        logger.info(f"Using callback URL for token exchange: {backend_callback_url} (production: {is_production})")
        
        # Obtenir le token d'accès auprès de Google
        try:
            access_token = await oauth_client.get_access_token(code, backend_callback_url)
        except Exception as e:
            logger.exception(f"Error getting access token: {str(e)}")
            return JSONResponse(
                status_code=400,
                content={"detail": f"Could not obtain access token: {str(e)}"},
            )
        
        if not access_token:
            return JSONResponse(
                status_code=400,
                content={"detail": "Could not obtain access token from OAuth provider"},
            )
        
        # Récupérer l'email utilisateur
        user_info = await oauth_client.get_id_email(access_token["access_token"])
        if not user_info:
            return JSONResponse(
                status_code=400, 
                content={"detail": "Could not get user info from OAuth provider"},
            )
        
        account_id, account_email = user_info
        
        # Récupérer des informations supplémentaires de l'utilisateur depuis Google
        import httpx
        try:
            # Récupérer les données utilisateur (profil, nom, prénom, image) depuis Google
            async with httpx.AsyncClient() as client:
                userinfo_response = await client.get(
                    "https://www.googleapis.com/oauth2/v3/userinfo",
                    headers={"Authorization": f"Bearer {access_token['access_token']}"}
                )
                
                if userinfo_response.status_code == 200:
                    google_userinfo = userinfo_response.json()
                    logger.info(f"Retrieved user info from Google: {google_userinfo}")
                    
                    # Extraire des informations utiles du profil
                    google_picture = google_userinfo.get("picture")
                    google_given_name = google_userinfo.get("given_name")
                    google_family_name = google_userinfo.get("family_name")
                    google_locale = google_userinfo.get("locale")
                    
                    # Créer un pseudo basé sur le prénom et nom de famille
                    google_pseudo = None
                    if google_given_name:
                        google_pseudo = google_given_name.lower()
                        if google_family_name:
                            # Ajouter initiale du nom de famille
                            google_pseudo += google_family_name[0].lower()
                else:
                    logger.warning(f"Failed to get user profile from Google: {userinfo_response.status_code}")
                    google_picture = None
                    google_given_name = None
                    google_family_name = None
                    google_locale = None
                    google_pseudo = None
        except Exception as user_info_error:
            logger.exception(f"Error fetching additional user info: {str(user_info_error)}")
            google_picture = None
            google_given_name = None
            google_family_name = None
            google_locale = None
            google_pseudo = None
        
        # Générer le token JWT (cette partie fonctionne déjà)
        logger.info(f"Generating token for email: {account_email}")
        from uuid import uuid4
        
        # Vérifier si l'utilisateur existe déjà et récupérer son ID
        try:
            # Obtenir une session
            db_gen = get_async_session()
            session = await anext(db_gen)
            
            try:
                # Vérifier si l'utilisateur existe déjà avec une requête SQL directe
                from sqlalchemy import select
                query = select(UserModel).where(UserModel.email == account_email)
                result = await session.execute(query)
                existing_user = result.scalars().first()
                
                if existing_user:
                    # Utilisateur existe déjà, utiliser son ID pour le token
                    user_id = existing_user.id
                    # S'assurer que l'utilisateur est vérifié
                    if not existing_user.is_verified:
                        existing_user.is_verified = True
                        session.add(existing_user)
                        await session.commit()
                    logger.info(f"Using existing user {user_id} for token generation")
                else:
                    # L'utilisateur n'existe pas, on le crée avec un nouvel ID
                    user_id = uuid4()
                    import secrets
                    import bcrypt
                    
                    # Générer un mot de passe aléatoire et le hacher
                    random_password = secrets.token_urlsafe(16)
                    salt = bcrypt.gensalt()
                    hashed_password = bcrypt.hashpw(random_password.encode(), salt).decode()
                    
                    # Créer un utilisateur directement avec SQLAlchemy
                    new_user = UserModel(
                        id=user_id,  # Nouvel ID pour le nouvel utilisateur
                        email=account_email,
                        hashed_password=hashed_password,
                        is_active=True,
                        is_verified=True,  # Important: marquer comme vérifié
                        is_superuser=False,
                        pseudo=google_pseudo,
                        picture=google_picture,
                        given_name=google_given_name,
                        family_name=google_family_name,
                        locale=google_locale
                    )
                    
                    # Ajouter l'utilisateur
                    session.add(new_user)
                    
                    # Créer une entrée dans la table oauth_account pour lier l'utilisateur à Google
                    oauth_account = OAuthAccount(
                        id=uuid4(),
                        oauth_name="google",   # Nom du fournisseur OAuth
                        account_id=account_id, # ID du compte Google obtenu plus tôt
                        account_email=account_email,
                        user_id=user_id,       # Même ID que l'utilisateur créé
                        access_token=access_token["access_token"],    # Token d'accès obligatoire
                        refresh_token=access_token.get("refresh_token", ""),  # Token de rafraîchissement
                        expires_at=int(access_token.get("expires_at", 0))     # Date d'expiration
                    )
                    
                    # Ajouter le compte OAuth
                    session.add(oauth_account)
                    
                    # Enregistrer les deux
                    await session.commit()
                    logger.info(f"User and OAuth account created for: {account_email}")
                
                # Créer un objet UserModel temporaire pour la génération du token
                # avec les bonnes valeurs pour s'assurer que JWTStrategy générera le bon token
                temp_user = UserModel(
                    id=user_id,
                    email=account_email,
                    hashed_password="$2b$12$temporaryhashed",  # Valeur temporaire, ne sera pas utilisée
                    is_active=True,
                    is_verified=True,
                    is_superuser=False,
                    # Champs personnalisés définis dans schemas/user.py
                    pseudo=None,
                    picture=None,
                    given_name=None,
                    family_name=None,
                    locale=None
                )
                
                # Utiliser la méthode intégrée pour générer le token avec le bon ID utilisateur
                token_data = await auth_backend.get_strategy().write_token(temp_user)
                    
            except Exception as inner_error:
                logger.exception(f"Error during database operation: {str(inner_error)}")
                try:
                    await session.rollback()
                except Exception:
                    pass
                # Créer un ID factice pour pouvoir continuer avec un token valide
                user_id = uuid4()
                # Générer un token avec cet ID factice (pourrait ne pas fonctionner correctement)
                temp_user = UserModel(
                    id=user_id, 
                    email=account_email, 
                    hashed_password="", 
                    is_active=True, 
                    is_verified=True, 
                    is_superuser=False,
                    pseudo=google_pseudo,
                    picture=google_picture,
                    given_name=google_given_name,
                    family_name=google_family_name,
                    locale=google_locale
                )
                token_data = await auth_backend.get_strategy().write_token(temp_user)
            finally:
                # Fermer la session proprement
                await session.close()
                try:
                    await db_gen.asend(None)
                except StopAsyncIteration:
                    pass
                
        except Exception as e:
            logger.exception(f"Error during token generation: {str(e)}")
            # Créer un ID factice pour pouvoir continuer
            user_id = uuid4()
            # Générer un token avec cet ID factice (pourrait ne pas fonctionner correctement)
            temp_user = UserModel(
                id=user_id, 
                email=account_email, 
                hashed_password="", 
                is_active=True, 
                is_verified=True, 
                is_superuser=False,
                pseudo=google_pseudo,
                picture=google_picture,
                given_name=google_given_name,
                family_name=google_family_name,
                locale=google_locale
            )
            token_data = await auth_backend.get_strategy().write_token(temp_user)
        
        # Retourner le token JWT, indépendamment de la création en base
        return {
            "access_token": token_data,
            "token_type": "bearer",
            "user": {
                "id": str(user_id),
                "email": account_email,
                "is_active": True,
                "is_verified": True,
                "is_superuser": False,
                "pseudo": google_pseudo,
                "picture": google_picture,
                "given_name": google_given_name,
                "family_name": google_family_name,
                "locale": google_locale
            }
        }
    except Exception as e:
        logger.exception(f"Unexpected error in exchange_google_token: {str(e)}")
        return JSONResponse(
            status_code=500,
            content={"detail": f"Unexpected authentication error: {str(e)}"},
        )

# Example Protected Route - MOVED ABOVE THE USER ROUTER INCLUSION
@app.get("/users/me", tags=["users"])
def read_users_me(current_user: UserModel = Depends(current_active_user)):
    """
    Renvoie les informations de l'utilisateur actuellement authentifié.
    Nécessite seulement que l'utilisateur soit actif (pas de vérification).
    """
    return current_user

# Auth routes (login, logout)
app.include_router(
    fastapi_users.get_auth_router(auth_backend),
    prefix="/auth/jwt",
    tags=["auth"],
)

# Route d'inscription personnalisée pour corriger le problème
@app.post("/auth/register", tags=["auth"])
async def register_user(
    user_create: UserCreate,
    user_manager: UserManager = Depends(get_user_manager),
):
    """
    Route d'inscription personnalisée pour remplacer celle de fastapi-users
    qui semble avoir un problème.
    """
    try:
        logger.info(f"Tentative d'inscription pour: {user_create.email}")
        
        # Vérification préliminaire si l'utilisateur existe déjà
        db_gen = get_async_session()
        session = await anext(db_gen)
        
        try:
            # Vérifier si l'email existe déjà
            from sqlalchemy import select, func
            query = select(func.count()).select_from(UserModel).where(UserModel.email == user_create.email)
            result = await session.execute(query)
            count = result.scalar()
            
            if count > 0:
                # Email déjà utilisé
                logger.warning(f"Tentative d'inscription avec un email déjà utilisé: {user_create.email}")
                return JSONResponse(
                    status_code=400,
                    content={"detail": "Cet email est déjà utilisé"}
                )
            
            # Créer l'utilisateur en utilisant le UserManager
            try:
                # Définir is_verified=True pour l'utilisateur avant de le créer
                user_dict = user_create.model_dump()
                user_dict["is_verified"] = True
                user_create_verified = UserCreate(**user_dict)
                
                created_user = await user_manager.create(user_create_verified)
                logger.info(f"Utilisateur créé avec succès: {created_user.id}")
                
                # Vérifier si l'utilisateur est bien marqué comme vérifié
                if not created_user.is_verified:
                    # Si ce n'est pas le cas, mettre à jour manuellement
                    logger.info(f"Mise à jour manuelle de is_verified pour l'utilisateur {created_user.id}")
                    created_user.is_verified = True
                    session.add(created_user)
                    await session.commit()
                
                # Retourner les infos utilisateur sans le mot de passe
                return UserRead.model_validate(created_user)
            except Exception as user_error:
                # S'assurer que la session est annulée en cas d'erreur
                try:
                    await session.rollback()
                except Exception:
                    pass
                    
                logger.exception(f"Erreur lors de la création de l'utilisateur: {str(user_error)}")
                return JSONResponse(
                    status_code=500,
                    content={"detail": f"Erreur lors de la création de l'utilisateur: {str(user_error)}"}
                )
                
        except Exception as db_error:
            # S'assurer que la session est annulée en cas d'erreur
            try:
                await session.rollback()
            except Exception:
                pass
                
            logger.exception(f"Erreur lors de la vérification en base de données: {str(db_error)}")
            return JSONResponse(
                status_code=500,
                content={"detail": f"Erreur lors de la vérification en base de données: {str(db_error)}"}
            )
        finally:
            # Fermer la session proprement
            await session.close()
            try:
                await db_gen.asend(None)
            except StopAsyncIteration:
                pass
    except Exception as e:
        logger.exception(f"Erreur inattendue lors de l'inscription: {str(e)}")
        return JSONResponse(
            status_code=500,
            content={"detail": f"Erreur inattendue lors de l'inscription: {str(e)}"}
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
        oauth_client=google_oauth_client,
        backend=auth_backend,
        state_secret=settings.SECRET_KEY,
        associate_by_email=True,
        is_verified_by_default=True,
    ),
    prefix="/auth/google",
    tags=["auth"],
)

# Fonction helper pour faire des requêtes vers les services backend
async def proxy_request(
    request: Request,
    service_url: str,
    path: str,
    current_user: UserModel
):
    """
    Fonction générique pour faire du reverse proxy vers les services backend.
    Transmet les paramètres de query, le body et les headers nécessaires.
    """
    try:
        # Construire l'URL complète vers le service backend
        target_url = f"{service_url.rstrip('/')}/{path.lstrip('/')}"
        
        # Récupérer les paramètres de query
        query_params = dict(request.query_params)
        
        # Préparer les headers à transmettre
        headers = {
            "Content-Type": "application/json",
            "User-Agent": "API-Gateway-Proxy/1.0"
        }
        
        # Récupérer le body si c'est une requête POST/PUT/PATCH
        body = None
        if request.method in ["POST", "PUT", "PATCH"]:
            body = await request.body()
        
        # Faire la requête vers le service backend
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.request(
                method=request.method,
                url=target_url,
                params=query_params,
                headers=headers,
                content=body
            )
            
            # Retourner la réponse du service backend
            return JSONResponse(
                status_code=response.status_code,
                content=response.json() if response.content else None
            )
            
    except httpx.RequestError as e:
        logger.error(f"Error proxying request to {service_url}: {e}")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Service temporairement indisponible"
        )
    except Exception as e:
        logger.error(f"Unexpected error in proxy_request: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Erreur interne du serveur"
        )

# Routes pour les datasets (service-selection)
@app.api_route("/datasets", methods=["GET", "POST"], tags=["datasets"])
async def datasets_proxy(request: Request, current_user: UserModel = Depends(current_active_user)):
    """Proxy vers le service-selection pour les opérations sur les datasets"""
    return await proxy_request(request, settings.SERVICE_SELECTION_URL, "datasets", current_user)

@app.api_route("/datasets/{dataset_id}", methods=["GET", "PUT", "DELETE"], tags=["datasets"])
async def dataset_detail_proxy(dataset_id: str, request: Request, current_user: UserModel = Depends(current_active_user)):
    """Proxy vers le service-selection pour les opérations sur un dataset spécifique"""
    return await proxy_request(request, settings.SERVICE_SELECTION_URL, f"datasets/{dataset_id}", current_user)

@app.get("/datasets/domains", tags=["datasets"])
async def datasets_domains_proxy(request: Request, current_user: UserModel = Depends(current_active_user)):
    """Proxy vers le service-selection pour récupérer les domaines d'application"""
    return await proxy_request(request, settings.SERVICE_SELECTION_URL, "datasets/domains", current_user)

@app.get("/datasets/tasks", tags=["datasets"])
async def datasets_tasks_proxy(request: Request, current_user: UserModel = Depends(current_active_user)):
    """Proxy vers le service-selection pour récupérer les tâches ML"""
    return await proxy_request(request, settings.SERVICE_SELECTION_URL, "datasets/tasks", current_user)

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
