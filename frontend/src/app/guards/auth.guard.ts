import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

/**
 * Guard fonctionnel pour vérifier si un utilisateur est authentifié.
 * Si l'utilisateur n'est pas authentifié, il est redirigé vers la page de connexion.
 */
export const authGuard: CanActivateFn = (route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (authService.isAuthenticated()) {
    return true; // Autorise l'accès à la route
  }

  // Non authentifié : rediriger vers la page de login
  console.log('AuthGuard: User not authenticated, redirecting to login.');
  router.navigate(['/authentication/login'], { queryParams: { returnUrl: state.url } }); // Garde l'URL de retour
  return false; // Bloque l'accès à la route actuelle
}; 
