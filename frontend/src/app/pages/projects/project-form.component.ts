import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, ActivatedRoute } from '@angular/router';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule, FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatCardModule } from '@angular/material/card';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSliderModule } from '@angular/material/slider';
import { MatDividerModule } from '@angular/material/divider';
import { MatChipsModule } from '@angular/material/chips';
import { MatSelectModule } from '@angular/material/select';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { Subject, takeUntil, debounceTime } from 'rxjs';

import { ProjectService } from '../../services/project.service';
import { DatasetService } from '../../services/dataset.service';
import { Project, ProjectCreate, ProjectUpdate, CriterionWeight } from '../../models/project.models';
import { DatasetFilterCriteria, DatasetScored } from '../../models/dataset.models';

@Component({
  selector: 'app-project-form',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    FormsModule,
    MatButtonModule,
    MatIconModule,
    MatInputModule,
    MatFormFieldModule,
    MatCardModule,
    MatProgressSpinnerModule,
    MatTooltipModule,
    MatSliderModule,
    MatDividerModule,
    MatChipsModule,
    MatSelectModule,
    MatCheckboxModule
  ],
  templateUrl: './project-form.component.html'
})
export class ProjectFormComponent implements OnInit, OnDestroy {
  private fb = inject(FormBuilder);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private projectService = inject(ProjectService);
  private datasetService = inject(DatasetService);
  private destroy$ = new Subject<void>();

  // État
  isLoading = false;
  isSaving = false;
  error: string | null = null;
  isEditMode = false;
  projectId: string | null = null;

  // Formulaire
  projectForm: FormGroup;

  // Critères et poids
  currentCriteria: DatasetFilterCriteria = {};
  tempCriteria: DatasetFilterCriteria = {};
  currentWeights: CriterionWeight[] = [];

  // Preview des recommandations
  previewDatasets: DatasetScored[] = [];
  previewCount = 0;
  isLoadingPreview = false;

  // Poids prédéfinis disponibles
  defaultWeights = [
    { criterion_name: 'ethical_score', weight: 0.4, label: 'Score Éthique', icon: 'security' },
    { criterion_name: 'technical_score', weight: 0.4, label: 'Score Technique', icon: 'engineering' },
    { criterion_name: 'popularity_score', weight: 0.2, label: 'Popularité', icon: 'trending_up' },
    { criterion_name: 'anonymization', weight: 0.0, label: 'Anonymisation', icon: 'verified_user' },
    { criterion_name: 'documentation', weight: 0.0, label: 'Documentation', icon: 'description' },
    { criterion_name: 'data_quality', weight: 0.0, label: 'Qualité des Données', icon: 'high_quality' }
  ];

  constructor() {
    this.projectForm = this.fb.group({
      name: ['', [Validators.required, Validators.maxLength(255)]],
      description: ['']
    });

    // Initialiser les poids par défaut
    this.currentWeights = this.projectService.getDefaultWeights();
  }

  ngOnInit(): void {
    // Initialiser les critères temporaires
    this.tempCriteria = { ...this.currentCriteria };
    
    // Vérifier si on est en mode édition
    this.route.params.pipe(takeUntil(this.destroy$)).subscribe(params => {
      if (params['id']) {
        this.isEditMode = true;
        this.projectId = params['id'];
        this.loadProject();
      }
    });

    // Écouter les changements pour le preview
    this.setupPreview();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /**
   * Configure le preview automatique
   */
  private setupPreview(): void {
    // Debounce pour éviter trop d'appels API
    this.projectForm.valueChanges
      .pipe(debounceTime(500), takeUntil(this.destroy$))
      .subscribe(() => {
        this.updatePreview();
      });
  }

  /**
   * Déclenche le preview quand les critères changent
   */
  onCriteriaUpdate(): void {
    this.currentCriteria = { ...this.tempCriteria };
    this.updatePreview();
  }

  /**
   * Charge le projet à éditer
   */
  private loadProject(): void {
    if (!this.projectId) return;

    this.isLoading = true;
    this.projectService.getProject(this.projectId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (project) => {
          this.projectForm.patchValue({
            name: project.name,
            description: project.description
          });
          
          if (project.criteria) {
            this.currentCriteria = project.criteria;
            this.tempCriteria = { ...project.criteria };
          }
          
          if (project.weights) {
            this.currentWeights = project.weights;
          }
          
          this.updatePreview();
          this.isLoading = false;
        },
        error: (error) => {
          console.error('Erreur lors du chargement du projet:', error);
          this.error = 'Projet non trouvé';
          this.isLoading = false;
        }
      });
  }



  /**
   * Gestion des changements de poids
   */
  onWeightChange(index: number, value: any): void {
    const numericWeight = typeof value === 'string' ? parseFloat(value) : value;
    this.defaultWeights[index].weight = numericWeight;
    this.currentWeights = this.defaultWeights.filter(w => w.weight > 0).map(w => ({
      criterion_name: w.criterion_name,
      weight: w.weight
    }));
    this.updatePreview();
  }

  /**
   * Reset des poids aux valeurs par défaut
   */
  resetWeights(): void {
    this.defaultWeights.forEach(w => {
      switch (w.criterion_name) {
        case 'ethical_score':
          w.weight = 0.4;
          break;
        case 'technical_score':
          w.weight = 0.4;
          break;
        case 'popularity_score':
          w.weight = 0.2;
          break;
        default:
          w.weight = 0.0;
      }
    });
    this.currentWeights = this.projectService.getDefaultWeights();
    this.updatePreview();
  }

  /**
   * Met à jour l'aperçu des recommandations
   */
  private updatePreview(): void {
    if (Object.keys(this.currentCriteria).length === 0 && this.currentWeights.length === 0) {
      this.previewDatasets = [];
      this.previewCount = 0;
      return;
    }

    this.isLoadingPreview = true;
    this.projectService.previewRecommendations(this.currentCriteria, this.currentWeights)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (datasets) => {
          this.previewDatasets = datasets.slice(0, 3); // Afficher les 3 premiers
          this.previewCount = datasets.length;
          this.isLoadingPreview = false;
        },
        error: (error) => {
          console.warn('Erreur lors du preview:', error);
          this.previewDatasets = [];
          this.previewCount = 0;
          this.isLoadingPreview = false;
        }
      });
  }

  /**
   * Sauvegarde le projet
   */
  onSave(): void {
    if (this.projectForm.invalid) {
      this.projectForm.markAllAsTouched();
      return;
    }

    this.isSaving = true;
    this.error = null;

    const formValue = this.projectForm.value;
    const projectData = {
      name: formValue.name,
      description: formValue.description,
      criteria: Object.keys(this.currentCriteria).length > 0 ? this.currentCriteria : undefined,
      weights: this.currentWeights.length > 0 ? this.currentWeights : undefined
    };

    const saveOperation = this.isEditMode && this.projectId
      ? this.projectService.updateProject(this.projectId, projectData as ProjectUpdate)
      : this.projectService.createProject(projectData as ProjectCreate);

    saveOperation
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (project) => {
          this.isSaving = false;
          this.router.navigate(['/projects', project.id]);
        },
        error: (error) => {
          console.error('Erreur lors de la sauvegarde:', error);
          this.error = 'Erreur lors de la sauvegarde du projet';
          this.isSaving = false;
        }
      });
  }

  /**
   * Annule les modifications
   */
  onCancel(): void {
    if (this.isEditMode && this.projectId) {
      this.router.navigate(['/projects', this.projectId]);
    } else {
      this.router.navigate(['/projects']);
    }
  }

  /**
   * Obtient le titre de la page
   */
  getPageTitle(): string {
    return this.isEditMode ? 'Modifier le Projet' : 'Nouveau Projet';
  }

  /**
   * Vérifie si le formulaire a des modifications
   */
  hasChanges(): boolean {
    return this.projectForm.dirty || 
           Object.keys(this.currentCriteria).length > 0 || 
           this.currentWeights.length > 0;
  }

  /**
   * Obtient la couleur basée sur le score
   */
  getScoreColor(score: number): string {
    return this.projectService.getScoreColor(score);
  }
} 