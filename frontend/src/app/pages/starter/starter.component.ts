import { Component, ViewEncapsulation, inject } from '@angular/core';
import { MaterialModule } from 'src/app/material.module';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Observable } from 'rxjs';

import { AdminService, TemporaryPromotionResponse } from '../../services/admin.service';
import { AuthService } from '../../services/auth.service';
import { UserRead } from '../../models/auth.models';

/**
 * Composant starter avec bouton temporaire d'administration
 */
@Component({
  selector: 'app-starter',
  templateUrl: './starter.component.html',
  imports: [MaterialModule, CommonModule, RouterModule, TranslateModule],
  styleUrls: ['./starter.component.scss'],
  encapsulation: ViewEncapsulation.None
})
export class StarterComponent {
  private adminService = inject(AdminService);
  private authService = inject(AuthService);
  private snackBar = inject(MatSnackBar);

  currentUser$: Observable<UserRead | null>;
  isPromoting = false;
  
  constructor() {
    this.currentUser$ = this.authService.getCurrentUser();
  }

  /**
   * Auto-promotion au rôle admin (temporaire)
   */
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

  private handlePromotionSuccess(response: TemporaryPromotionResponse): void {
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

}
