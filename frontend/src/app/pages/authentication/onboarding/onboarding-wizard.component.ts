import { Component, inject, OnInit } from '@angular/core';
import { CoreService } from 'src/app/services/core.service';
import {
  FormGroup,
  FormControl,
  Validators,
  FormsModule,
  ReactiveFormsModule,
  FormBuilder,
} from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { MaterialModule } from '../../../material.module';
import { BrandingComponent } from '../../../layouts/full/vertical/sidebar/branding.component';
import { AuthService } from 'src/app/services/auth.service';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { finalize } from 'rxjs';
import { OnboardingData, EducationLevel, UserRead } from '../../../models/auth.models';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-onboarding-wizard',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    MaterialModule,
    FormsModule,
    ReactiveFormsModule,
    BrandingComponent,
    TranslateModule,
  ],
  templateUrl: './onboarding-wizard.component.html',
  styleUrls: ['./onboarding-wizard.component.scss']
})
export class OnboardingWizardComponent implements OnInit {
  private authService = inject(AuthService);
  private router = inject(Router);
  private settings = inject(CoreService);
  private translate = inject(TranslateService);
  private formBuilder = inject(FormBuilder);

  options = this.settings.getOptions();
  currentUser: UserRead | null = null;

  // État du stepper
  currentStep = 0;
  totalSteps = 4; // Introduction + 3 questions
  isLoading = false;
  error: string | null = null;

  // Formulaires pour chaque étape
  educationForm: FormGroup;
  ageForm: FormGroup;
  familiarityForm: FormGroup;

  // Options pour les champs de sélection
  educationLevels = [
    { value: EducationLevel.NO_FORMAL, key: 'NO_FORMAL' },
    { value: EducationLevel.HIGH_SCHOOL, key: 'HIGH_SCHOOL' },
    { value: EducationLevel.BACHELOR, key: 'BACHELOR' },
    { value: EducationLevel.MASTER, key: 'MASTER' },
    { value: EducationLevel.PHD, key: 'PHD' },
    { value: EducationLevel.ENGINEER, key: 'ENGINEER' },
    { value: EducationLevel.OTHER, key: 'OTHER' }
  ];

  familiarityLevels = [
    { value: 1, key: 'BEGINNER' },
    { value: 2, key: 'NOVICE' },
    { value: 3, key: 'INTERMEDIATE' },
    { value: 4, key: 'ADVANCED' },
    { value: 5, key: 'EXPERT' }
  ];

  constructor() {
    // Initialiser les formulaires
    this.educationForm = this.formBuilder.group({
      education_level: ['', [Validators.required]]
    });

    this.ageForm = this.formBuilder.group({
      age: ['', [Validators.required, Validators.min(13), Validators.max(120)]]
    });

    this.familiarityForm = this.formBuilder.group({
      ai_familiarity: ['', [Validators.required, Validators.min(1), Validators.max(5)]]
    });
  }

  ngOnInit() {
    this.loadCurrentUser();
  }

  /**
   * Charge les données de l'utilisateur actuel
   */
  loadCurrentUser() {
    this.authService.getCurrentUser().subscribe({
      next: (user) => {
        this.currentUser = user;
        // Pré-remplir les formulaires si les données existent déjà
        if (user.education_level) {
          this.educationForm.patchValue({ education_level: user.education_level });
        }
        if (user.age) {
          this.ageForm.patchValue({ age: user.age });
        }
        if (user.ai_familiarity) {
          this.familiarityForm.patchValue({ ai_familiarity: user.ai_familiarity });
        }
      },
      error: (error) => {
        console.error('Error loading user data:', error);
        this.error = this.translate.instant('ERRORS.LOADING_USER_DATA');
      }
    });
  }

  /**
   * Retourne le formulaire pour l'étape courante
   */
  getCurrentForm(): FormGroup {
    switch (this.currentStep) {
      case 0:
        // Étape d'introduction - pas de formulaire
        return this.educationForm; // On retourne un form valide par défaut
      case 1:
        return this.educationForm;
      case 2:
        return this.ageForm;
      case 3:
        return this.familiarityForm;
      default:
        return this.educationForm;
    }
  }

  /**
   * Vérifie si l'étape courante est valide
   */
  isCurrentStepValid(): boolean {
    // L'étape d'introduction est toujours valide
    if (this.currentStep === 0) {
      return true;
    }
    return this.getCurrentForm().valid;
  }

  /**
   * Passe à l'étape suivante
   */
  nextStep() {
    if (this.isCurrentStepValid() && this.currentStep < this.totalSteps - 1) {
      this.currentStep++;
      this.error = null;
    } else {
      this.getCurrentForm().markAllAsTouched();
      this.error = this.translate.instant('ONBOARDING.ERRORS.INVALID_STEP');
    }
  }

  /**
   * Revient à l'étape précédente
   */
  previousStep() {
    if (this.currentStep > 0) {
      this.currentStep--;
      this.error = null;
    }
  }

  /**
   * Vérifie si tous les formulaires sont valides
   */
  areAllFormsValid(): boolean {
    return this.educationForm.valid && this.ageForm.valid && this.familiarityForm.valid;
  }

  /**
   * Soumet les données d'onboarding
   */
  submitOnboarding() {
    if (!this.areAllFormsValid()) {
      // Marquer tous les formulaires comme touchés pour afficher les erreurs
      this.educationForm.markAllAsTouched();
      this.ageForm.markAllAsTouched();
      this.familiarityForm.markAllAsTouched();
      this.error = this.translate.instant('ONBOARDING.ERRORS.INVALID_FORM');
      return;
    }

    this.isLoading = true;
    this.error = null;

    const onboardingData: OnboardingData = {
      education_level: this.educationForm.get('education_level')?.value,
      age: this.ageForm.get('age')?.value,
      ai_familiarity: this.familiarityForm.get('ai_familiarity')?.value
    };

    this.authService.saveOnboarding(onboardingData)
      .pipe(finalize(() => this.isLoading = false))
      .subscribe({
        next: (response) => {
          console.log('Onboarding completed successfully', response);
          // Rediriger vers la page d'accueil
          this.router.navigate(['/starter']);
        },
        error: (error) => {
          console.error('Onboarding failed:', error);
          this.error = error.message || this.translate.instant('ONBOARDING.ERRORS.SAVE_FAILED');
        }
      });
  }

  /**
   * Retourne le pourcentage de progression
   */
  getProgressPercentage(): number {
    // Ne pas inclure l'étape d'introduction dans le calcul de progression
    if (this.currentStep === 0) {
      return 0;
    }
    return (this.currentStep / (this.totalSteps - 1)) * 100;
  }

  /**
   * Retourne le nom d'affichage de l'utilisateur
   */
  getUserDisplayName(): string {
    if (this.currentUser) {
      return this.currentUser.given_name || this.currentUser.pseudo || this.currentUser.email.split('@')[0];
    }
    return '';
  }
}
