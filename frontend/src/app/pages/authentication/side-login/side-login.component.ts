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
import { LoginCredentials } from '../../../models/auth.models';

@Component({
  selector: 'app-side-login',
  standalone: true,
  imports: [
    RouterModule,
    MaterialModule,
    FormsModule,
    ReactiveFormsModule,
    BrandingComponent,
  ],
  templateUrl: './side-login.component.html',
})
export class AppSideLoginComponent {
  // Inject services
  private authService = inject(AuthService);
  private router = inject(Router);
  private settings = inject(CoreService);

  // Initialize options using the injected service
  options = this.settings.getOptions();

  isLoading = false;
  loginError: string | null = null;

  // Update form to use email instead of uname
  form = new FormGroup({
    email: new FormControl('', [Validators.required, Validators.email]),
    password: new FormControl('', [Validators.required]),
  });

  get f() {
    return this.form.controls;
  }

  submit() {
    if (this.form.invalid) {
      // Optionally mark fields as touched to show validation errors
      this.form.markAllAsTouched();
      this.loginError = 'Veuillez remplir correctement tous les champs.'
      return;
    }

    this.isLoading = true;
    this.loginError = null;
    // Utiliser l'interface LoginCredentials
    const credentials: LoginCredentials = {
      email: this.f.email.value ?? '', // Utiliser ?? '' pour gérer null/undefined
      password: this.f.password.value ?? '',
    };

    this.authService.login(credentials)
      .pipe(finalize(() => this.isLoading = false)) // Stop loading indicator when done
      .subscribe({
        next: (response) => {
          console.log('Login successful', response); // Log for debugging
          // Navigate to starter page on success
          this.router.navigate(['/starter']);
        },
        error: (error) => {
          console.error('Login failed:', error);
          // Display specific error from backend if available, otherwise generic message
          this.loginError = error.message?.includes('400')
            ? 'Email ou mot de passe incorrect.' // Specific message for 400 Bad Request from fastapi-users login
            : (error.message || 'Échec de la connexion. Veuillez réessayer.');
        }
      });
  }
}
