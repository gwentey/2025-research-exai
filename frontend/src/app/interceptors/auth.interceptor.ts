import { HttpInterceptorFn, HttpRequest, HttpHandlerFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
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
  const authToken = authService.getToken();

  // Debug info
  console.log(`[Intercepteur] URL: ${req.url}`);
  console.log(`[Intercepteur] Token présent: ${!!authToken}`);
  
  // Ajouter le token à toutes les requêtes vers l'API, quelle que soit l'URL
  if (authToken) {
    // Cloner la requête et ajouter l'en-tête Authorization
    const authReq = req.clone({
      setHeaders: {
        Authorization: `Bearer ${authToken}`
      }
    });
    
    // Log la requête modifiée
    console.log(`[Intercepteur] Requête authentifiée: ${authReq.url} avec token: ${authToken.substring(0, 15)}...`);
    
    // Passer la requête clonée avec l'en-tête et gérer les erreurs
    return next(authReq).pipe(
      catchError((error: HttpErrorResponse) => {
        console.error(`[Intercepteur] Erreur HTTP ${error.status} pour ${req.url}:`, error);
        
        // Si erreur 401 ou 403, cela pourrait indiquer un problème avec le token
        if (error.status === 401 || error.status === 403) {
          console.warn('[Intercepteur] Erreur d\'authentification détectée, vérifiez le token et les permissions');
        }
        
        return throwError(() => error);
      })
    );
  }

  // Si pas de token, passer la requête originale
  console.log(`[Intercepteur] Requête sans authentification: ${req.url}`);
  return next(req);
}; 