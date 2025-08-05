import { Component, OnInit, ChangeDetectionStrategy, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

import { MatDividerModule } from '@angular/material/divider';
import { MatRippleModule } from '@angular/material/core';
import { MatBadgeModule } from '@angular/material/badge';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Router } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { catchError, of } from 'rxjs';

import { AuthService } from '../../../services/auth.service';
import { ClaimCreditsResponse, UserRead } from '../../../models/auth.models';
import { CreditsIndicatorComponent } from '../../../components/credits-indicator/credits-indicator.component';

@Component({
  selector: 'app-credits-refill',
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,

    MatDividerModule,
    MatRippleModule,
    MatBadgeModule,
    TranslateModule,
    CreditsIndicatorComponent
  ],
  templateUrl: './credits-refill.component.html',
  styleUrls: ['./credits-refill.component.scss'],
  changeDetection: ChangeDetectionStrategy.Default
})
export class CreditsRefillComponent implements OnInit {
  private authService = inject(AuthService);
  private snackBar = inject(MatSnackBar);
  private router = inject(Router);
  private cdr = inject(ChangeDetectorRef);

  public currentUser: UserRead | null = null;
  public isLoading = false;
  public canClaim = true;
  public daysRemaining = 0;
  public nextClaimDate: Date | null = null;

  ngOnInit(): void {
    this.loadUserData();
  }

  private loadUserData(): void {
    this.authService.getCurrentUser().pipe(
      catchError(error => {
        console.error('Erreur lors du chargement des données utilisateur:', error);
        return of(null);
      })
    ).subscribe(user => {
      this.currentUser = user;
      if (user?.date_claim) {
        this.checkClaimEligibility(user.date_claim);
      } else {
        // L'utilisateur n'a jamais réclamé de crédits - il peut en récupérer
        this.canClaim = true;
        this.daysRemaining = 0;
        this.nextClaimDate = null;
      }
      // Forcer la détection des changements pour s'assurer que l'affichage se met à jour
      this.cdr.detectChanges();
      console.log('Données utilisateur chargées:', {
        user: user?.email,
        date_claim: user?.date_claim,
        canClaim: this.canClaim,
        daysRemaining: this.daysRemaining
      });
    });
  }

  private checkClaimEligibility(dateClaimString: string): void {
    const lastClaimDate = new Date(dateClaimString);
    const now = new Date();
    const daysDiff = Math.floor((now.getTime() - lastClaimDate.getTime()) / (1000 * 60 * 60 * 24));
    
    if (daysDiff < 7) {
      this.canClaim = false;
      this.daysRemaining = 7 - daysDiff;
      this.nextClaimDate = new Date(lastClaimDate.getTime() + (7 * 24 * 60 * 60 * 1000));
    } else {
      this.canClaim = true;
      this.daysRemaining = 0;
      this.nextClaimDate = null;
    }
  }

  public claimCredits(): void {
    if (!this.canClaim || this.isLoading) {
      return;
    }

    this.isLoading = true;

    this.authService.claimCredits().pipe(
      catchError(error => {
        console.error('Erreur lors du claim de crédits:', error);
        this.snackBar.open(
          'Erreur lors de la récupération des crédits. Veuillez réessayer.',
          'Fermer',
          { duration: 5000 }
        );
        this.isLoading = false;
        return of(null);
      })
    ).subscribe((response: ClaimCreditsResponse | null) => {
      this.isLoading = false;
      
      if (response) {
        if (response.success) {
          // Succès - Beau message avec icône et style
          this.snackBar.open(
            `🎉 ${response.message} Vous avez maintenant ${response.total_credits} crédits !`,
            '✓ Parfait',
            { 
              duration: 6000, 
              panelClass: ['success-snackbar', 'credits-success'],
              horizontalPosition: 'center',
              verticalPosition: 'top'
            }
          );
          
          // Recharger les données utilisateur SANS redirection
          this.loadUserData();
          
          // Mise à jour immédiate de l'affichage
          if (response.next_claim_date) {
            this.nextClaimDate = new Date(response.next_claim_date);
            this.canClaim = false;
            this.daysRemaining = 7; // Il faudra attendre 7 jours
          }
        } else {
          // Refusé (doit attendre)
          this.snackBar.open(
            response.message,
            'Fermer',
            { duration: 5000, panelClass: ['warning-snackbar'] }
          );
          
          if (response.days_remaining) {
            this.daysRemaining = response.days_remaining;
            this.canClaim = false;
          }
          
          if (response.next_claim_date) {
            this.nextClaimDate = new Date(response.next_claim_date);
          }
        }
      }
    });
  }

  public getUserCredits(): number {
    return this.currentUser?.credits ?? 0;
  }

  public goBack(): void {
    this.router.navigate(['/profile']);
  }

  /**
   * Formatage personnalisé de la date pour un affichage plus lisible
   */
  public formatClaimDate(dateString: string | undefined): string {
    if (!dateString) {
      return 'Jamais réclamé';
    }
    const date = new Date(dateString);
    return date.toLocaleDateString('fr-FR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  /**
   * Méthode pour déboguer l'état du composant
   */
  public getDebugInfo(): string {
    return `User: ${this.currentUser?.email}, CanClaim: ${this.canClaim}, DaysRemaining: ${this.daysRemaining}, LastClaim: ${this.currentUser?.date_claim}`;
  }
}