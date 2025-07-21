import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

/**
 * Guard fonctionnel pour vérifier si un utilisateur n'est PAS authentifié.
 * Si l'utilisateur est déjà authentifié, il est redirigé vers la page d'accueil.
 * À utiliser pour protéger les routes comme login et register.
 */
export const nonAuthGuard: CanActivateFn = (route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (!authService.isAuthenticated()) {
    return true; // Autorise l'accès à la route car l'utilisateur n'est pas connecté
  }

  // Déjà authentifié : rediriger vers la page d'accueil
  console.log('NonAuthGuard: User already authenticated, redirecting to home.');
  router.navigate(['/starter']);
  return false; // Bloque l'accès à la route actuelle
}; 
