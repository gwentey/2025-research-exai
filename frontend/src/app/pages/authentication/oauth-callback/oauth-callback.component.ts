import { Component, OnInit, inject } from '@angular/core';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { AuthService } from '../../../services/auth.service';
import { finalize } from 'rxjs';

@Component({
  selector: 'app-oauth-callback',
  standalone: true,
  imports: [RouterModule, CommonModule, MatProgressSpinnerModule],
  template: `
    <div class="d-flex flex-column align-items-center justify-content-center" style="height: 100vh;">
      <mat-spinner *ngIf="isLoading"></mat-spinner>
      <div *ngIf="errorMessage" class="text-danger mt-4">
        {{ errorMessage }}
      </div>
      <div *ngIf="errorMessage" class="mt-3">
        <a [routerLink]="['/authentication/login']" class="btn btn-primary">Retour à la connexion</a>
      </div>
    </div>
  `,
})
export class OAuthCallbackComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private authService = inject(AuthService);

  isLoading = false;
  errorMessage: string | null = null;

  ngOnInit(): void {
    // Récupérer le code et l'état depuis les paramètres de l'URL
    this.route.queryParams.subscribe(params => {
      const code = params['code'];
      const state = params['state'];
      
      if (code && state) {
        this.isLoading = true;
        this.authService.completeGoogleAuth(code, state)
          .pipe(finalize(() => this.isLoading = false))
          .subscribe({
            next: (response) => {
              // Rediriger vers la page d'accueil après connexion réussie
              this.router.navigate(['/starter']);
            },
            error: (error) => {
              console.error('OAuth authentication failed:', error);
              this.errorMessage = 'Échec de l\'authentification. Veuillez réessayer.';
            }
          });
      } else {
        this.errorMessage = 'Paramètres d\'authentification manquants.';
      }
    });
  }
} 
