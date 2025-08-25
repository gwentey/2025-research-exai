import { inject } from '@angular/core';
import { CanActivateFn, Router, ActivatedRouteSnapshot } from '@angular/router';
import { Observable, of, map, catchError } from 'rxjs';
import { RoleService, UserRole } from '../services/role.service';
import { AuthService } from '../services/auth.service';

/**
 * Guard fonctionnel pour vérifier les rôles d'utilisateur.
 * Utilisé pour protéger les routes selon les permissions.
 * 
 * Usage dans les routes:
 * {
 *   path: 'admin',
 *   component: AdminComponent,
 *   canActivate: [roleGuard],
 *   data: { roles: ['admin'] }
 * }
 */
export const roleGuard: CanActivateFn = (route: ActivatedRouteSnapshot, state) => {
  const roleService = inject(RoleService);
  const authService = inject(AuthService);
  const router = inject(Router);

  // Vérifier d'abord si l'utilisateur est authentifié
  if (!authService.isAuthenticated()) {
    console.log('RoleGuard: User not authenticated, redirecting to login');
    router.navigate(['/authentication/login'], { queryParams: { returnUrl: state.url } });
    return false;
  }

  // Récupérer les rôles requis depuis les données de la route
  const requiredRoles = route.data['roles'] as string[] | undefined;

  if (!requiredRoles || requiredRoles.length === 0) {
    // Aucun rôle spécifique requis, autoriser l'accès
    return true;
  }

  // Convertir les strings en UserRole enum
  const requiredUserRoles = requiredRoles.map(role => role as UserRole);

  // Vérifier les rôles de l'utilisateur
  return roleService.hasAnyRole(requiredUserRoles).pipe(
    map(hasRole => {
      if (hasRole) {
        return true;
      } else {
        console.log(`RoleGuard: User does not have required roles: ${requiredRoles.join(', ')}`);
        // Rediriger vers une page d'erreur 403 ou dashboard
        router.navigate(['/starter'], { 
          queryParams: { 
            error: 'insufficient-permissions',
            required: requiredRoles.join(',')
          } 
        });
        return false;
      }
    }),
    catchError((error) => {
      console.error('RoleGuard: Error checking user roles:', error);
      router.navigate(['/authentication/login']);
      return of(false);
    })
  );
};

/**
 * Guard spécialisé pour les routes d'administration.
 * Raccourci pour vérifier le rôle admin.
 */
export const adminGuard: CanActivateFn = (route, state) => {
  // Ajouter automatiquement le rôle admin requis
  route.data = { ...route.data, roles: ['admin'] };
  return roleGuard(route, state);
};

/**
 * Guard pour les routes de contribution et d'administration.
 * Permet l'accès aux contributeurs et administrateurs.
 */
export const contributorGuard: CanActivateFn = (route, state) => {
  // Ajouter automatiquement les rôles contributeur et admin
  route.data = { ...route.data, roles: ['admin', 'contributor'] };
  return roleGuard(route, state);
};

/**
 * Fonction utilitaire pour créer un guard avec des rôles spécifiques.
 * Utile pour des cas d'usage avancés.
 * 
 * Usage:
 * export const myCustomGuard = createRoleGuard(['admin', 'contributor']);
 */
export function createRoleGuard(roles: string[]): CanActivateFn {
  return (route, state) => {
    route.data = { ...route.data, roles };
    return roleGuard(route, state);
  };
}

/**
 * Guard pour vérifier si l'utilisateur peut uploader des datasets.
 * Maintenant tous les utilisateurs authentifiés peuvent uploader.
 */
export const uploadGuard: CanActivateFn = (route, state) => {
  const roleService = inject(RoleService);
  const authService = inject(AuthService);
  const router = inject(Router);

  if (!authService.isAuthenticated()) {
    router.navigate(['/authentication/login'], { queryParams: { returnUrl: state.url } });
    return false;
  }

  return roleService.canUploadDatasets().pipe(
    map(canUpload => {
      if (canUpload) {
        return true;
      } else {
        console.log('UploadGuard: User cannot upload datasets');
        router.navigate(['/starter'], { 
          queryParams: { 
            error: 'upload-not-allowed',
            message: 'Vous devez être authentifié pour uploader des datasets'
          } 
        });
        return false;
      }
    }),
    catchError((error) => {
      console.error('UploadGuard: Error checking upload permissions:', error);
      router.navigate(['/authentication/login']);
      return of(false);
    })
  );
};