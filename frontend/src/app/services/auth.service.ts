import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { Router } from '@angular/router';
import { Observable, throwError } from 'rxjs';
import { catchError, map, tap } from 'rxjs/operators';
import { environment } from '../../environments/environment'; // Importer l'environnement
// Importer les nouvelles interfaces
import { LoginCredentials, LoginResponse, SignupData, UserRead, OAuthAuthorizationResponse, UserUpdate, PasswordUpdate, ProfilePictureUpload, OnboardingData, AccountDeletionRequest, AccountDeletionResponse, ClaimCreditsResponse } from '../models/auth.models';

// Utiliser une constante comme constante
const AUTH_TOKEN_KEY = 'ibis_x_access_token';

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
   * Obtient l'URL d'autorisation Google auprès du backend.
   * @returns Un Observable contenant l'URL d'autorisation Google.
   */
  getGoogleAuthorizeUrl(): Observable<string> {
    // Utiliser HTTPS pour le callback en production, sinon le protocole actuel
    const protocol = environment.production ? 'https' : window.location.protocol.replace(':', '');
    const hostname = window.location.host;
    
    // Construire l'URL complète avec le bon protocole selon l'environnement
    const frontendCallbackUrl = `${protocol}://${hostname}/authentication/callback`;
    console.log(`Frontend callback URL: ${frontendCallbackUrl} (production: ${environment.production})`);
    
    const encodedRedirectUri = encodeURIComponent(frontendCallbackUrl);
    const apiUrl = `${environment.apiUrl}/auth/google/authorize?redirect_uri=${encodedRedirectUri}`;
    
    // Fait une requête HTTP à l'API Gateway pour obtenir l'URL d'autorisation
    return this.http.get<{authorization_url: string}>(apiUrl).pipe(
      map(response => response.authorization_url) // Extrait uniquement l'URL de la réponse
    );
  }

  /**
   * Complète le processus d'authentification Google OAuth après la redirection.
   * @param code - Le code d'autorisation fourni par Google.
   * @param state - L'état fourni par le serveur pour vérifier la requête.
   * @returns Un Observable contenant la réponse LoginResponse.
   */
  completeGoogleAuth(code: string, state: string): Observable<LoginResponse> {
    // Utiliser la nouvelle route dédiée pour échanger le code contre un token
    return this.http.post<LoginResponse>(
      `${environment.apiUrl}/auth/google/exchange-token`,
      { code, state } // Envoyer dans le corps JSON
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
   * @param userData - Objet SignupData contenant email et password.
   * @returns Observable avec les informations UserRead de l'utilisateur créé.
   */
  signup(userData: SignupData): Observable<UserRead> {
    // S'assurer que tous les champs obligatoires sont présents dans la requête
    const completeUserData = {
      email: userData.email,
      password: userData.password,
      pseudo: userData.pseudo || null,
      picture: userData.picture || null,
      given_name: userData.given_name || null,
      family_name: userData.family_name || null,
      locale: userData.locale || null
    };
    
    // Utiliser UserRead comme type de retour
    return this.http.post<UserRead>(`${environment.apiUrl}/auth/register`, completeUserData).pipe(
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
   * Vérifie si l'utilisateur est actuellement authentifié (basé sur la présence et la validité du token).
   * @returns true si un token valide existe, false sinon.
   */
  isAuthenticated(): boolean {
    const token = this.getToken();
    if (!token) {
      return false;
    }
    
    // Vérifier si le token est expiré
    if (this.isTokenExpired(token)) {
      console.log('Token expiré détecté, nettoyage automatique');
      this.logout();
      return false;
    }
    
    return true;
  }

  /**
   * Vérifie si un token JWT est expiré
   * @param token - Le token JWT à vérifier
   * @returns true si le token est expiré, false sinon
   */
  private isTokenExpired(token: string): boolean {
    try {
      // Décoder le payload du JWT (partie centrale encodée en base64)
      const payload = JSON.parse(atob(token.split('.')[1]));
      
      // Vérifier la date d'expiration (exp est en secondes, Date.now() en millisecondes)
      const currentTime = Math.floor(Date.now() / 1000);
      
      if (payload.exp && payload.exp < currentTime) {
        console.log(`Token expiré: exp=${payload.exp}, current=${currentTime}`);
        return true;
      }
      
      return false;
    } catch (error) {
      // Si on ne peut pas décoder le token, le considérer comme invalide
      console.warn('Impossible de décoder le token JWT, considéré comme expiré:', error);
      return true;
    }
  }

  /**
   * Déconnecte l'utilisateur en supprimant le token et en redirigeant vers la page de login.
   */
  logout(): void {
    localStorage.removeItem(this.tokenKey);
    // Ajout d'un court délai pour s'assurer que le token est bien supprimé avant la redirection
    setTimeout(() => {
      this.router.navigate(['/authentication/login']);
    }, 50);
  }

  /**
   * Récupère les informations de l'utilisateur actuellement connecté.
   * @returns Observable avec les informations UserRead de l'utilisateur.
   */
  getCurrentUser(): Observable<UserRead> {
    // Vérifier si un token est présent avant de faire la requête
    const token = this.getToken();
    if (!token) {
      console.error("getCurrentUser - Aucun token disponible");
      return throwError(() => new Error('Aucun token d\'authentification disponible'));
    }

    console.log("getCurrentUser - Début de la requête, URL:", `${environment.apiUrl}/users/me`);
    console.log("getCurrentUser - Token:", token.substring(0, 15) + '...');
    
    // Utiliser l'URL complète de l'API
    return this.http.get<UserRead>(`${environment.apiUrl}/users/me`, {
      headers: {
        'Authorization': `Bearer ${token}` // Ajouter explicitement le token en plus de l'intercepteur
      }
    }).pipe(
      tap(user => {
        console.log("getCurrentUser - Succès, utilisateur récupéré:", user);
      }),
      catchError((error) => {
        console.error("getCurrentUser - Erreur:", error);
        
        // Si l'erreur est 401 ou 403, cela peut signifier que le token est expiré ou invalide
        if (error.status === 401 || error.status === 403) {
          console.warn("getCurrentUser - Token potentiellement invalide ou expiré, vérifier le format du token et les droits.");
          // Considérer une déconnexion automatique ou un rafraîchissement du token
          // this.logout(); // Décommenter pour déconnecter automatiquement en cas de token invalide
        }
        
        return this.handleError(error);
      })
    );
  }

  /**
   * Met à jour les informations du profil utilisateur.
   * @param userData - Objet UserUpdate contenant les champs à mettre à jour.
   * @returns Observable avec les informations UserRead mises à jour.
   */
  updateProfile(userData: UserUpdate): Observable<UserRead> {
    const token = this.getToken();
    if (!token) {
      console.error("updateProfile - Aucun token disponible");
      return throwError(() => new Error('Aucun token d\'authentification disponible'));
    }

    console.log("updateProfile - Début de la requête, données:", userData);
    
    return this.http.patch<UserRead>(`${environment.apiUrl}/users/me`, userData, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    }).pipe(
      tap(user => {
        console.log("updateProfile - Succès, profil mis à jour:", user);
      }),
      catchError(this.handleError)
    );
  }

  /**
   * Met à jour le mot de passe de l'utilisateur.
   * @param passwordData - Objet PasswordUpdate contenant l'ancien et le nouveau mot de passe.
   * @returns Observable indiquant le succès de l'opération.
   */
  updatePassword(passwordData: PasswordUpdate): Observable<any> {
    const token = this.getToken();
    if (!token) {
      console.error("updatePassword - Aucun token disponible");
      return throwError(() => new Error('Aucun token d\'authentification disponible'));
    }

    console.log("updatePassword - Début de la requête");
    
    return this.http.patch(`${environment.apiUrl}/users/me/password`, passwordData, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    }).pipe(
      tap(() => {
        console.log("updatePassword - Succès, mot de passe mis à jour");
      }),
      catchError(this.handleError)
    );
  }

  /**
   * Met à jour l'image de profil de l'utilisateur.
   * @param pictureData - Objet ProfilePictureUpload contenant l'image encodée.
   * @returns Observable avec les informations UserRead mises à jour.
   */
  updateProfilePicture(pictureData: ProfilePictureUpload): Observable<UserRead> {
    const token = this.getToken();
    if (!token) {
      console.error("updateProfilePicture - Aucun token disponible");
      return throwError(() => new Error('Aucun token d\'authentification disponible'));
    }

    console.log("updateProfilePicture - Début de la requête");
    
    return this.http.patch<UserRead>(`${environment.apiUrl}/users/me/picture`, pictureData, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    }).pipe(
      tap(user => {
        console.log("updateProfilePicture - Succès, image de profil mise à jour:", user);
      }),
      catchError(this.handleError)
    );
  }

  /**
   * Sauvegarde les données d'onboarding de l'utilisateur.
   * @param data - Objet OnboardingData contenant les réponses d'onboarding.
   * @returns Observable avec les informations UserRead mises à jour.
   */
  saveOnboarding(data: OnboardingData): Observable<UserRead> {
    const token = this.getToken();
    if (!token) {
      console.error("saveOnboarding - Aucun token disponible");
      return throwError(() => new Error('Aucun token d\'authentification disponible'));
    }

    console.log("saveOnboarding - Début de la requête, données:", data);
    
    return this.http.patch<UserRead>(`${environment.apiUrl}/users/me`, data, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    }).pipe(
      tap(user => {
        console.log("saveOnboarding - Succès, données d'onboarding sauvegardées:", user);
      }),
      catchError(this.handleError)
    );
  }

  /**
   * Supprime définitivement le compte de l'utilisateur.
   * @param deletionData - Objet AccountDeletionRequest contenant le mot de passe pour confirmer.
   * @returns Observable avec la réponse de suppression.
   */
  deleteAccount(deletionData: AccountDeletionRequest): Observable<AccountDeletionResponse> {
    const token = this.getToken();
    if (!token) {
      console.error("deleteAccount - Aucun token disponible");
      return throwError(() => new Error('Aucun token d\'authentification disponible'));
    }

    console.log("deleteAccount - Début de la requête de suppression de compte");
    console.log("deleteAccount - Email de confirmation:", deletionData.email_confirmation);
    
    return this.http.delete<AccountDeletionResponse>(`${environment.apiUrl}/users/me`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: deletionData
    }).pipe(
      tap(response => {
        console.log("deleteAccount - Succès, compte supprimé:", response);
        // Supprimer immédiatement le token local après suppression réussie
        this.logout();
      }),
      catchError(this.handleError)
    );
  }

  /**
   * Récupère des crédits pour l'utilisateur (10 maximum, tous les 30 jours).
   * @returns Observable avec la réponse ClaimCreditsResponse
   */
  claimCredits(): Observable<ClaimCreditsResponse> {
    const token = this.getToken();
    if (!token) {
      console.error("claimCredits - Aucun token disponible");
      return throwError(() => new Error('Aucun token d\'authentification disponible'));
    }

    console.log("claimCredits - Début de la requête de claim de crédits");
    
    return this.http.post<ClaimCreditsResponse>(`${environment.apiUrl}/users/me/claim-credits`, {}, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    }).pipe(
      tap(response => {
        if (response.success) {
          console.log("claimCredits - Succès, crédits récupérés:", response);
        } else {
          console.log("claimCredits - Refusé:", response.message);
        }
      }),
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
    
    // Erreur côté client ou réseau
    if (error.error instanceof ErrorEvent) {
      errorMessage = `Erreur client: ${error.error.message}`;
      console.error('Erreur client:', error.error.message);
    } 
    // Erreur retournée par le backend
    else if (error.status > 0) {
      // Extraire le message d'erreur depuis la réponse FastAPI (detail)
      const detail = error.error?.detail || error.message || 'Erreur serveur inconnue';
      errorMessage = `Erreur ${error.status}: ${detail}`;
      console.error(`Erreur serveur (${error.status}):`, detail);
    }
    // Erreur de connexion (status 0)
    else {
      errorMessage = 'Impossible de se connecter au serveur. Veuillez vérifier votre connexion ou réessayer plus tard.';
      console.error('Erreur de connexion au serveur:', error);
    }
    
    // Retourne un observable avec une erreur orientée utilisateur
    return throwError(() => new Error(errorMessage));
  }
} 
