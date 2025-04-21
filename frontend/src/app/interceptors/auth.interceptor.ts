import { HttpInterceptorFn, HttpRequest, HttpHandlerFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { AuthService } from '../services/auth.service';
import { environment } from '../../environments/environment';

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

  // Vérifier si la requête est destinée à notre API et si un token existe
  // Utiliser environment.apiUrl
  if (authToken && req.url.startsWith(environment.apiUrl)) {
    // Cloner la requête et ajouter l'en-tête Authorization
    const authReq = req.clone({
      setHeaders: {
        Authorization: `Bearer ${authToken}`
      }
    });
    // Passer la requête clonée avec l'en-tête
    return next(authReq);
  }

  // Pour les autres requêtes ou si pas de token, passer la requête originale
  return next(req);
}; 