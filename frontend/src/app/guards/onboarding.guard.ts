import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { map, catchError } from 'rxjs/operators';
import { of } from 'rxjs';

/**
 * Guard fonctionnel pour vérifier si un utilisateur a complété l'onboarding.
 * Si l'utilisateur n'a pas complété l'onboarding, il est redirigé vers la page d'onboarding.
 * Ce guard doit être utilisé après authGuard pour s'assurer que l'utilisateur est authentifié.
 */
export const onboardingGuard: CanActivateFn = (route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  // Vérifier d'abord si l'utilisateur est authentifié
  if (!authService.isAuthenticated()) {
    console.log('OnboardingGuard: User not authenticated, redirecting to login.');
    router.navigate(['/authentication/login']);
    return false;
  }

  // Récupérer les données utilisateur pour vérifier l'onboarding
  return authService.getCurrentUser().pipe(
    map(user => {
      // Vérifier si tous les champs d'onboarding sont complétés
      const isOnboardingComplete = user.education_level !== null && 
                                  user.education_level !== undefined && 
                                  user.age !== null && 
                                  user.age !== undefined && 
                                  user.ai_familiarity !== null && 
                                  user.ai_familiarity !== undefined;

      if (isOnboardingComplete) {
        console.log('OnboardingGuard: Onboarding complete, allowing access.');
        return true; // Autorise l'accès à la route
      }

      // Onboarding non complété : rediriger vers la page d'onboarding
      console.log('OnboardingGuard: Onboarding not complete, redirecting to onboarding.');
      router.navigate(['/onboarding']);
      return false; // Bloque l'accès à la route actuelle
    }),
    catchError(error => {
      console.error('OnboardingGuard: Error checking user data:', error);
      // En cas d'erreur, rediriger vers la page de connexion
      router.navigate(['/authentication/login']);
      return of(false);
    })
  );
}; 
