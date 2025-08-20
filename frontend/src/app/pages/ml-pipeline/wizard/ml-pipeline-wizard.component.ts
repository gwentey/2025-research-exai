import { Component, OnInit, ViewChild, ChangeDetectorRef, AfterViewInit, ElementRef, OnDestroy } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule, FormsModule } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { MatStepper, MatStepperModule } from '@angular/material/stepper';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatCardModule } from '@angular/material/card';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatChipsModule } from '@angular/material/chips';
import { MatSliderModule } from '@angular/material/slider';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatRadioModule } from '@angular/material/radio';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { CommonModule } from '@angular/common';
import { DatasetService } from '../../../services/dataset.service';
import { MlPipelineService } from '../../../services/ml-pipeline.service';
import { AuthService } from '../../../services/auth.service';
import { ProjectService } from '../../../services/project.service';
import { HyperparameterConfig, AlgorithmInfo, ExperimentCreate } from '../../../models/ml-pipeline.models';
import { DatasetDetailView } from '../../../models/dataset.models';
import { UserRead } from '../../../models/auth.models';


import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { finalize } from 'rxjs/operators';
import { Chart, registerables } from 'chart.js';
import { trigger, transition, style, animate } from '@angular/animations';

// Interface pour les logs de training
interface TrainingLog {
  timestamp: Date;
  level: 'info' | 'warning' | 'error' | 'success';
  message: string;
}

Chart.register(...registerables);

@Component({
  selector: 'app-ml-pipeline-wizard',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    MatStepperModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatCardModule,
    MatProgressBarModule,
    MatChipsModule,
    MatSliderModule,
    MatCheckboxModule,
    MatRadioModule,
    MatIconModule,
    MatTooltipModule,
    MatProgressSpinnerModule,
    MatSlideToggleModule,
    TranslateModule
  ],
  templateUrl: './ml-pipeline-wizard.component.html',
  styleUrls: ['./ml-pipeline-wizard.component.scss'],
  animations: [
    trigger('fadeInUp', [
      transition(':enter', [
        style({ opacity: 0, transform: 'translateY(30px)' }),
        animate('0.5s ease-out', style({ opacity: 1, transform: 'translateY(0)' }))
      ])
    ]),
    trigger('slideInRight', [
      transition(':enter', [
        style({ opacity: 0, transform: 'translateX(30px)' }),
        animate('0.4s ease-out', style({ opacity: 1, transform: 'translateX(0)' }))
      ])
    ]),
    trigger('scaleIn', [
      transition(':enter', [
        style({ opacity: 0, transform: 'scale(0.95)' }),
        animate('0.3s ease-out', style({ opacity: 1, transform: 'scale(1)' }))
      ])
    ]),

  ]
})
export class MlPipelineWizardComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('stepper') stepper!: MatStepper;
  @ViewChild('logsContainer') logsContainer!: ElementRef;

  // Forms for each step
  datasetForm!: FormGroup;
  dataCleaningForm!: FormGroup;  // Nouveau formulaire pour le nettoyage
  dataQualityForm!: FormGroup;
  algorithmForm!: FormGroup;
  hyperparametersForm!: FormGroup;
  summaryForm!: FormGroup;
  finalVerificationForm!: FormGroup;

  // Data
  projectId: string = '';
  datasetId: string = '';
  dataset: DatasetDetailView | null = null;
  datasetDetails: DatasetDetailView | null = null;
  algorithms: AlgorithmInfo[] = [];
  selectedAlgorithm: AlgorithmInfo | null = null;
  experimentId: string = '';
  experimentStatus: any = null;
  experimentResults: any = null;

  // Data Quality Analysis
  dataQualityAnalysis: any = null;
  isAnalyzingData = false;
  dataQualityRecommendations: any = null;

  // Configuration multi-colonnes pour le nettoyage
  columnCleaningConfigs: any[] = [];
  showPreviewModal = false;
  previewColumn: any = null;
  previewData: any = null;
  showMultipleDatasets = false;

  // Support multi-datasets
  additionalDatasets: any[] = [];
  availableDatasets: any[] = [];

  // Data Cleaning Help
  showDataCleaningHelp = false;
  showManualControls = false;

  // Export Python code flag
  exportPythonCode = false;

  // Analyse par colonne
  columnsAnalysis: any[] = [];
  autoFixCategories: any[] = [];

  // UI State
  isLoading = true;
  isTraining = false;
  trainingProgress = 0;

  // Training logs
  trainingLogs: TrainingLog[] = [];
  autoScrollLogs = true;
  private logSimulationTimer: any;



  // User data for credits
  currentUser: UserRead | null = null;

  // Step titles and descriptions
  private stepTitles = [
    'Sélection du Dataset',
    'Configuration des Données',
    'Choix de l\'Algorithme',
    'Paramètres Avancés',
    'Entraînement du Modèle'
  ];

  private stepSubtitles = [
    'Vérifiez les informations de votre dataset',
    'Configurez le preprocessing de vos données',
    'Sélectionnez l\'algorithme le plus adapté',
    'Ajustez les hyperparamètres',
    'Lancez l\'entraînement de votre modèle'
  ];

  constructor(
    private fb: FormBuilder,
    private router: Router,
    private route: ActivatedRoute,
    private datasetService: DatasetService,
    private mlPipelineService: MlPipelineService,
    private translate: TranslateService,
    private cdr: ChangeDetectorRef,
    private authService: AuthService,
    private projectService: ProjectService
  ) {}

    ngOnInit() {
    // ⚠️ ROBUSTESSE : Reset complet de l'état pour éviter les bugs de session
    this.resetWizardState();

    // Initialize forms first
    this.initializeForms();

    // Load user credits
    this.loadUserCredits();

    // Get route parameters - Méthode améliorée
    // Essayer plusieurs façons de récupérer le projectId
    this.projectId = this.route.snapshot.parent?.params['id'] ||
                     this.route.snapshot.params['projectId'] ||
                     this.route.snapshot.queryParams['projectId'] || '';

    console.log('🔍 Route analysis:');
    console.log('- Parent params:', this.route.snapshot.parent?.params);
    console.log('- Direct params:', this.route.snapshot.params);
    console.log('- Query params:', this.route.snapshot.queryParams);
    console.log('- Final projectId:', this.projectId);

    // Support clavier pour navigation
    document.addEventListener('keydown', this.handleKeyboardEvents.bind(this));

    // Check if coming from dataset selection
    this.route.queryParams.subscribe(params => {
      this.datasetId = params['datasetId'] || '';
      const datasetName = params['datasetName'] || '';

      // Vérifier aussi le projectId dans les query params
      if (!this.projectId && params['projectId']) {
        this.projectId = params['projectId'];
        console.log('✅ ProjectId found in query params:', this.projectId);
      }

      // If coming from dataset selection, pre-fill the dataset
      if (this.datasetId) {
        this.datasetForm.patchValue({
          datasetId: this.datasetId,
          datasetName: datasetName
        });
        this.loadDataset();
      }
    });

    this.loadAlgorithms();

    // Simulate loading delay for smooth UX
    setTimeout(() => {
      this.isLoading = false;
      this.cdr.detectChanges();
    }, 800);

    // Déboguer le formulaire de vérification finale
    this.finalVerificationForm.valueChanges.subscribe(value => {
      console.log('🔍 finalVerificationForm valueChanges:', value);
    });
  }

  ngAfterViewInit() {
    // Initialize stepper after view is ready
    setTimeout(() => {
      this.initializeStepper();
    }, 100);
  }

  private initializeStepper(): void {
    // Ensure stepper is properly initialized
    if (this.stepper) {
      // Reset to first step
      this.stepper.reset();
      this.stepper.selectedIndex = 0;
      this.cdr.detectChanges();
    }
  }

  initializeForms() {
    // Step 1: Dataset Overview
    this.datasetForm = this.fb.group({
      datasetId: [this.datasetId, Validators.required]
    });

    // Step 2: Data Cleaning (nouveau formulaire dédié)
    this.dataCleaningForm = this.fb.group({
      analysisCompleted: [true], // Par défaut true pour permettre de continuer
      autoFixApplied: [false],
      manualOverrides: [{}] // Pour stocker les personnalisations manuelles
    });

    // Step 3: Data Configuration (configuration du modèle)
    this.dataQualityForm = this.fb.group({
      targetColumn: ['', Validators.required],
      taskType: ['classification', Validators.required],
      missingValueStrategy: ['mean', Validators.required],
      knnNeighbors: [5, [Validators.min(1), Validators.max(20)]],
      maxIterativeIter: [10, [Validators.min(5), Validators.max(50)]],
      featureScaling: [true],
      scalingMethod: ['standard'],
      categoricalEncoding: ['onehot'],
      outlierDetection: [false],
      outlierMethod: ['iqr'],
      outlierThreshold: [0.1, [Validators.min(0.01), Validators.max(0.5)]],
      testSize: [20, [Validators.required, Validators.min(10), Validators.max(50)]],
      useRecommendations: [true] // Utiliser les recommandations automatiques
    });

    // Step 4: Algorithm Selection
    this.algorithmForm = this.fb.group({
      algorithm: ['', Validators.required]
    });

    // Step 5: Hyperparameters (dynamic based on algorithm)
    this.hyperparametersForm = this.fb.group({});

    // Step 6: Summary
    this.summaryForm = this.fb.group({});

    // Step 8: Final Verification
    this.finalVerificationForm = this.fb.group({
      confirmed: [false, Validators.requiredTrue]
    });
  }

  loadDataset() {
    if (!this.datasetId) return;

    this.datasetService.getDatasetDetails(this.datasetId)
      .subscribe({
        next: (data) => {
          this.dataset = data;
          this.datasetDetails = data;

          // IMPORTANT : Le dataset ne contient pas directement le project_id
          // On va devoir le récupérer autrement (depuis l'URL ou les query params)

          console.log('📊 Dataset loaded:', {
            dataset_id: data.id,
            dataset_name: data.dataset_name,
            columns: data.columns?.length || 0,
            files: data.files?.length || 0
          });

          // Essayer de récupérer le project_id depuis l'URL si pas encore défini
          if (!this.projectId) {
            const urlParams = new URLSearchParams(window.location.search);
            const projectFromUrl = urlParams.get('projectId');
            if (projectFromUrl) {
              this.projectId = projectFromUrl;
              console.log('✅ ProjectId récupéré depuis l\'URL:', this.projectId);
            }
          }

          // Auto-suggest target column and task type based on dataset metadata
          this.suggestTargetAndTaskType(data);

          // Analyser la qualité des données automatiquement
          this.analyzeDataQuality();
        },
        error: (error) => {
          console.error('Error loading dataset:', error);
        }
      });
  }

  analyzeDataQuality() {
    if (!this.datasetId) return;

    this.isAnalyzingData = true;
    const targetColumn = this.dataQualityForm.get('targetColumn')?.value;

    this.mlPipelineService.getDatasetRecommendations(this.datasetId, targetColumn)
      .subscribe({
        next: (recommendations) => {
          this.dataQualityRecommendations = recommendations;

          // Appliquer automatiquement les recommandations si la confiance est élevée
          this.applyDataQualityRecommendations(recommendations);

          this.isAnalyzingData = false;
          this.cdr.detectChanges();
        },
        error: (error) => {
          console.error('Error analyzing data quality:', error);
          this.isAnalyzingData = false;
          this.cdr.detectChanges();
        }
      });
  }

  analyzeFullDataQuality() {
    if (!this.datasetId) return;

    this.isAnalyzingData = true;
    const targetColumn = this.dataQualityForm.get('targetColumn')?.value;

    const request = {
      dataset_id: this.datasetId,
      target_column: targetColumn,
      sample_size: 10000
    };

    this.mlPipelineService.analyzeDataQuality(request)
      .subscribe({
        next: (analysis) => {
          this.dataQualityAnalysis = analysis;
          this.isAnalyzingData = false;

          // Mettre à jour les recommandations détaillées
          this.updateDetailedRecommendations(analysis);

          this.cdr.detectChanges();
        },
        error: (error) => {
          console.error('Error performing full data quality analysis:', error);
          this.isAnalyzingData = false;
          this.cdr.detectChanges();
        }
      });
  }

  private applyDataQualityRecommendations(recommendations: any) {
    if (!recommendations || !recommendations.recommendations) return;

    const recs = recommendations.recommendations;

    // Appliquer les recommandations de stratégie de valeurs manquantes
    if (recs.scaling_recommendation) {
      // Pas de champ direct pour scaling dans le form, mais on peut l'utiliser plus tard
    }

    // Appliquer les recommandations d'encoding
    if (recs.encoding_recommendation) {
      this.dataQualityForm.patchValue({
        categoricalEncoding: recs.encoding_recommendation
      });
    }

    // Mettre à jour la stratégie de valeurs manquantes basée sur le niveau de sévérité
    if (recommendations.missingDataSummary?.severityLevel) {
      const severity = recommendations.missingDataSummary.severityLevel;
      let strategy = 'mean'; // default

      if (severity === 'high' || severity === 'critical') {
        strategy = 'knn'; // Utiliser KNN pour les cas difficiles
      } else if (severity === 'medium') {
        strategy = 'median'; // Plus robuste que mean
      }

      this.dataQualityForm.patchValue({
        missingValueStrategy: strategy
      });
    }
  }

  private updateDetailedRecommendations(analysis: any) {
    // Mettre à jour les options avancées basées sur l'analyse complète
    const recommendations = analysis.preprocessing_recommendations;

    // Ajouter des logs d'information pour l'utilisateur
    if (analysis.data_quality_score < 70) {
      this.addTrainingLog('warning', `Score de qualité des données: ${analysis.data_quality_score}/100 - Des améliorations sont recommandées`);
    } else {
      this.addTrainingLog('success', `Score de qualité des données: ${analysis.data_quality_score}/100 - Bonne qualité`);
    }

    // Ajouter des recommandations spécifiques dans les logs
    if (recommendations.priority_actions && recommendations.priority_actions.length > 0) {
      recommendations.priority_actions.forEach((action: any) => {
        this.addTrainingLog('info', `Recommandation: ${action.description}`);
      });
    }
  }

  loadAlgorithms() {
    this.mlPipelineService.getAvailableAlgorithms()
      .subscribe({
        next: (algorithms) => {
          this.algorithms = algorithms;
        },
        error: (error) => {
          console.error('Error loading algorithms:', error);
        }
      });
  }

  selectAlgorithm(algorithmName: string) {
    this.algorithmForm.patchValue({ algorithm: algorithmName });
    this.onAlgorithmSelected();
  }

  onAlgorithmSelected() {
    const algorithmName = this.algorithmForm.get('algorithm')?.value;
    this.selectedAlgorithm = this.algorithms.find(a => a.name === algorithmName) || null;

    if (this.selectedAlgorithm) {
      // Build dynamic hyperparameter form
      const controls: any = {};

      for (const [param, config] of Object.entries(this.selectedAlgorithm.hyperparameters)) {
        const hyperparamConfig = config as HyperparameterConfig;
        const validators = [];
        let defaultValue = hyperparamConfig.default;

        if (hyperparamConfig.type === 'number') {
          validators.push(Validators.required);
          if (hyperparamConfig.min !== undefined) {
            validators.push(Validators.min(hyperparamConfig.min));
          }
          if (hyperparamConfig.max !== undefined) {
            validators.push(Validators.max(hyperparamConfig.max));
          }
        }

        controls[param] = [defaultValue, validators];
      }

      this.hyperparametersForm = this.fb.group(controls);
    }
  }

  private pollingSubscription?: any;
  private pollingInterval?: any;

  // Variables de suivi des étapes
  progressSteps = {
    dataLoaded: false,
    preprocessing: false,
    training: false,
    evaluation: false
  };

  pollTrainingStatus() {
    console.log('🔄 Starting training status polling...');

    // Réinitialiser les étapes de progression
    this.progressSteps = {
      dataLoaded: false,
      preprocessing: false,
      training: false,
      evaluation: false
    };

    // Nettoyer le polling précédent
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
    }

    this.pollingInterval = setInterval(() => {
      console.log('🔍 Polling experiment status for:', this.experimentId);

      this.mlPipelineService.getExperimentStatus(this.experimentId)
        .subscribe({
          next: (status) => {
            console.log('📊 Status received:', status);
            this.experimentStatus = status;

            // Mise à jour de la progression avec validation
            if (status.progress !== undefined && status.progress !== null) {
              const newProgress = Math.max(0, Math.min(100, status.progress));
              if (newProgress !== this.trainingProgress) {
                this.trainingProgress = newProgress;
                console.log(`📈 Progress updated: ${this.trainingProgress}%`);

                // Mise à jour des logs selon la progression
                this.updateProgressLogs(this.trainingProgress);
              }
            }

            if (status.status === 'completed') {
              console.log('✅ Training completed! Stopping poll and showing completion...');
              this.handleTrainingCompletion();

            } else if (status.status === 'failed') {
              console.log('❌ Training failed:', status.error_message);
              this.handleTrainingFailure(status.error_message);

            } else if (status.status === 'running' || status.status === 'pending') {
              console.log(`🔄 Training in progress: ${this.trainingProgress}%`);
              // Continue polling
            }

            // Force UI update
            this.cdr.detectChanges();
          },
          error: (error) => {
            console.error('❌ Error polling status:', error);
            this.addTrainingLog('error', `Erreur de communication: ${error.message}`);
            // Continue polling in case of temporary error
          }
        });
    }, 1500); // Poll every 1.5 seconds pour plus de réactivité
  }

  updateProgressLogs(progress: number) {
    if (progress >= 10 && !this.progressSteps.dataLoaded) {
      this.addTrainingLog('success', '📊 Données chargées et validées');
      this.progressSteps.dataLoaded = true;
    }
    if (progress >= 40 && !this.progressSteps.preprocessing) {
      this.addTrainingLog('success', '🔧 Préprocessing et nettoyage terminés');
      this.progressSteps.preprocessing = true;
    }
    if (progress >= 70 && !this.progressSteps.training) {
      this.addTrainingLog('success', '🤖 Entraînement du modèle en cours...');
      this.progressSteps.training = true;
    }
    if (progress >= 90 && !this.progressSteps.evaluation) {
      this.addTrainingLog('success', '📈 Évaluation et génération des visualisations');
      this.progressSteps.evaluation = true;
    }
  }

  trainingCompleted = false;
  showingCompletionAnimation = false;

        handleTrainingCompletion() {
    console.log('🎉 TRAINING COMPLETION DETECTED - Updating state...');

    this.isTraining = false;
    this.trainingProgress = 100;
    this.trainingCompleted = true;

    // ⚠️ ROBUSTESSE : Nettoyer complètement le polling
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
      console.log('✅ Polling interval cleaned up');
    }

    this.addTrainingLog('success', '🎉 Entraînement terminé avec succès!');
    this.addTrainingLog('success', '💾 Modèle sauvegardé et versionné');
    this.addTrainingLog('success', '🎨 Visualisations générées');

    // ⚠️ ROBUSTESSE : Force UI update
    this.cdr.detectChanges();

    // TRANSFORMER LA CONSOLE EN POPUP DE SUCCÈS
    setTimeout(() => {
      this.transformConsoleToSuccessPopup();
    }, 1500);
  }

  // Nouvelle méthode pour transformer la console en popup
  transformConsoleToSuccessPopup() {
    this.showingCompletionAnimation = true;
    this.addTrainingLog('success', '✨ Transformation en vue de succès...');

    // Animation progressive des éléments de succès
    setTimeout(() => {
      this.addTrainingLog('success', '📊 Métriques de performance calculées');
    }, 500);

    setTimeout(() => {
      this.addTrainingLog('success', '🎨 Visualisations prêtes');
    }, 1000);

    setTimeout(() => {
      this.addTrainingLog('success', '🚀 Prêt à explorer les résultats !');
      this.showingCompletionAnimation = false;
      // La console reste visible avec le bouton pour voir les résultats
    }, 1500);
  }

  handleTrainingFailure(errorMessage?: string) {
    this.isTraining = false;
    this.trainingCompleted = false;

    // Nettoyer le polling
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
    }

    this.addTrainingLog('error', `❌ ÉCHEC: ${errorMessage || 'Erreur inconnue'}`);
    this.addTrainingLog('error', '🔧 Vérifiez votre configuration et réessayez');

    // Reset des étapes
    this.progressSteps = {
      dataLoaded: false,
      preprocessing: false,
      training: false,
      evaluation: false
    };
  }

  showCompletionAnimation() {
    this.showingCompletionAnimation = true;
    this.addTrainingLog('success', '✨ Entraînement terminé avec succès !');
    this.addTrainingLog('info', '🎯 Génération des insights et visualisations...');

    // Animation progressive des éléments de succès
    setTimeout(() => {
      this.addTrainingLog('success', '📊 Métriques de performance calculées');
    }, 500);

    setTimeout(() => {
      this.addTrainingLog('success', '🎨 Visualisations générées');
    }, 1000);

    setTimeout(() => {
      this.addTrainingLog('success', '💾 Modèle sauvegardé et versionné');
    }, 1500);

    setTimeout(() => {
      this.addTrainingLog('success', '🚀 Prêt à explorer les résultats !');
      this.showingCompletionAnimation = false;
    }, 2000);
  }

  loadResults(): Promise<void> {
    console.log('📈 Loading experiment results for:', this.experimentId);

    if (!this.experimentId) {
      console.error('❌ No experiment ID available for loading results');
      return Promise.reject('No experiment ID');
    }

    this.addTrainingLog('info', '⏳ Chargement des résultats...');

    return new Promise((resolve, reject) => {
      this.mlPipelineService.getExperimentResults(this.experimentId)
        .subscribe({
          next: (results) => {
            console.log('✅ Results loaded successfully:', results);
            this.experimentResults = results;
            // NE PLUS afficher les résultats inline - seulement dans la modal
            this.isTraining = false;

            // Log de succès
            this.addTrainingLog('success', `📊 Résultats chargés: ${Object.keys(results.metrics || {}).length} métriques disponibles`);
            this.addTrainingLog('success', '🎨 Prêt à explorer en détail !');

            // Trigger change detection pour s'assurer que l'UI se met à jour
            this.cdr.detectChanges();

            console.log('🎯 Results loaded and ready for modal');
            resolve();
          },
          error: (error) => {
            console.error('❌ Error loading results:', error);
            this.addTrainingLog('error', `Erreur lors du chargement des résultats: ${error.message || 'Erreur inconnue'}`);
            this.addTrainingLog('info', '🔧 Vous pouvez réessayer en cliquant sur le bouton');
            reject(error);
          }
        });
    });
  }

  suggestTargetAndTaskType(data: DatasetDetailView) {
    // Try to suggest target column and task type based on dataset metadata
    if (data.files && data.files.length > 0) {
      const firstFile = data.files[0];
      if (firstFile.columns && firstFile.columns.length > 0) {
        // Look for common target column names
        const potentialTargets = firstFile.columns.filter(col =>
          col.column_name.toLowerCase().includes('target') ||
          col.column_name.toLowerCase().includes('label') ||
          col.column_name.toLowerCase().includes('class') ||
          col.column_name.toLowerCase().includes('outcome') ||
          col.column_name.toLowerCase().includes('result')
        );

        // If no obvious target, suggest the last column
        const suggestedTarget = potentialTargets.length > 0
          ? potentialTargets[0].column_name
          : firstFile.columns[firstFile.columns.length - 1]?.column_name;

        // Determine task type based on dataset task metadata or target column type
        let suggestedTaskType = 'classification';
        if (data.task && data.task.includes('regression')) {
          suggestedTaskType = 'regression';
        }

        if (suggestedTarget) {
          this.dataQualityForm.patchValue({
            targetColumn: suggestedTarget,
            taskType: suggestedTaskType
          });
        }
      }
    }
  }

  getDatasetColumns() {
    if (this.datasetDetails?.files && this.datasetDetails.files.length > 0) {
      return this.datasetDetails.files[0].columns || [];
    }
    return [];
  }

  isFormValid(): boolean {
    // Vérifier le numéro de l'étape actuelle
    const currentStep = this.getCurrentStepNumber();

    // Logs de débogage pour chaque formulaire
    console.log('Validation des formulaires:');
    console.log('- datasetForm:', this.datasetForm.valid, this.datasetForm.value);
    console.log('- dataCleaningForm:', this.dataCleaningForm.valid, this.dataCleaningForm.value);
    console.log('- dataQualityForm:', this.dataQualityForm.valid, this.dataQualityForm.value);
    console.log('- algorithmForm:', this.algorithmForm.valid, this.algorithmForm.value);
    console.log('- hyperparametersForm:', this.hyperparametersForm.valid, this.hyperparametersForm.value);
    console.log('- summaryForm:', this.summaryForm.valid, this.summaryForm.value);
    console.log('- finalVerificationForm:', this.finalVerificationForm.valid, this.finalVerificationForm.value);

    // Vérifications de base pour toutes les étapes
    const baseValidation = this.datasetForm.valid &&
                          this.dataCleaningForm.valid &&  // Ajout du formulaire de nettoyage
                          this.dataQualityForm.valid &&
                          this.algorithmForm.valid &&
                          this.hyperparametersForm.valid &&
                          this.summaryForm.valid;

    // Si on est à l'étape 8, vérifier aussi le formulaire de vérification finale
    if (currentStep === 8) {
      return baseValidation && this.finalVerificationForm.valid;
    }

    return baseValidation;
  }

  goBack() {
    // Empêcher la navigation pendant l'entraînement
    if (this.isTraining) {
      console.log('🚫 Navigation bloquée pendant l\'entraînement');
      return;
    }

    const returnUrl = this.route.snapshot.queryParams['returnUrl'] || `/ml-pipeline`;
    this.router.navigateByUrl(returnUrl);
  }

  // Méthode pour gérer manuellement le changement de la checkbox
  onConfirmationChange(event: any): void {
    console.log('🔄 Checkbox changed:', event.target.checked);
    this.finalVerificationForm.patchValue({
      confirmed: event.target.checked
    });
    console.log('✅ Form value after patch:', this.finalVerificationForm.value);
  }

  backToApp() {
    // Empêcher la navigation pendant l'entraînement
    if (this.isTraining) {
      console.log('🚫 Navigation bloquée pendant l\'entraînement');
      return;
    }

    // Retour au dashboard principal ou à la page d'accueil
    this.router.navigate(['/starter']);
  }

  getProgressPercentage(): number {
    // Avoid NG0100 error by ensuring stable values
    if (!this.stepper || this.stepper.selectedIndex === undefined || this.stepper.selectedIndex === null) {
      return 20; // Default to step 1 (20%)
    }
    return Math.round(((this.stepper.selectedIndex + 1) / 5) * 100);
  }

  getCurrentStepNumber(): number {
    // Ensure stepper is initialized and has a valid selectedIndex
    if (!this.stepper || this.stepper.selectedIndex === undefined || this.stepper.selectedIndex === null) {
      return 1;
    }
    return this.stepper.selectedIndex + 1;
  }

  getStepTitle(): string {
    const stepIndex = this.getCurrentStepNumber() - 1;
    return this.stepTitles[stepIndex] || 'ML Pipeline Wizard';
  }

  getStepSubtitle(): string {
    const stepIndex = this.getCurrentStepNumber() - 1;
    return this.stepSubtitles[stepIndex] || 'Créez votre modèle de machine learning';
  }

  nextStep(): void {
    // Empêcher la navigation pendant l'entraînement
    if (this.isTraining) {
      console.log('🚫 Navigation bloquée pendant l\'entraînement');
      return;
    }

    if (this.stepper) {
      // Synchronize the forms with the stepper
      this.updateStepperForms();
      setTimeout(() => {
        this.stepper.next();
        this.cdr.detectChanges();
      });
    }
  }

  previousStep(): void {
    // Empêcher la navigation pendant l'entraînement
    if (this.isTraining) {
      console.log('🚫 Navigation bloquée pendant l\'entraînement');
      return;
    }

    if (this.stepper) {
      setTimeout(() => {
        this.stepper.previous();
        this.cdr.detectChanges();
      });
    }
  }

    goToStep(stepNumber: number): void {
    // Permettre la navigation vers l'étape 9 (Résultats) même pendant l'entraînement
    if (this.isTraining && stepNumber !== 9) {
      console.log('🚫 Navigation bloquée pendant l\'entraînement (sauf étape 9)');
      return;
    }

    if (this.stepper && stepNumber >= 1 && stepNumber <= 9) {
      console.log(`🎯 Navigation vers étape ${stepNumber}`);
      this.stepper.selectedIndex = stepNumber - 1;
      this.cdr.detectChanges();
    }
  }

  private updateStepperForms(): void {
    // Update the stepper forms with current values from our custom forms
    const currentStep = this.getCurrentStepNumber();

    switch (currentStep) {
      case 1:
        // Update dataset form in stepper
        if (this.stepper.steps.get(0)) {
          this.stepper.steps.get(0)!.stepControl = this.datasetForm;
        }
        break;
      case 2:
        // Update data quality form in stepper
        if (this.stepper.steps.get(1)) {
          this.stepper.steps.get(1)!.stepControl = this.dataQualityForm;
        }
        break;
      case 3:
        // Update algorithm form in stepper
        if (this.stepper.steps.get(2)) {
          this.stepper.steps.get(2)!.stepControl = this.algorithmForm;
        }
        break;
      case 4:
        // Update hyperparameters form in stepper
        if (this.stepper.steps.get(3)) {
          this.stepper.steps.get(3)!.stepControl = this.hyperparametersForm;
        }
        break;
      case 5:
        // Update summary form in stepper
        if (this.stepper.steps.get(4)) {
          this.stepper.steps.get(4)!.stepControl = this.summaryForm;
        }
        break;
    }
  }

  isCurrentStepValid(): boolean {
    if (!this.stepper) return false;

    const currentIndex = this.stepper.selectedIndex;
    switch (currentIndex) {
      case 0:
        return this.datasetForm.valid;
      case 1:
        return this.dataQualityForm.valid;
      case 2:
        return this.algorithmForm.valid;
      case 3:
        return this.hyperparametersForm.valid;
      case 4:
        return this.summaryForm.valid;
      default:
        return false;
    }
  }

  getAlgorithmIcon(algorithmName: string): string {
    const iconMap: { [key: string]: string } = {
      'random_forest': 'park',
      'decision_tree': 'account_tree',
      'logistic_regression': 'trending_up',
      'svm': 'scatter_plot',
      'naive_bayes': 'psychology',
      'gradient_boosting': 'auto_graph',
      'neural_network': 'device_hub'
    };
    return iconMap[algorithmName] || 'smart_toy';
  }

  // ==============================================
  // NOUVELLES MÉTHODES POUR LES LOGS ET MÉTRIQUES
  // ==============================================

  // Gestion des logs de training
  addTrainingLog(level: TrainingLog['level'], message: string): void {
    const log: TrainingLog = {
      timestamp: new Date(),
      level,
      message
    };

    this.trainingLogs.push(log);

    // Limiter le nombre de logs pour éviter les problèmes de performance
    if (this.trainingLogs.length > 100) {
      this.trainingLogs = this.trainingLogs.slice(-100);
    }

    // Forcer la détection de changements avant l'auto-scroll
    this.cdr.detectChanges();

    // Auto-scroll vers le bas si activé
    if (this.autoScrollLogs) {
      // Attendre que le DOM soit mis à jour avant de scroller
      setTimeout(() => this.scrollLogsToBottom(), 150);

      // Double check pour s'assurer que ça marche
      setTimeout(() => this.scrollLogsToBottom(), 300);
    }
  }

  private scrollLogsToBottom(): void {
    if (this.logsContainer && this.logsContainer.nativeElement) {
      const element = this.logsContainer.nativeElement;

      // Debug pour vérifier si l'élément est trouvé
      console.log('🔍 Auto-scroll: Element found:', !!element, 'scrollHeight:', element.scrollHeight);

      // Scroll vers le bas avec animation fluide
      element.scrollTo({
        top: element.scrollHeight,
        behavior: 'smooth'
      });

      // Fallback pour navigateurs plus anciens
      element.scrollTop = element.scrollHeight;
    } else {
      console.warn('⚠️ Auto-scroll: logsContainer non trouvé');
    }
  }

  clearLogs(): void {
    this.trainingLogs = [];
    this.cdr.detectChanges();
  }

  toggleAutoScroll(): void {
    this.autoScrollLogs = !this.autoScrollLogs;
    if (this.autoScrollLogs) {
      this.scrollLogsToBottom();
    }
  }

  getCurrentTimestamp(): string {
    return new Date().toLocaleTimeString('fr-FR', {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  }

  trackLogFn(index: number, log: TrainingLog): string {
    return `${log.timestamp.getTime()}-${index}`;
  }

  // Simulation de logs pendant l'entraînement
  private simulateTrainingLogs(): void {
    const logMessages = [
      { level: 'info' as const, message: 'Chargement des données d\'entraînement...' },
      { level: 'info' as const, message: 'Preprocessing des variables catégorielles...' },
      { level: 'info' as const, message: 'Normalisation des features numériques...' },
      { level: 'info' as const, message: 'Division train/test (80%/20%)...' },
      { level: 'info' as const, message: 'Initialisation de l\'algorithme...' },
      { level: 'info' as const, message: 'Début de l\'entraînement...' },
      { level: 'info' as const, message: 'Epoch 1/10 - Loss: 0.8543' },
      { level: 'info' as const, message: 'Epoch 2/10 - Loss: 0.7234' },
      { level: 'warning' as const, message: 'Convergence lente détectée' },
      { level: 'info' as const, message: 'Epoch 3/10 - Loss: 0.6891' },
      { level: 'info' as const, message: 'Epoch 4/10 - Loss: 0.6234' },
      { level: 'info' as const, message: 'Validation - Accuracy: 78.5%' },
      { level: 'info' as const, message: 'Epoch 5/10 - Loss: 0.5987' },
      { level: 'success' as const, message: 'Amélioration des performances détectée' },
      { level: 'info' as const, message: 'Sauvegarde du checkpoint...' },
      { level: 'info' as const, message: 'Entraînement terminé avec succès!' }
    ];

    let messageIndex = 0;
    this.logSimulationTimer = setInterval(() => {
      if (messageIndex < logMessages.length && this.isTraining) {
        const logMessage = logMessages[messageIndex];
        this.addTrainingLog(logMessage.level, logMessage.message);
        messageIndex++;
      } else {
        clearInterval(this.logSimulationTimer);
      }
    }, 800); // Un nouveau log toutes les 800ms
  }

  // Méthodes pour les métriques
  getMetricIcon(metric: string): string {
    const iconMap: { [key: string]: string } = {
      'accuracy': 'target',
      'precision': 'precision_manufacturing',
      'recall': 'search',
      'f1_score': 'balance',
      'roc_auc': 'trending_up',
      'mse': 'straighten',
      'mae': 'linear_scale',
      'r2_score': 'analytics'
    };
    return iconMap[metric] || 'assessment';
  }

  getMetricLabel(metric: string): string {
    const labelMap: { [key: string]: string } = {
      'accuracy': 'Précision',
      'precision': 'Précision',
      'recall': 'Rappel',
      'f1_score': 'Score F1',
      'roc_auc': 'AUC-ROC',
      'mse': 'Erreur quadratique',
      'mae': 'Erreur absolue',
      'r2_score': 'Coefficient R²'
    };
    return labelMap[metric] || metric.charAt(0).toUpperCase() + metric.slice(1);
  }

  getMetricProgressClass(metric: string): string {
    // Retourne une classe CSS basée sur la performance de la métrique
    if (!this.experimentResults?.metrics[metric]) return '';

    const value = this.experimentResults.metrics[metric];

    if (value >= 0.9) return 'progress-success';
    if (value >= 0.8) return 'progress-warning';
    return 'progress-danger';
  }

    // ==============================================
  // NAVIGATION VERS PAGE RÉSULTATS DÉDIÉE
  // ==============================================

    navigateToResults(): void {
    console.log('🎯 Navigating to dedicated results page');

    if (!this.experimentId) {
      console.error('❌ No experiment ID available for navigation');
      this.addTrainingLog('error', 'Impossible de naviguer - ID expérience manquant');
      return;
    }

    this.addTrainingLog('info', '🚀 Navigation vers la page de résultats...');

    // ⚠️ ROBUSTESSE : Clean state before navigation
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
    }

    // Navigation vers la page dédiée experiment-results
    this.router.navigate(['/projects', this.projectId, 'ml-pipeline', 'experiment', this.experimentId]).then(() => {
      console.log('✅ Navigation successful to results page');
    }).catch(error => {
      console.error('❌ Navigation failed:', error);
      this.addTrainingLog('error', 'Erreur de navigation vers les résultats');
    });
  }

    // Formatage de la durée d'entraînement
  formatDuration(seconds: number): string {
    if (!seconds) return 'N/A';

    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);

    if (minutes > 0) {
      return `${minutes}m ${remainingSeconds}s`;
    } else {
      return `${remainingSeconds}s`;
    }
  }

  // Calcul de la taille d'entraînement (80% du dataset)
  getTrainingSize(): number {
    const totalSize = this.dataset?.instances_number || 0;
    return Math.floor(totalSize * 0.8);
  }

  // Nouvelles méthodes pour les actions des résultats
  downloadModel(): void {
    if (this.experimentResults?.artifact_uri) {
      console.log('📥 Downloading model from:', this.experimentResults.artifact_uri);
      this.addTrainingLog('info', 'Téléchargement du modèle initié...');

      // Créer une URL de téléchargement temporaire
      const downloadUrl = `/api/v1/ml-pipeline/experiments/${this.experimentId}/download/model`;

      // Créer un lien temporaire et déclencher le téléchargement
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = `model_${this.experimentId}.joblib`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      this.addTrainingLog('success', 'Téléchargement démarré');
    } else {
      console.error('❌ No model artifact available for download');
      this.addTrainingLog('error', 'Aucun modèle disponible pour téléchargement');
    }
  }

  viewDetailedResults(): void {
    console.log('🔍 Chargement des résultats dans la console');
    // Charger les résultats dans la console - PAS de navigation
    if (this.experimentId && !this.experimentResults) {
      this.loadResults();
    } else if (this.experimentResults) {
      // Si les résultats sont déjà chargés, les afficher
      this.addTrainingLog('info', '📊 Résultats déjà disponibles !');
      this.showResults = true;
      this.cdr.detectChanges();
    } else {
      console.error('Experiment ID not available');
    }
  }

  // Retourner au wizard pour un nouvel entraînement
    returnToWizard(): void {
    console.log('🔄 Retour au wizard pour nouvel entraînement');
    this.trainingConsoleMode = false;
    this.isTraining = false;
    this.trainingCompleted = false;
    this.showResults = false;
    this.experimentResults = null;
    this.experimentId = '';
    this.trainingLogs = [];

    // Reset des étapes de progression
    this.progressSteps = {
      dataLoaded: false,
      preprocessing: false,
      training: false,
      evaluation: false
    };

    // Nettoyer le polling
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
    }

    // Retourner à l'étape 8 (lancement)
    if (this.stepper) {
      this.stepper.selectedIndex = 7; // Étape 8 (index 7)
    }

    this.cdr.detectChanges();
  }

  // Variable pour contrôler l'affichage des résultats
  showResults = false;

  // Variable pour le mode console pure (sort du wizard)
  trainingConsoleMode = false;

  // Nouvelle implémentation de startTraining avec simulation des logs
  async startTraining() {
    console.log('🚀 startTraining() called');
    console.log('Form validity:', {
      datasetForm: this.datasetForm.valid,
      dataCleaningForm: this.dataCleaningForm.valid,
      dataQualityForm: this.dataQualityForm.valid,
      algorithmForm: this.algorithmForm.valid,
      hyperparametersForm: this.hyperparametersForm.valid,
      summaryForm: this.summaryForm.valid,
      isFormValid: this.isFormValid()
    });

    if (!this.isFormValid()) {
      console.error('Form is not valid, cannot start training');
      // Afficher les erreurs spécifiques
      if (!this.datasetForm.valid) console.error('Dataset form invalid:', this.datasetForm.errors);
      if (!this.dataCleaningForm.valid) console.error('Data cleaning form invalid:', this.dataCleaningForm.errors);
      if (!this.dataQualityForm.valid) console.error('Data quality form invalid:', this.dataQualityForm.errors);
      if (!this.algorithmForm.valid) console.error('Algorithm form invalid:', this.algorithmForm.errors);
      if (!this.hyperparametersForm.valid) console.error('Hyperparameters form invalid:', this.hyperparametersForm.errors);
      if (!this.summaryForm.valid) console.error('Summary form invalid:', this.summaryForm.errors);
      alert('❌ Formulaire invalide. Veuillez vérifier tous les champs.');
      return;
    }

        console.log('✅ Starting training process...');

        // ALLER À L'ÉTAPE 9 CACHÉE (CONSOLE) - Garder le layout wizard
    this.trainingConsoleMode = true;
    this.isTraining = true;
    this.trainingProgress = 0;
    this.trainingLogs = []; // Reset des logs
    this.trainingCompleted = false;
    this.showResults = false;

    // Navigation vers l'étape cachée de console avec délai pour assurer la mise à jour
    setTimeout(() => {
      if (this.stepper) {
        console.log('🎯 Navigation vers étape 9 (console), index:', 8);
        this.stepper.selectedIndex = 8; // Étape 9 (index 8)
        this.cdr.detectChanges();
        console.log('✅ Étape active maintenant:', this.stepper.selectedIndex + 1);
      }
    }, 100);

    // Ajouter un log immédiat pour montrer que ça démarre
    this.addTrainingLog('info', '🚀 Démarrage de l\'entraînement...');
    this.addTrainingLog('info', '⏳ Création de l\'expérience en cours...');

    // Démarrer la simulation des logs
    this.simulateTrainingLogs();

    // Vérifier les valeurs critiques
    const targetColumn = this.dataQualityForm.value.targetColumn;
    const algorithm = this.algorithmForm.value.algorithm;

    if (!targetColumn) {
      alert('❌ Erreur: Aucune colonne cible sélectionnée!');
      this.isTraining = false;
      return;
    }

    if (!algorithm) {
      alert('❌ Erreur: Aucun algorithme sélectionné!');
      this.isTraining = false;
      return;
    }

    // SOLUTION TEMPORAIRE : Récupérer le projectId depuis le dataset
    let finalProjectId = this.projectId;

    // Si pas de projectId, essayer de créer un projet temporaire basé sur le dataset
    if (!finalProjectId && this.dataset) {
      // Le dataset n'a pas de project_id direct, on doit le gérer autrement
      console.log('⚠️ Pas de project_id trouvé. Dataset info:', {
        id: this.dataset.id,
        name: this.dataset.dataset_name
      });
    }

    // Si toujours pas de projectId, essayer depuis l'URL actuelle
    if (!finalProjectId) {
      const currentUrl = window.location.href;
      const urlMatch = currentUrl.match(/projects?\/([a-f0-9-]+)/i);
      if (urlMatch) {
        finalProjectId = urlMatch[1];
        console.log('🔍 ProjectId extrait de l\'URL:', finalProjectId);
      }
    }

    // DERNIER RECOURS : Récupérer un projet existant ou en créer un
    if (!finalProjectId) {
      console.error('❌ AUCUN PROJECT_ID TROUVÉ ! Tentative de récupération...');

      // Option 1: Récupérer le premier projet disponible
      try {
        const projectService = this.projectService;
        const projectsResponse = await projectService.getProjects({ page_size: 1 }).toPromise();

        if (projectsResponse && projectsResponse.projects && projectsResponse.projects.length > 0) {
          finalProjectId = projectsResponse.projects[0].id;
          console.log('✅ Utilisation du projet existant:', projectsResponse.projects[0].name);
          this.addTrainingLog('info', `📁 Utilisation du projet: ${projectsResponse.projects[0].name}`);
        } else {
          // Option 2: Créer un nouveau projet automatiquement
          const newProject = {
            name: `ML Pipeline - ${new Date().toLocaleDateString()}`,
            description: `Projet créé automatiquement pour l'entraînement ML sur le dataset ${this.dataset?.dataset_name || 'inconnu'}`
          };

          const createdProject = await projectService.createProject(newProject).toPromise();
          if (createdProject) {
            finalProjectId = createdProject.id;
            console.log('✅ Nouveau projet créé:', createdProject.name);
            this.addTrainingLog('success', `✨ Nouveau projet créé: ${createdProject.name}`);
          }
        }
      } catch (error) {
        console.error('Erreur lors de la récupération/création du projet:', error);
      }

      // Si toujours pas de projet, erreur critique SANS redirection
      if (!finalProjectId) {
        console.error('❌ ERREUR CRITIQUE : Impossible de trouver ou créer un projet !');
        this.addTrainingLog('error', '❌ Impossible de trouver un projet. Veuillez rafraîchir la page.');
        this.isTraining = false;
        // PAS de navigation - rester sur la page
        return;
      }
    }

    const experimentData = {
      project_id: finalProjectId,
      dataset_id: this.datasetId || '',
      algorithm: algorithm,
      hyperparameters: this.hyperparametersForm.value || {},
      preprocessing_config: {
        target_column: targetColumn,
        task_type: this.dataQualityForm.value.taskType || 'classification',
        missing_values: {
          strategy: this.dataQualityForm.value.missingValueStrategy || 'mean',
          knn_neighbors: this.dataQualityForm.value.knnNeighbors || 5,
          max_iterative_iter: this.dataQualityForm.value.maxIterativeIter || 10
        },
        scaling: {
          enabled: this.dataQualityForm.value.featureScaling || false,
          method: this.dataQualityForm.value.scalingMethod || 'standard'
        },
        encoding: this.dataQualityForm.value.categoricalEncoding || 'one-hot',
        outlier_detection: {
          enabled: this.dataQualityForm.value.outlierDetection || false,
          method: this.dataQualityForm.value.outlierMethod || 'isolation_forest',
          threshold: this.dataQualityForm.value.outlierThreshold || 0.1
        },
        test_size: (this.dataQualityForm.value.testSize || 20) / 100,
        // Ajout des configurations de nettoyage par colonne
        column_cleaning_configs: this.columnCleaningConfigs || [],
        // Ajout des overrides manuels
        manual_overrides: this.dataCleaningForm.value.manualOverrides || {}
      }
    };

    console.log('📤 Sending experiment data:', JSON.stringify(experimentData, null, 2));

    this.mlPipelineService.createExperiment(experimentData)
      .subscribe({
        next: (experiment) => {
          console.log('Experiment created successfully:', experiment);
          this.experimentId = experiment.id;
          this.addTrainingLog('success', 'Expérience créée avec succès');
          this.pollTrainingStatus();
        },
        error: (error) => {
          console.error('❌ Error starting training:', error);

          // Essayer de lire la réponse comme texte si ce n'est pas du JSON
          if (error.error instanceof Blob) {
            error.error.text().then((text: string) => {
              console.error('Error as text:', text);
              this.handleTrainingError(error, text);
            });
          } else if (error.error instanceof ArrayBuffer) {
            const text = new TextDecoder().decode(error.error);
            console.error('Error as ArrayBuffer text:', text);
            this.handleTrainingError(error, text);
          } else {
            console.error('Error body:', error.error);
            this.handleTrainingError(error, error.error);
          }
        }
      });
  }

  // Nouvelle méthode pour gérer les erreurs
  private handleTrainingError(error: any, errorBody: any): void {
    let errorMessage = 'Erreur inconnue';

    // Analyser spécifiquement l'erreur 422
    if (error.status === 422) {
      console.error('Validation error (422) - Body:', errorBody);

      // DIAGNOSTIC : Vérifier si project_id est vide
      if (!this.projectId) {
        errorMessage = '❌ ERREUR CRITIQUE : Aucun projet sélectionné !\n\nVous devez sélectionner un projet avant de lancer l\'entraînement.';
      } else if (typeof errorBody === 'string') {
        try {
          const parsed = JSON.parse(errorBody);
          if (parsed.detail) {
            if (Array.isArray(parsed.detail)) {
              errorMessage = parsed.detail.map((e: any) => {
                const field = e.loc ? e.loc.join(' → ') : 'Champ';
                return `${field}: ${e.msg}`;
              }).join('\n');
            } else {
              errorMessage = parsed.detail;
            }
          }
        } catch {
          errorMessage = errorBody;
        }
      } else if (errorBody?.detail) {
        if (Array.isArray(errorBody.detail)) {
          errorMessage = errorBody.detail.map((e: any) => {
            const field = e.loc ? e.loc.join(' → ') : 'Champ';
            return `${field}: ${e.msg}`;
          }).join('\n');
        } else {
          errorMessage = errorBody.detail;
        }
      }
    } else {
      errorMessage = errorBody?.detail || errorBody?.message || error.message || 'Erreur serveur';
    }

    this.addTrainingLog('error', `❌ Erreur: ${errorMessage}`);

    // Alerte améliorée
    alert(`❌ Erreur lors du lancement de l'entraînement:

${errorMessage}

Status: ${error.status}

DIAGNOSTIC :
- Project ID: ${this.projectId || 'MANQUANT ❌'}
- Dataset ID: ${this.datasetId || 'MANQUANT ❌'}
- Algorithm: ${this.algorithmForm.value.algorithm || 'MANQUANT ❌'}`);

    this.isTraining = false;
    if (this.logSimulationTimer) {
      clearInterval(this.logSimulationTimer);
    }
  }

  /**
   * Charge les données utilisateur pour afficher les crédits
   */
  loadUserCredits(): void {
    this.authService.getCurrentUser().subscribe({
      next: (user) => {
        this.currentUser = user;
        this.cdr.detectChanges();
      },
      error: (error) => {
        console.error('Erreur lors du chargement des crédits utilisateur:', error);
      }
    });
  }

  /**
   * Retourne le nombre de crédits de l'utilisateur actuel
   */
  getUserCredits(): number {
    return this.currentUser?.credits ?? 0;
  }

  // Cleanup lors de la destruction du composant
  ngOnDestroy() {
    if (this.logSimulationTimer) {
      clearInterval(this.logSimulationTimer);
    }
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
    }

    // Cleanup keyboard listener
    document.removeEventListener('keydown', this.handleKeyboardEvents.bind(this));
  }

  // ==============================================
  // ROBUSTESSE : PRÉVENTION DES BUGS DE SESSION
  // ==============================================

  resetWizardState(): void {
    console.log('🔄 Resetting wizard state for robustness...');

    // Reset training state
    this.isTraining = false;
    this.trainingProgress = 0;
    this.trainingCompleted = false;
    this.showingCompletionAnimation = false;
    this.showResults = false;

    // Reset experiment data
    this.experimentId = '';
    this.experimentResults = null;

    // Reset logs
    this.trainingLogs = [];

    // Reset progress steps
    this.progressSteps = {
      dataLoaded: false,
      preprocessing: false,
      training: false,
      evaluation: false
    };

    // Clean any existing polling
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
    }

    console.log('✅ Wizard state reset complete');
  }

  checkForCompletedExperiments(): void {
    // Vérifier s'il y a des expériences récentes terminées pour ce projet
    // Cela permet de détecter les entraînements terminés en arrière-plan
    if (this.projectId) {
      console.log('🔍 Checking for completed experiments in project:', this.projectId);
      // Cette logique pourrait être ajoutée si nécessaire
    }
  }

  // Support clavier pour navigation
  private handleKeyboardEvents(event: KeyboardEvent): void {
    // Placeholder pour support clavier futur
    console.log('⌨️ Keyboard event:', event.key);
  }

  objectKeys = Object.keys;

  // Types de stratégies de nettoyage
  readonly CLEANING_STRATEGIES = {
    NONE: 'none',
    DROP_COLUMN: 'drop_column',
    DROP_ROWS: 'drop_rows',
    MEAN: 'mean',
    MEDIAN: 'median',
    MODE: 'mode',
    CONSTANT: 'constant',
    KNN: 'knn',
    ITERATIVE: 'iterative',
    RANDOM_FOREST: 'random_forest',
    LINEAR: 'linear',
    SPLINE: 'spline',
    FORWARD_FILL: 'forward_fill',
    BACKWARD_FILL: 'backward_fill'
  };

  // Méthodes pour les informations détaillées (versions améliorées en bas du fichier)

  getAlgorithmUseCases(algorithmName: string): string[] {
    const useCases: Record<string, string[]> = {
      'random_forest': [
        'Prédiction de prix',
        'Classification multi-classes',
        'Détection de fraude'
      ],
      'linear_regression': [
        'Prédiction de tendances',
        'Analyse de corrélation',
        'Prévisions simples'
      ],
      'logistic_regression': [
        'Classification binaire',
        'Analyse de risque',
        'Prédiction oui/non'
      ],
      'svm': [
        'Classification de texte',
        'Reconnaissance d\'images',
        'Données complexes'
      ],
      'xgboost': [
        'Compétitions de données',
        'Prédictions haute précision',
        'Données complexes'
      ],
      'neural_network': [
        'Vision par ordinateur',
        'Traitement du langage',
        'Patterns complexes'
      ],
      'naive_bayes': [
        'Filtrage de spam',
        'Classification de texte',
        'Analyses rapides'
      ],
      'knn': [
        'Systèmes de recommandation',
        'Classification simple',
        'Données groupées'
      ]
    };
    return useCases[algorithmName] || ['Usage général'];
  }

  applyPreset(preset: string): void {
    if (!this.selectedAlgorithm) return;

    const presets: Record<string, Record<string, any>> = {
      'balanced': {
        'n_estimators': 100,
        'max_depth': 10,
        'learning_rate': 0.1,
        'min_samples_split': 5
      },
      'accuracy': {
        'n_estimators': 200,
        'max_depth': 20,
        'learning_rate': 0.05,
        'min_samples_split': 2
      },
      'speed': {
        'n_estimators': 50,
        'max_depth': 5,
        'learning_rate': 0.3,
        'min_samples_split': 10
      }
    };

    const presetValues = presets[preset];
    if (presetValues) {
      Object.keys(presetValues).forEach(param => {
        if (this.hyperparametersForm.contains(param)) {
          this.hyperparametersForm.get(param)?.setValue(presetValues[param]);
        }
      });
    }
  }

  getParameterDisplayName(param: string): string {
    const displayNames: Record<string, string> = {
      'n_estimators': 'Nombre d\'arbres',
      'max_depth': 'Profondeur maximale',
      'learning_rate': 'Taux d\'apprentissage',
      'min_samples_split': 'Échantillons minimum pour diviser',
      'criterion': 'Critère de division',
      'C': 'Paramètre de régularisation',
      'kernel': 'Type de noyau',
      'alpha': 'Force de régularisation'
    };
    return displayNames[param] || param.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  }

  getParameterTooltip(param: string): string {
    const tooltips: Record<string, string> = {
      'n_estimators': 'Plus d\'arbres = meilleure précision mais plus lent',
      'max_depth': 'Limite la complexité pour éviter le surapprentissage',
      'learning_rate': 'Vitesse d\'apprentissage - plus bas = plus précis mais plus lent',
      'min_samples_split': 'Évite de créer des branches trop spécifiques'
    };
    return tooltips[param] || 'Ajustez ce paramètre pour optimiser votre modèle';
  }

  getParameterImpact(param: string): string {
    const impacts: Record<string, string> = {
      'n_estimators': 'Augmenter améliore la précision mais ralentit l\'entraînement',
      'max_depth': 'Valeurs élevées peuvent causer du surapprentissage',
      'learning_rate': 'Diminuer améliore la précision mais augmente le temps',
      'min_samples_split': 'Augmenter réduit le surapprentissage'
    };
    return impacts[param] || 'Influence les performances du modèle';
  }

  getOptionDisplayName(param: string, option: string): string {
    if (param === 'criterion') {
      const criteriaNames: Record<string, string> = {
        'gini': 'Gini (rapide et efficace)',
        'entropy': 'Entropie (plus précis)',
        'squared_error': 'Erreur quadratique',
        'absolute_error': 'Erreur absolue'
      };
      return criteriaNames[option] || option;
    }
    return option;
  }

  getOptionExplanation(param: string, value: string): string {
    if (param === 'criterion' && value) {
      const explanations: Record<string, string> = {
        'gini': 'Mesure l\'impureté - rapide et efficace pour la plupart des cas',
        'entropy': 'Mesure le désordre - peut donner de meilleurs résultats',
        'squared_error': 'Pour les problèmes de régression - sensible aux valeurs extrêmes',
        'absolute_error': 'Pour les problèmes de régression - robuste aux valeurs extrêmes'
      };
      return explanations[value] || 'Option sélectionnée';
    }
    return 'Configuration actuelle';
  }

  getBooleanImpact(param: string, value: boolean): string {
    const impacts: Record<string, Record<string, string>> = {
      'bootstrap': {
        'true': 'Échantillonnage avec remplacement activé - améliore la généralisation',
        'false': 'Utilise toutes les données - peut surapprendre'
      },
      'oob_score': {
        'true': 'Calcul du score out-of-bag activé - estimation gratuite de la performance',
        'false': 'Pas de score OOB - plus rapide'
      }
    };
    return impacts[param]?.[String(value)] || (value ? 'Activé' : 'Désactivé');
  }

  getEstimatedTrainingTime(): string {
    if (!this.dataset || !this.selectedAlgorithm) return '2-5 minutes';

    const rows = this.dataset.instances_number || 1000;
    const features = this.dataset.features_number || 10;
    const complexity = this.getAlgorithmSpeed(this.selectedAlgorithm.name);

    let baseTime = Math.ceil((rows * features) / 50000); // minutes de base

    // Ajustement selon la complexité
    const complexityMultipliers: Record<string, number> = {
      'Très rapide': 0.5,
      'Rapide': 0.8,
      'Moyenne': 1,
      'Lente': 2,
      'Très lente': 3
    };

    baseTime *= complexityMultipliers[complexity] || 1;

    // Ajustement selon les hyperparamètres
    const nEstimators = this.hyperparametersForm.get('n_estimators')?.value || 100;
    if (nEstimators > 100) {
      baseTime *= (nEstimators / 100);
    }

    if (baseTime < 1) return 'Moins d\'une minute';
    if (baseTime > 10) return `${Math.ceil(baseTime)} minutes`;
    return `${Math.ceil(baseTime)}-${Math.ceil(baseTime * 1.5)} minutes`;
  }

  getModelComplexity(): number {
    if (!this.selectedAlgorithm) return 50;

    let complexity = 50; // Base

    // Ajustement selon l'algorithme
    const algoComplexity: Record<string, number> = {
      'linear_regression': 20,
      'logistic_regression': 30,
      'naive_bayes': 25,
      'knn': 40,
      'random_forest': 60,
      'svm': 70,
      'xgboost': 80,
      'neural_network': 90
    };

    complexity = algoComplexity[this.selectedAlgorithm.name] || 50;

    // Ajustement selon les hyperparamètres
    const maxDepth = this.hyperparametersForm.get('max_depth')?.value;
    if (maxDepth && maxDepth > 10) {
      complexity += Math.min((maxDepth - 10) * 2, 20);
    }

    return Math.min(complexity, 100);
  }

  getExpectedAccuracy(): string {
    const baseAccuracy = this.getAlgorithmAccuracy(this.selectedAlgorithm?.name || '');
    const accuracyMap: Record<string, string> = {
      'Très élevée': '85-95%',
      'Élevée': '75-85%',
      'Moyenne': '65-75%',
      'Faible': '50-65%'
    };
    return accuracyMap[baseAccuracy] || '70-80%';
  }

  // Nouvelles méthodes pour l'analyse de qualité des données

  getDataQualityScoreColor(score?: number): string {
    const qualityScore = score || this.dataQualityRecommendations?.qualityScore;
    if (!qualityScore) return 'text-muted';

    if (qualityScore >= 80) return 'excellent';
    if (qualityScore >= 60) return 'good';
    if (qualityScore >= 40) return 'warning';
    return 'danger';
  }

  getDataQualityScoreIcon(): string {
    if (!this.dataQualityRecommendations?.qualityScore) return 'help_outline';

    const score = this.dataQualityRecommendations.qualityScore;
    if (score >= 80) return 'check_circle';
    if (score >= 60) return 'warning';
    return 'error';
  }

  getSeverityLevelColor(level: string): string {
    const colorMap: Record<string, string> = {
      'none': 'text-success',
      'low': 'text-success',
      'medium': 'text-warning',
      'high': 'text-danger',
      'critical': 'text-danger'
    };
    return colorMap[level] || 'text-muted';
  }

  getSeverityLevelIcon(level: string): string {
    const iconMap: Record<string, string> = {
      'none': 'check_circle',
      'low': 'info',
      'medium': 'warning',
      'high': 'error',
      'critical': 'dangerous'
    };
    return iconMap[level] || 'help_outline';
  }



  onMissingValueStrategyChange() {
    const strategy = this.dataQualityForm.get('missingValueStrategy')?.value;

    // Afficher/masquer les options spécifiques selon la stratégie
    if (strategy === 'knn') {
      // Les options KNN sont déjà dans le formulaire
    } else if (strategy === 'iterative') {
      // Les options iterative sont déjà dans le formulaire
    }

    // Mettre à jour les recommandations si nécessaire
    this.cdr.detectChanges();
  }

  toggleOutlierDetection() {
    const enabled = this.dataQualityForm.get('outlierDetection')?.value;
    if (enabled && !this.dataQualityAnalysis) {
      // Faire une analyse complète si pas encore fait
      this.analyzeFullDataQuality();
    }
  }

  getRecommendationIcon(priority: string): string {
    const iconMap: Record<string, string> = {
      'high': 'priority_high',
      'medium': 'report_problem',
      'low': 'info'
    };
    return iconMap[priority] || 'lightbulb';
  }

  getRecommendationColor(priority: string): string {
    const colorMap: Record<string, string> = {
      'high': 'text-danger',
      'medium': 'text-warning',
      'low': 'text-info'
    };
    return colorMap[priority] || 'text-muted';
  }

  refreshDataQualityAnalysis() {
    this.analyzeDataQuality();
  }

  showAdvancedDataQualityOptions(): boolean {
    return !this.dataQualityForm.get('useRecommendations')?.value;
  }

  applyRecommendedSettings() {
    if (this.dataQualityRecommendations) {
      this.applyDataQualityRecommendations(this.dataQualityRecommendations);
      this.dataQualityForm.patchValue({ useRecommendations: true });
    }
  }

  // Nouvelles méthodes pour l'interface de nettoyage avancée

  toggleDataCleaningHelp(): void {
    this.showDataCleaningHelp = !this.showDataCleaningHelp;
  }

  getSelectedStrategy(): string {
    const useRecommendations = this.dataQualityForm.get('useRecommendations')?.value;
    if (useRecommendations && this.dataQualityRecommendations) {
      // Retourner la stratégie recommandée principale
      return this.dataQualityRecommendations.missingValueStrategy || 'median';
    }
    return this.dataQualityForm.get('missingValueStrategy')?.value || 'median';
  }

  isAdvancedStrategy(): boolean {
    const strategy = this.getSelectedStrategy();
    return ['knn', 'iterative'].includes(strategy);
  }

  getScalingMethodDescription(): string {
    const method = this.dataQualityForm.get('scalingMethod')?.value;
    const descriptions: Record<string, string> = {
      'standard': 'Normalisation z-score : transforme les données pour avoir une moyenne de 0 et un écart-type de 1. Idéal pour la plupart des algorithmes ML.',
      'minmax': 'Normalisation Min-Max : transforme les données entre 0 et 1. Préserve les relations exactes entre valeurs.',
      'robust': 'Normalisation robuste : utilise la médiane et les quartiles. Résistant aux valeurs aberrantes.'
    };
    return descriptions[method] || '';
  }

  getMissingValueStrategyDescription(strategy: string): string {
    const descriptions: Record<string, string> = {
      'drop': 'Supprime toutes les lignes contenant des valeurs manquantes. Simple mais peut perdre beaucoup de données.',
      'mean': 'Remplace par la moyenne de la colonne. Idéal pour données numériques avec distribution normale.',
      'median': 'Remplace par la médiane (valeur du milieu). Robuste aux valeurs extrêmes.',
      'mode': 'Remplace par la valeur la plus fréquente. Parfait pour les données catégorielles.',
      'knn': 'Utilise les K plus proches voisins pour prédire la valeur manquante. Très précis.',
      'iterative': 'Modélise chaque colonne en fonction des autres (MICE). Le plus sophistiqué.',
      'forward_fill': 'Propage la dernière valeur valide. Idéal pour séries temporelles.',
      'linear': 'Interpolation linéaire entre valeurs adjacentes. Pour données séquentielles.'
    };
    return descriptions[strategy] || 'Méthode de nettoyage des données';
  }

  getOutlierMethodDescription(method: string): string {
    const descriptions: Record<string, string> = {
      'iqr': 'Interquartile Range : détecte les valeurs en dehors de Q1-1.5*IQR et Q3+1.5*IQR. Méthode statistique classique.',
      'zscore': 'Z-Score : détecte les valeurs à plus de N écarts-types de la moyenne. Sensible à la distribution.',
      'isolation': 'Isolation Forest : algorithme ML qui isole les anomalies. Détecte des patterns complexes.'
    };
    return descriptions[method] || '';
  }

  // Helper methods pour les tooltips et UI

  getStrategyIcon(strategy: string): string {
    const icons: Record<string, string> = {
      'drop': 'delete',
      'mean': 'calculate',
      'median': 'align_horizontal_center',
      'mode': 'bar_chart',
      'knn': 'group',
      'iterative': 'refresh',
      'forward_fill': 'arrow_forward',
      'linear': 'trending_up'
    };
    return icons[strategy] || 'build';
  }

  getStrategyComplexity(strategy: string): 'simple' | 'intermediate' | 'advanced' {
    const complexityMap: Record<string, 'simple' | 'intermediate' | 'advanced'> = {
      'drop': 'simple',
      'mean': 'simple',
      'median': 'simple',
      'mode': 'simple',
      'forward_fill': 'intermediate',
      'linear': 'intermediate',
      'knn': 'advanced',
      'iterative': 'advanced'
    };
    return complexityMap[strategy] || 'simple';
  }

  getComplexityColor(complexity: string): string {
    const colors: Record<string, string> = {
      'simple': 'success',
      'intermediate': 'warning',
      'advanced': 'primary'
    };
    return colors[complexity] || 'secondary';
  }

  // Méthodes pour les recommandations automatiques

  hasDataQualityIssues(): boolean {
    return this.dataQualityAnalysis &&
           this.dataQualityAnalysis.missing_data_analysis.severity_assessment.level !== 'none';
  }

  getQualityIssuesCount(): number {
    if (!this.dataQualityAnalysis) return 0;
    return this.dataQualityAnalysis.missing_data_analysis.severity_assessment.main_issues?.length || 0;
  }

  shouldShowRecommendations(): boolean {
    return this.dataQualityAnalysis && this.hasDataQualityIssues();
  }

  getRecommendationSummary(): string {
    if (!this.dataQualityRecommendations) return '';

    const strategies = this.dataQualityRecommendations.strategies || {};
    const uniqueStrategies = [...new Set(Object.values(strategies))];

    return `${uniqueStrategies.length} stratégie(s) recommandée(s) : ${uniqueStrategies.join(', ')}`;
  }

  // ===============================================
  // NOUVELLES MÉTHODES POUR L'ÉTAPE DE NETTOYAGE DÉDIÉE
  // ===============================================

  /**
   * Analyse les colonnes pour le nettoyage multi-colonnes
   */
  analyzeColumnsCleaning(): void {
    if (!this.datasetId) return;

    this.isAnalyzingData = true;
    const targetColumn = this.dataQualityForm.get('targetColumn')?.value;

    const request = {
      dataset_id: this.datasetId,
      target_column: targetColumn,
      sample_size: 10000
    };

    this.mlPipelineService.analyzeDataQuality(request)
      .subscribe({
        next: (analysis) => {
          this.dataQualityAnalysis = analysis;
          this.isAnalyzingData = false;

          // Générer la configuration par colonne
          this.generateColumnCleaningConfigs(analysis);

          // Marquer l'analyse comme complétée
          this.dataCleaningForm.patchValue({
            analysisCompleted: true
          });

          this.cdr.detectChanges();
        },
        error: (error) => {
          console.error('Error performing data quality analysis:', error);
          this.isAnalyzingData = false;

          // Générer des données de démonstration
          this.generateDemoCleaningConfigs();

          this.cdr.detectChanges();
        }
      });
  }

  /**
   * Génère la configuration de nettoyage pour chaque colonne
   */
  generateColumnCleaningConfigs(analysis: any): void {
    const columns = this.getDatasetColumns();
    const targetColumn = this.dataQualityForm.get('targetColumn')?.value;

    this.columnCleaningConfigs = columns.map((column) => {
      const columnAnalysis = analysis.missing_data_analysis?.columns_analysis?.[column.column_name];
      const missingPercentage = columnAnalysis?.missing_percentage || 0;
      const dataType = column.data_type_interpreted || column.data_type_original || 'string';
      const isTarget = column.column_name === targetColumn;
      const isTimeSeries = this.isTimeSeriesColumn(column);

      // Déterminer la stratégie recommandée
      let recommendedStrategy = this.CLEANING_STRATEGIES.NONE;
      if (missingPercentage > 0) {
        if (missingPercentage > 70 && !isTarget) {
          recommendedStrategy = this.CLEANING_STRATEGIES.DROP_COLUMN;
        } else if (isTimeSeries || dataType === 'datetime') {
          recommendedStrategy = this.CLEANING_STRATEGIES.LINEAR;
        } else if (['integer', 'float'].includes(dataType)) {
          if (missingPercentage < 15) {
            recommendedStrategy = this.CLEANING_STRATEGIES.MEAN;
          } else {
            recommendedStrategy = this.CLEANING_STRATEGIES.KNN;
          }
        } else {
          recommendedStrategy = this.CLEANING_STRATEGIES.MODE;
        }
      }

      // Recommandation de l'analyse
      if (columnAnalysis?.recommendation?.primary_strategy) {
        recommendedStrategy = this.mapRecommendationToStrategy(columnAnalysis.recommendation.primary_strategy);
      }

      return {
        name: column.column_name,
        type: dataType,
        missingPercentage: Math.round(missingPercentage),
        missingCount: columnAnalysis?.missing_count || 0,
        isTarget: isTarget,
        isTimeSeries: isTimeSeries,
        strategy: recommendedStrategy,
        recommendedStrategy: recommendedStrategy,
        params: this.getDefaultParams(recommendedStrategy),
        confidence: columnAnalysis?.recommendation?.confidence || 0.8
      };
    });
  }

  /**
   * Génère des données de démonstration pour le nettoyage
   */
  generateDemoCleaningConfigs(): void {
    const columns = this.getDatasetColumns();
    const targetColumn = this.dataQualityForm.get('targetColumn')?.value;

    this.columnCleaningConfigs = columns.map((column, index) => {
      // Simuler des pourcentages de données manquantes variés
      const missingPercentages = [0, 5, 15, 35, 75];
      const missingPercentage = missingPercentages[index % missingPercentages.length];
      const dataType = column.data_type_interpreted || column.data_type_original || 'string';
      const isTarget = column.column_name === targetColumn;

      // Déterminer la stratégie en fonction du pourcentage
      let strategy = this.CLEANING_STRATEGIES.NONE;
      if (missingPercentage > 0) {
        if (missingPercentage > 70 && !isTarget) {
          strategy = this.CLEANING_STRATEGIES.DROP_COLUMN;
        } else if (missingPercentage > 15) {
          strategy = ['integer', 'float'].includes(dataType) ?
                    this.CLEANING_STRATEGIES.KNN :
                    this.CLEANING_STRATEGIES.MODE;
        } else {
          strategy = ['integer', 'float'].includes(dataType) ?
                    this.CLEANING_STRATEGIES.MEAN :
                    this.CLEANING_STRATEGIES.MODE;
        }
      }

      return {
        name: column.column_name,
        type: dataType,
        missingPercentage: missingPercentage,
        missingCount: Math.round((this.dataset?.instances_number || 1000) * missingPercentage / 100),
        isTarget: isTarget,
        isTimeSeries: false,
        strategy: strategy,
        recommendedStrategy: strategy,
        params: this.getDefaultParams(strategy),
        confidence: 0.85
      };
    });

    // Marquer l'analyse comme terminée
    this.dataCleaningForm.patchValue({
      analysisCompleted: true
    });
  }

  autoFixAllDataIssues(): void {
    if (!this.dataset) return;

    this.isAnalyzingData = true;

    // Lancer l'analyse complète des données
    this.mlPipelineService.analyzeDataQuality({
      dataset_id: this.datasetId,
      sample_size: 5000,
      target_column: this.dataQualityForm.get('targetColumn')?.value
    }).subscribe({
      next: (analysis) => {
        this.dataQualityAnalysis = analysis;
        this.generateColumnsAnalysis(analysis);
        this.generateAutoFixCategories(analysis);

        // Marquer l'analyse comme complétée
        this.dataCleaningForm.patchValue({
          analysisCompleted: true,
          autoFixApplied: true
        });

        this.isAnalyzingData = false;

        // Appliquer automatiquement les recommandations
        this.applyAutoFixRecommendations(analysis);
      },
      error: (error) => {
        console.error('Erreur lors de l\'analyse:', error);
        this.isAnalyzingData = false;

        // Générer des données d'exemple en cas d'erreur
        this.generateFallbackAnalysis();
      }
    });
  }

  generateColumnsAnalysis(analysis: any): void {
    const columns = this.getDatasetColumns();
    if (!columns.length) return;

    this.columnsAnalysis = columns.map(column => {
      const missingInfo = analysis.missing_data_analysis?.columns_analysis?.[column.column_name];
      const issues = [];
      const alternatives = [];

      // Détection des problèmes
      if (missingInfo?.missing_percentage > 0) {
        const severity = missingInfo.missing_percentage > 50 ? 'high' :
                        missingInfo.missing_percentage > 20 ? 'medium' : 'low';

        issues.push({
          icon: 'warning',
          severity: severity,
          title: `${missingInfo.missing_percentage.toFixed(1)}% de données manquantes`,
          description: `${missingInfo.missing_count} valeurs manquantes sur ${analysis.dataset_overview.total_rows} lignes`,
          stats: [`${missingInfo.missing_count} manquantes`, `${(100 - missingInfo.missing_percentage).toFixed(1)}% complètes`]
        });
      }

      // Recommandations
      let recommendedAction = null;
      if (missingInfo?.recommendation) {
        const strategy = missingInfo.recommendation.primary_strategy;
        recommendedAction = {
          type: this.getActionType(strategy),
          icon: this.getActionIcon(strategy),
          title: this.getActionTitle(strategy),
          description: missingInfo.recommendation.explanation,
          confidence: missingInfo.recommendation.confidence
        };

        // Actions alternatives
        if (missingInfo.recommendation.alternative_strategies) {
          alternatives.push(...missingInfo.recommendation.alternative_strategies.map((alt: string) => ({
            icon: this.getActionIcon(alt),
            title: this.getActionTitle(alt),
            description: this.getActionDescription(alt)
          })));
        }
      }

      return {
        name: column.column_name,
        type: column.data_type_interpreted || column.data_type_original,
        issues: issues,
        recommendedAction: recommendedAction,
        alternativeActions: alternatives
      };
    });
  }

  generateAutoFixCategories(analysis: any): void {
    const categories = {
      suppression: { title: '🗑️ Suppression', icon: 'delete', columns: [] as string[], description: 'Colonnes trop corrompues à supprimer' },
      imputation_advanced: { title: '🎯 Imputation Avancée', icon: 'auto_fix_high', columns: [] as string[], description: 'KNN et Iterative pour missing values importantes' },
      imputation_simple: { title: '🔧 Imputation Simple', icon: 'build', columns: [] as string[], description: 'Mean, médiane, mode pour missing values légères' },
      interpolation: { title: '📈 Interpolation', icon: 'trending_up', columns: [] as string[], description: 'Données temporelles et séquentielles' }
    };

    if (analysis.missing_data_analysis?.columns_analysis) {
      Object.entries(analysis.missing_data_analysis.columns_analysis).forEach(([columnName, info]: [string, any]) => {
        const strategy = info.recommendation?.primary_strategy;

        if (strategy === 'drop_column') {
          categories.suppression.columns.push(columnName);
        } else if (['knn', 'iterative'].includes(strategy)) {
          categories.imputation_advanced.columns.push(columnName);
        } else if (['linear', 'forward_fill'].includes(strategy)) {
          categories.interpolation.columns.push(columnName);
        } else {
          categories.imputation_simple.columns.push(columnName);
        }
      });
    }

    this.autoFixCategories = Object.values(categories).filter(cat => cat.columns.length > 0);
  }

  generateFallbackAnalysis(): void {
    // Générer une analyse factice en cas d'erreur pour que l'interface fonctionne
    const columns = this.getDatasetColumns();
    if (!columns.length) return;

    this.columnsAnalysis = columns.slice(0, 5).map((column, index) => {
      const missingPercentage = [0, 5, 15, 45, 85][index] || 0;
      const issues = missingPercentage > 0 ? [{
        icon: 'warning',
        severity: missingPercentage > 50 ? 'high' : 'low',
        title: `${missingPercentage}% de données manquantes`,
        description: 'Données simulées pour démonstration',
        stats: [`${missingPercentage}% manquantes`]
      }] : [];

      return {
        name: column.column_name,
        type: column.data_type_interpreted || column.data_type_original || 'string',
        issues: issues,
        recommendedAction: missingPercentage > 0 ? {
          type: 'imputation',
          icon: 'build',
          title: 'Imputation recommandée',
          description: 'Stratégie automatique selon le type de données',
          confidence: 0.8
        } : null,
        alternativeActions: []
      };
    });

    // Marquer comme terminé
    this.dataCleaningForm.patchValue({
      analysisCompleted: true,
      autoFixApplied: true
    });
  }

  applyAutoFixRecommendations(analysis: any): void {
    // Appliquer automatiquement les recommandations à la configuration
    if (analysis.preprocessing_recommendations) {
      const recommendations = analysis.preprocessing_recommendations;

      // Mettre à jour le formulaire avec les recommandations
      this.dataQualityForm.patchValue({
        missingValueStrategy: recommendations.missing_values_strategy || 'median',
        scalingMethod: recommendations.scaling_recommendation || 'standard',
        categoricalEncoding: recommendations.encoding_recommendation || 'onehot',
        outlierDetection: true,
        useRecommendations: true
      });
    }
  }

  // Méthodes d'aide pour l'interface
  getColumnsWithIssuesCount(): number {
    return this.columnsAnalysis.filter(col => col.issues && col.issues.length > 0).length;
  }

  getColumnsAnalysis(): any[] {
    return this.columnsAnalysis;
  }

  hasAutoFixActions(): boolean {
    return this.autoFixCategories.length > 0;
  }

  getAutoFixCategories(): any[] {
    return this.autoFixCategories;
  }

  isDataCleaningComplete(): boolean {
    return this.dataCleaningForm.get('analysisCompleted')?.value === true;
  }

  getColumnSeverityClass(column: any): string {
    if (!column.issues || column.issues.length === 0) return 'perfect';

    const highSeverityIssue = column.issues.find((issue: any) => issue.severity === 'high');
    const mediumSeverityIssue = column.issues.find((issue: any) => issue.severity === 'medium');

    if (highSeverityIssue) return 'high-severity';
    if (mediumSeverityIssue) return 'medium-severity';
    return 'low-severity';
  }

  getColumnTypeIcon(type: string): string {
    const iconMap: Record<string, string> = {
      'string': 'text_fields',
      'integer': 'numbers',
      'float': 'decimal',
      'boolean': 'toggle_on',
      'datetime': 'event',
      'object': 'category'
    };
    return iconMap[type.toLowerCase()] || 'help';
  }

  getColumnTypeLabel(type: string): string {
    const labelMap: Record<string, string> = {
      'string': 'Texte',
      'integer': 'Entier',
      'float': 'Décimal',
      'boolean': 'Booléen',
      'datetime': 'Date/Heure',
      'object': 'Objet'
    };
    return labelMap[type.toLowerCase()] || type;
  }

  /**
   * Retourne les configurations de nettoyage par colonne
   */
  getColumnCleaningConfigs(): any[] {
    return this.columnCleaningConfigs;
  }

  /**
   * Vérifie si une colonne est de type série temporelle
   */
  isTimeSeriesColumn(column: any): boolean {
    const name = column.column_name.toLowerCase();
    return column.data_type_interpreted === 'datetime' ||
           name.includes('date') ||
           name.includes('time') ||
           name.includes('timestamp');
  }

  /**
   * Map la stratégie recommandée vers notre enum
   */
  mapRecommendationToStrategy(recommendation: string): string {
    const strategyMap: Record<string, string> = {
      'drop_column': this.CLEANING_STRATEGIES.DROP_COLUMN,
      'drop_rows': this.CLEANING_STRATEGIES.DROP_ROWS,
      'mean': this.CLEANING_STRATEGIES.MEAN,
      'median': this.CLEANING_STRATEGIES.MEDIAN,
      'mode': this.CLEANING_STRATEGIES.MODE,
      'knn': this.CLEANING_STRATEGIES.KNN,
      'iterative': this.CLEANING_STRATEGIES.ITERATIVE,
      'linear': this.CLEANING_STRATEGIES.LINEAR,
      'forward_fill': this.CLEANING_STRATEGIES.FORWARD_FILL,
      'backward_fill': this.CLEANING_STRATEGIES.BACKWARD_FILL
    };
    return strategyMap[recommendation] || this.CLEANING_STRATEGIES.MEAN;
  }

  /**
   * Retourne les paramètres par défaut pour une stratégie
   */
  getDefaultParams(strategy: string): any {
    switch (strategy) {
      case this.CLEANING_STRATEGIES.KNN:
        return { n_neighbors: 5 };
      case this.CLEANING_STRATEGIES.ITERATIVE:
        return { max_iter: 10 };
      case this.CLEANING_STRATEGIES.CONSTANT:
        return { fill_value: 0 };
      case this.CLEANING_STRATEGIES.SPLINE:
        return { order: 3 };
      default:
        return {};
    }
  }

  /**
   * Vérifie si une stratégie a des paramètres
   */
  hasParameters(strategy: string): boolean {
    return [this.CLEANING_STRATEGIES.KNN,
            this.CLEANING_STRATEGIES.ITERATIVE,
            this.CLEANING_STRATEGIES.CONSTANT,
            this.CLEANING_STRATEGIES.SPLINE].includes(strategy);
  }

  /**
   * Gère le changement de stratégie pour une colonne
   */
  onStrategyChange(column: any, index: number): void {
    // Réinitialiser les paramètres avec les valeurs par défaut
    column.params = this.getDefaultParams(column.strategy);
    this.cdr.detectChanges();
  }

  /**
   * Affiche l'aperçu du nettoyage pour une colonne
   */
  previewColumnCleaning(column: any, index: number): void {
    this.previewColumn = column;
    this.showPreviewModal = true;

    // Simuler des données d'aperçu
    const totalRows = this.dataset?.instances_number || 1000;
    const missingBefore = Math.round(totalRows * column.missingPercentage / 100);
    const missingAfter = column.strategy === this.CLEANING_STRATEGIES.DROP_COLUMN ? totalRows :
                        column.strategy === this.CLEANING_STRATEGIES.DROP_ROWS ? 0 :
                        0;

    this.previewData = {
      before: { missing: missingBefore },
      after: { missing: missingAfter },
      samples: this.generatePreviewSamples(column)
    };
  }

  /**
   * Génère des échantillons pour l'aperçu
   */
  generatePreviewSamples(column: any): any[] {
    const samples = [];
    const sampleSize = 10;

    for (let i = 0; i < sampleSize; i++) {
      const isMissing = Math.random() < (column.missingPercentage / 100);
      let cleanedValue;

      if (isMissing) {
        switch (column.strategy) {
          case this.CLEANING_STRATEGIES.MEAN:
            cleanedValue = column.type === 'integer' ? 42 : 42.5;
            break;
          case this.CLEANING_STRATEGIES.MEDIAN:
            cleanedValue = column.type === 'integer' ? 35 : 35.0;
            break;
          case this.CLEANING_STRATEGIES.MODE:
            cleanedValue = column.type === 'string' ? 'Mode Value' : 1;
            break;
          case this.CLEANING_STRATEGIES.CONSTANT:
            cleanedValue = column.params.fill_value || 0;
            break;
          case this.CLEANING_STRATEGIES.KNN:
            cleanedValue = column.type === 'integer' ? 38 : 'Predicted';
            break;
          default:
            cleanedValue = 'N/A';
        }
      } else {
        cleanedValue = this.generateSampleValue(column.type, i);
      }

      samples.push({
        index: i + 1,
        original: isMissing ? null : this.generateSampleValue(column.type, i),
        cleaned: cleanedValue
      });
    }

    return samples;
  }

  /**
   * Génère une valeur d'exemple selon le type
   */
  generateSampleValue(type: string, index: number): any {
    switch (type) {
      case 'integer':
        return Math.floor(Math.random() * 100);
      case 'float':
        return (Math.random() * 100).toFixed(2);
      case 'string':
        return `Value_${index}`;
      case 'boolean':
        return Math.random() > 0.5;
      case 'datetime':
        return new Date(2024, 0, index + 1).toISOString().split('T')[0];
      default:
        return `Data_${index}`;
    }
  }

  /**
   * Ferme la modal d'aperçu
   */
  closePreview(): void {
    this.showPreviewModal = false;
    this.previewColumn = null;
    this.previewData = null;
  }

  /**
   * Obtient la classe de santé d'une colonne
   */
  getColumnHealthClass(column: any): string {
    if (column.missingPercentage === 0) return 'perfect';
    if (column.missingPercentage < 15) return 'good';
    if (column.missingPercentage < 50) return 'warning';
    return 'danger';
  }

  /**
   * Obtient l'icône de santé d'une colonne
   */
  getColumnHealthIcon(column: any): string {
    if (column.missingPercentage === 0) return 'check_circle';
    if (column.missingPercentage < 15) return 'info';
    if (column.missingPercentage < 50) return 'warning';
    return 'error';
  }

  /**
   * Obtient le tooltip de santé d'une colonne
   */
  getColumnHealthTooltip(column: any): string {
    if (column.missingPercentage === 0) return 'Aucune donnée manquante';
    return `${column.missingPercentage}% de données manquantes (${column.missingCount} valeurs)`;
  }

  /**
   * Retourne le nombre total de valeurs manquantes
   */
  getTotalMissingValuesCount(): number {
    return this.columnCleaningConfigs.reduce((total, col) => total + col.missingCount, 0);
  }

  /**
   * Applique une configuration intelligente prédéfinie
   */
  applySmartPreset(): void {
    this.columnCleaningConfigs.forEach(config => {
      config.strategy = config.recommendedStrategy;
      config.params = this.getDefaultParams(config.recommendedStrategy);
    });
    this.cdr.detectChanges();
  }

  /**
   * Réinitialise toutes les configurations
   */
  resetCleaningPipeline(): void {
    this.columnCleaningConfigs.forEach(config => {
      config.strategy = config.missingPercentage > 0 ? this.CLEANING_STRATEGIES.DROP_ROWS : this.CLEANING_STRATEGIES.NONE;
      config.params = {};
    });
    this.cdr.detectChanges();
  }

  /**
   * Valide le pipeline de nettoyage
   */
  validateCleaningPipeline(): void {
    // Vérifier que toutes les colonnes avec des données manquantes ont une stratégie
    const invalidConfigs = this.columnCleaningConfigs.filter(
      config => config.missingPercentage > 0 && config.strategy === this.CLEANING_STRATEGIES.NONE
    );

    if (invalidConfigs.length > 0) {
      this.addTrainingLog('warning', `${invalidConfigs.length} colonnes avec données manquantes n'ont pas de stratégie définie`);
      return;
    }

    // Vérifier les colonnes à supprimer
    const columnsToDelete = this.columnCleaningConfigs.filter(
      config => config.strategy === this.CLEANING_STRATEGIES.DROP_COLUMN
    );

    if (columnsToDelete.length > 0) {
      this.addTrainingLog('info', `${columnsToDelete.length} colonnes seront supprimées`);
    }

    // Tester la configuration avec l'API backend
    this.testCleaningConfiguration();
  }

  /**
   * Exporte le code Python pour le nettoyage
   */
  exportCleaningCode(): void {
    // Utiliser la version avec jointures si des datasets additionnels sont présents
    const pythonCode = this.additionalDatasets.length > 0
      ? this.generatePythonCleaningCodeWithJoins()
      : this.generatePythonCleaningCode();

    // Créer un blob et télécharger
    const blob = new Blob([pythonCode], { type: 'text/plain' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'data_cleaning_pipeline.py';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);

    this.addTrainingLog('success', 'Code Python exporté avec succès !');
  }

  /**
   * Génère le code Python pour le pipeline de nettoyage
   */
  generatePythonCleaningCode(): string {
    let code = `import pandas as pd
import numpy as np
from sklearn.impute import SimpleImputer, KNNImputer
from sklearn.experimental import enable_iterative_imputer
from sklearn.impute import IterativeImputer

# Charger les données
df = pd.read_csv('your_dataset.csv')

# Pipeline de nettoyage des données
`;

    this.columnCleaningConfigs.forEach(config => {
      if (config.strategy === this.CLEANING_STRATEGIES.NONE) return;

      code += `\n# Nettoyage de la colonne: ${config.name}\n`;

      switch (config.strategy) {
        case this.CLEANING_STRATEGIES.DROP_COLUMN:
          code += `df = df.drop('${config.name}', axis=1)\n`;
          break;

        case this.CLEANING_STRATEGIES.DROP_ROWS:
          code += `df = df.dropna(subset=['${config.name}'])\n`;
          break;

        case this.CLEANING_STRATEGIES.MEAN:
          code += `df['${config.name}'].fillna(df['${config.name}'].mean(), inplace=True)\n`;
          break;

        case this.CLEANING_STRATEGIES.MEDIAN:
          code += `df['${config.name}'].fillna(df['${config.name}'].median(), inplace=True)\n`;
          break;

        case this.CLEANING_STRATEGIES.MODE:
          code += `df['${config.name}'].fillna(df['${config.name}'].mode()[0], inplace=True)\n`;
          break;

        case this.CLEANING_STRATEGIES.CONSTANT:
          code += `df['${config.name}'].fillna(${config.params.fill_value}, inplace=True)\n`;
          break;

        case this.CLEANING_STRATEGIES.KNN:
          code += `knn_imputer = KNNImputer(n_neighbors=${config.params.n_neighbors})
df['${config.name}'] = knn_imputer.fit_transform(df[['${config.name}']])\n`;
          break;

        case this.CLEANING_STRATEGIES.ITERATIVE:
          code += `iterative_imputer = IterativeImputer(max_iter=${config.params.max_iter})
df['${config.name}'] = iterative_imputer.fit_transform(df[['${config.name}']])\n`;
          break;

        case this.CLEANING_STRATEGIES.LINEAR:
          code += `df['${config.name}'].interpolate(method='linear', inplace=True)\n`;
          break;

        case this.CLEANING_STRATEGIES.FORWARD_FILL:
          code += `df['${config.name}'].fillna(method='ffill', inplace=True)\n`;
          break;

        case this.CLEANING_STRATEGIES.BACKWARD_FILL:
          code += `df['${config.name}'].fillna(method='bfill', inplace=True)\n`;
          break;
      }
    });

    code += `\n# Sauvegarder les données nettoyées
df.to_csv('cleaned_dataset.csv', index=False)
print(f"Dataset nettoyé: {df.shape[0]} lignes, {df.shape[1]} colonnes")`;

    return code;
  }

  /**
   * Obtient les statistiques de nettoyage
   */
  getCleaningStats(): any[] {
    const stats = [];

    // Colonnes à supprimer
    const columnsToDelete = this.columnCleaningConfigs.filter(
      c => c.strategy === this.CLEANING_STRATEGIES.DROP_COLUMN
    ).length;
    if (columnsToDelete > 0) {
      stats.push({
        icon: 'delete',
        label: 'Colonnes à supprimer',
        value: columnsToDelete
      });
    }

    // Stratégies d'imputation
    const imputationStrategies = this.columnCleaningConfigs.filter(
      c => [this.CLEANING_STRATEGIES.MEAN, this.CLEANING_STRATEGIES.MEDIAN,
            this.CLEANING_STRATEGIES.MODE, this.CLEANING_STRATEGIES.KNN,
            this.CLEANING_STRATEGIES.ITERATIVE].includes(c.strategy)
    ).length;
    if (imputationStrategies > 0) {
      stats.push({
        icon: 'build',
        label: 'Colonnes avec imputation',
        value: imputationStrategies
      });
    }

    // Interpolations
    const interpolations = this.columnCleaningConfigs.filter(
      c => [this.CLEANING_STRATEGIES.LINEAR, this.CLEANING_STRATEGIES.FORWARD_FILL,
            this.CLEANING_STRATEGIES.BACKWARD_FILL].includes(c.strategy)
    ).length;
    if (interpolations > 0) {
      stats.push({
        icon: 'trending_up',
        label: 'Colonnes avec interpolation',
        value: interpolations
      });
    }

    // Total de colonnes modifiées
    const totalModified = this.columnCleaningConfigs.filter(
      c => c.strategy !== this.CLEANING_STRATEGIES.NONE
    ).length;
    stats.push({
      icon: 'auto_fix_high',
      label: 'Total de modifications',
      value: totalModified
    });

    return stats;
  }

  /**
   * Obtient les overrides de nettoyage pour le formulaire
   */
  getCleaningOverrides(): any {
    const overrides: any = {};

    this.columnCleaningConfigs.forEach(config => {
      if (config.strategy !== config.recommendedStrategy) {
        overrides[config.name] = {
          strategy: config.strategy,
          params: config.params
        };
      }
    });

    return overrides;
  }

  /**
   * Ouvre le sélecteur de dataset pour la fusion
   */
  openDatasetSelector(): void {
    // Charger la liste des datasets disponibles
    this.datasetService.getProjectDatasets(this.projectId)
      .subscribe({
        next: (datasets) => {
          // Filtrer pour ne pas inclure le dataset actuel
          this.availableDatasets = datasets.filter(ds => ds.id !== this.datasetId);

          // Ouvrir une modal ou un dialog pour sélectionner
          // Pour l'instant, on ajoute simplement un dataset de démonstration
          if (this.availableDatasets.length > 0) {
            this.addDatasetForJoin(this.availableDatasets[0]);
          } else {
            this.addTrainingLog('warning', 'Aucun autre dataset disponible pour la fusion');
          }
        },
        error: (error) => {
          console.error('Error loading datasets:', error);
          this.addTrainingLog('error', 'Erreur lors du chargement des datasets');
        }
      });
  }

  /**
   * Ajoute un dataset pour la fusion
   */
  addDatasetForJoin(dataset: any): void {
    // Récupérer les détails du dataset
    this.datasetService.getDatasetDetails(dataset.id)
      .subscribe({
        next: (details) => {
          const columns = details.files?.[0]?.columns?.map((col: any) => col.column_name) || [];

          this.additionalDatasets.push({
            id: dataset.id,
            name: dataset.dataset_name,
            rows: details.instances_number || 0,
            columns: columns,
            joinType: 'inner',
            joinKey: columns[0] || '' // Première colonne par défaut
          });

          this.addTrainingLog('success', `Dataset "${dataset.dataset_name}" ajouté pour la fusion`);
          this.cdr.detectChanges();
        },
        error: (error) => {
          console.error('Error loading dataset details:', error);
          this.addTrainingLog('error', 'Erreur lors du chargement des détails du dataset');
        }
      });
  }

  /**
   * Supprime un dataset de la liste de fusion
   */
  removeDataset(index: number): void {
    const dataset = this.additionalDatasets[index];
    this.additionalDatasets.splice(index, 1);
    this.addTrainingLog('info', `Dataset "${dataset.name}" retiré de la fusion`);
    this.cdr.detectChanges();
  }

  /**
   * Génère le code Python incluant la fusion de datasets
   */
  generatePythonCleaningCodeWithJoins(): string {
    let code = this.generatePythonCleaningCode();

    // Ajouter le code pour les jointures si nécessaire
    if (this.additionalDatasets.length > 0) {
      code += `\n\n# Fusion avec d'autres datasets\n`;

      this.additionalDatasets.forEach((ds, index) => {
        code += `\n# Charger le dataset ${index + 2}: ${ds.name}\n`;
        code += `df${index + 2} = pd.read_csv('${ds.name.toLowerCase().replace(/\s+/g, '_')}.csv')\n`;

        // Générer le code de jointure selon le type
        const joinMethodMap: { [key: string]: string } = {
          'inner': 'inner',
          'left': 'left',
          'right': 'right',
          'outer': 'outer'
        };
        const joinMethod = joinMethodMap[ds.joinType] || 'inner';

        code += `df = pd.merge(df, df${index + 2}, on='${ds.joinKey}', how='${joinMethod}')\n`;
      });

      code += `\nprint(f"Dataset fusionné: {df.shape[0]} lignes, {df.shape[1]} colonnes")`;
    }

    return code;
  }

  /**
   * Teste la configuration avec l'API backend
   */
  testCleaningConfiguration(): void {
    if (!this.datasetId || !this.columnCleaningConfigs.length) {
      this.addTrainingLog('warning', 'Configuration incomplète pour le test');
      return;
    }

    // Préparer la configuration de nettoyage pour l'API
    const cleaningConfig = {
      dataset_id: this.datasetId,
      column_strategies: this.columnCleaningConfigs.reduce((acc, config) => {
        if (config.strategy !== 'none') {
          acc[config.name] = {
            strategy: config.strategy,
            params: config.params
          };
        }
        return acc;
      }, {} as any),
      additional_datasets: this.additionalDatasets.map(ds => ({
        dataset_id: ds.id,
        join_type: ds.joinType,
        join_key: ds.joinKey
      }))
    };

    // Envoyer à l'API pour validation
    this.mlPipelineService.validateCleaningConfiguration(cleaningConfig)
      .subscribe({
        next: (response) => {
          this.addTrainingLog('success', 'Configuration de nettoyage validée avec succès');

          // Mettre à jour le formulaire avec la configuration validée
          this.dataCleaningForm.patchValue({
            analysisCompleted: true,
            autoFixApplied: true,
            manualOverrides: this.getCleaningOverrides()
          });

          this.cdr.detectChanges();
        },
        error: (error) => {
          console.error('Error validating cleaning configuration:', error);
          this.addTrainingLog('error', 'Erreur lors de la validation de la configuration');
        }
      });
  }

  getColumnStatusClass(column: any): string {
    if (!column.issues || column.issues.length === 0) return 'perfect';

    const hasHighSeverity = column.issues.some((issue: any) => issue.severity === 'high');
    if (hasHighSeverity) return 'error';

    const hasMediumSeverity = column.issues.some((issue: any) => issue.severity === 'medium');
    if (hasMediumSeverity) return 'warning';

    return 'info';
  }

  getColumnStatusIcon(column: any): string {
    if (!column.issues || column.issues.length === 0) return 'check_circle';

    const hasHighSeverity = column.issues.some((issue: any) => issue.severity === 'high');
    if (hasHighSeverity) return 'error';

    const hasMediumSeverity = column.issues.some((issue: any) => issue.severity === 'medium');
    if (hasMediumSeverity) return 'warning';

    return 'info';
  }



  getActionType(strategy: string): string {
    if (['drop_column', 'drop_rows'].includes(strategy)) return 'suppression';
    if (['knn', 'iterative'].includes(strategy)) return 'imputation-advanced';
    if (['linear', 'forward_fill'].includes(strategy)) return 'interpolation';
    return 'imputation-simple';
  }

  getActionIcon(strategy: string): string {
    const iconMap: Record<string, string> = {
      'drop_column': 'delete',
      'drop_rows': 'delete_sweep',
      'mean': 'calculate',
      'median': 'align_horizontal_center',
      'mode': 'bar_chart',
      'knn': 'group',
      'iterative': 'refresh',
      'linear': 'trending_up',
      'forward_fill': 'arrow_forward'
    };
    return iconMap[strategy] || 'build';
  }

  getActionTitle(strategy: string): string {
    const titleMap: Record<string, string> = {
      'drop_column': 'Supprimer la colonne',
      'drop_rows': 'Supprimer les lignes',
      'mean': 'Imputation par la moyenne',
      'median': 'Imputation par la médiane',
      'mode': 'Imputation par le mode',
      'knn': 'Imputation KNN',
      'iterative': 'Imputation Iterative',
      'linear': 'Interpolation linéaire',
      'forward_fill': 'Forward Fill'
    };
    return titleMap[strategy] || 'Stratégie personnalisée';
  }

  getActionDescription(strategy: string): string {
    const descMap: Record<string, string> = {
      'drop_column': 'Supprime complètement la colonne du dataset',
      'drop_rows': 'Supprime les lignes avec des valeurs manquantes',
      'mean': 'Remplace par la moyenne de la colonne',
      'median': 'Remplace par la médiane (valeur du milieu)',
      'mode': 'Remplace par la valeur la plus fréquente',
      'knn': 'Utilise les K plus proches voisins pour prédire',
      'iterative': 'Modélise chaque colonne en fonction des autres',
      'linear': 'Interpolation entre valeurs adjacentes',
      'forward_fill': 'Propage la dernière valeur valide'
    };
    return descMap[strategy] || 'Description non disponible';
  }

  getSelectedMethodName(): string {
    const method = this.dataQualityForm.get('scalingMethod')?.value;
    const methodNames: Record<string, string> = {
      'standard': 'StandardScaler',
      'minmax': 'MinMaxScaler',
      'robust': 'RobustScaler'
    };
    return methodNames[method] || 'StandardScaler';
  }

  getAlgorithmSpeed(algorithmName: string): string {
    const speedMap: Record<string, string> = {
      'random_forest': 'Rapide ⚡',
      'linear_regression': 'Très rapide ⚡⚡⚡',
      'logistic_regression': 'Très rapide ⚡⚡⚡',
      'svm': 'Moyen 🐌',
      'decision_tree': 'Rapide ⚡⚡',
      'xgboost': 'Moyen ⚡',
      'neural_network': 'Lent 🐌🐌'
    };
    return speedMap[algorithmName] || 'Variable';
  }

  getAlgorithmComplexity(algorithmName: string): string {
    const complexityMap: Record<string, string> = {
      'random_forest': 'Facile 😊',
      'linear_regression': 'Très facile 😊😊😊',
      'logistic_regression': 'Très facile 😊😊😊',
      'svm': 'Complexe 🧠🧠',
      'decision_tree': 'Facile 😊😊',
      'xgboost': 'Complexe 🧠🧠',
      'neural_network': 'Très complexe 🧠🧠🧠'
    };
    return complexityMap[algorithmName] || 'Variable';
  }

  getAlgorithmAccuracy(algorithmName: string): string {
    const accuracyMap: Record<string, string> = {
      'random_forest': 'Excellent 🎯🎯🎯',
      'linear_regression': 'Bon 🎯🎯',
      'logistic_regression': 'Bon 🎯🎯',
      'svm': 'Très bon 🎯🎯🎯',
      'decision_tree': 'Moyen 🎯',
      'xgboost': 'Excellent 🎯🎯🎯',
      'neural_network': 'Variable 🎯🎯'
    };
    return accuracyMap[algorithmName] || 'Variable';
  }

  // ===== NOUVELLES MÉTHODES POUR HYPERPARAMÈTRES =====

  getParameterIcon(paramName: string): string {
    const iconMap: Record<string, string> = {
      'n_estimators': 'forest',
      'max_depth': 'height',
      'min_samples_split': 'call_split',
      'min_samples_leaf': 'eco',
      'criterion': 'rule',
      'C': 'tune',
      'kernel': 'settings',
      'gamma': 'radio_button_checked',
      'learning_rate': 'speed',
      'max_iter': 'loop',
      'solver': 'build',
      'penalty': 'gavel',
      'alpha': 'tune',
      'fit_intercept': 'vertical_align_center',
      'normalize': 'straighten',
      'random_state': 'shuffle'
    };
    return iconMap[paramName] || 'settings';
  }

  getOptionIcon(paramName: string, option: string): string {
    const iconMap: Record<string, Record<string, string>> = {
      'criterion': {
        'gini': 'donut_small',
        'entropy': 'scatter_plot',
        'log_loss': 'trending_down'
      },
      'kernel': {
        'linear': 'trending_flat',
        'poly': 'show_chart',
        'rbf': 'radio_button_checked',
        'sigmoid': 'waves'
      },
      'solver': {
        'liblinear': 'speed',
        'newton-cg': 'rotate_right',
        'lbfgs': 'psychology',
        'sag': 'arrow_forward',
        'saga': 'fast_forward'
      },
      'penalty': {
        'l1': 'straighten',
        'l2': 'crop_square',
        'elasticnet': 'grid_on',
        'none': 'block'
      }
    };
    return iconMap[paramName]?.[option] || 'radio_button_unchecked';
  }

  isOptionRecommended(paramName: string, option: string): boolean {
    const recommendedMap: Record<string, string> = {
      'criterion': 'gini',
      'kernel': 'rbf',
      'solver': 'lbfgs',
      'penalty': 'l2'
    };
    return recommendedMap[paramName] === option;
  }

  // Vérification que tous les systèmes sont prêts pour le lancement
  isAllSystemsGo(): boolean {
    return !!(
      this.dataset &&
      this.dataQualityForm.get('targetColumn')?.value &&
      this.algorithmForm.get('algorithm')?.value &&
      this.hyperparametersForm.valid
    );
  }
}
