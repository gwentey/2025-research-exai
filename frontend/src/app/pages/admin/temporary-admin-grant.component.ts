import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatDividerModule } from '@angular/material/divider';
import { MatChipsModule } from '@angular/material/chips';
import { TranslateModule } from '@ngx-translate/core';
import { Observable } from 'rxjs';

import { AdminService } from '../../services/admin.service';
import { AuthService } from '../../services/auth.service';
import { UserRead } from '../../models/auth.models';

interface PromotionResponse {
  message: string;
  user: {
    id: string;
    email: string;
    role: string;
    is_superuser: boolean;
    previous_role?: string;
  };
  action: 'promoted' | 'no_change' | 'self_promoted';
  granted_by?: string;
}

@Component({
  selector: 'app-temporary-admin-grant',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatInputModule,
    MatFormFieldModule,
    MatProgressSpinnerModule,
    MatDividerModule,
    MatChipsModule,
    TranslateModule
  ],
  template: `
    <div class="temporary-admin-grant">
      <!-- Header -->
      <div class="header-section">
        <h1 class="page-title">
          <mat-icon class="title-icon warning-color">security</mat-icon>
          Promotion Temporaire Admin
        </h1>
        <p class="page-subtitle">
          Outil de développement pour accorder rapidement les droits d'administrateur.
        </p>
        
        <!-- Warning Banner -->
        <div class="warning-banner">
          <mat-icon>warning</mat-icon>
          <div class="warning-content">
            <strong>ATTENTION :</strong> Cet outil est temporaire et destiné au développement uniquement.
            Il doit être retiré avant la mise en production !
          </div>
        </div>
      </div>

      <!-- Quick Self-Promotion Card -->
      <mat-card class="self-promotion-card">
        <mat-card-header>
          <mat-card-title>
            <mat-icon>person</mat-icon>
            Auto-Promotion
          </mat-card-title>
          <mat-card-subtitle>
            Accordez-vous rapidement les droits d'administrateur
          </mat-card-subtitle>
        </mat-card-header>
        
        <mat-card-content>
          <div class="current-user-info" *ngIf="currentUser$ | async as user">
            <div class="user-details">
              <p><strong>Email :</strong> {{ user.email }}</p>
              <p><strong>Rôle actuel :</strong> 
                <mat-chip [class]="'role-chip role-' + user.role">
                  {{ user.role }}
                </mat-chip>
              </p>
              <p><strong>Admin :</strong> 
                <mat-chip [class]="user.is_superuser ? 'admin-yes' : 'admin-no'">
                  {{ user.is_superuser ? 'Oui' : 'Non' }}
                </mat-chip>
              </p>
            </div>
          </div>
        </mat-card-content>
        
        <mat-card-actions>
          <button 
            mat-raised-button 
            color="warn" 
            [disabled]="isPromoting"
            (click)="selfPromoteToAdmin()">
            <mat-icon>security</mat-icon>
            <span *ngIf="!isPromoting">Me promouvoir Admin</span>
            <span *ngIf="isPromoting">
              <mat-spinner diameter="20" class="inline-spinner"></mat-spinner>
              Promotion en cours...
            </span>
          </button>
        </mat-card-actions>
      </mat-card>

      <mat-divider class="section-divider"></mat-divider>

      <!-- Promote Other User Card -->
      <mat-card class="promote-user-card">
        <mat-card-header>
          <mat-card-title>
            <mat-icon>people</mat-icon>
            Promouvoir un Utilisateur
          </mat-card-title>
          <mat-card-subtitle>
            Accordez les droits d'administrateur à un utilisateur par email
          </mat-card-subtitle>
        </mat-card-header>
        
        <mat-card-content>
          <form [formGroup]="promotionForm" (ngSubmit)="promoteUser()">
            <mat-form-field appearance="outline" class="full-width">
              <mat-label>Email de l'utilisateur</mat-label>
              <input 
                matInput 
                type="email"
                formControlName="userEmail"
                placeholder="utilisateur@example.com"
                [disabled]="isPromoting">
              <mat-icon matSuffix>email</mat-icon>
              <mat-error *ngIf="promotionForm.get('userEmail')?.hasError('required')">
                L'email est requis
              </mat-error>
              <mat-error *ngIf="promotionForm.get('userEmail')?.hasError('email')">
                Veuillez entrer un email valide
              </mat-error>
            </mat-form-field>
          </form>
        </mat-card-content>
        
        <mat-card-actions>
          <button 
            mat-raised-button 
            color="primary" 
            [disabled]="promotionForm.invalid || isPromoting"
            (click)="promoteUser()">
            <mat-icon>person_add</mat-icon>
            <span *ngIf="!isPromoting">Promouvoir Admin</span>
            <span *ngIf="isPromoting">
              <mat-spinner diameter="20" class="inline-spinner"></mat-spinner>
              Promotion en cours...
            </span>
          </button>
          
          <button 
            mat-button 
            [disabled]="isPromoting"
            (click)="resetForm()">
            <mat-icon>clear</mat-icon>
            Effacer
          </button>
        </mat-card-actions>
      </mat-card>

      <!-- Recent Promotions -->
      <mat-card class="recent-promotions-card" *ngIf="recentPromotions.length > 0">
        <mat-card-header>
          <mat-card-title>
            <mat-icon>history</mat-icon>
            Promotions Récentes
          </mat-card-title>
        </mat-card-header>
        
        <mat-card-content>
          <div class="promotion-list">
            <div 
              class="promotion-item" 
              *ngFor="let promotion of recentPromotions">
              <div class="promotion-info">
                <p class="promotion-email">{{ promotion.user.email }}</p>
                <p class="promotion-details">
                  <span class="role-change">
                    {{ promotion.user.previous_role || 'user' }} → {{ promotion.user.role }}
                  </span>
                  <span class="promotion-time">{{ promotion.timestamp | date:'short' }}</span>
                </p>
              </div>
              <div class="promotion-status">
                <mat-chip [class]="'action-' + promotion.action">
                  {{ getActionLabel(promotion.action) }}
                </mat-chip>
              </div>
            </div>
          </div>
        </mat-card-content>
      </mat-card>
    </div>
  `,
  styles: [`
    .temporary-admin-grant {
      padding: 24px;
      max-width: 1200px;
      margin: 0 auto;
    }

    .header-section {
      margin-bottom: 32px;
    }

    .page-title {
      display: flex;
      align-items: center;
      gap: 12px;
      font-size: 2.5rem;
      font-weight: 500;
      margin: 0 0 8px 0;
      color: #333;
    }

    .title-icon {
      font-size: 2.5rem;
      width: 2.5rem;
      height: 2.5rem;
    }

    .warning-color {
      color: #ff9800;
    }

    .page-subtitle {
      font-size: 1.1rem;
      color: #666;
      margin: 0 0 24px 0;
    }

    .warning-banner {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 16px;
      background-color: #fff3e0;
      border: 1px solid #ffcc02;
      border-radius: 8px;
      color: #e65100;
    }

    .warning-banner mat-icon {
      color: #ff9800;
      font-size: 24px;
    }

    .warning-content {
      flex: 1;
    }

    .self-promotion-card,
    .promote-user-card,
    .recent-promotions-card {
      margin-bottom: 24px;
    }

    .section-divider {
      margin: 32px 0;
    }

    .current-user-info {
      background-color: #f5f5f5;
      padding: 16px;
      border-radius: 8px;
      margin-bottom: 16px;
    }

    .user-details p {
      margin: 8px 0;
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .role-chip {
      border-radius: 16px;
      font-size: 0.8rem;
      padding: 4px 12px;
    }

    .role-admin {
      background-color: #e8f5e8;
      color: #2e7d32;
    }

    .role-user {
      background-color: #e3f2fd;
      color: #1976d2;
    }

    .role-contributor {
      background-color: #fff3e0;
      color: #f57c00;
    }

    .admin-yes {
      background-color: #e8f5e8;
      color: #2e7d32;
    }

    .admin-no {
      background-color: #ffebee;
      color: #c62828;
    }

    .full-width {
      width: 100%;
      margin-bottom: 16px;
    }

    .inline-spinner {
      margin-right: 8px;
    }

    .promotion-list {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .promotion-item {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 12px;
      border: 1px solid #e0e0e0;
      border-radius: 8px;
      background-color: #fafafa;
    }

    .promotion-info {
      flex: 1;
    }

    .promotion-email {
      font-weight: 500;
      margin: 0 0 4px 0;
    }

    .promotion-details {
      font-size: 0.9rem;
      color: #666;
      margin: 0;
      display: flex;
      gap: 16px;
    }

    .role-change {
      font-family: monospace;
      background-color: #e0e0e0;
      padding: 2px 6px;
      border-radius: 4px;
    }

    .action-promoted {
      background-color: #e8f5e8;
      color: #2e7d32;
    }

    .action-no_change {
      background-color: #fff3e0;
      color: #f57c00;
    }

    .action-self_promoted {
      background-color: #e3f2fd;
      color: #1976d2;
    }

    mat-card-header {
      margin-bottom: 16px;
    }

    mat-card-title {
      display: flex;
      align-items: center;
      gap: 8px;
    }
  `]
})
export class TemporaryAdminGrantComponent implements OnInit {
  private fb = inject(FormBuilder);
  private adminService = inject(AdminService);
  private authService = inject(AuthService);
  private snackBar = inject(MatSnackBar);

  currentUser$: Observable<UserRead | null>;
  promotionForm: FormGroup;
  isPromoting = false;
  recentPromotions: (PromotionResponse & { timestamp: Date })[] = [];

  constructor() {
    this.currentUser$ = this.authService.getCurrentUser();
    
    this.promotionForm = this.fb.group({
      userEmail: ['', [Validators.required, Validators.email]]
    });
  }

  ngOnInit(): void {
    // Charger les promotions récentes depuis le localStorage
    this.loadRecentPromotions();
  }

  async selfPromoteToAdmin(): Promise<void> {
    if (this.isPromoting) return;

    this.isPromoting = true;
    
    try {
      const response = await this.adminService.selfPromoteToAdmin().toPromise();
      
      if (response) {
        this.handlePromotionSuccess(response);
        
        // Mettre à jour les données utilisateur (recharger depuis le serveur)
        this.currentUser$ = this.authService.getCurrentUser();
      }
    } catch (error) {
      this.handlePromotionError(error);
    } finally {
      this.isPromoting = false;
    }
  }

  async promoteUser(): Promise<void> {
    if (this.promotionForm.invalid || this.isPromoting) return;

    this.isPromoting = true;
    const userEmail = this.promotionForm.get('userEmail')?.value;
    
    try {
      const response = await this.adminService.promoteUserToAdmin(userEmail).toPromise();
      
      if (response) {
        this.handlePromotionSuccess(response);
        this.resetForm();
      }
    } catch (error) {
      this.handlePromotionError(error);
    } finally {
      this.isPromoting = false;
    }
  }

  resetForm(): void {
    this.promotionForm.reset();
  }

  private handlePromotionSuccess(response: PromotionResponse): void {
    // Ajouter à l'historique local
    this.addToRecentPromotions(response);
    
    // Afficher le message de succès
    this.snackBar.open(response.message, 'Fermer', {
      duration: 5000,
      panelClass: ['success-snackbar']
    });
  }

  private handlePromotionError(error: any): void {
    let errorMessage = 'Erreur lors de la promotion';
    
    if (error?.error?.detail) {
      errorMessage = error.error.detail;
    } else if (error?.message) {
      errorMessage = error.message;
    }

    this.snackBar.open(errorMessage, 'Fermer', {
      duration: 8000,
      panelClass: ['error-snackbar']
    });
  }

  private addToRecentPromotions(response: PromotionResponse): void {
    const promotionWithTimestamp = {
      ...response,
      timestamp: new Date()
    };

    this.recentPromotions.unshift(promotionWithTimestamp);
    
    // Garder seulement les 10 dernières promotions
    if (this.recentPromotions.length > 10) {
      this.recentPromotions = this.recentPromotions.slice(0, 10);
    }

    // Sauvegarder dans le localStorage
    this.saveRecentPromotions();
  }

  private loadRecentPromotions(): void {
    try {
      const stored = localStorage.getItem('temp_admin_promotions');
      if (stored) {
        const parsed = JSON.parse(stored);
        this.recentPromotions = parsed.map((p: any) => ({
          ...p,
          timestamp: new Date(p.timestamp)
        }));
      }
    } catch (error) {
      console.warn('Erreur lors du chargement des promotions récentes:', error);
      this.recentPromotions = [];
    }
  }

  private saveRecentPromotions(): void {
    try {
      localStorage.setItem('temp_admin_promotions', JSON.stringify(this.recentPromotions));
    } catch (error) {
      console.warn('Erreur lors de la sauvegarde des promotions récentes:', error);
    }
  }

  getActionLabel(action: string): string {
    switch (action) {
      case 'promoted':
        return 'Promu';
      case 'no_change':
        return 'Déjà admin';
      case 'self_promoted':
        return 'Auto-promu';
      default:
        return 'Inconnu';
    }
  }
}