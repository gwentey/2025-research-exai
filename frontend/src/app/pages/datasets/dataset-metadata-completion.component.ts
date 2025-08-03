import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatRadioModule } from '@angular/material/radio';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSnackBarModule, MatSnackBar } from '@angular/material/snack-bar';
import { MatChipsModule } from '@angular/material/chips';
import { MatDividerModule } from '@angular/material/divider';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { Subject, takeUntil } from 'rxjs';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

import { DatasetService } from '../../services/dataset.service';

interface CompletionStatus {
  overall_completion: number;
  missing_fields: Array<{field: string, category: string, description: string}>;
  default_values: Array<{field: string, category: string, value: any, description: string}>;
  needs_review: Array<{field: string, value: any, reason: string}>;
  complete_fields: Array<{field: string, category: string, value: any}>;
}

interface MetadataForm {
  dataset_id: string;
  dataset_name: string;
  form_structure: {
    dataset_info: FormSection;
    technical_info: FormSection;
    ethical_criteria: FormSection;
  };
  completion_status: CompletionStatus;
}

interface FormSection {
  title: string;
  fields: FormField[];
}

interface FormField {
  name: string;
  label: string;
  type: string;
  required?: boolean;
  current_value: any;
  options?: any[];
  help: string;
}

@Component({
  selector: 'app-dataset-metadata-completion',
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
    MatRadioModule,
    MatCheckboxModule,
    MatExpansionModule,
    MatProgressBarModule,
    MatSnackBarModule,
    MatChipsModule,
    MatDividerModule,
    MatTooltipModule,
    MatProgressSpinnerModule,
    TranslateModule
  ],
  templateUrl: './dataset-metadata-completion.component.html',
  styleUrls: ['./dataset-metadata-completion.component.scss']
})
export class DatasetMetadataCompletionComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private fb = inject(FormBuilder);
  private datasetService = inject(DatasetService);
  private snackBar = inject(MatSnackBar);
  private translate = inject(TranslateService);

  datasetId: string = '';
  metadataForm!: FormGroup;
  formStructure: MetadataForm | null = null;
  completionStatus: CompletionStatus | null = null;
  isLoading = false;
  isSaving = false;

  ngOnInit() {
    this.datasetId = this.route.snapshot.paramMap.get('id') || '';
    if (this.datasetId) {
      this.loadMetadataForm();
    }
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadMetadataForm() {
    this.isLoading = true;
    
    this.datasetService.getMetadataForm(this.datasetId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (data: MetadataForm) => {
          this.formStructure = data;
          this.completionStatus = data.completion_status;
          this.buildReactiveForm();
          this.isLoading = false;
        },
        error: (error) => {
          console.error('Erreur lors du chargement du formulaire:', error);
          this.showMessage('Erreur lors du chargement des métadonnées', 'error');
          this.isLoading = false;
        }
      });
  }

  buildReactiveForm() {
    if (!this.formStructure) return;

    const formControls: any = {};

    // Construire les contrôles pour chaque section
    Object.keys(this.formStructure.form_structure).forEach(sectionKey => {
      const section = this.formStructure!.form_structure[sectionKey as keyof typeof this.formStructure.form_structure];
      
      section.fields.forEach(field => {
        const validators = field.required ? [Validators.required] : [];
        formControls[field.name] = [field.current_value, validators];
      });
    });

    this.metadataForm = this.fb.group(formControls);
  }

  saveMetadata() {
    if (!this.metadataForm.valid) {
      this.showMessage('Veuillez remplir tous les champs obligatoires', 'error');
      return;
    }

    this.isSaving = true;
    const formData = this.metadataForm.value;

    this.datasetService.completeMetadata(this.datasetId, formData)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          this.showMessage('Métadonnées mises à jour avec succès', 'success');
          this.completionStatus = response.completion_status;
          this.isSaving = false;
          
          // Optionnel: rediriger vers le détail du dataset
          // this.router.navigate(['/datasets', this.datasetId]);
        },
        error: (error) => {
          console.error('Erreur lors de la sauvegarde:', error);
          this.showMessage('Erreur lors de la sauvegarde', 'error');
          this.isSaving = false;
        }
      });
  }

  goBackToDetail() {
    this.router.navigate(['/datasets', this.datasetId]);
  }

  getCategoryIcon(category: string): string {
    const icons = {
      'general': 'info',
      'technical': 'settings',
      'ethical': 'verified_user'
    };
    return icons[category as keyof typeof icons] || 'help';
  }

  getCompletionColor(percentage: number): string {
    if (percentage >= 80) return 'primary';
    if (percentage >= 50) return 'accent';
    return 'warn';
  }

  getFieldsBySection(sectionKey: string): FormField[] {
    if (!this.formStructure) return [];
    return this.formStructure.form_structure[sectionKey as keyof typeof this.formStructure.form_structure]?.fields || [];
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