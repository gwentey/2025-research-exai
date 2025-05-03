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
import { finalize } from 'rxjs';
import { SignupData } from '../../../models/auth.models';

@Component({
  selector: 'app-side-register',
  standalone: true,
  imports: [
    RouterModule,
    MaterialModule,
    FormsModule,
    ReactiveFormsModule,
    BrandingComponent,
  ],
  templateUrl: './side-register.component.html',
})
export class AppSideRegisterComponent {
  private authService = inject(AuthService);
  private router = inject(Router);
  private settings = inject(CoreService);

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
      this.signupError = 'Veuillez remplir correctement tous les champs.';
      this.signupSuccess = false;
      return;
    }

    this.isLoading = true;
    this.signupError = null;
    this.signupSuccess = false;

    const userData: SignupData = {
      email: this.f.email.value ?? '',
      password: this.f.password.value ?? '',
      pseudo: this.f.pseudo.value || undefined,
      picture: undefined,
      given_name: undefined,
      family_name: undefined,
      locale: undefined,
    };

    this.authService.signup(userData)
      .pipe(finalize(() => this.isLoading = false))
      .subscribe({
        next: (response) => {
          console.log('Signup successful', response);
          this.signupSuccess = true;
        },
        error: (error) => {
          console.error('Signup failed:', error);
          this.signupSuccess = false;
          if (error.message?.includes('400')) {
             this.signupError = 'Cet email est déjà utilisé. Veuillez en choisir un autre ou vous connecter.';
          } else {
             this.signupError = error.message || 'Échec de l\'inscription. Veuillez réessayer.';
          }
        }
      });
  }

  /**
   * Initie la connexion avec Google
   */
  loginWithGoogle() {
    this.isGoogleLoading = true;
    this.signupError = null;

    this.authService.googleLogin()
      .pipe(finalize(() => this.isGoogleLoading = false))
      .subscribe({
        next: (response) => {
          if (response && response.authorization_url) {
            // Rediriger vers l'URL d'autorisation Google
            window.location.href = response.authorization_url;
          }
        },
        error: (error) => {
          console.error('Google login initiation failed:', error);
          this.signupError = 'Impossible d\'initialiser la connexion avec Google. Veuillez réessayer.';
        }
      });
  }
}
