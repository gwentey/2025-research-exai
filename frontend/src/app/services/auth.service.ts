import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { Router } from '@angular/router';
import { Observable, throwError } from 'rxjs';
import { catchError, map, tap } from 'rxjs/operators';
import { environment } from '../../environments/environment'; // Importer l'environnement
// Importer les nouvelles interfaces
import { LoginCredentials, LoginResponse, SignupData, UserRead, OAuthAuthorizationResponse } from '../models/auth.models';

// Définir la clé du token comme constante
const AUTH_TOKEN_KEY = 'exai_access_token';

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private http = inject(HttpClient);
  private router = inject(Router);

  // Utiliser la constante
  private tokenKey = AUTH_TOKEN_KEY;

  constructor() {}

  /**
   * Tente de connecter l'utilisateur en envoyant les credentials à l'API Gateway.
   * @param credentials - Objet LoginCredentials contenant email et password.
   * @returns Observable avec la réponse LoginResponse de l'API (contenant le token).
   */
  login(credentials: LoginCredentials): Observable<LoginResponse> {
    // fastapi-users attend les données de login en 'application/x-www-form-urlencoded' par défaut
    const body = new URLSearchParams();
    body.set('username', credentials.email); // fastapi-users attend 'username' ici
    body.set('password', credentials.password);

    const headers = new HttpHeaders({
      'Content-Type': 'application/x-www-form-urlencoded'
    });

    // Utiliser LoginResponse comme type de retour
    return this.http.post<LoginResponse>(`${environment.apiUrl}/auth/jwt/login`, body.toString(), { headers }).pipe(
      tap((response) => {
        if (response && response.access_token) {
          this.storeToken(response.access_token);
          // Optionnel: rediriger ici ou laisser le composant le faire
          // this.router.navigate(['/starter']);
        }
      }),
      catchError(this.handleError)
    );
  }

  /**
   * Démarre le processus d'authentification Google OAuth.
   * @returns Un Observable contenant l'URL d'autorisation Google.
   */
  googleLogin(): Observable<OAuthAuthorizationResponse> {
    return this.http.get<OAuthAuthorizationResponse>(`${environment.apiUrl}/auth/google/authorize`).pipe(
      catchError(this.handleError)
    );
  }

  /**
   * Complète le processus d'authentification Google OAuth après la redirection.
   * @param code - Le code d'autorisation fourni par Google.
   * @param state - L'état fourni par le serveur pour vérifier la requête.
   * @returns Un Observable contenant la réponse LoginResponse.
   */
  completeGoogleAuth(code: string, state: string): Observable<LoginResponse> {
    return this.http.get<LoginResponse>(
      `${environment.apiUrl}/auth/google/callback?code=${code}&state=${state}`
    ).pipe(
      tap((response) => {
        if (response && response.access_token) {
          this.storeToken(response.access_token);
        }
      }),
      catchError(this.handleError)
    );
  }

  /**
   * Inscrit un nouvel utilisateur.
   * @param userData - Objet SignupData contenant email, password, etc.
   * @returns Observable avec les informations UserRead de l'utilisateur créé.
   */
  signup(userData: SignupData): Observable<UserRead> {
    // Utiliser UserRead comme type de retour
    return this.http.post<UserRead>(`${environment.apiUrl}/auth/register`, userData).pipe(
      tap(() => {
        // Optionnel : Rediriger vers la page de login après inscription réussie
        // this.router.navigate(['/authentication/login']);
      }),
      catchError(this.handleError)
    );
  }

  /**
   * Stocke le token JWT dans le localStorage.
   * @param token - Le token JWT à stocker.
   */
  storeToken(token: string): void {
    localStorage.setItem(this.tokenKey, token);
  }

  /**
   * Récupère le token JWT depuis le localStorage.
   * @returns Le token JWT ou null s'il n'existe pas.
   */
  getToken(): string | null {
    return localStorage.getItem(this.tokenKey);
  }

  /**
   * Vérifie si l'utilisateur est actuellement authentifié (basé sur la présence du token).
   * Note : Pour une vérification robuste, il faudrait valider le token (ex: expiration).
   * @returns true si un token existe, false sinon.
   */
  isAuthenticated(): boolean {
    return this.getToken() !== null;
    // TODO: Ajouter une vérification de validité/expiration du token
  }

  /**
   * Déconnecte l'utilisateur en supprimant le token et en redirigeant vers la page de login.
   */
  logout(): void {
    localStorage.removeItem(this.tokenKey);
    this.router.navigate(['/authentication/login']);
  }

  /**
   * Récupère les informations de l'utilisateur actuellement connecté.
   * Nécessite un intercepteur pour ajouter le token aux en-têtes.
   * @returns Observable avec les informations UserRead de l'utilisateur.
   */
  getCurrentUser(): Observable<UserRead> {
    // Note: Assurez-vous qu'un intercepteur ajoute le token 'Authorization: Bearer <token>'
    return this.http.get<UserRead>(`${environment.apiUrl}/users/me`).pipe(
      catchError(this.handleError)
    );
  }

  /**
   * Gestionnaire d'erreurs HTTP simple.
   * @param error - L'objet HttpErrorResponse.
   * @returns Un Observable qui émet une erreur.
   */
  private handleError(error: HttpErrorResponse) {
    let errorMessage = 'Une erreur inconnue est survenue !';
    if (error.error instanceof ErrorEvent) {
      // Erreur côté client ou réseau
      errorMessage = `Erreur : ${error.error.message}`;
    } else {
      // Le backend a retourné un code d'échec.
      // Le corps de la réponse peut contenir des indices sur ce qui n'a pas fonctionné.
      errorMessage = `Code Erreur: ${error.status}\nMessage: ${error.error?.detail || error.message}`; // FastAPI retourne souvent les erreurs dans 'detail'
    }
    console.error(errorMessage);
    // Retourne un observable avec une erreur orientée utilisateur
    return throwError(() => new Error(errorMessage));
  }
} 