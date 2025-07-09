import { Injectable, inject } from '@angular/core';
import { AbstractControl, ValidationErrors } from '@angular/forms';
import { TranslateService } from '@ngx-translate/core';

/**
 * Service centralisé pour la gestion des erreurs de formulaire avec traductions
 */
@Injectable({
  providedIn: 'root'
})
export class FormErrorService {
  
  private translate = inject(TranslateService);

  /**
   * Obtient le message d'erreur traduit pour un contrôle de formulaire
   * @param control Le contrôle du formulaire
   * @param fieldName Le nom du champ (pour personnaliser les messages)
   * @returns Le message d'erreur traduit ou null si pas d'erreur
   */
  getErrorMessage(control: AbstractControl | null, fieldName: string = ''): string | null {
    if (!control || !control.errors || control.valid) {
      return null;
    }

    const errors = control.errors;
    
    // Ordre de priorité des erreurs
    const errorKeys = ['required', 'email', 'minlength', 'maxlength', 'min', 'max', 'pattern', 'mismatch'];
    
    for (const errorType of errorKeys) {
      if (errors[errorType]) {
        return this.getSpecificErrorMessage(errorType, errors[errorType], fieldName);
      }
    }

    // Si aucune erreur connue, retourner un message générique
    return this.translate.instant('FORMS.VALIDATION.INVALID_FIELD');
  }

  /**
   * Obtient le message d'erreur spécifique pour un type d'erreur donné
   * @param errorType Le type d'erreur
   * @param errorValue La valeur de l'erreur
   * @param fieldName Le nom du champ
   * @returns Le message d'erreur traduit
   */
  private getSpecificErrorMessage(errorType: string, errorValue: any, fieldName: string): string {
    const params = { field: fieldName };
    
    switch (errorType) {
      case 'required':
        return this.translate.instant('FORMS.VALIDATION.REQUIRED', params);
        
      case 'email':
        return this.translate.instant('FORMS.VALIDATION.EMAIL_INVALID', params);
        
      case 'minlength':
        return this.translate.instant('FORMS.VALIDATION.MIN_LENGTH', { 
          ...params, 
          min: errorValue.requiredLength 
        });
        
      case 'maxlength':
        return this.translate.instant('FORMS.VALIDATION.MAX_LENGTH', { 
          ...params, 
          max: errorValue.requiredLength 
        });
        
      case 'min':
        return this.translate.instant('FORMS.VALIDATION.MIN_VALUE', { 
          ...params, 
          min: errorValue.min 
        });
        
      case 'max':
        return this.translate.instant('FORMS.VALIDATION.MAX_VALUE', { 
          ...params, 
          max: errorValue.max 
        });
        
      case 'pattern':
        return this.translate.instant('FORMS.VALIDATION.PATTERN_INVALID', params);
        
      case 'mismatch':
        return this.translate.instant('FORMS.VALIDATION.PASSWORD_MISMATCH', params);
        
      default:
        return this.translate.instant('FORMS.VALIDATION.INVALID_FIELD', params);
    }
  }

  /**
   * Vérifie si un contrôle a une erreur spécifique
   * @param control Le contrôle du formulaire
   * @param errorType Le type d'erreur à vérifier
   * @returns true si le contrôle a cette erreur
   */
  hasError(control: AbstractControl | null, errorType: string): boolean {
    return !!(control && control.errors && control.errors[errorType]);
  }

  /**
   * Vérifie si un contrôle a des erreurs et a été touché/modifié
   * @param control Le contrôle du formulaire
   * @returns true si le contrôle a des erreurs et doit afficher les erreurs
   */
  shouldShowError(control: AbstractControl | null): boolean {
    return !!(control && control.invalid && (control.dirty || control.touched));
  }

  /**
   * Obtient toutes les erreurs d'un formulaire avec leurs messages traduits
   * @param form Le formulaire ou groupe de contrôles
   * @param fieldNames Mapping des noms de contrôles vers les noms de champs traduits
   * @returns Un objet avec les erreurs par champ
   */
  getAllFormErrors(form: AbstractControl, fieldNames: { [key: string]: string } = {}): { [key: string]: string[] } {
    const errors: { [key: string]: string[] } = {};

    if (form.hasError) {
      Object.keys(form.controls).forEach(key => {
        const control = form.get(key);
        const fieldName = fieldNames[key] || key;
        
        if (control && control.errors) {
          errors[key] = [];
          Object.keys(control.errors).forEach(errorType => {
            const errorMessage = this.getSpecificErrorMessage(errorType, control.errors![errorType], fieldName);
            errors[key].push(errorMessage);
          });
        }
      });
    }

    return errors;
  }

  /**
   * Messages d'erreur pré-traduits pour les cas courants
   */
  get commonErrors() {
    return {
      required: this.translate.instant('FORMS.VALIDATION.REQUIRED'),
      email: this.translate.instant('FORMS.VALIDATION.EMAIL_INVALID'),
      passwordMismatch: this.translate.instant('FORMS.VALIDATION.PASSWORD_MISMATCH'),
      minLength: (length: number) => this.translate.instant('FORMS.VALIDATION.MIN_LENGTH', { min: length }),
      maxLength: (length: number) => this.translate.instant('FORMS.VALIDATION.MAX_LENGTH', { max: length })
    };
  }

  /**
   * Valide un mot de passe et retourne les erreurs avec messages traduits
   * @param password Le mot de passe à valider
   * @returns Un tableau des erreurs trouvées
   */
  validatePassword(password: string): string[] {
    const errors: string[] = [];

    if (!password) {
      errors.push(this.translate.instant('FORMS.VALIDATION.REQUIRED'));
      return errors;
    }

    if (password.length < 8) {
      errors.push(this.translate.instant('FORMS.VALIDATION.PASSWORD_MIN_LENGTH'));
    }

    if (!/[A-Z]/.test(password)) {
      errors.push(this.translate.instant('FORMS.VALIDATION.PASSWORD_UPPERCASE'));
    }

    if (!/[a-z]/.test(password)) {
      errors.push(this.translate.instant('FORMS.VALIDATION.PASSWORD_LOWERCASE'));
    }

    if (!/[0-9]/.test(password)) {
      errors.push(this.translate.instant('FORMS.VALIDATION.PASSWORD_NUMBER'));
    }

    return errors;
  }

  /**
   * Valide une adresse email et retourne un message d'erreur si invalide
   * @param email L'email à valider
   * @returns Le message d'erreur ou null si valide
   */
  validateEmail(email: string): string | null {
    if (!email) {
      return this.translate.instant('FORMS.VALIDATION.REQUIRED');
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return this.translate.instant('FORMS.VALIDATION.EMAIL_INVALID');
    }

    return null;
  }
} 