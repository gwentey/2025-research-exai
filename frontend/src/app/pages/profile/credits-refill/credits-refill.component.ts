import { Component, OnInit, ChangeDetectionStrategy, inject } from '@angular/core';
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
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CreditsRefillComponent implements OnInit {
  private authService = inject(AuthService);
  private snackBar = inject(MatSnackBar);
  private router = inject(Router);

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
      }
    });
  }

  private checkClaimEligibility(dateClaimString: string): void {
    const lastClaimDate = new Date(dateClaimString);
    const now = new Date();
    const daysDiff = Math.floor((now.getTime() - lastClaimDate.getTime()) / (1000 * 60 * 60 * 24));
    
    if (daysDiff < 30) {
      this.canClaim = false;
      this.daysRemaining = 30 - daysDiff;
      this.nextClaimDate = new Date(lastClaimDate.getTime() + (30 * 24 * 60 * 60 * 1000));
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
          // Succès
          this.snackBar.open(
            response.message,
            'Fermer',
            { duration: 5000, panelClass: ['success-snackbar'] }
          );
          
          // Recharger les données utilisateur
          this.loadUserData();
          
          // Rediriger vers le profil après 2 secondes
          setTimeout(() => {
            this.router.navigate(['/profile']);
          }, 2000);
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
}