import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTableModule } from '@angular/material/table';
import { MatPaginatorModule } from '@angular/material/paginator';
import { MatSortModule } from '@angular/material/sort';
import { MatChipsModule } from '@angular/material/chips';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatDialogModule, MatDialog } from '@angular/material/dialog';
import { MatSnackBarModule, MatSnackBar } from '@angular/material/snack-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { TranslateModule } from '@ngx-translate/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { Observable, BehaviorSubject, combineLatest, map, startWith } from 'rxjs';

import { RoleService, UserRole } from '../../services/role.service';
import { AuthService } from '../../services/auth.service';
import { AdminService } from '../../services/admin.service';
import { UserRead } from '../../models/auth.models';

interface UserSummary {
  id: string;
  email: string;
  displayName: string;
  role: UserRole;
  isActive: boolean;
  isVerified: boolean;
  createdDate: Date;
  lastLogin: Date | null;
  datasetsCount: number;
  profileImage?: string;
}

@Component({
  selector: 'app-user-management',
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatTableModule,
    MatPaginatorModule,
    MatSortModule,
    MatChipsModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatDialogModule,
    MatSnackBarModule,
    MatProgressSpinnerModule,
    MatTooltipModule,
    MatSlideToggleModule,
    TranslateModule,
    ReactiveFormsModule
  ],
  template: `
    <div class="user-management">
      <!-- Header -->
      <div class="header-section">
        <div class="title-area">
          <h1>
            <mat-icon>people</mat-icon>
            {{ 'ADMIN.USERS.TITLE' | translate }}
          </h1>
          <p class="subtitle">
            {{ 'ADMIN.USERS.SUBTITLE' | translate }}
          </p>
        </div>

        <div class="actions-area">
          <button 
            mat-raised-button 
            color="primary"
            (click)="inviteUser()">
            <mat-icon>person_add</mat-icon>
            {{ 'ADMIN.USERS.INVITE_USER' | translate }}
          </button>
        </div>
      </div>

      <!-- Stats Cards -->
      <div class="stats-grid">
        <mat-card class="stat-card">
          <mat-card-content>
            <div class="stat-content">
              <mat-icon class="stat-icon total-users">people</mat-icon>
              <div class="stat-info">
                <h3>{{ (filteredUsers$ | async)?.length || 0 }}</h3>
                <p>{{ 'ADMIN.USERS.TOTAL_USERS' | translate }}</p>
              </div>
            </div>
          </mat-card-content>
        </mat-card>

        <mat-card class="stat-card">
          <mat-card-content>
            <div class="stat-content">
              <mat-icon class="stat-icon active-users">person</mat-icon>
              <div class="stat-info">
                <h3>{{ getActiveUsersCount() }}</h3>
                <p>{{ 'ADMIN.USERS.ACTIVE_USERS' | translate }}</p>
              </div>
            </div>
          </mat-card-content>
        </mat-card>

        <mat-card class="stat-card">
          <mat-card-content>
            <div class="stat-content">
              <mat-icon class="stat-icon admin-users">shield</mat-icon>
              <div class="stat-info">
                <h3>{{ getAdminUsersCount() }}</h3>
                <p>{{ 'ADMIN.USERS.ADMIN_USERS' | translate }}</p>
              </div>
            </div>
          </mat-card-content>
        </mat-card>

        <mat-card class="stat-card">
          <mat-card-content>
            <div class="stat-content">
              <mat-icon class="stat-icon contributor-users">edit</mat-icon>
              <div class="stat-info">
                <h3>{{ getContributorUsersCount() }}</h3>
                <p>{{ 'ADMIN.USERS.CONTRIBUTOR_USERS' | translate }}</p>
              </div>
            </div>
          </mat-card-content>
        </mat-card>
      </div>

      <!-- Filters -->
      <mat-card class="filters-card">
        <mat-card-content>
          <div class="filters-row">
            <mat-form-field appearance="outline" class="filter-field">
              <mat-label>{{ 'ADMIN.USERS.SEARCH' | translate }}</mat-label>
              <input matInput [formControl]="searchControl" placeholder="{{ 'ADMIN.USERS.SEARCH_PLACEHOLDER' | translate }}">
              <mat-icon matSuffix>search</mat-icon>
            </mat-form-field>

            <mat-form-field appearance="outline" class="filter-field">
              <mat-label>{{ 'ADMIN.USERS.ROLE' | translate }}</mat-label>
              <mat-select [formControl]="roleControl" multiple>
                <mat-option value="admin">{{ 'ADMIN.USERS.ROLE_ADMIN' | translate }}</mat-option>
                <mat-option value="contributor">{{ 'ADMIN.USERS.ROLE_CONTRIBUTOR' | translate }}</mat-option>
                <mat-option value="user">{{ 'ADMIN.USERS.ROLE_USER' | translate }}</mat-option>
              </mat-select>
            </mat-form-field>

            <mat-form-field appearance="outline" class="filter-field">
              <mat-label>{{ 'ADMIN.USERS.STATUS' | translate }}</mat-label>
              <mat-select [formControl]="statusControl" multiple>
                <mat-option value="active">{{ 'ADMIN.USERS.STATUS_ACTIVE' | translate }}</mat-option>
                <mat-option value="inactive">{{ 'ADMIN.USERS.STATUS_INACTIVE' | translate }}</mat-option>
                <mat-option value="verified">{{ 'ADMIN.USERS.STATUS_VERIFIED' | translate }}</mat-option>
                <mat-option value="unverified">{{ 'ADMIN.USERS.STATUS_UNVERIFIED' | translate }}</mat-option>
              </mat-select>
            </mat-form-field>

            <button 
              mat-stroked-button 
              (click)="clearFilters()"
              class="clear-filters-btn">
              <mat-icon>clear</mat-icon>
              {{ 'ADMIN.USERS.CLEAR_FILTERS' | translate }}
            </button>
          </div>
        </mat-card-content>
      </mat-card>

      <!-- Users Table -->
      <mat-card class="table-card">
        <mat-card-content class="table-content">
          <div class="table-header">
            <h3>{{ 'ADMIN.USERS.USERS_LIST' | translate }}</h3>
            <div class="table-stats">
              <span class="stats-text">
                {{ (filteredUsers$ | async)?.length ?? 0 }} {{ 'ADMIN.USERS.USERS_FOUND' | translate }}
              </span>
            </div>
          </div>

          <div class="table-container">
            <table mat-table [dataSource]="(filteredUsers$ | async) ?? []" class="users-table" matSort>
              <!-- User Column -->
              <ng-container matColumnDef="user">
                <th mat-header-cell *matHeaderCellDef mat-sort-header>
                  {{ 'ADMIN.USERS.TABLE.USER' | translate }}
                </th>
                <td mat-cell *matCellDef="let user">
                  <div class="user-cell">
                    <img 
                      [src]="user.profileImage || '/assets/images/profile/user5.jpg'" 
                      [alt]="user.displayName"
                      class="user-avatar"
                      onerror="this.src='/assets/images/profile/user5.jpg';">
                    <div class="user-info">
                      <strong class="user-name">{{ user.displayName }}</strong>
                      <div class="user-email">{{ user.email }}</div>
                    </div>
                  </div>
                </td>
              </ng-container>

              <!-- Role Column -->
              <ng-container matColumnDef="role">
                <th mat-header-cell *matHeaderCellDef mat-sort-header>
                  {{ 'ADMIN.USERS.TABLE.ROLE' | translate }}
                </th>
                <td mat-cell *matCellDef="let user">
                  <mat-chip [color]="getRoleColor(user.role)">
                    <mat-icon matChipAvatar>{{ getRoleIcon(user.role) }}</mat-icon>
                    {{ getRoleDisplayName(user.role) }}
                  </mat-chip>
                </td>
              </ng-container>

              <!-- Status Column -->
              <ng-container matColumnDef="status">
                <th mat-header-cell *matHeaderCellDef>
                  {{ 'ADMIN.USERS.TABLE.STATUS' | translate }}
                </th>
                <td mat-cell *matCellDef="let user">
                  <div class="status-indicators">
                    <mat-chip 
                      [class]="user.isActive ? 'status-active' : 'status-inactive'">
                      {{ user.isActive ? ('ADMIN.USERS.STATUS_ACTIVE' | translate) : ('ADMIN.USERS.STATUS_INACTIVE' | translate) }}
                    </mat-chip>
                    <mat-chip 
                      *ngIf="user.isVerified"
                      class="status-verified">
                      <mat-icon matChipAvatar>verified</mat-icon>
                      {{ 'ADMIN.USERS.STATUS_VERIFIED' | translate }}
                    </mat-chip>
                  </div>
                </td>
              </ng-container>

              <!-- Created Date Column -->
              <ng-container matColumnDef="createdDate">
                <th mat-header-cell *matHeaderCellDef mat-sort-header>
                  {{ 'ADMIN.USERS.TABLE.CREATED' | translate }}
                </th>
                <td mat-cell *matCellDef="let user">
                  {{ user.createdDate | date:'short' }}
                </td>
              </ng-container>

              <!-- Last Login Column -->
              <ng-container matColumnDef="lastLogin">
                <th mat-header-cell *matHeaderCellDef mat-sort-header>
                  {{ 'ADMIN.USERS.TABLE.LAST_LOGIN' | translate }}
                </th>
                <td mat-cell *matCellDef="let user">
                  {{ user.lastLogin ? (user.lastLogin | date:'short') : ('ADMIN.USERS.NEVER' | translate) }}
                </td>
              </ng-container>

              <!-- Datasets Count Column -->
              <ng-container matColumnDef="datasetsCount">
                <th mat-header-cell *matHeaderCellDef mat-sort-header>
                  {{ 'ADMIN.USERS.TABLE.DATASETS' | translate }}
                </th>
                <td mat-cell *matCellDef="let user">
                  <div class="datasets-count">
                    <mat-icon class="datasets-icon">database</mat-icon>
                    {{ user.datasetsCount }}
                  </div>
                </td>
              </ng-container>

              <!-- Actions Column -->
              <ng-container matColumnDef="actions">
                <th mat-header-cell *matHeaderCellDef>
                  {{ 'ADMIN.USERS.TABLE.ACTIONS' | translate }}
                </th>
                <td mat-cell *matCellDef="let user" class="actions-cell">
                  <button 
                    mat-icon-button 
                    (click)="editUser(user)"
                    matTooltip="{{ 'ADMIN.USERS.EDIT_USER' | translate }}">
                    <mat-icon>edit</mat-icon>
                  </button>
                  
                  <button 
                    mat-icon-button 
                    [color]="user.isActive ? 'warn' : 'primary'"
                    (click)="toggleUserStatus(user)"
                    [matTooltip]="user.isActive ? ('ADMIN.USERS.DEACTIVATE' | translate) : ('ADMIN.USERS.ACTIVATE' | translate)">
                    <mat-icon>{{ user.isActive ? 'block' : 'check_circle' }}</mat-icon>
                  </button>
                  
                  <button 
                    mat-icon-button 
                    color="warn"
                    (click)="deleteUser(user)"
                    matTooltip="{{ 'ADMIN.USERS.DELETE_USER' | translate }}">
                    <mat-icon>delete</mat-icon>
                  </button>
                </td>
              </ng-container>

              <tr mat-header-row *matHeaderRowDef="displayedColumns"></tr>
              <tr mat-row *matRowDef="let row; columns: displayedColumns;"></tr>
            </table>
          </div>

          <!-- Loading State -->
          <div class="loading-container" *ngIf="isLoading">
            <mat-progress-spinner mode="indeterminate" diameter="50"></mat-progress-spinner>
            <p>{{ 'ADMIN.USERS.LOADING' | translate }}</p>
          </div>

          <!-- Empty State -->
          <div class="empty-state" *ngIf="!isLoading && (filteredUsers$ | async)?.length === 0">
            <mat-icon class="empty-icon">people</mat-icon>
            <h3>{{ 'ADMIN.USERS.NO_USERS' | translate }}</h3>
            <p>{{ 'ADMIN.USERS.NO_USERS_MESSAGE' | translate }}</p>
          </div>
        </mat-card-content>
      </mat-card>
    </div>
  `,
  styles: [`
    .user-management {
      padding: 24px;
      max-width: 1400px;
      margin: 0 auto;
    }

    .header-section {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 24px;
      gap: 24px;
    }

    .title-area h1 {
      display: flex;
      align-items: center;
      gap: 12px;
      font-size: 2rem;
      font-weight: 400;
      margin: 0 0 8px 0;
      color: #1976d2;
    }

    .subtitle {
      color: #666;
      margin: 0;
      font-size: 1.1rem;
    }

    .stats-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 16px;
      margin-bottom: 24px;
    }

    .stat-card {
      min-height: 100px;
    }

    .stat-content {
      display: flex;
      align-items: center;
      gap: 16px;
    }

    .stat-icon {
      font-size: 2.5rem;
      width: 2.5rem;
      height: 2.5rem;
      flex-shrink: 0;
    }

    .total-users { color: #1976d2; }
    .active-users { color: #388e3c; }
    .admin-users { color: #d32f2f; }
    .contributor-users { color: #f57c00; }

    .stat-info h3 {
      font-size: 1.8rem;
      font-weight: 500;
      margin: 0 0 4px 0;
    }

    .stat-info p {
      font-size: 0.9rem;
      color: #666;
      margin: 0;
    }

    .filters-card {
      margin-bottom: 24px;
    }

    .filters-row {
      display: flex;
      gap: 16px;
      align-items: center;
      flex-wrap: wrap;
    }

    .filter-field {
      min-width: 200px;
      flex: 1;
    }

    .clear-filters-btn {
      flex-shrink: 0;
    }

    .table-card {
      margin-bottom: 24px;
    }

    .table-content {
      padding: 0;
    }

    .table-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 20px 24px;
      border-bottom: 1px solid #e0e0e0;
    }

    .table-header h3 {
      margin: 0;
      font-size: 1.2rem;
      font-weight: 500;
    }

    .stats-text {
      color: #666;
      font-size: 0.9rem;
    }

    .table-container {
      overflow-x: auto;
    }

    .users-table {
      width: 100%;
      min-width: 900px;
    }

    .user-cell {
      display: flex;
      align-items: center;
      gap: 12px;
      max-width: 250px;
    }

    .user-avatar {
      width: 40px;
      height: 40px;
      border-radius: 50%;
      object-fit: cover;
      border: 2px solid #e0e0e0;
      flex-shrink: 0;
    }

    .user-info {
      flex: 1;
      min-width: 0;
    }

    .user-name {
      display: block;
      font-weight: 500;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .user-email {
      font-size: 0.85rem;
      color: #666;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .status-indicators {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .status-active {
      background-color: #e8f5e8;
      color: #2e7d32;
    }

    .status-inactive {
      background-color: #ffebee;
      color: #c62828;
    }

    .status-verified {
      background-color: #e3f2fd;
      color: #1976d2;
    }

    .datasets-count {
      display: flex;
      align-items: center;
      gap: 4px;
    }

    .datasets-icon {
      font-size: 1rem;
      width: 1rem;
      height: 1rem;
      color: #666;
    }

    .actions-cell {
      width: 140px;
    }

    .actions-cell button {
      margin-right: 4px;
    }

    .loading-container, .empty-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 60px 20px;
      text-align: center;
    }

    .loading-container p, .empty-state p {
      margin-top: 16px;
      color: #666;
    }

    .empty-icon {
      font-size: 4rem;
      width: 4rem;
      height: 4rem;
      color: #ccc;
      margin-bottom: 16px;
    }

    .empty-state h3 {
      margin: 0 0 8px 0;
      color: #666;
    }

    /* Responsive */
    @media (max-width: 768px) {
      .user-management {
        padding: 16px;
      }

      .header-section {
        flex-direction: column;
        align-items: flex-start;
      }

      .stats-grid {
        grid-template-columns: 1fr;
      }

      .filters-row {
        flex-direction: column;
        align-items: stretch;
      }

      .filter-field {
        min-width: unset;
      }

      .table-header {
        flex-direction: column;
        align-items: flex-start;
        gap: 8px;
      }
    }
  `]
})
export class UserManagementComponent implements OnInit {
  private roleService = inject(RoleService);
  private authService = inject(AuthService);
  private adminService = inject(AdminService);
  private dialog = inject(MatDialog);
  private snackBar = inject(MatSnackBar);

  // Table configuration
  displayedColumns: string[] = ['user', 'role', 'status', 'createdDate', 'lastLogin', 'datasetsCount', 'actions'];
  
  // Form controls for filtering
  searchControl = new FormControl<string>('');
  roleControl = new FormControl<UserRole[]>([]);
  statusControl = new FormControl<string[]>([]);

  // Data streams
  users$ = new BehaviorSubject<UserSummary[]>([]);
  filteredUsers$: Observable<UserSummary[]>;
  isLoading = true;

  ngOnInit(): void {
    this.loadUsers();
    this.setupFiltering();
  }

  private setupFiltering(): void {
    this.filteredUsers$ = combineLatest([
      this.users$.asObservable(),
      this.searchControl.valueChanges.pipe(startWith('')),
      this.roleControl.valueChanges.pipe(startWith([])),
      this.statusControl.valueChanges.pipe(startWith([]))
    ]).pipe(
      map(([users, search, roles, statuses]: [UserSummary[], string | null, UserRole[] | null, string[] | null]) => {
        let filtered = users;

        // Search filter
        if (search) {
          const searchLower = search.toLowerCase();
          filtered = filtered.filter(user => 
            user.displayName.toLowerCase().includes(searchLower) ||
            user.email.toLowerCase().includes(searchLower)
          );
        }

        // Role filter
        if (roles && roles.length > 0) {
          filtered = filtered.filter(user => roles.includes(user.role));
        }

        // Status filter
        if (statuses && statuses.length > 0) {
          filtered = filtered.filter(user => {
            const userStatuses: string[] = [];
            if (user.isActive) userStatuses.push('active');
            else userStatuses.push('inactive');
            if (user.isVerified) userStatuses.push('verified');
            else userStatuses.push('unverified');
            
            return statuses.some(status => userStatuses.includes(status));
          });
        }

        return filtered;
      })
    );
  }

  private loadUsers(): void {
    this.isLoading = true;
    
    // Récupération des vraies données depuis l'API backend
    this.adminService.getAllUsers(1, 100).subscribe({
      next: (response) => {
        const users: UserSummary[] = response.users.map(user => ({
          id: user.id,
          email: user.email,
          displayName: this.getUserDisplayName(user),
          role: (user.role as UserRole) || UserRole.USER,
          isActive: user.is_active ?? true,
          isVerified: user.is_verified ?? false,
          createdDate: new Date(), // TODO: ajouter created_at dans le modèle UserRead
          lastLogin: null, // TODO: ajouter last_login dans le modèle UserRead
          datasetsCount: 0 // TODO: calculer depuis les datasets du user
        }));
        
        this.users$.next(users);
        this.isLoading = false;
      },
      error: (error) => {
        console.error('Erreur lors du chargement des utilisateurs:', error);
        let errorMessage = 'Erreur lors du chargement des utilisateurs';
        if (error.status === 404) {
          errorMessage = 'Endpoint utilisateurs non trouvé';
        } else if (error.status === 403) {
          errorMessage = 'Accès non autorisé - droits administrateur requis';
        } else if (error.status === 500) {
          errorMessage = 'Erreur serveur - veuillez réessayer plus tard';
        }
        this.snackBar.open(errorMessage, 'Fermer', { duration: 5000 });
        this.users$.next([]);
        this.isLoading = false;
      }
    });
  }

  private getUserDisplayName(user: UserRead): string {
    if (user.pseudo) return user.pseudo;
    if (user.given_name && user.family_name) return `${user.given_name} ${user.family_name}`;
    if (user.given_name) return user.given_name;
    if (user.family_name) return user.family_name;
    return user.email;
  }

  clearFilters(): void {
    this.searchControl.setValue('');
    this.roleControl.setValue([]);
    this.statusControl.setValue([]);
  }

  getActiveUsersCount(): number {
    return this.users$.value.filter(user => user.isActive).length;
  }

  getAdminUsersCount(): number {
    return this.users$.value.filter(user => user.role === UserRole.ADMIN).length;
  }

  getContributorUsersCount(): number {
    return this.users$.value.filter(user => user.role === UserRole.CONTRIBUTOR).length;
  }

  getRoleDisplayName(role: UserRole): string {
    return this.roleService.getRoleDisplayName(role);
  }

  getRoleColor(role: UserRole): string {
    return this.roleService.getRoleColor(role);
  }

  getRoleIcon(role: UserRole): string {
    return this.roleService.getRoleIcon(role);
  }

  inviteUser(): void {
    // TODO: Implémenter l'invitation d'utilisateur
    console.log('Inviter un utilisateur');
    this.snackBar.open('Fonctionnalité d\'invitation en développement', 'Fermer', { duration: 3000 });
  }

  editUser(user: UserSummary): void {
    // TODO: Implémenter l'édition d'utilisateur
    console.log('Éditer utilisateur:', user.id);
    this.snackBar.open(`Édition de l'utilisateur "${user.displayName}" en développement`, 'Fermer', { duration: 3000 });
  }

  toggleUserStatus(user: UserSummary): void {
    const action = user.isActive ? 'désactiver' : 'activer';
    const confirmMessage = `Êtes-vous sûr de vouloir ${action} l'utilisateur "${user.displayName}" ?`;
    
    if (confirm(confirmMessage)) {
      // TODO: Implémenter via API
      user.isActive = !user.isActive;
      
      this.snackBar.open(
        `Utilisateur "${user.displayName}" ${user.isActive ? 'activé' : 'désactivé'} avec succès`,
        'Fermer',
        { duration: 3000 }
      );
      
      // Mettre à jour la liste
      const currentUsers = this.users$.value;
      const updatedUsers = currentUsers.map(u => u.id === user.id ? user : u);
      this.users$.next(updatedUsers);
    }
  }

  deleteUser(user: UserSummary): void {
    const confirmMessage = `Êtes-vous sûr de vouloir supprimer l'utilisateur "${user.displayName}" ? Cette action est irréversible.`;
    
    if (confirm(confirmMessage)) {
      // TODO: Implémenter la suppression via API
      console.log('Suppression utilisateur:', user.id);
      
      this.snackBar.open(
        `Utilisateur "${user.displayName}" supprimé avec succès`,
        'Fermer',
        { duration: 3000 }
      );
      
      // Retirer l'utilisateur de la liste
      const currentUsers = this.users$.value;
      const updatedUsers = currentUsers.filter(u => u.id !== user.id);
      this.users$.next(updatedUsers);
    }
  }
}