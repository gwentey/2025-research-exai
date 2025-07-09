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
import { TranslateModule, TranslateService } from '@ngx-translate/core';

import { ProjectService } from '../../services/project.service';
import { DatasetService } from '../../services/dataset.service';
import { Project, ProjectCreate, ProjectUpdate, CriterionWeight } from '../../models/project.models';
import { DatasetFilterCriteria, DatasetScored } from '../../models/dataset.models';
import { RecommendationHeatmapComponent } from './components/recommendation-heatmap.component';

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
    MatCheckboxModule,
    RecommendationHeatmapComponent,
    TranslateModule
  ],
  templateUrl: './project-form.component.html',
  styles: [`
    .full-height-content {
      height: 320px;
      display: flex;
      flex-direction: column;
    }

    .loading-state, .empty-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      height: 100%;
    }

    .empty-icon {
      font-size: 48px !important;
      width: 48px !important;
      height: 48px !important;
      color: #bbb;
      margin-bottom: 12px;
    }

    .rankings-list {
      flex: 1;
      display: flex;
      flex-direction: column;
      justify-content: space-evenly;
      padding: 20px 0;
    }

    .ranking-item {
      display: flex;
      align-items: center;
      padding: 16px 12px;
      border-radius: 8px;
      background: #f8f9fa;
      margin-bottom: 12px;
      transition: all 0.2s ease;
    }

    .ranking-item:hover {
      background: #e9ecef;
      transform: translateY(-1px);
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
    }

    .ranking-item:last-child {
      margin-bottom: 0;
    }

    .ranking-badge {
      width: 32px;
      height: 32px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: bold;
      color: white;
      font-size: 14px;
      margin-right: 12px;
      flex-shrink: 0;
    }

    .badge-1 {
      background: linear-gradient(135deg, #FFD700, #FFA500);
      box-shadow: 0 2px 4px rgba(255, 165, 0, 0.3);
    }

    .badge-2 {
      background: linear-gradient(135deg, #C0C0C0, #A9A9A9);
      box-shadow: 0 2px 4px rgba(169, 169, 169, 0.3);
    }

    .badge-3 {
      background: linear-gradient(135deg, #CD7F32, #B8860B);
      box-shadow: 0 2px 4px rgba(184, 134, 11, 0.3);
    }

    .dataset-info {
      flex: 1;
      min-width: 0;
    }

    .dataset-name {
      font-weight: 600;
      font-size: 14px;
      margin: 0 0 4px 0;
      color: #2c3e50;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .dataset-meta {
      font-size: 12px;
      color: #6c757d;
      margin: 0;
    }

    .score-display {
      margin-left: 12px;
      flex-shrink: 0;
    }

    .score-value {
      font-weight: 700;
      font-size: 16px;
    }
  `]
})
export class ProjectFormComponent implements OnInit, OnDestroy {
  private fb = inject(FormBuilder);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private projectService = inject(ProjectService);
  private datasetService = inject(DatasetService);
  private translateService = inject(TranslateService);
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
  currentWeights: CriterionWeight[] = [];

  // Preview des recommandations
  previewDatasets: DatasetScored[] = [];
  previewCount = 0;
  isLoadingPreview = false;

  // Poids prédéfinis disponibles
  get defaultWeights() {
    return [
      { criterion_name: 'ethical_score', weight: 0.4, label: this.translateService.instant('PROJECTS.CRITERIA.ETHICAL_SCORE'), icon: 'security' },
      { criterion_name: 'technical_score', weight: 0.4, label: this.translateService.instant('PROJECTS.CRITERIA.TECHNICAL_SCORE'), icon: 'engineering' },
      { criterion_name: 'popularity_score', weight: 0.2, label: this.translateService.instant('PROJECTS.CRITERIA.POPULARITY_SCORE'), icon: 'trending_up' },
      { criterion_name: 'anonymization', weight: 0.0, label: this.translateService.instant('PROJECTS.CRITERIA.ANONYMIZATION'), icon: 'verified_user' },
      { criterion_name: 'documentation', weight: 0.0, label: this.translateService.instant('PROJECTS.CRITERIA.DOCUMENTATION'), icon: 'description' },
      { criterion_name: 'data_quality', weight: 0.0, label: this.translateService.instant('PROJECTS.CRITERIA.DATA_QUALITY'), icon: 'high_quality' }
    ];
  }

  constructor() {
    this.projectForm = this.fb.group({
      name: ['', [Validators.required, Validators.maxLength(255)]],
      description: [''],
      // Ajout des critères de recherche dans le formulaire réactif
      criteria: this.fb.group({
        objective: [''],
        domain: [[]],
        task: [[]],
        instances_number_min: [null],
        instances_number_max: [null],
        features_number_min: [null],
        features_number_max: [null],
        year_min: [null],
        year_max: [null],
        ethical_score_min: [null],
        is_split: [false],
        is_anonymized: [false],
        is_public: [false]
      })
    });

    // Initialiser les poids par défaut
    this.currentWeights = this.projectService.getDefaultWeights();
  }

  ngOnInit(): void {
    // Vérifier si on est en mode édition
    this.route.params.pipe(takeUntil(this.destroy$)).subscribe(params => {
      if (params['id']) {
        this.isEditMode = true;
        this.projectId = params['id'];
        this.loadProject();
      }
    });

    // Écouter les changements pour le preview - maintenant sur tout le formulaire
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
    // Debounce pour éviter trop d'appels API - fonctionne maintenant pour tous les champs
    this.projectForm.valueChanges
      .pipe(debounceTime(800), takeUntil(this.destroy$))
      .subscribe((formValues) => {
        // Synchroniser les critères depuis le formulaire
        this.currentCriteria = { ...formValues.criteria };
        this.updatePreview();
      });
  }

  /**
   * Déclenche le preview quand les critères changent (méthode dépréciée)
   */
  onCriteriaUpdate(): void {
    // Cette méthode n'est plus nécessaire car le debouncing automatique gère tout
    // Garder pour compatibilité temporaire
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
            this.projectForm.get('criteria')?.patchValue(project.criteria);
            this.currentCriteria = project.criteria;
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
    // Les critères sont maintenant synchronisés automatiquement depuis le formulaire
    // via setupPreview()
    
    // Afficher un aperçu même sans critères spécifiques (avec les poids par défaut)
    if (Object.keys(this.currentCriteria).length === 0 && this.currentWeights.length === 0) {
      // Utiliser les poids par défaut pour l'aperçu initial
      this.currentWeights = this.getDefaultWeightsForPreview();
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
   * Retourne des poids par défaut pour l'aperçu initial
   */
  private getDefaultWeightsForPreview(): CriterionWeight[] {
    return [
      { criterion_name: 'ethical_score', weight: 0.4 },
      { criterion_name: 'technical_score', weight: 0.4 },
      { criterion_name: 'popularity_score', weight: 0.2 }
    ];
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
    return this.isEditMode ? 
      this.translateService.instant('PROJECTS.FORM.EDIT_PROJECT') : 
      this.translateService.instant('PROJECTS.FORM.CREATE_PROJECT');
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
   * Obtient le pourcentage d'un poids pour l'affichage
   */
  getWeightPercent(criterionName: string): number {
    const weight = this.currentWeights.find(w => w.criterion_name === criterionName);
    return weight ? Math.round(weight.weight * 100) : 0;
  }

  /**
   * Génère un tooltip détaillé pour le score d'un dataset
   */
  getScoreTooltip(dataset: DatasetScored): string {
    const totalScore = Math.round(dataset.score * 100);
    let tooltip = `Score total : ${totalScore}%\n\nDétail par critère :\n`;
    
    // Calcul approximatif des scores individuels pour le tooltip
    const ethicalScore = this.estimateEthicalScore(dataset);
    const technicalScore = this.estimateTechnicalScore(dataset);
    const popularityScore = this.estimatePopularityScore(dataset);
    
    tooltip += `• Éthique : ${Math.round(ethicalScore * 100)}% (poids: ${this.getWeightPercent('ethical_score')}%)\n`;
    tooltip += `• Technique : ${Math.round(technicalScore * 100)}% (poids: ${this.getWeightPercent('technical_score')}%)\n`;
    tooltip += `• Popularité : ${Math.round(popularityScore * 100)}% (poids: ${this.getWeightPercent('popularity_score')}%)\n\n`;
    tooltip += `Cliquez sur "Voir formules détaillées" pour comprendre le calcul.`;
    
    return tooltip;
  }

  /**
   * Estime le score éthique basé sur les critères disponibles
   */
  private estimateEthicalScore(dataset: DatasetScored): number {
    let count = 0;
    let total = 0;
    
    // Estimation basée sur les champs disponibles dans DatasetScored
    if (dataset.anonymization_applied !== undefined) { total++; if (dataset.anonymization_applied) count++; }
    if (dataset.transparency !== undefined) { total++; if (dataset.transparency) count++; }
    if (dataset.informed_consent !== undefined) { total++; if (dataset.informed_consent) count++; }
    
    return total > 0 ? count / total : 0.7; // Valeur par défaut si pas d'info
  }

  /**
   * Estime le score technique basé sur la taille et les caractéristiques
   */
  private estimateTechnicalScore(dataset: DatasetScored): number {
    let score = 0;
    
    // Score basé sur la taille du dataset (échelle logarithmique)
    if (dataset.instances_number && dataset.instances_number > 0) {
      const logInstances = Math.log10(Math.max(1, dataset.instances_number));
      const instanceScore = Math.min(1.0, Math.max(0.0, (logInstances - 2) / 3));
      score += instanceScore * 0.4;
    } else {
      score += 0.5 * 0.4; // Score moyen si pas d'info
    }
    
    // Score basé sur le nombre de features (optimal 10-100)
    if (dataset.features_number && dataset.features_number > 0) {
      let featureScore = 0;
      if (dataset.features_number >= 10 && dataset.features_number <= 100) {
        featureScore = 1.0;
      } else if (dataset.features_number > 100) {
        featureScore = Math.max(0.5, 1 - (dataset.features_number - 100) / 1000);
      } else {
        featureScore = dataset.features_number / 10;
      }
      score += featureScore * 0.3;
    } else {
      score += 0.5 * 0.3; // Score moyen si pas d'info
    }
    
    // Score de documentation (estimation moyenne)
    score += 0.6 * 0.3;
    
    return score;
  }

  /**
   * Estime le score de popularité basé sur les citations
   */
  private estimatePopularityScore(dataset: DatasetScored): number {
    if (!dataset.num_citations || dataset.num_citations <= 0) {
      return 0.0;
    }
    
    // Formule logarithmique : log10(citations) / 3 (max à 1000 citations)
    const logCitations = Math.log10(dataset.num_citations);
    return Math.min(1.0, Math.max(0.0, logCitations / 3));
  }

  /**
   * Obtient la couleur basée sur le score
   */
  getScoreColor(score: number): string {
    return this.projectService.getScoreColor(score);
  }
} 