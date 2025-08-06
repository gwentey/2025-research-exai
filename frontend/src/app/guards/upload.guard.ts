import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { RoleService } from '../services/role.service';
import { AuthService } from '../services/auth.service';
import { map, catchError } from 'rxjs/operators';
import { of } from 'rxjs';

/**
 * Guard fonctionnel pour vérifier si un utilisateur peut uploader des datasets.
 * Vérifie que l'utilisateur est authentifié ET a les permissions d'upload (admin ou contributeur).
 */
export const uploadGuard: CanActivateFn = (route, state) => {
  const authService = inject(AuthService);
  const roleService = inject(RoleService);
  const router = inject(Router);

  // Vérifier d'abord l'authentification
  if (!authService.isAuthenticated()) {
    console.log('UploadGuard: User not authenticated, redirecting to login.');
    router.navigate(['/authentication/login'], { queryParams: { returnUrl: state.url } });
    return false;
  }

  // Vérifier les permissions d'upload
  return roleService.canUploadDatasets().pipe(
    map(canUpload => {
      if (canUpload) {
        console.log('UploadGuard: User has upload permissions, access granted.');
        return true;
      } else {
        console.log('UploadGuard: User does not have upload permissions, redirecting to datasets.');
        // Rediriger vers la liste des datasets avec un message d'erreur
        router.navigate(['/datasets'], { 
          queryParams: { 
            error: 'upload_permission_denied',
            message: 'Vous devez avoir les droits admin ou contributeur pour ajouter des datasets.'
          } 
        });
        return false;
      }
    }),
    catchError(error => {
      console.error('UploadGuard: Error checking upload permissions:', error);
      router.navigate(['/datasets'], { 
        queryParams: { 
          error: 'permission_check_failed',
          message: 'Erreur lors de la vérification des permissions.'
        } 
      });
      return of(false);
    })
  );
};