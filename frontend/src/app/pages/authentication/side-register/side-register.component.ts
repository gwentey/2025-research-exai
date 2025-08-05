import { Component, inject } from '@angular/core';
import { CoreService } from 'src/app/services/core.service';
import {
  FormGroup,
  FormControl,
  Validators,
  FormsModule,
  ReactiveFormsModule,
} from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { MaterialModule } from '../../../material.module';
import { BrandingComponent } from '../../../layouts/full/vertical/sidebar/branding.component';
import { AuthService } from 'src/app/services/auth.service';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { finalize } from 'rxjs';
import { SignupData, SignupResponse } from '../../../models/auth.models';

@Component({
  selector: 'app-side-register',
  standalone: true,
  imports: [
    RouterModule,
    MaterialModule,
    FormsModule,
    ReactiveFormsModule,
    BrandingComponent,
    TranslateModule,
  ],
  templateUrl: './side-register.component.html',
})
export class AppSideRegisterComponent {
  private authService = inject(AuthService);
  private router = inject(Router);
  private settings = inject(CoreService);
  private translate = inject(TranslateService);

  options = this.settings.getOptions();

  isLoading = false;
  isGoogleLoading = false;
  signupError: string | null = null;
  signupSuccess = false;

  form = new FormGroup({
    pseudo: new FormControl('', [Validators.required, Validators.minLength(3)]),
    email: new FormControl('', [Validators.required, Validators.email]),
    password: new FormControl('', [Validators.required, Validators.minLength(8)]),
  });

  get f() {
    return this.form.controls;
  }

  submit() {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.signupError = this.translate.instant('AUTH.LOGIN.FORM_INVALID');
      this.signupSuccess = false;
      return;
    }

    this.isLoading = true;
    this.signupError = null;
    this.signupSuccess = false;

    const userData: SignupData = {
      email: this.f.email.value ?? '',
      password: this.f.password.value ?? '',
      pseudo: this.f.pseudo.value || null,
      picture: null,
      given_name: null,
      family_name: null,
      locale: null,
      education_level: null,
      age: null,
      ai_familiarity: null
    };

    this.authService.signup(userData)
      .pipe(finalize(() => this.isLoading = false))
      .subscribe({
        next: (response: SignupResponse) => {
          console.log('Signup successful with auto-login', response);
          // *** NOUVEAUTÉ : Auto-connexion réussie, rediriger vers le dashboard ***
          if (response && response.access_token && response.user) {
            console.log('Auto-connexion réussie pour:', response.user.email);
            // Vérifier que le token est bien stocké
            if (this.authService.isAuthenticated()) {
              // Rediriger vers le dashboard au lieu de l'onboarding
              this.router.navigate(['/starter']);
            } else {
              // Fallback : problème de stockage du token
              console.error('Erreur: Token non stocké correctement, redirection vers login');
              this.router.navigate(['/authentication/login'], { 
                queryParams: { 
                  msg: 'Inscription réussie mais problème de connexion, veuillez vous connecter manuellement',
                  auto_login_failed: 'true'
                } 
              });
            }
          } else {
            // Fallback : réponse incomplète du serveur
            console.warn('Inscription réussie mais réponse serveur incomplète, redirection vers login');
            this.router.navigate(['/authentication/login'], { 
              queryParams: { 
                msg: 'Inscription réussie, veuillez vous connecter',
                signup_success: 'true'
              } 
            });
          }
        },
        error: (error) => {
          console.error('Signup failed:', error);
          this.signupSuccess = false;
          
          // Gérer les nouveaux codes d'erreur spécifiques du backend
          if (error.message?.includes('EMAIL_ALREADY_LINKED_TO_OAUTH')) {
            this.signupError = this.translate.instant('ERRORS.EMAIL_ALREADY_LINKED_TO_OAUTH');
          } else if (error.message?.includes('EMAIL_ALREADY_EXISTS')) {
            this.signupError = this.translate.instant('ERRORS.EMAIL_ALREADY_EXISTS');
          } else if (error.message?.includes('400')) {
            this.signupError = this.translate.instant('ERRORS.ACCESS_DENIED');
          } else {
            this.signupError = error.message || this.translate.instant('ERRORS.AUTHENTICATION_FAILED');
          }
        }
      });
  }

  /**
   * Initie la connexion/inscription avec Google
   */
  loginWithGoogle() {
    this.isGoogleLoading = true;
    this.signupError = null;
    
    // S'abonne à l'Observable qui va récupérer l'URL d'autorisation Google
    this.authService.getGoogleAuthorizeUrl()
      .pipe(finalize(() => this.isGoogleLoading = false))
      .subscribe({
        next: (googleAuthUrl) => {
          // Redirige vers l'URL d'autorisation Google (pas vers notre backend)
          // Note: Après la connexion OAuth, l'utilisateur sera redirigé vers l'onboarding
          // si nécessaire via le guard d'onboarding
          window.location.href = googleAuthUrl;
        },
        error: (error) => {
          console.error('Échec de récupération de l\'URL d\'autorisation Google:', error);
          this.signupError = this.translate.instant('ERRORS.AUTHENTICATION_FAILED');
        }
      });
  }
}
