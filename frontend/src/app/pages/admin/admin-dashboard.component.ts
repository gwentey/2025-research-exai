import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatGridListModule } from '@angular/material/grid-list';
import { MatChipsModule } from '@angular/material/chips';
import { RouterModule } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { Observable, of } from 'rxjs';
import { catchError } from 'rxjs/operators';

import { RoleService, UserRole } from '../../services/role.service';
import { AuthService } from '../../services/auth.service';
import { AdminService } from '../../services/admin.service';
import { UserRead } from '../../models/auth.models';

@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatGridListModule,
    MatChipsModule,
    RouterModule,
    TranslateModule
  ],
  template: `
    <div class="admin-dashboard">
      <!-- Header -->
      <div class="header-section">
        <h1 class="dashboard-title">
          <mat-icon class="title-icon">dashboard</mat-icon>
          {{ 'ADMIN.DASHBOARD.TITLE' | translate }}
        </h1>
        <p class="dashboard-subtitle">
          {{ 'ADMIN.DASHBOARD.SUBTITLE' | translate }}
        </p>
      </div>

      <!-- Stats Cards -->
      <div class="stats-grid">
        <mat-card class="stat-card">
          <mat-card-content>
            <div class="stat-content">
              <div class="stat-icon">
                <mat-icon class="icon-large icon-datasets">database</mat-icon>
              </div>
              <div class="stat-info">
                <h3 class="stat-number">{{ (totalDatasets$ | async) ?? 0 }}</h3>
                <p class="stat-label">{{ 'ADMIN.DASHBOARD.TOTAL_DATASETS' | translate }}</p>
              </div>
            </div>
          </mat-card-content>
        </mat-card>

        <mat-card class="stat-card">
          <mat-card-content>
            <div class="stat-content">
              <div class="stat-icon">
                <mat-icon class="icon-large icon-users">people</mat-icon>
              </div>
              <div class="stat-info">
                <h3 class="stat-number">{{ (totalUsers$ | async) ?? 0 }}</h3>
                <p class="stat-label">{{ 'ADMIN.DASHBOARD.TOTAL_USERS' | translate }}</p>
              </div>
            </div>
          </mat-card-content>
        </mat-card>

        <mat-card class="stat-card">
          <mat-card-content>
            <div class="stat-content">
              <div class="stat-icon">
                <mat-icon class="icon-large icon-uploads">upload</mat-icon>
              </div>
              <div class="stat-info">
                <h3 class="stat-number">{{ (totalUploads$ | async) ?? 0 }}</h3>
                <p class="stat-label">{{ 'ADMIN.DASHBOARD.RECENT_UPLOADS' | translate }}</p>
              </div>
            </div>
          </mat-card-content>
        </mat-card>

        <mat-card class="stat-card">
          <mat-card-content>
            <div class="stat-content">
              <div class="stat-icon">
                <mat-icon class="icon-large icon-storage">storage</mat-icon>
              </div>
              <div class="stat-info">
                <h3 class="stat-number">{{ (storageUsed$ | async) ?? '0 MB' }}</h3>
                <p class="stat-label">{{ 'ADMIN.DASHBOARD.STORAGE_USED' | translate }}</p>
              </div>
            </div>
          </mat-card-content>
        </mat-card>
      </div>

      <!-- Quick Actions -->
      <mat-card class="actions-card">
        <mat-card-header>
          <mat-card-title>{{ 'ADMIN.DASHBOARD.QUICK_ACTIONS' | translate }}</mat-card-title>
        </mat-card-header>
        <mat-card-content>
          <div class="actions-grid">
            <button 
              mat-raised-button 
              color="primary" 
              class="action-button"
              routerLink="/admin/datasets">
              <mat-icon>storage</mat-icon>
              {{ 'ADMIN.DASHBOARD.MANAGE_DATASETS' | translate }}
            </button>

            <button 
              mat-raised-button 
              color="accent" 
              class="action-button"
              routerLink="/admin/users">
              <mat-icon>people</mat-icon>
              {{ 'ADMIN.DASHBOARD.MANAGE_USERS' | translate }}
            </button>

            <button 
              mat-raised-button 
              color="warn" 
              class="action-button"
              routerLink="/admin/ethical-templates">
              <mat-icon>shield-check</mat-icon>
              {{ 'ADMIN.DASHBOARD.ETHICAL_TEMPLATES' | translate }}
            </button>

            <button 
              mat-raised-button 
              color="primary"
              class="action-button"
              routerLink="/datasets/upload">
              <mat-icon>add</mat-icon>
              {{ 'ADMIN.DASHBOARD.ADD_DATASET' | translate }}
            </button>
          </div>
        </mat-card-content>
      </mat-card>

      <!-- User Info -->
      <mat-card class="user-info-card">
        <mat-card-header>
          <mat-card-title>{{ 'ADMIN.DASHBOARD.ADMIN_INFO' | translate }}</mat-card-title>
        </mat-card-header>
        <mat-card-content>
          <div class="user-info" *ngIf="currentUser$ | async as user">
            <div class="user-avatar">
              <img 
                [src]="user.picture ?? '/assets/images/profile/user5.jpg'" 
                [alt]="user.email"
                class="avatar-image"
                onerror="this.src='/assets/images/profile/user5.jpg';">
            </div>
            <div class="user-details">
              <h3 class="user-name">{{ getUserDisplayName(user) }}</h3>
              <p class="user-email">{{ user.email }}</p>
              <mat-chip-set>
                <mat-chip [color]="getRoleColor(user.role ?? 'user')">
                  <mat-icon matChipAvatar>{{ getRoleIcon(user.role ?? 'user') }}</mat-icon>
                  {{ getRoleDisplayName(user.role ?? 'user') }}
                </mat-chip>
              </mat-chip-set>
            </div>
          </div>
        </mat-card-content>
      </mat-card>
    </div>
  `,
  styles: [`
    .admin-dashboard {
      padding: 24px;
      max-width: 1200px;
      margin: 0 auto;
    }

    .header-section {
      margin-bottom: 32px;
      text-align: center;
    }

    .dashboard-title {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 12px;
      font-size: 2.5rem;
      font-weight: 300;
      margin: 0 0 8px 0;
      color: #1976d2;
    }

    .title-icon {
      font-size: 2.5rem;
      width: 2.5rem;
      height: 2.5rem;
    }

    .dashboard-subtitle {
      font-size: 1.2rem;
      color: #666;
      margin: 0;
    }

    .stats-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
      gap: 24px;
      margin-bottom: 32px;
    }

    .stat-card {
      min-height: 120px;
    }

    .stat-content {
      display: flex;
      align-items: center;
      gap: 16px;
    }

    .stat-icon {
      flex-shrink: 0;
    }

    .icon-large {
      font-size: 3rem;
      width: 3rem;
      height: 3rem;
    }

    .icon-datasets { color: #1976d2; }
    .icon-users { color: #388e3c; }
    .icon-uploads { color: #f57c00; }
    .icon-storage { color: #7b1fa2; }

    .stat-info {
      flex: 1;
    }

    .stat-number {
      font-size: 2rem;
      font-weight: 500;
      margin: 0 0 4px 0;
      color: #333;
    }

    .stat-label {
      font-size: 0.9rem;
      color: #666;
      margin: 0;
    }

    .actions-card {
      margin-bottom: 32px;
    }

    .actions-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 16px;
      margin-top: 16px;
    }

    .action-button {
      height: 60px;
      display: flex;
      flex-direction: column;
      gap: 8px;
      align-items: center;
      justify-content: center;
    }

    .action-button mat-icon {
      font-size: 1.5rem;
      width: 1.5rem;
      height: 1.5rem;
    }

    .user-info-card {
      margin-bottom: 24px;
    }

    .user-info {
      display: flex;
      align-items: center;
      gap: 20px;
      margin-top: 16px;
    }

    .user-avatar {
      flex-shrink: 0;
    }

    .avatar-image {
      width: 64px;
      height: 64px;
      border-radius: 50%;
      object-fit: cover;
      border: 2px solid #e0e0e0;
    }

    .user-details {
      flex: 1;
    }

    .user-name {
      font-size: 1.3rem;
      font-weight: 500;
      margin: 0 0 4px 0;
      color: #333;
    }

    .user-email {
      font-size: 0.95rem;
      color: #666;
      margin: 0 0 12px 0;
    }

    mat-chip {
      font-weight: 500;
    }

    /* Responsive */
    @media (max-width: 768px) {
      .admin-dashboard {
        padding: 16px;
      }

      .dashboard-title {
        font-size: 2rem;
      }

      .stats-grid {
        grid-template-columns: 1fr;
        gap: 16px;
      }

      .actions-grid {
        grid-template-columns: 1fr;
      }

      .user-info {
        flex-direction: column;
        text-align: center;
      }
    }
  `]
})
export class AdminDashboardComponent implements OnInit {
  private roleService = inject(RoleService);
  private authService = inject(AuthService);
  private adminService = inject(AdminService);

  currentUser$: Observable<UserRead | null>;
  totalDatasets$: Observable<number>;
  totalUsers$: Observable<number>;
  totalUploads$: Observable<number>;
  storageUsed$: Observable<string>;

  ngOnInit(): void {
    this.currentUser$ = this.authService.getCurrentUser();
    
    // Récupération des vraies données depuis les APIs backend avec gestion d'erreurs
    this.totalDatasets$ = this.adminService.getTotalDatasets().pipe(
      catchError(error => {
        console.error('Erreur lors du chargement des datasets:', error);
        return of(0); // Valeur par défaut en cas d'erreur
      })
    );
    
    this.totalUsers$ = this.adminService.getTotalUsers().pipe(
      catchError(error => {
        console.error('Erreur lors du chargement des utilisateurs:', error);
        return of(0);
      })
    );
    
    this.totalUploads$ = this.adminService.getRecentUploads().pipe(
      catchError(error => {
        console.error('Erreur lors du chargement des uploads:', error);
        return of(0);
      })
    );
    
    this.storageUsed$ = this.adminService.getStorageUsed().pipe(
      catchError(error => {
        console.error('Erreur lors du calcul du stockage:', error);
        return of('0 MB');
      })
    );
  }

  getUserDisplayName(user: UserRead): string {
    if (user.pseudo) return user.pseudo;
    if (user.given_name && user.family_name) return `${user.given_name} ${user.family_name}`;
    if (user.given_name) return user.given_name;
    return user.email.split('@')[0];
  }

  getRoleDisplayName(role: string): string {
    return this.roleService.getRoleDisplayName(role as UserRole);
  }

  getRoleColor(role: string): string {
    return this.roleService.getRoleColor(role as UserRole);
  }

  getRoleIcon(role: string): string {
    return this.roleService.getRoleIcon(role as UserRole);
  }
}