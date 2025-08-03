import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, FormArray, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatTabsModule } from '@angular/material/tabs';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatSnackBarModule, MatSnackBar } from '@angular/material/snack-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatChipsModule } from '@angular/material/chips';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDividerModule } from '@angular/material/divider';
import { Subject, takeUntil } from 'rxjs';
import { TranslateModule } from '@ngx-translate/core';

import { AdminService } from '../../services/admin.service';

interface EthicalTemplate {
  domain: string;
  ethical: {
    informed_consent: boolean;
    transparency: boolean;
    user_control: boolean;
    equity_non_discrimination: boolean;
    security_measures_in_place: boolean;
    data_quality_documented: boolean;
    anonymization_applied: boolean;
    record_keeping_policy_exists: boolean;
    purpose_limitation_respected: boolean;
    accountability_defined: boolean;
  };
  technical: {
    representativity_level: string;
    sample_balance_level: string;
  };
  quality: {
    data_errors_description: string;
  };
}

@Component({
  selector: 'app-ethical-templates',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatButtonModule,
    MatIconModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatSlideToggleModule,
    MatTabsModule,
    MatExpansionModule,
    MatSnackBarModule,
    MatProgressSpinnerModule,
    MatChipsModule,
    MatTooltipModule,
    MatDividerModule,
    TranslateModule
  ],
  templateUrl: './ethical-templates.component.html',
  styleUrls: ['./ethical-templates.component.scss']
})
export class EthicalTemplatesComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();
  private fb = inject(FormBuilder);
  private adminService = inject(AdminService);
  private snackBar = inject(MatSnackBar);

  templatesForm!: FormGroup;
  templates: EthicalTemplate[] = [];
  isLoading = false;
  isSaving = false;

  // Options pour les listes déroulantes
  representativityLevels = [
    { value: 'high', label: 'Élevé' },
    { value: 'medium', label: 'Moyen' },
    { value: 'low', label: 'Faible' },
    { value: 'unknown', label: 'Inconnu' }
  ];

  balanceLevels = [
    { value: 'balanced', label: 'Équilibré' },
    { value: 'moderate', label: 'Modéré' },
    { value: 'imbalanced', label: 'Déséquilibré' },
    { value: 'severely_imbalanced', label: 'Très déséquilibré' }
  ];

  availableDomains = [
    'default', 'education', 'healthcare', 'social', 
    'business', 'finance', 'technology'
  ];

  ngOnInit() {
    this.initForm();
    this.loadTemplates();
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  initForm() {
    this.templatesForm = this.fb.group({
      templates: this.fb.array([])
    });
  }

  get templatesArray(): FormArray {
    return this.templatesForm.get('templates') as FormArray;
  }

  loadTemplates() {
    this.isLoading = true;
    
    this.adminService.getEthicalTemplates()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (templates) => {
          this.templates = templates;
          this.buildTemplatesForm();
          this.isLoading = false;
        },
        error: (error) => {
          console.error('Erreur lors du chargement des templates:', error);
          this.showMessage('Erreur lors du chargement des templates', 'error');
          this.isLoading = false;
        }
      });
  }

  buildTemplatesForm() {
    // Vider le FormArray existant
    this.templatesArray.clear();
    
    // Ajouter les templates
    this.templates.forEach(template => {
      this.templatesArray.push(this.createTemplateFormGroup(template));
    });
  }

  createTemplateFormGroup(template: EthicalTemplate): FormGroup {
    return this.fb.group({
      domain: [template.domain, Validators.required],
      ethical: this.fb.group({
        informed_consent: [template.ethical.informed_consent],
        transparency: [template.ethical.transparency],
        user_control: [template.ethical.user_control],
        equity_non_discrimination: [template.ethical.equity_non_discrimination],
        security_measures_in_place: [template.ethical.security_measures_in_place],
        data_quality_documented: [template.ethical.data_quality_documented],
        anonymization_applied: [template.ethical.anonymization_applied],
        record_keeping_policy_exists: [template.ethical.record_keeping_policy_exists],
        purpose_limitation_respected: [template.ethical.purpose_limitation_respected],
        accountability_defined: [template.ethical.accountability_defined]
      }),
      technical: this.fb.group({
        representativity_level: [template.technical.representativity_level, Validators.required],
        sample_balance_level: [template.technical.sample_balance_level, Validators.required]
      }),
      quality: this.fb.group({
        data_errors_description: [template.quality.data_errors_description]
      })
    });
  }

  addNewDomain() {
    const newTemplate: EthicalTemplate = {
      domain: 'nouveau_domaine',
      ethical: {
        informed_consent: false,
        transparency: true,
        user_control: false,
        equity_non_discrimination: true,
        security_measures_in_place: true,
        data_quality_documented: true,
        anonymization_applied: false,
        record_keeping_policy_exists: true,
        purpose_limitation_respected: true,
        accountability_defined: true
      },
      technical: {
        representativity_level: 'medium',
        sample_balance_level: 'moderate'
      },
      quality: {
        data_errors_description: 'À définir selon le domaine'
      }
    };

    this.templatesArray.push(this.createTemplateFormGroup(newTemplate));
  }

  removeTemplate(index: number) {
    this.templatesArray.removeAt(index);
  }

  saveTemplates() {
    if (!this.templatesForm.valid) {
      this.showMessage('Veuillez corriger les erreurs dans le formulaire', 'error');
      return;
    }

    this.isSaving = true;
    const formValue = this.templatesForm.value;

    this.adminService.saveEthicalTemplates(formValue.templates)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          this.showMessage('Templates sauvegardés avec succès', 'success');
          this.isSaving = false;
          // Recharger pour avoir les dernières données
          this.loadTemplates();
        },
        error: (error) => {
          console.error('Erreur lors de la sauvegarde:', error);
          this.showMessage('Erreur lors de la sauvegarde', 'error');
          this.isSaving = false;
        }
      });
  }

  resetToDefaults() {
    if (confirm('Êtes-vous sûr de vouloir restaurer les templates par défaut ? Toutes vos modifications seront perdues.')) {
      this.isLoading = true;
      
      this.adminService.resetEthicalTemplates()
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: () => {
            this.showMessage('Templates restaurés par défaut', 'success');
            this.loadTemplates();
          },
          error: (error) => {
            console.error('Erreur lors de la restauration:', error);
            this.showMessage('Erreur lors de la restauration', 'error');
            this.isLoading = false;
          }
        });
    }
  }

  validateTemplates() {
    this.adminService.validateEthicalTemplates()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (result) => {
          if (result.valid) {
            this.showMessage(`✅ Templates valides ! ${result.templates_count} templates vérifiés.`, 'success');
          } else {
            this.showMessage(`❌ ${result.errors.length} erreur(s) de validation détectée(s)`, 'error');
          }
        },
        error: (error) => {
          console.error('Erreur lors de la validation:', error);
          this.showMessage('Erreur lors de la validation', 'error');
        }
      });
  }

  getDomainIcon(domain: string): string {
    const icons: { [key: string]: string } = {
      'default': 'help',
      'education': 'school',
      'healthcare': 'medical_services',
      'social': 'people',
      'business': 'business',
      'finance': 'account_balance',
      'technology': 'computer'
    };
    return icons[domain] || 'domain';
  }

  getDomainColor(domain: string): string {
    const colors: { [key: string]: string } = {
      'default': 'basic',
      'education': 'primary',
      'healthcare': 'warn',
      'social': 'accent',
      'business': 'primary',
      'finance': 'warn',
      'technology': 'accent'
    };
    return colors[domain] || 'basic';
  }

  getEthicalFieldLabel(field: string): string {
    const labels: { [key: string]: string } = {
      'informed_consent': 'Consentement éclairé',
      'transparency': 'Transparence',
      'user_control': 'Contrôle utilisateur',
      'equity_non_discrimination': 'Équité et non-discrimination',
      'security_measures_in_place': 'Mesures de sécurité',
      'data_quality_documented': 'Qualité documentée',
      'anonymization_applied': 'Anonymisation appliquée',
      'record_keeping_policy_exists': 'Politique de conservation',
      'purpose_limitation_respected': 'Limitation d\'usage',
      'accountability_defined': 'Responsabilité définie'
    };
    return labels[field] || field;
  }

  getEthicalFieldHelp(field: string): string {
    const help: { [key: string]: string } = {
      'informed_consent': 'Les sujets ont-ils donné leur consentement pour l\'utilisation des données ?',
      'transparency': 'La méthode de collecte est-elle documentée et transparente ?',
      'user_control': 'Les utilisateurs ont-ils un contrôle sur leurs données ?',
      'equity_non_discrimination': 'Le dataset est-il exempt de biais discriminatoires ?',
      'security_measures_in_place': 'Des mesures de sécurité sont-elles en place ?',
      'data_quality_documented': 'La qualité des données est-elle évaluée et documentée ?',
      'anonymization_applied': 'Des techniques d\'anonymisation ont-elles été appliquées ?',
      'record_keeping_policy_exists': 'Y a-t-il une politique de conservation des données ?',
      'purpose_limitation_respected': 'L\'usage des données est-il limité au but défini ?',
      'accountability_defined': 'La responsabilité de l\'usage des données est-elle définie ?'
    };
    return help[field] || '';
  }

  private showMessage(message: string, type: 'success' | 'error' = 'success') {
    this.snackBar.open(
      message,
      'Fermer',
      {
        duration: 5000,
        panelClass: type === 'success' ? 'success-snackbar' : 'error-snackbar'
      }
    );
  }
}