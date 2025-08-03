"""
Middleware et décorateurs pour la gestion des rôles et permissions.
"""
import functools
from typing import List, Union
from fastapi import HTTPException, Depends
from fastapi_users import FastAPIUsers
from ..schemas.user import UserRole
from ..models.user import User


def require_role(*allowed_roles: str):
    """
    Décorateur pour vérifier que l'utilisateur actuel a l'un des rôles autorisés.
    
    Args:
        *allowed_roles: Liste des rôles autorisés (ex: "admin", "contributor")
    
    Usage:
        @require_role("admin")
        async def admin_only_endpoint(...):
            pass
            
        @require_role("admin", "contributor")
        async def admin_or_contributor_endpoint(...):
            pass
    """
    def decorator(func):
        @functools.wraps(func)
        async def wrapper(*args, current_user: User = None, **kwargs):
            if current_user is None:
                # Chercher current_user dans les kwargs ou args
                for arg in args:
                    if isinstance(arg, User):
                        current_user = arg
                        break
                if current_user is None and 'current_user' in kwargs:
                    current_user = kwargs['current_user']
            
            if current_user is None:
                raise HTTPException(
                    status_code=401,
                    detail="Authentication required"
                )
            
            if current_user.role not in allowed_roles:
                raise HTTPException(
                    status_code=403,
                    detail=f"Insufficient permissions. Required roles: {', '.join(allowed_roles)}"
                )
            
            return await func(*args, **kwargs)
        return wrapper
    return decorator


def require_admin(func):
    """
    Décorateur raccourci pour les endpoints réservés aux administrateurs.
    
    Usage:
        @require_admin
        async def admin_endpoint(...):
            pass
    """
    return require_role("admin")(func)


def require_contributor_or_admin(func):
    """
    Décorateur raccourci pour les endpoints accessibles aux contributeurs et admins.
    
    Usage:
        @require_contributor_or_admin
        async def upload_endpoint(...):
            pass
    """
    return require_role("admin", "contributor")(func)


# Fonctions utilitaires pour la vérification des rôles
# Le système principal utilise maintenant current_superuser de fastapi-users
# avec la propriété is_superuser calculée dans le modèle User

def verify_admin_role(current_user: User) -> None:
    """
    Vérifie que l'utilisateur a le rôle admin.
    À utiliser comme dependency après current_active_user.
    """
    if current_user.role != "admin":
        raise HTTPException(
            status_code=403,
            detail="Insufficient permissions. Admin role required."
        )
    return None

def verify_contributor_or_admin_role(current_user: User) -> None:
    """
    Vérifie que l'utilisateur a le rôle admin ou contributor.
    À utiliser comme dependency après current_active_user.
    """
    if current_user.role not in ["admin", "contributor"]:
        raise HTTPException(
            status_code=403,
            detail="Insufficient permissions. Admin or contributor role required."
        )
    return None


def has_role(user: User, required_role: Union[str, List[str]]) -> bool:
    """
    Fonction utilitaire pour vérifier si un utilisateur a un rôle spécifique.
    
    Args:
        user: L'utilisateur à vérifier
        required_role: Le rôle requis (string) ou liste de rôles autorisés
    
    Returns:
        bool: True si l'utilisateur a le rôle requis
    """
    if isinstance(required_role, str):
        return user.role == required_role
    elif isinstance(required_role, list):
        return user.role in required_role
    return False


def has_admin_role(user: User) -> bool:
    """Vérifier si l'utilisateur est administrateur."""
    return user.role == UserRole.ADMIN


def has_contributor_role(user: User) -> bool:
    """Vérifier si l'utilisateur est contributeur."""
    return user.role == UserRole.CONTRIBUTOR


def can_upload_datasets(user: User) -> bool:
    """Vérifier si l'utilisateur peut uploader des datasets."""
    return user.role in [UserRole.ADMIN, UserRole.CONTRIBUTOR]


def can_manage_all_datasets(user: User) -> bool:
    """Vérifier si l'utilisateur peut gérer tous les datasets."""
    return user.role == UserRole.ADMIN


def can_manage_user_roles(user: User) -> bool:
    """Vérifier si l'utilisateur peut gérer les rôles d'autres utilisateurs."""
    return user.role == UserRole.ADMIN


def filter_datasets_by_role(user: User, datasets):
    """
    Filtrer les datasets selon le rôle de l'utilisateur.
    
    Args:
        user: L'utilisateur actuel
        datasets: QuerySet ou liste des datasets
    
    Returns:
        Datasets filtrés selon les permissions
    """
    if user.role == UserRole.ADMIN:
        # Admin voit tous les datasets
        return datasets
    elif user.role == UserRole.CONTRIBUTOR:
        # Contributeur voit ses propres datasets + les publics
        return datasets.filter(
            (datasets.c.created_by == user.id) | 
            (datasets.c.is_public == True)
        )
    else:
        # Utilisateur standard voit seulement les datasets publics
        return datasets.filter(datasets.c.is_public == True)