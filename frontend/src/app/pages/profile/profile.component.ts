import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Router } from '@angular/router';
import { MaterialModule } from '../../material.module';
import { TablerIconsModule } from 'angular-tabler-icons';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { AuthService } from '../../services/auth.service';
import { UserRead, UserUpdate, PasswordUpdate } from '../../models/auth.models';

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MaterialModule,
    TablerIconsModule,
    TranslateModule
  ],
  templateUrl: './profile.component.html',
  styleUrls: ['./profile.component.scss']
})
export class ProfileComponent implements OnInit {
  
  // Injections
  private authService = inject(AuthService);
  private formBuilder = inject(FormBuilder);
  private snackBar = inject(MatSnackBar);
  private router = inject(Router);
  private translateService = inject(TranslateService);

  // Données utilisateur
  currentUser: UserRead | null = null;
  
  // Formulaires
  profileForm!: FormGroup;
  passwordForm!: FormGroup;
  
  // États de chargement
  isLoadingProfile = false;
  isLoadingPassword = false;
  isLoadingPicture = false;
  
  // Variables pour l'upload d'image
  selectedFile: File | null = null;
  imagePreview: string | null = null;

  // Langues disponibles - initialisées une seule fois pour éviter les problèmes de performance
  languages: Array<{code: string, name: string}> = [];

  // Niveaux d'éducation disponibles
  educationLevels: Array<{code: string, name: string}> = [];

  ngOnInit(): void {
    this.initializeLanguages();
    this.initializeEducationLevels();
    this.initializeForms();
    this.loadUserProfile();
  }

  /**
   * Initialise la liste des langues une seule fois
   */
  initializeLanguages(): void {
    this.languages = [
      { code: 'fr', name: this.translateService.instant('PROFILE.LANGUAGES.FRENCH') },
      { code: 'en', name: this.translateService.instant('PROFILE.LANGUAGES.ENGLISH') },
      { code: 'es', name: this.translateService.instant('PROFILE.LANGUAGES.SPANISH') },
      { code: 'de', name: this.translateService.instant('PROFILE.LANGUAGES.GERMAN') }
    ];
  }

  /**
   * Initialise la liste des niveaux d'éducation une seule fois
   */
  initializeEducationLevels(): void {
    this.educationLevels = [
      { code: 'no_formal', name: this.translateService.instant('PROFILE.EDUCATION_LEVELS.NO_FORMAL') },
      { code: 'high_school', name: this.translateService.instant('PROFILE.EDUCATION_LEVELS.HIGH_SCHOOL') },
      { code: 'bachelor', name: this.translateService.instant('PROFILE.EDUCATION_LEVELS.BACHELOR') },
      { code: 'master', name: this.translateService.instant('PROFILE.EDUCATION_LEVELS.MASTER') },
      { code: 'phd', name: this.translateService.instant('PROFILE.EDUCATION_LEVELS.PHD') },
      { code: 'other', name: this.translateService.instant('PROFILE.EDUCATION_LEVELS.OTHER') }
    ];
  }

  /**
   * Initialise les formulaires réactifs
   */
  initializeForms(): void {
    // Formulaire de profil
    this.profileForm = this.formBuilder.group({
      pseudo: [''],
      given_name: [''],
      family_name: [''],
      locale: ['fr'],
      education_level: [''],
      age: ['', [Validators.min(13), Validators.max(120)]],
      ai_familiarity: ['', [Validators.min(1), Validators.max(5)]]
    });

    // Formulaire de mot de passe
    this.passwordForm = this.formBuilder.group({
      current_password: ['', [Validators.required]],
      new_password: ['', [Validators.required, Validators.minLength(8)]],
      confirm_password: ['', [Validators.required]]
    }, { validators: this.passwordMatchValidator });
  }

  /**
   * Validateur personnalisé pour vérifier que les mots de passe correspondent
   */
  passwordMatchValidator(group: FormGroup) {
    const newPassword = group.get('new_password')?.value;
    const confirmPassword = group.get('confirm_password')?.value;
    return newPassword === confirmPassword ? null : { mismatch: true };
  }

  /**
   * Charge les informations du profil utilisateur
   */
  loadUserProfile(): void {
    // Ajouter un indicateur de chargement
    this.isLoadingProfile = true;
    
    this.authService.getCurrentUser().subscribe({
      next: (user) => {
        this.currentUser = user;
        this.updateFormWithUserData(user);
        this.imagePreview = user.picture || null;
        this.isLoadingProfile = false;
        console.log('Profil utilisateur chargé avec succès:', user);
      },
      error: (error) => {
        this.isLoadingProfile = false;
        console.error('Erreur lors du chargement du profil:', error);
        
        // Si l'erreur est liée à l'authentification, rediriger vers login
        if (error.message && error.message.includes('token')) {
          console.warn('Problème de token détecté, redirection vers login');
          this.authService.logout();
          return;
        }
        
        this.showError(this.translateService.instant('PROFILE.ERRORS.LOAD_PROFILE'));
      }
    });
  }

  /**
   * Met à jour le formulaire avec les données utilisateur
   */
  updateFormWithUserData(user: UserRead): void {
    this.profileForm.patchValue({
      pseudo: user.pseudo || '',
      given_name: user.given_name || '',
      family_name: user.family_name || '',
      locale: user.locale || 'fr',
      education_level: user.education_level || '',
      age: user.age || null,
      ai_familiarity: user.ai_familiarity || null
    });
  }

  /**
   * Soumet le formulaire de mise à jour du profil
   */
  onSubmitProfile(): void {
    if (this.profileForm.valid) {
      this.isLoadingProfile = true;
      
      const updateData: UserUpdate = {
        pseudo: this.profileForm.value.pseudo || null,
        given_name: this.profileForm.value.given_name || null,
        family_name: this.profileForm.value.family_name || null,
        locale: this.profileForm.value.locale || null,
        education_level: this.profileForm.value.education_level || null,
        age: this.profileForm.value.age || null,
        ai_familiarity: this.profileForm.value.ai_familiarity || null
      };

      this.authService.updateProfile(updateData).subscribe({
        next: (updatedUser) => {
          this.currentUser = updatedUser;
          this.isLoadingProfile = false;
          this.showSuccess(this.translateService.instant('PROFILE.MESSAGES.PROFILE_UPDATED'));
        },
        error: (error) => {
          this.isLoadingProfile = false;
          console.error('Erreur lors de la mise à jour du profil:', error);
          this.showError(this.translateService.instant('PROFILE.ERRORS.UPDATE_PROFILE'));
        }
      });
    } else {
      this.markFormGroupTouched(this.profileForm);
    }
  }

  /**
   * Soumet le formulaire de changement de mot de passe
   */
  onSubmitPassword(): void {
    if (this.passwordForm.valid) {
      this.isLoadingPassword = true;
      
      const passwordData: PasswordUpdate = {
        current_password: this.passwordForm.value.current_password,
        new_password: this.passwordForm.value.new_password
      };

      this.authService.updatePassword(passwordData).subscribe({
        next: () => {
          this.isLoadingPassword = false;
          this.passwordForm.reset();
          this.showSuccess(this.translateService.instant('PROFILE.MESSAGES.PASSWORD_UPDATED'));
        },
        error: (error) => {
          this.isLoadingPassword = false;
          console.error('Erreur lors du changement de mot de passe:', error);
          this.showError(this.translateService.instant('PROFILE.ERRORS.UPDATE_PASSWORD'));
        }
      });
    } else {
      this.markFormGroupTouched(this.passwordForm);
    }
  }

  /**
   * Gère la sélection d'un fichier image
   */
  onFileSelected(event: any): void {
    const file = event.target.files[0];
    if (file) {
      // Vérifications de base
      if (!file.type.startsWith('image/')) {
        this.showError('Veuillez sélectionner un fichier image valide');
        return;
      }
      
      if (file.size > 5 * 1024 * 1024) { // 5MB max
        this.showError('La taille du fichier ne doit pas dépasser 5MB');
        return;
      }

      this.selectedFile = file;
      
      // Générer un aperçu
      const reader = new FileReader();
      reader.onload = () => {
        this.imagePreview = reader.result as string;
      };
      reader.readAsDataURL(file);
    }
  }

  /**
   * Upload l'image de profil
   */
  uploadProfilePicture(): void {
    if (!this.selectedFile) {
      this.showError('Veuillez sélectionner une image');
      return;
    }

    this.isLoadingPicture = true;
    
    const reader = new FileReader();
    reader.onload = () => {
      const base64Image = reader.result as string;
      
      this.authService.updateProfilePicture({ picture: base64Image }).subscribe({
        next: (updatedUser) => {
          this.currentUser = updatedUser;
          this.isLoadingPicture = false;
          this.selectedFile = null;
          this.showSuccess('Image de profil mise à jour avec succès');
        },
        error: (error) => {
          this.isLoadingPicture = false;
          console.error('Erreur lors de l\'upload de l\'image:', error);
          this.showError('Erreur lors de la mise à jour de l\'image');
        }
      });
    };
    reader.readAsDataURL(this.selectedFile);
  }

  /**
   * Annule la sélection d'image
   */
  cancelImageSelection(): void {
    this.selectedFile = null;
    this.imagePreview = this.currentUser?.picture || null;
  }

  /**
   * Marque tous les champs d'un FormGroup comme touchés
   */
  private markFormGroupTouched(formGroup: FormGroup): void {
    Object.keys(formGroup.controls).forEach(key => {
      const control = formGroup.get(key);
      control?.markAsTouched();
    });
  }

  /**
   * Affiche un message de succès
   */
  private showSuccess(message: string): void {
    this.snackBar.open(message, 'Fermer', {
      duration: 3000,
      panelClass: ['success-snackbar']
    });
  }

  /**
   * Affiche un message d'erreur
   */
  private showError(message: string): void {
    this.snackBar.open(message, 'Fermer', {
      duration: 5000,
      panelClass: ['error-snackbar']
    });
  }

  /**
   * Obtient l'URL de l'image de profil ou une image par défaut
   */
  getProfileImageUrl(): string {
    return this.imagePreview || this.currentUser?.picture || '/assets/images/profile/user5.jpg';
  }

  /**
   * Obtient le nom d'affichage de l'utilisateur
   */
  getDisplayName(): string {
    if (!this.currentUser) return 'Utilisateur';
    
    if (this.currentUser.pseudo) {
      return this.currentUser.pseudo;
    }
    
    if (this.currentUser.given_name || this.currentUser.family_name) {
      return `${this.currentUser.given_name || ''} ${this.currentUser.family_name || ''}`.trim();
    }
    
    return this.currentUser.email;
  }

  /**
   * Navigation vers le tableau de bord
   */
  goBack(): void {
    this.router.navigate(['/starter']);
  }
} 