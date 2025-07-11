import { Component, inject, OnInit, OnDestroy } from '@angular/core';
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
import { finalize, Subscription } from 'rxjs';
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
    TranslateModule,
  ],
  templateUrl: './side-login.component.html',
})
export class AppSideLoginComponent implements OnInit, OnDestroy {
  // Inject services
  private authService = inject(AuthService);
  private router = inject(Router);
  private settings = inject(CoreService);
  private translate = inject(TranslateService);
  private langChangeSubscription?: Subscription;

  // Initialize options using the injected service
  options = this.settings.getOptions();

  isLoading = false;
  isGoogleLoading = false;
  loginError: string | null = null;

  // Labels traduits
  loginTitle: string = '';
  loginSubtitle: string = '';
  orContinueWith: string = '';
  emailLabel: string = '';
  passwordLabel: string = '';
  rememberMe: string = '';
  forgotPassword: string = '';
  createAccount: string = '';
  signUp: string = '';
  submitLabel: string = '';
  googleLabel: string = '';
  googleLoadingLabel: string = '';
  emailRequired: string = '';
  emailInvalid: string = '';
  passwordRequired: string = '';
  loadingLabel: string = '';

  // Update form to use email instead of uname
  form = new FormGroup({
    email: new FormControl('', [Validators.required, Validators.email]),
    password: new FormControl('', [Validators.required]),
  });

  get f() {
    return this.form.controls;
  }

  ngOnInit(): void {
    // Initialiser les traductions
    this.updateTranslations();
    
    // S'abonner aux changements de langue
    this.langChangeSubscription = this.translate.onLangChange.subscribe(() => {
      this.updateTranslations();
    });
  }

  ngOnDestroy(): void {
    // Nettoyer les abonnements
    if (this.langChangeSubscription) {
      this.langChangeSubscription.unsubscribe();
    }
  }

  private updateTranslations(): void {
    this.loginTitle = this.translate.instant('AUTH.LOGIN.TITLE');
    this.loginSubtitle = this.translate.instant('AUTH.LOGIN.SUBTITLE');
    this.orContinueWith = this.translate.instant('AUTH.OR_CONTINUE_WITH');
    this.emailLabel = this.translate.instant('AUTH.LOGIN.EMAIL_LABEL');
    this.passwordLabel = this.translate.instant('AUTH.LOGIN.PASSWORD_LABEL');
    this.rememberMe = this.translate.instant('AUTH.REMEMBER_ME');
    this.forgotPassword = this.translate.instant('AUTH.LOGIN.FORGOT_PASSWORD');
    this.createAccount = this.translate.instant('AUTH.LOGIN.CREATE_ACCOUNT');
    this.signUp = this.translate.instant('AUTH.SIGN_UP');
    this.submitLabel = this.translate.instant('AUTH.LOGIN.SUBMIT');
    this.googleLabel = this.translate.instant('AUTH.LOGIN.GOOGLE');
    this.googleLoadingLabel = this.translate.instant('AUTH.LOGIN.GOOGLE_LOADING');
    this.emailRequired = this.translate.instant('AUTH.LOGIN.EMAIL_REQUIRED');
    this.emailInvalid = this.translate.instant('AUTH.LOGIN.EMAIL_INVALID');
    this.passwordRequired = this.translate.instant('AUTH.LOGIN.PASSWORD_REQUIRED');
    this.loadingLabel = this.translate.instant('COMMON.LOADING');
  }

  /**
   * Traite le formulaire de connexion standard
   */
  submit() {
    if (this.form.invalid) {
      // Optionally mark fields as touched to show validation errors
      this.form.markAllAsTouched();
      this.loginError = this.translate.instant('AUTH.LOGIN.FORM_INVALID');
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
            ? this.translate.instant('AUTH.LOGIN.INVALID_CREDENTIALS') // Specific message for 400 Bad Request from fastapi-users login
            : (error.message || this.translate.instant('ERRORS.AUTHENTICATION_FAILED'));
        }
      });
  }

  /**
   * Initie la connexion avec Google
   */
  loginWithGoogle() {
    this.isGoogleLoading = true;
    this.loginError = null;
    
    // S'abonne à l'Observable qui va récupérer l'URL d'autorisation Google
    this.authService.getGoogleAuthorizeUrl()
      .pipe(finalize(() => this.isGoogleLoading = false))
      .subscribe({
        next: (googleAuthUrl) => {
          // Redirige vers l'URL d'autorisation Google (pas vers notre backend)
          window.location.href = googleAuthUrl;
        },
        error: (error) => {
          console.error('Échec de récupération de l\'URL d\'autorisation Google:', error);
          this.loginError = this.translate.instant('ERRORS.AUTHENTICATION_FAILED');
        }
      });
  }
}
