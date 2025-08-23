import { Injectable, inject } from '@angular/core';
import { Observable, BehaviorSubject, map, catchError, of } from 'rxjs';
import { AuthService } from './auth.service';
import { UserRead } from '../models/auth.models';

// Enum des rôles (correspond au backend)
export enum UserRole {
  ADMIN = 'admin',
  CONTRIBUTOR = 'contributor',
  USER = 'user'
}

@Injectable({
  providedIn: 'root'
})
export class RoleService {
  private authService = inject(AuthService);

  // BehaviorSubject pour maintenir l'état actuel du rôle
  private currentRole$ = new BehaviorSubject<UserRole | null>(null);
  private currentUser$ = new BehaviorSubject<UserRead | null>(null);

  constructor() {
    // Initialiser le rôle au démarrage du service
    this.initializeCurrentRole();
  }

  /**
   * Initialise le rôle de l'utilisateur actuel
   */
  private initializeCurrentRole(): void {
    if (this.authService.isAuthenticated()) {
      this.authService.getCurrentUser().pipe(
        catchError((error) => {
          console.warn('Erreur lors de la récupération du rôle utilisateur:', error);
          return of(null);
        })
      ).subscribe({
        next: (user) => {
          if (user) {
            this.currentUser$.next(user);
            this.currentRole$.next(user.role as UserRole);
          } else {
            this.currentUser$.next(null);
            this.currentRole$.next(null);
          }
        }
      });
    } else {
      this.currentUser$.next(null);
      this.currentRole$.next(null);
    }
  }

  /**
   * Rafraîchit le rôle de l'utilisateur actuel
   */
  refreshCurrentRole(): void {
    this.initializeCurrentRole();
  }

  /**
   * Observable du rôle actuel de l'utilisateur
   */
  getCurrentRole(): Observable<UserRole | null> {
    return this.currentRole$.asObservable();
  }

  /**
   * Observable de l'utilisateur actuel complet
   */
  getCurrentUser(): Observable<UserRead | null> {
    return this.currentUser$.asObservable();
  }

  /**
   * Vérifie si l'utilisateur actuel a un rôle spécifique
   * @param role - Le rôle à vérifier
   * @returns Observable<boolean>
   */
  hasRole(role: UserRole): Observable<boolean> {
    return this.currentRole$.pipe(
      map(currentRole => currentRole === role)
    );
  }

  /**
   * Vérifie si l'utilisateur actuel a l'un des rôles spécifiés
   * @param roles - Liste des rôles autorisés
   * @returns Observable<boolean>
   */
  hasAnyRole(roles: UserRole[]): Observable<boolean> {
    return this.currentRole$.pipe(
      map(currentRole => currentRole !== null && roles.includes(currentRole))
    );
  }

  /**
   * Vérifie si l'utilisateur actuel est administrateur
   * @returns Observable<boolean>
   */
  isAdmin(): Observable<boolean> {
    return this.hasRole(UserRole.ADMIN);
  }

  /**
   * Vérifie si l'utilisateur actuel est contributeur
   * @returns Observable<boolean>
   */
  isContributor(): Observable<boolean> {
    return this.hasRole(UserRole.CONTRIBUTOR);
  }

  /**
   * Vérifie si l'utilisateur actuel est un utilisateur standard
   * @returns Observable<boolean>
   */
  isUser(): Observable<boolean> {
    return this.hasRole(UserRole.USER);
  }

  /**
   * Vérifie si l'utilisateur peut uploader des datasets
   * MODIFIÉ : Accessible à tous les utilisateurs authentifiés
   * @returns Observable<boolean>
   */
  canUploadDatasets(): Observable<boolean> {
    return of(true); // Tous les utilisateurs peuvent maintenant uploader des datasets
  }

  /**
   * Vérifie si l'utilisateur peut gérer tous les datasets
   * @returns Observable<boolean>
   */
  canManageAllDatasets(): Observable<boolean> {
    return this.isAdmin();
  }

  /**
   * Vérifie si l'utilisateur peut accéder au menu d'administration
   * @returns Observable<boolean>
   */
  canAccessAdminMenu(): Observable<boolean> {
    return this.isAdmin();
  }

  /**
   * Vérifie si l'utilisateur peut gérer les rôles d'autres utilisateurs
   * @returns Observable<boolean>
   */
  canManageUserRoles(): Observable<boolean> {
    return this.isAdmin();
  }

  /**
   * Vérifie si l'utilisateur peut modifier un dataset spécifique
   * @param datasetOwnerId - ID du propriétaire du dataset
   * @returns Observable<boolean>
   */
  canEditDataset(datasetOwnerId?: string): Observable<boolean> {
    return this.currentUser$.pipe(
      map(user => {
        if (!user) return false;

        // Admin peut tout modifier
        if (user.role === UserRole.ADMIN) return true;

        // Contributeur peut modifier ses propres datasets
        if (user.role === UserRole.CONTRIBUTOR && datasetOwnerId) {
          return user.id === datasetOwnerId;
        }

        return false;
      })
    );
  }

  /**
   * Vérifie si l'utilisateur peut supprimer un dataset spécifique
   * @param datasetOwnerId - ID du propriétaire du dataset
   * @returns Observable<boolean>
   */
  canDeleteDataset(datasetOwnerId?: string): Observable<boolean> {
    return this.currentUser$.pipe(
      map(user => {
        if (!user) return false;

        // Seul l'admin peut supprimer
        return user.role === UserRole.ADMIN;
      })
    );
  }

  /**
   * Méthode utilitaire synchrone pour vérifier le rôle actuel
   * (à utiliser avec précaution, préférer les méthodes Observable)
   */
  getCurrentRoleSync(): UserRole | null {
    return this.currentRole$.value;
  }

  /**
   * Méthode utilitaire synchrone pour vérifier l'utilisateur actuel
   */
  getCurrentUserSync(): UserRead | null {
    return this.currentUser$.value;
  }

  /**
   * Réinitialise l'état du service (utile lors de la déconnexion)
   */
  reset(): void {
    this.currentUser$.next(null);
    this.currentRole$.next(null);
  }

  /**
   * Obtient le libellé d'affichage d'un rôle
   * @param role - Le rôle
   * @returns Le libellé d'affichage
   */
  getRoleDisplayName(role: UserRole): string {
    switch (role) {
      case UserRole.ADMIN:
        return 'Administrateur';
      case UserRole.CONTRIBUTOR:
        return 'Contributeur';
      case UserRole.USER:
        return 'Utilisateur';
      default:
        return 'Inconnu';
    }
  }

  /**
   * Obtient la couleur associée à un rôle (pour l'interface)
   * @param role - Le rôle
   * @returns La classe de couleur
   */
  getRoleColor(role: UserRole): string {
    switch (role) {
      case UserRole.ADMIN:
        return 'error'; // Rouge pour admin
      case UserRole.CONTRIBUTOR:
        return 'warning'; // Orange pour contributeur
      case UserRole.USER:
        return 'primary'; // Bleu pour utilisateur
      default:
        return 'default';
    }
  }

  /**
   * Obtient l'icône associée à un rôle
   * @param role - Le rôle
   * @returns Le nom de l'icône
   */
  getRoleIcon(role: UserRole): string {
    switch (role) {
      case UserRole.ADMIN:
        return 'crown';
      case UserRole.CONTRIBUTOR:
        return 'edit';
      case UserRole.USER:
        return 'user';
      default:
        return 'help';
    }
  }
}
