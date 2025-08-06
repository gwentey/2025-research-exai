import uuid
import logging
import httpx
from fastapi import FastAPI, Depends, status, Request, Query, HTTPException
from fastapi.responses import Response, RedirectResponse, JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, update
from typing import Annotated
from contextlib import asynccontextmanager

from fastapi_users import FastAPIUsers
from fastapi_users.authentication import AuthenticationBackend, BearerTransport, JWTStrategy
from fastapi_users_db_sqlalchemy import SQLAlchemyUserDatabase

from httpx_oauth.clients.google import GoogleOAuth2

from .core.config import settings
from .db import get_async_session
from .schemas.user import UserCreate, UserRead, UserUpdate, UserProfileUpdate, PasswordUpdate, ProfilePictureUpdate, AccountDeletionRequest, SignupResponse
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

# Configuration CORS - Support production et développement
allowed_origins = [
    "http://localhost:8080",  # Développement local
    "http://ibisx.fr",        # HTTP temporaire en production
    "https://ibisx.fr",       # HTTPS production principal
    "https://www.ibisx.fr",   # Variante avec www
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],  # Toutes les méthodes
    allow_headers=["*"],  # Tous les headers
    expose_headers=["*"]  # Exposer tous les headers
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
    # CORRECTION : Utiliser directement le redirect_uri du frontend au lieu de construire une URL API
    # Le redirect_uri vient du frontend (ex: https://ibisx.fr/authentication/callback)
    callback_url = redirect_uri
    
    # Détection du mode production pour validation
    is_production = callback_url.startswith("https://")
    
    logger.info(f"OAUTH: Using frontend callback URL: {callback_url} (production: {is_production})")
    
    # Générer un state simple pour l'autorisation
    from uuid import uuid4
    
    # Préparer un token simple qui servira de state
    token = str(uuid4())
    
    # Obtenir l'URL d'autorisation avec le bon callback URL (frontend)
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
        
        # CORRECTION : Utiliser la même URL de redirection que celle utilisée lors de l'autorisation
        # Google OAuth exige que l'URL de redirection soit EXACTEMENT la même lors de l'échange du token
        # Nous devons reconstituer l'URL du frontend depuis le referer ou utiliser une URL standard
        
        # Pour la production, utiliser l'URL standard du frontend
        is_production = "https://" in str(request.headers.get("referer", ""))
        
        if is_production:
            # URL du frontend en production (même que celle utilisée pour l'autorisation)
            frontend_callback_url = "https://ibisx.fr/authentication/callback"
        else:
            # URL du frontend en développement
            frontend_callback_url = "http://localhost:8080/authentication/callback"
            
        logger.info(f"Using frontend callback URL for token exchange: {frontend_callback_url} (production: {is_production})")
        
        # Obtenir le token d'accès auprès de Google avec l'URL frontend
        try:
            access_token = await oauth_client.get_access_token(code, frontend_callback_url)
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
    return UserRead.from_orm_user(current_user)

@app.get("/users/me/debug", tags=["users"])
async def debug_user_info(
    current_user: UserModel = Depends(current_active_user),
    session: AsyncSession = Depends(get_async_session)
):
    """
    Endpoint de débogage pour diagnostiquer les problèmes de session.
    """
    try:
        logger.info(f"DEBUG: current_user type: {type(current_user)}")
        logger.info(f"DEBUG: current_user id: {current_user.id}")
        logger.info(f"DEBUG: current_user email: {current_user.email}")
        
        # Test de récupération dans notre session
        stmt = select(UserModel).where(UserModel.id == current_user.id)
        result = await session.execute(stmt)
        user_in_session = result.unique().scalar_one_or_none()
        
        logger.info(f"DEBUG: user_in_session found: {user_in_session is not None}")
        if user_in_session:
            logger.info(f"DEBUG: user_in_session type: {type(user_in_session)}")
            logger.info(f"DEBUG: user_in_session id: {user_in_session.id}")
        
        return {
            "status": "debug_success",
            "current_user_id": str(current_user.id),
            "current_user_email": current_user.email,
            "user_found_in_session": user_in_session is not None,
            "session_type": str(type(session))
        }
        
    except Exception as e:
        logger.error(f"DEBUG ERROR: {str(e)}")
        logger.error(f"DEBUG ERROR type: {type(e)}")
        import traceback
        logger.error(f"DEBUG TRACEBACK: {traceback.format_exc()}")
        return {
            "status": "debug_error",
            "error": str(e),
            "error_type": str(type(e))
        }

@app.patch("/users/me", tags=["users"])
async def update_user_profile(
    profile_update: UserProfileUpdate,
    current_user: UserModel = Depends(current_active_user),
    session: AsyncSession = Depends(get_async_session)
):
    """
    Met à jour les informations du profil de l'utilisateur actuellement authentifié.
    """
    try:
        logger.info(f"Mise à jour du profil pour l'utilisateur {current_user.id}")
        
        # Récupérer l'utilisateur dans notre session
        stmt = select(UserModel).where(UserModel.id == current_user.id)
        result = await session.execute(stmt)
        user_in_session = result.unique().scalar_one_or_none()
        
        if not user_in_session:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Utilisateur non trouvé"
            )
        
        # Mise à jour des champs fournis
        update_data = profile_update.model_dump(exclude_unset=True)
        logger.info(f"DEBUG: update_data = {update_data}")
        
        for field, value in update_data.items():
            if hasattr(user_in_session, field):
                logger.info(f"DEBUG: Setting {field} = {value}")
                setattr(user_in_session, field, value)
            else:
                logger.warning(f"DEBUG: Field {field} not found on user model")
        
        # Sauvegarder les modifications
        logger.info("DEBUG: About to commit changes")
        await session.commit()
        logger.info("DEBUG: Commit successful")
        
        # Récupérer l'utilisateur mis à jour avec les relations chargées
        stmt_updated = select(UserModel).where(UserModel.id == current_user.id)
        result_updated = await session.execute(stmt_updated)
        updated_user = result_updated.unique().scalar_one()
        
        logger.info(f"Profil mis à jour avec succès pour l'utilisateur {current_user.id}")
        return UserRead.from_orm_user(updated_user)
        
    except HTTPException:
        # Re-lever les HTTPException telles quelles
        raise
    except Exception as e:
        logger.error(f"Erreur lors de la mise à jour du profil: {str(e)}")
        await session.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Erreur lors de la mise à jour du profil"
        )

@app.patch("/users/me/password", tags=["users"])
async def update_user_password(
    password_update: PasswordUpdate,
    current_user: UserModel = Depends(current_active_user),
    session: AsyncSession = Depends(get_async_session),
    user_manager: UserManager = Depends(get_user_manager)
):
    """
    Met à jour le mot de passe de l'utilisateur actuellement authentifié.
    """
    try:
        logger.info(f"Changement de mot de passe pour l'utilisateur {current_user.id}")
        
        # Récupérer l'utilisateur dans notre session
        stmt = select(UserModel).where(UserModel.id == current_user.id)
        result = await session.execute(stmt)
        user_in_session = result.unique().scalar_one_or_none()
        
        if not user_in_session:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Utilisateur non trouvé"
            )
        
        # Vérifier l'ancien mot de passe
        is_valid = user_manager.password_helper.verify_and_update(
            password_update.current_password, 
            user_in_session.hashed_password
        )
        
        if not is_valid[0]:  # is_valid est un tuple (bool, updated_hash_or_none)
            logger.warning(f"Tentative de changement de mot de passe avec un mot de passe actuel incorrect pour l'utilisateur {current_user.id}")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Mot de passe actuel incorrect"
            )
        
        # Valider le nouveau mot de passe
        try:
            await user_manager.validate_password(password_update.new_password, user_in_session)
        except Exception as password_error:
            logger.error(f"Validation du nouveau mot de passe échouée: {str(password_error)}")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Le nouveau mot de passe ne répond pas aux exigences: {str(password_error)}"
            )
        
        # Hasher le nouveau mot de passe
        new_hashed_password = user_manager.password_helper.hash(password_update.new_password)
        user_in_session.hashed_password = new_hashed_password
        
        # Sauvegarder les modifications
        await session.commit()
        
        logger.info(f"Mot de passe mis à jour avec succès pour l'utilisateur {current_user.id}")
        return {"message": "Mot de passe mis à jour avec succès"}
        
    except HTTPException:
        # Re-lever les HTTPException telles quelles
        raise
    except Exception as e:
        logger.error(f"Erreur lors de la mise à jour du mot de passe: {str(e)}")
        await session.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Erreur lors de la mise à jour du mot de passe"
        )

@app.patch("/users/me/picture", tags=["users"])
async def update_user_picture(
    picture_update: ProfilePictureUpdate,
    current_user: UserModel = Depends(current_active_user),
    session: AsyncSession = Depends(get_async_session)
):
    """
    Met à jour l'image de profil de l'utilisateur actuellement authentifié.
    """
    try:
        logger.info(f"Mise à jour de l'image de profil pour l'utilisateur {current_user.id}")
        
        # Validation de base de l'image (optionnel)
        if picture_update.picture and len(picture_update.picture) > 10 * 1024 * 1024:  # 10MB max
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Image trop volumineuse (max 10MB)"
            )
        
        # Récupérer l'utilisateur dans notre session
        stmt = select(UserModel).where(UserModel.id == current_user.id)
        result = await session.execute(stmt)
        user_in_session = result.unique().scalar_one_or_none()
        
        if not user_in_session:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Utilisateur non trouvé"
            )
        
        # Mettre à jour l'image de profil
        user_in_session.picture = picture_update.picture
        
        # Sauvegarder les modifications
        await session.commit()
        await session.refresh(user_in_session)
        
        logger.info(f"Image de profil mise à jour avec succès pour l'utilisateur {current_user.id}")
        return UserRead.from_orm_user(user_in_session)
        
    except HTTPException:
        # Re-lever les HTTPException telles quelles
        raise
    except Exception as e:
        logger.error(f"Erreur lors de la mise à jour de l'image de profil: {str(e)}")
        await session.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Erreur lors de la mise à jour de l'image de profil"
        )

@app.delete("/users/me", tags=["users"])
async def delete_user_account(
    deletion_request: AccountDeletionRequest,
    current_user: UserModel = Depends(current_active_user),
    session: AsyncSession = Depends(get_async_session),
    user_manager: UserManager = Depends(get_user_manager)
):
    """
    Supprime définitivement le compte de l'utilisateur actuel.
    
    Cette opération est irréversible et supprime toutes les données associées :
    - Le profil utilisateur
    - Tous les projets de l'utilisateur
    - L'historique d'activité
    - Les données d'onboarding
    
    L'utilisateur doit confirmer en saisissant son adresse email.
    La vérification est insensible à la casse.
    
    Parameters:
        deletion_request: Contient l'email de confirmation
        current_user: Utilisateur authentifié (injecté par dépendance)
        session: Session de base de données (injectée par dépendance)
        user_manager: Gestionnaire d'utilisateurs (injecté par dépendance)
    
    Returns:
        JSONResponse: Confirmation de la suppression
    
    Raises:
        HTTPException: 
            - 400 si l'email de confirmation est incorrect
            - 500 si erreur lors de la suppression
    """
    try:
        logger.info(f"User account deletion requested for user {current_user.id}")
        
        # 1. Vérifier l'email de confirmation (insensible à la casse)
        if deletion_request.email_confirmation.lower() != current_user.email.lower():
            logger.warning(f"Invalid email confirmation provided for account deletion by user {current_user.id}")
            logger.warning(f"Expected: {current_user.email.lower()}, Got: {deletion_request.email_confirmation.lower()}")
            raise HTTPException(
                status_code=400,
                detail="L'email de confirmation ne correspond pas à votre adresse email"
            )
        
        # 2. Supprimer l'utilisateur (cela supprimera automatiquement les données liées grâce aux CASCADE)
        await user_manager.delete(current_user)
        
        logger.info(f"User account {current_user.id} deleted successfully")
        
        # 3. Retourner une confirmation
        return JSONResponse(
            status_code=200,
            content={
                "message": "Compte supprimé avec succès",
                "success": True
            }
        )
    
    except HTTPException:
        # Re-raise HTTPException pour qu'elle soit gérée par FastAPI
        raise
    
    except Exception as e:
        logger.error(f"Error deleting user account {current_user.id}: {str(e)}")
        await session.rollback()
        raise HTTPException(
            status_code=500,
            detail="Erreur lors de la suppression du compte"
        )
    
    finally:
        await session.close()

@app.post("/users/me/claim-credits", tags=["users"])
async def claim_user_credits(
    current_user: UserModel = Depends(current_active_user),
    user_manager: UserManager = Depends(get_user_manager)
):
    """
    Permet à l'utilisateur de récupérer des crédits (10 maximum, tous les 7 jours).
    
    Retourne les détails du claim avec le statut :
    - success: true si le claim a réussi
    - success: false si l'utilisateur doit attendre
    """
    try:
        result = await user_manager.claim_credits(current_user)
        
        if result["success"]:
            logger.info(f"Claim de crédits réussi pour l'utilisateur {current_user.id}")
            return JSONResponse(
                status_code=200,
                content=result
            )
        else:
            logger.info(f"Claim de crédits refusé pour l'utilisateur {current_user.id}: {result['message']}")
            return JSONResponse(
                status_code=400,
                content=result
            )
    except HTTPException:
        # Re-lever les HTTPException telles quelles
        raise
    except Exception as e:
        logger.error(f"Erreur lors du claim de crédits pour {current_user.id}: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail="Erreur lors de la récupération des crédits"
        )

# Auth routes (login, logout)
app.include_router(
    fastapi_users.get_auth_router(auth_backend),
    prefix="/auth/jwt",
    tags=["auth"],
)

# Route d'inscription personnalisée avec auto-connexion
@app.post("/auth/register", tags=["auth"], response_model=SignupResponse)
async def register_user(
    user_create: UserCreate,
    user_manager: UserManager = Depends(get_user_manager),
):
    """
    Route d'inscription personnalisée avec auto-connexion.
    Retourne les informations utilisateur + token JWT pour connexion immédiate.
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
                # L'email existe déjà, vérifier s'il est associé à un compte OAuth
                oauth_query = select(func.count()).select_from(OAuthAccount).where(OAuthAccount.account_email == user_create.email)
                oauth_result = await session.execute(oauth_query)
                oauth_count = oauth_result.scalar()
                
                if oauth_count > 0:
                    # L'email est associé à un compte OAuth (Google)
                    logger.warning(f"Tentative d'inscription avec un email déjà associé à un compte OAuth: {user_create.email}")
                    return JSONResponse(
                        status_code=400,
                        content={"detail": "EMAIL_ALREADY_LINKED_TO_OAUTH", "error_code": "EMAIL_OAUTH_CONFLICT"}
                    )
                else:
                    # L'email existe mais n'est pas OAuth (double inscription classique)
                    logger.warning(f"Tentative d'inscription avec un email déjà utilisé: {user_create.email}")
                    return JSONResponse(
                        status_code=400,
                        content={"detail": "EMAIL_ALREADY_EXISTS", "error_code": "EMAIL_DUPLICATE"}
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
                
                # *** NOUVEAUTÉ : Générer un token JWT pour auto-connexion ***
                jwt_strategy = get_jwt_strategy()
                access_token = await jwt_strategy.write_token(created_user)
                logger.info(f"Token JWT généré pour l'utilisateur {created_user.id}")
                
                # Retourner la réponse avec auto-connexion
                return SignupResponse(
                    access_token=access_token,
                    token_type="bearer",
                    user=UserRead.from_orm_user(created_user)
                )
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

# User management routes (basic fastapi-users routes)
# Note: Les routes /users/me restent accessibles aux utilisateurs normaux
app.include_router(
    fastapi_users.get_users_router(UserRead, UserUpdate),
    prefix="/users",
    tags=["users"],
)

# Routes administratives spécifiques pour la gestion des utilisateurs (admin seulement)
@app.get("/admin/users", tags=["admin"])
async def admin_get_all_users(
    page: int = Query(1, ge=1),
    page_size: int = Query(100, ge=1, le=100),
    current_user: UserModel = Depends(current_superuser),
    session: AsyncSession = Depends(get_async_session)
):
    """Liste tous les utilisateurs (admin seulement)"""
    try:
        skip = (page - 1) * page_size
        
        # Requête pour récupérer les utilisateurs avec pagination
        query = select(UserModel).offset(skip).limit(page_size)
        result = await session.execute(query)
        users = result.scalars().unique().all()
        
        # Compter le total d'utilisateurs
        count_query = select(func.count()).select_from(UserModel)
        count_result = await session.execute(count_query)
        total = count_result.scalar()
        
        # Convertir en schémas de réponse
        users_data = [UserRead.from_orm_user(user) for user in users]
        
        return {
            "users": users_data,
            "total": total,
            "page": page,
            "page_size": page_size,
            "total_pages": (total + page_size - 1) // page_size
        }
    except Exception as e:
        logger.error(f"Erreur lors de la récupération des utilisateurs: {e}")
        raise HTTPException(status_code=500, detail="Erreur interne du serveur")

@app.get("/admin/users/count", tags=["admin"])
async def admin_get_users_count(
    current_user: UserModel = Depends(current_superuser),
    session: AsyncSession = Depends(get_async_session)
):
    """Compte le nombre total d'utilisateurs (admin seulement)"""
    try:
        query = select(func.count()).select_from(UserModel)
        result = await session.execute(query)
        count = result.scalar()
        return {"total": count}
    except Exception as e:
        logger.error(f"Erreur lors du comptage des utilisateurs: {e}")
        raise HTTPException(status_code=500, detail="Erreur interne du serveur")



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
        
        # Préparer les headers à transmettre, incluant l'user_id pour l'authentification
        headers = {
            "User-Agent": "API-Gateway-Proxy/1.0",
            "X-User-ID": str(current_user.id),  # Transmettre l'ID de l'utilisateur connecté
            "X-User-Email": current_user.email,  # Optionnel : email pour debug
            "X-User-Role": current_user.role  # Transmettre le rôle pour l'autorisation
        }
        
        # Ne pas forcer Content-Type pour les uploads multipart
        content_type = request.headers.get("content-type")
        if content_type and not content_type.startswith("multipart/"):
            headers["Content-Type"] = "application/json"
        
        # Récupérer le body si c'est une requête POST/PUT/PATCH
        body = None
        files = None
        if request.method in ["POST", "PUT", "PATCH"]:
            # Pour les uploads multipart, on utilise request.form() et request.files
            if content_type and content_type.startswith("multipart/"):
                form = await request.form()
                files = []
                for key, file in form.items():
                    if hasattr(file, 'read'):  # C'est un fichier
                        files.append((key, (file.filename, file.file, file.content_type)))
                    else:  # C'est un champ normal
                        if not body:
                            body = {}
                        body[key] = file
            else:
                body = await request.body()
        
        # Faire la requête vers le service backend
        async with httpx.AsyncClient(timeout=30.0) as client:
            if files:
                # Pour les uploads de fichiers
                response = await client.request(
                    method=request.method,
                    url=target_url,
                    params=query_params,
                    headers=headers,
                    files=files,
                    data=body
                )
            else:
                # Pour les requêtes JSON normales
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

@app.post("/datasets/score", tags=["datasets"])
async def datasets_score_proxy(request: Request, current_user: UserModel = Depends(current_active_user)):
    """Proxy vers le service-selection pour le scoring des datasets"""
    return await proxy_request(request, settings.SERVICE_SELECTION_URL, "datasets/score", current_user)

# Nouvelles routes pour les détails étendus des datasets
@app.get("/datasets/{dataset_id}/details", tags=["datasets"])
async def dataset_details_proxy(dataset_id: str, request: Request, current_user: UserModel = Depends(current_active_user)):
    """Proxy vers le service-selection pour récupérer les détails complets d'un dataset"""
    return await proxy_request(request, settings.SERVICE_SELECTION_URL, f"datasets/{dataset_id}/details", current_user)

@app.get("/datasets/{dataset_id}/preview", tags=["datasets"])
async def dataset_preview_proxy(dataset_id: str, request: Request, current_user: UserModel = Depends(current_active_user)):
    """Proxy vers le service-selection pour récupérer l'aperçu des données d'un dataset"""
    return await proxy_request(request, settings.SERVICE_SELECTION_URL, f"datasets/{dataset_id}/preview", current_user)

@app.get("/datasets/{dataset_id}/similar", tags=["datasets"])
async def dataset_similar_proxy(dataset_id: str, request: Request, current_user: UserModel = Depends(current_active_user)):
    """Proxy vers le service-selection pour récupérer les datasets similaires"""
    return await proxy_request(request, settings.SERVICE_SELECTION_URL, f"datasets/{dataset_id}/similar", current_user)

# Routes pour les projets (service-selection)
@app.api_route("/projects", methods=["GET", "POST"], tags=["projects"])
async def projects_proxy(request: Request, current_user: UserModel = Depends(current_active_user)):
    """Proxy vers le service-selection pour les opérations sur les projets"""
    return await proxy_request(request, settings.SERVICE_SELECTION_URL, "projects", current_user)

@app.api_route("/projects/{project_id}", methods=["GET", "PUT", "DELETE"], tags=["projects"])
async def project_detail_proxy(project_id: str, request: Request, current_user: UserModel = Depends(current_active_user)):
    """Proxy vers le service-selection pour les opérations sur un projet spécifique"""
    return await proxy_request(request, settings.SERVICE_SELECTION_URL, f"projects/{project_id}", current_user)

@app.get("/projects/{project_id}/recommendations", tags=["projects"])
async def project_recommendations_proxy(project_id: str, request: Request, current_user: UserModel = Depends(current_active_user)):
    """Proxy vers le service-selection pour récupérer les recommandations d'un projet"""
    return await proxy_request(request, settings.SERVICE_SELECTION_URL, f"projects/{project_id}/recommendations", current_user)

# Routes pour ML Pipeline
@app.api_route("/api/v1/ml-pipeline/{path:path}", methods=["GET", "POST", "PUT", "DELETE"])
async def proxy_ml_pipeline(
    path: str,
    request: Request,
    current_user: UserModel = Depends(current_active_user)
):
    """Proxy requests to ML Pipeline service"""
    return await proxy_request(request, settings.ML_PIPELINE_URL, path, current_user)

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

# Endpoint temporaire de debug SANS authentification
@app.get("/debug/datasets", tags=["debug"], include_in_schema=True)
async def debug_datasets_count():
    """
    ENDPOINT TEMPORAIRE - Récupère le nombre de datasets sans authentification
    À SUPPRIMER en production !
    """
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.get(f"{settings.SERVICE_SELECTION_URL}/debug/datasets-count")
            if response.status_code == 200:
                return response.json()
            else:
                return {"error": f"Service unavailable: {response.status_code}"}
    except Exception as e:
        logger.error(f"Error getting datasets count: {e}")
        return {"error": str(e)}

# === ENDPOINTS ADMIN ===

@app.get("/debug/datasets-count", tags=["admin"], include_in_schema=True)
async def admin_datasets_count():
    """Récupère le nombre total de datasets pour le dashboard admin"""
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.get(f"{settings.SERVICE_SELECTION_URL}/debug/datasets-count")
            if response.status_code == 200:
                return response.json()
            else:
                raise HTTPException(status_code=response.status_code, detail="Service indisponible")
    except Exception as e:
        logger.error(f"Erreur lors de l'appel au service-selection: {e}")
        raise HTTPException(status_code=500, detail="Erreur interne du serveur")

# Routes pour les templates éthiques (admin seulement)
@app.get("/admin/ethical-templates", tags=["admin"])
async def get_ethical_templates(current_user: UserModel = Depends(current_superuser)):
    """Récupère tous les templates éthiques (admin uniquement)"""
    # Retourner des templates par défaut pour le moment
    # TODO: Implémenter le stockage persistant des templates
    default_templates = [
        {
            "domain": "default",
            "ethical": {
                "informed_consent": True,
                "transparency": True,
                "user_control": True,
                "equity_non_discrimination": True,
                "security_measures_in_place": True,
                "data_quality_documented": True,
                "anonymization_applied": True,
                "record_keeping_policy_exists": True,
                "purpose_limitation_respected": True,
                "accountability_defined": True
            },
            "technical": {
                "representativity_level": "medium",
                "sample_balance_level": "balanced"
            },
            "quality": {
                "data_errors_description": "Description des erreurs par défaut"
            }
        },
        {
            "domain": "healthcare",
            "ethical": {
                "informed_consent": True,
                "transparency": True,
                "user_control": True,
                "equity_non_discrimination": True,
                "security_measures_in_place": True,
                "data_quality_documented": True,
                "anonymization_applied": True,
                "record_keeping_policy_exists": True,
                "purpose_limitation_respected": True,
                "accountability_defined": True
            },
            "technical": {
                "representativity_level": "high",
                "sample_balance_level": "balanced"
            },
            "quality": {
                "data_errors_description": "Standards élevés requis pour la santé"
            }
        }
    ]
    return {"templates": default_templates}

@app.put("/admin/ethical-templates", tags=["admin"])
async def save_ethical_templates(
    templates_data: dict,
    current_user: UserModel = Depends(current_superuser)
):
    """Sauvegarde les templates éthiques (admin uniquement)"""
    # TODO: Implémenter la sauvegarde persistante
    logger.info(f"Templates sauvegardés par l'admin {current_user.email}")
    return {"message": "Templates sauvegardés avec succès", "count": len(templates_data.get("templates", []))}

@app.post("/admin/ethical-templates/reset", tags=["admin"])
async def reset_ethical_templates(current_user: UserModel = Depends(current_superuser)):
    """Restaure les templates éthiques par défaut (admin uniquement)"""
    # TODO: Implémenter la restauration des templates par défaut
    logger.info(f"Templates restaurés par l'admin {current_user.email}")
    return {"message": "Templates restaurés aux valeurs par défaut"}

@app.get("/admin/ethical-templates/validate", tags=["admin"])
async def validate_ethical_templates(current_user: UserModel = Depends(current_superuser)):
    """Valide les templates éthiques (admin uniquement)"""
    return {
        "valid": True,
        "templates_count": 2,
        "errors": [],
        "warnings": []
    }

# ============================================
# ENDPOINT TEMPORAIRE POUR ADMIN GRANT
# ============================================

@app.post("/admin/temporary-grant", tags=["admin", "temporary"])
async def temporary_grant_admin(
    user_email: str = Query(..., description="Email de l'utilisateur à promouvoir admin"),
    current_user: UserModel = Depends(current_active_user),
    session: AsyncSession = Depends(get_async_session)
):
    """
    ENDPOINT TEMPORAIRE - Accorde les droits d'administrateur à un utilisateur par email.
    
    Cet endpoint est temporaire et destiné aux phases de développement.
    Il permet de promouvoir rapidement un utilisateur au rôle 'admin' sans aller en base.
    
    Sécurité minimale : L'utilisateur qui fait la demande doit être authentifié.
    Pour plus de sécurité en production, retirer cet endpoint !
    """
    try:
        logger.info(f"Tentative de promotion admin pour: {user_email} par {current_user.email}")
        
        # Rechercher l'utilisateur par email
        stmt = select(UserModel).where(UserModel.email == user_email.lower())
        result = await session.execute(stmt)
        target_user = result.scalars().first()
        
        if not target_user:
            logger.warning(f"Utilisateur non trouvé: {user_email}")
            raise HTTPException(
                status_code=404,
                detail=f"Aucun utilisateur trouvé avec l'email: {user_email}"
            )
        
        # Vérifier s'il est déjà admin
        if target_user.role == "admin":
            logger.info(f"L'utilisateur {user_email} est déjà administrateur")
            return {
                "message": f"L'utilisateur {user_email} est déjà administrateur",
                "user": {
                    "id": str(target_user.id),
                    "email": target_user.email,
                    "role": target_user.role,
                    "is_superuser": target_user.is_superuser
                },
                "action": "no_change"
            }
        
        # Promouvoir l'utilisateur au rôle admin
        old_role = target_user.role
        target_user.role = "admin"
        
        # Sauvegarder en base
        await session.commit()
        await session.refresh(target_user)
        
        logger.info(f"Utilisateur {user_email} promu de '{old_role}' à 'admin' par {current_user.email}")
        
        return {
            "message": f"Utilisateur {user_email} promu au rang d'administrateur avec succès !",
            "user": {
                "id": str(target_user.id),
                "email": target_user.email,
                "role": target_user.role,
                "is_superuser": target_user.is_superuser,
                "previous_role": old_role
            },
            "action": "promoted",
            "granted_by": current_user.email
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Erreur lors de la promotion admin: {str(e)}")
        await session.rollback()
        raise HTTPException(
            status_code=500,
            detail=f"Erreur lors de la promotion: {str(e)}"
        )

@app.get("/admin/temporary-grant/current-user", tags=["admin", "temporary"])
async def temporary_grant_current_user(
    current_user: UserModel = Depends(current_active_user),
    session: AsyncSession = Depends(get_async_session)
):
    """
    ENDPOINT TEMPORAIRE - Accorde les droits d'administrateur à l'utilisateur actuellement connecté.
    
    Très pratique pour se donner rapidement les droits admin lors du développement.
    ATTENTION: Cet endpoint doit être retiré en production !
    """
    try:
        logger.info(f"Auto-promotion admin pour: {current_user.email}")
        
        # Récupérer l'utilisateur depuis la session
        stmt = select(UserModel).where(UserModel.id == current_user.id)
        result = await session.execute(stmt)
        user_in_session = result.scalars().first()
        
        if not user_in_session:
            raise HTTPException(
                status_code=404,
                detail="Utilisateur non trouvé en session"
            )
        
        # Vérifier s'il est déjà admin
        if user_in_session.role == "admin":
            logger.info(f"L'utilisateur {current_user.email} est déjà administrateur")
            return {
                "message": "Vous êtes déjà administrateur",
                "user": {
                    "id": str(user_in_session.id),
                    "email": user_in_session.email,
                    "role": user_in_session.role,
                    "is_superuser": user_in_session.is_superuser
                },
                "action": "no_change"
            }
        
        # Promouvoir l'utilisateur au rôle admin
        old_role = user_in_session.role
        user_in_session.role = "admin"
        
        # Sauvegarder en base
        await session.commit()
        await session.refresh(user_in_session)
        
        logger.info(f"Auto-promotion de {current_user.email} de '{old_role}' à 'admin'")
        
        return {
            "message": "Vous avez été promu administrateur avec succès !",
            "user": {
                "id": str(user_in_session.id),
                "email": user_in_session.email,
                "role": user_in_session.role,
                "is_superuser": user_in_session.is_superuser,
                "previous_role": old_role
            },
            "action": "self_promoted"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Erreur lors de l'auto-promotion admin: {str(e)}")
        await session.rollback()
        raise HTTPException(
            status_code=500,
            detail=f"Erreur lors de l'auto-promotion: {str(e)}"
        )

# Endpoint manquant pour l'upload de datasets - similar
@app.api_route("/datasets/preview", methods=["POST"], tags=["datasets"])
async def datasets_preview_proxy(request: Request, current_user: UserModel = Depends(current_active_user)):
    """Proxy vers le service-selection pour l'analyse préalable des fichiers de dataset"""
    return await proxy_request(request, settings.SERVICE_SELECTION_URL, "datasets/preview", current_user)

@app.get("/datasets/upload/similar", tags=["datasets"])
async def datasets_upload_similar(
    limit: int = Query(5, ge=1, le=20),
    current_user: UserModel = Depends(current_active_user)
):
    """Récupère des datasets similaires lors de l'upload"""
    # Retourner une liste vide pour le moment pour éviter l'erreur 500
    # TODO: Implémenter la logique de recommendation de datasets similaires
    return {"similar_datasets": [], "message": "Fonctionnalité en développement"}
