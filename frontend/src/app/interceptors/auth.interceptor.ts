import { HttpInterceptorFn, HttpRequest, HttpHandlerFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { environment } from '../../environments/environment';
import { catchError, throwError } from 'rxjs';

// Récupérer l'URL de l'API Gateway (idéalement depuis l'environnement)
// Assurez-vous que cette valeur correspond à celle dans auth.service.ts
// const API_GATEWAY_URL = 'http://localhost:8000'; // Commenter ou supprimer l'ancienne constante

/**
 * Intercepteur HTTP fonctionnel pour ajouter le token JWT aux requêtes sortantes
 * vers l'API Gateway si l'utilisateur est authentifié.
 */
export const authInterceptor: HttpInterceptorFn = (req: HttpRequest<unknown>, next: HttpHandlerFn) => {
  const authService = inject(AuthService);
  const router = inject(Router);
  const authToken = authService.getToken();

  // Debug info
  console.log(`[Intercepteur] URL: ${req.url}`);
  console.log(`[Intercepteur] Token présent: ${!!authToken}`);
  
  // Test si la requête va vers l'API
  const isApiRequest = req.url.startsWith(environment.apiUrl) || 
                      (!req.url.startsWith('http') && !req.url.startsWith('./assets'));

  // Si on a un token ET que l'utilisateur est encore authentifié (token valide)
  if (authToken && isApiRequest && authService.isAuthenticated()) {
    // Clone la requête et ajoute le header d'authentification
    const authReq = req.clone({
      headers: req.headers.set('Authorization', `Bearer ${authToken}`)
    });
    
    // Log la requête modifiée
    console.log(`[Intercepteur] Requête authentifiée: ${req.url} avec token: ${authToken.substring(0, 15)}...`);
    
    // Utiliser la requête modifiée dans la chaîne d'intercepteurs
    return next(authReq).pipe(
      catchError((error: HttpErrorResponse) => {
        console.log(`\n[Intercepteur] Erreur HTTP ${error.status} pour ${req.url}:`, error);
        
        // Gestion spéciale pour les erreurs d'authentification
        if (error.status === 401 || error.status === 403) {
          console.log(`\n[Intercepteur] Erreur d'authentification détectée, vérifiez le token et les permissions`);
          
          // Gérer l'expiration du token pour TOUS les endpoints API
          if (isApiRequest && authToken) {
            console.log('[Intercepteur] Token expiré ou invalide détecté, déconnexion automatique');
            
            // Déconnecter l'utilisateur après une erreur d'authentification
            // et rediriger vers la page de connexion
            setTimeout(() => {
              authService.logout();
              router.navigate(['/authentication/login'], { 
                queryParams: { 
                  auth_error: 'token_expired',
                  msg: 'Votre session a expiré, veuillez vous reconnecter.'
                } 
              });
            }, 100);
          }
        }
        
        // Propager l'erreur
        return throwError(() => error);
      })
    );
  }

  // Si on a un token mais qu'il est expiré, rediriger vers la connexion
  if (authToken && isApiRequest && !authService.isAuthenticated()) {
    console.log(`[Intercepteur] Token expiré pour requête: ${req.url}, redirection vers login`);
    router.navigate(['/authentication/login'], { 
      queryParams: { 
        auth_error: 'token_expired',
        msg: 'Votre session a expiré, veuillez vous reconnecter.'
      } 
    });
    // Retourner une erreur 401 pour arrêter la requête
    return throwError(() => new HttpErrorResponse({
      status: 401,
      statusText: 'Token expiré',
      url: req.url
    }));
  }

  // Si pas de token ou pas une requête API, laisse passer la requête sans modification
  console.log(`[Intercepteur] Requête sans authentification: ${req.url}`);
  return next(req);
}; 
