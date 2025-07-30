import { Component, OnInit, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { trigger, state, style, transition, animate, query, stagger, keyframes } from '@angular/animations';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSliderModule } from '@angular/material/slider';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatRadioModule } from '@angular/material/radio';
import { MatChipsModule } from '@angular/material/chips';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatDialogModule, MatDialog } from '@angular/material/dialog';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { Chart, registerables } from 'chart.js';
import { DatasetService } from '../../../services/dataset.service';
import { MlPipelineService } from '../../../services/ml-pipeline.service';
import { DatasetDetailView } from '../../../models/dataset.models';
import { AlgorithmInfo, ExperimentCreate } from '../../../models/ml-pipeline.models';
import { interval, Subscription } from 'rxjs';
import { takeWhile } from 'rxjs/operators';

Chart.register(...registerables);

@Component({
  selector: 'app-ml-studio',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatIconModule,
    MatButtonModule,
    MatCardModule,
    MatProgressBarModule,
    MatTooltipModule,
    MatSliderModule,
    MatSelectModule,
    MatFormFieldModule,
    MatInputModule,
    MatCheckboxModule,
    MatRadioModule,
    MatChipsModule,
    MatExpansionModule,
    MatSlideToggleModule,
    MatDialogModule,
    MatSnackBarModule,
    TranslateModule
  ],
  templateUrl: './ml-studio.component.html',
  styleUrls: ['./ml-studio.component.scss'],
  animations: [
    trigger('fadeIn', [
      transition(':enter', [
        style({ opacity: 0 }),
        animate('500ms ease-in', style({ opacity: 1 }))
      ])
    ]),
    trigger('slideInLeft', [
      transition(':enter', [
        style({ transform: 'translateX(-50px)', opacity: 0 }),
        animate('600ms cubic-bezier(0.35, 0, 0.25, 1)', 
          style({ transform: 'translateX(0)', opacity: 1 }))
      ])
    ]),
    trigger('slideInRight', [
      transition(':enter', [
        style({ transform: 'translateX(50px)', opacity: 0 }),
        animate('600ms cubic-bezier(0.35, 0, 0.25, 1)', 
          style({ transform: 'translateX(0)', opacity: 1 }))
      ])
    ]),
    trigger('expandCollapse', [
      state('collapsed', style({ height: '0px', minHeight: '0' })),
      state('expanded', style({ height: '*' })),
      transition('expanded <=> collapsed', animate('300ms cubic-bezier(0.4, 0.0, 0.2, 1)'))
    ]),
    trigger('progressAnimation', [
      transition(':enter', [
        animate('2000ms ease-out', keyframes([
          style({ width: '0%', offset: 0 }),
          style({ width: '{{progress}}%', offset: 1 })
        ]))
      ])
    ])
  ]
})
export class MlStudioComponent implements OnInit {
  @ViewChild('dataQualityChart') dataQualityChartRef!: ElementRef;
  
  projectId: string = '';
  datasetId: string = '';
  dataset: DatasetDetailView | null = null;
  algorithms: AlgorithmInfo[] = [];
  selectedAlgorithm: AlgorithmInfo | null = null;
  
  configForm!: FormGroup;
  isLoading = false;
  currentStep = 1;
  totalSteps = 4;
  
  // Training state
  isTraining = false;
  trainingProgress = 0;
  experimentId: string = '';
  trainingStatus: string = '';
  statusCheckSubscription?: Subscription;
  
  // UI state
  showAdvancedOptions = false;
  dataQualityChart: Chart | null = null;
  
  // Presets
  presets = [
    { id: 'quick', name: 'ML_STUDIO.PRESETS.QUICK', icon: 'flash_on', description: 'ML_STUDIO.PRESETS.QUICK_DESC' },
    { id: 'balanced', name: 'ML_STUDIO.PRESETS.BALANCED', icon: 'balance', description: 'ML_STUDIO.PRESETS.BALANCED_DESC' },
    { id: 'accurate', name: 'ML_STUDIO.PRESETS.ACCURATE', icon: 'stars', description: 'ML_STUDIO.PRESETS.ACCURATE_DESC' }
  ];
  selectedPreset = 'balanced';
  
  constructor(
    private fb: FormBuilder,
    private router: Router,
    private route: ActivatedRoute,
    private datasetService: DatasetService,
    private mlPipelineService: MlPipelineService,
    private translate: TranslateService,
    private dialog: MatDialog,
    private snackBar: MatSnackBar
  ) {}
  
  ngOnInit() {
    this.projectId = this.route.snapshot.parent?.params['id'] || '';
    
    this.route.queryParams.subscribe(params => {
      this.datasetId = params['datasetId'] || '';
      if (this.datasetId) {
        this.loadDataset();
      }
    });
    
    this.initializeForm();
    this.loadAlgorithms();
  }
  
  initializeForm() {
    this.configForm = this.fb.group({
      // Étape 1: Configuration données
      targetColumn: ['', Validators.required],
      taskType: ['classification', Validators.required],
      testSize: [20, [Validators.required, Validators.min(10), Validators.max(50)]],
      
      // Étape 2: Prétraitement
      missingValueStrategy: ['mean', Validators.required],
      featureScaling: [true],
      encoding: ['onehot'],
      removeOutliers: [false],
      outlierThreshold: [1.5],
      
      // Étape 3: Algorithme
      algorithm: ['', Validators.required],
      
      // Étape 4: Hyperparamètres (dynamiques)
      hyperparameters: this.fb.group({})
    });
  }
  
  loadDataset() {
    this.isLoading = true;
    this.datasetService.getDatasetDetails(this.datasetId).subscribe({
      next: (dataset: any) => {
        this.dataset = dataset;
        this.analyzeDataQuality();
        this.suggestTargetColumn();
        this.isLoading = false;
      },
      error: () => {
        this.isLoading = false;
        this.showError('ML_STUDIO.ERRORS.LOAD_DATASET');
      }
    });
  }
  
  loadAlgorithms() {
    this.mlPipelineService.getAvailableAlgorithms().subscribe({
      next: (algorithms) => {
        this.algorithms = algorithms;
      }
    });
  }
  
  analyzeDataQuality() {
    if (!this.dataset) return;
    
    // Simuler l'analyse de qualité des données
    setTimeout(() => {
      this.createDataQualityChart();
    }, 500);
  }
  
  createDataQualityChart() {
    if (!this.dataQualityChartRef) return;
    
    const ctx = this.dataQualityChartRef.nativeElement.getContext('2d');
    
    // Simuler des scores de qualité
    const qualityScores = {
      completeness: Math.random() * 30 + 70,
      accuracy: Math.random() * 20 + 80,
      consistency: Math.random() * 25 + 75,
      validity: Math.random() * 20 + 80,
      uniqueness: Math.random() * 15 + 85
    };
    
    this.dataQualityChart = new Chart(ctx, {
      type: 'radar',
      data: {
        labels: Object.keys(qualityScores).map(key => 
          this.translate.instant(`ML_STUDIO.DATA_QUALITY.${key.toUpperCase()}`)
        ),
        datasets: [{
          label: this.translate.instant('ML_STUDIO.DATA_QUALITY.SCORE'),
          data: Object.values(qualityScores),
          fill: true,
          backgroundColor: 'rgba(102, 126, 234, 0.2)',
          borderColor: 'rgb(102, 126, 234)',
          pointBackgroundColor: 'rgb(102, 126, 234)',
          pointBorderColor: '#fff',
          pointHoverBackgroundColor: '#fff',
          pointHoverBorderColor: 'rgb(102, 126, 234)'
        }]
      },
      options: {
        elements: {
          line: {
            borderWidth: 3
          }
        },
        scales: {
          r: {
            beginAtZero: true,
            max: 100,
            ticks: {
              stepSize: 20
            }
          }
        },
        plugins: {
          legend: {
            display: false
          }
        }
      }
    });
  }
  
  suggestTargetColumn() {
    if (!this.dataset || !this.dataset.columns || this.dataset.columns.length === 0) return;
    
    // Logique simple pour suggérer la colonne cible
    const lastColumn = this.dataset.columns[this.dataset.columns.length - 1];
    if (lastColumn) {
      this.configForm.patchValue({
        targetColumn: lastColumn.name
      });
    }
  }
  
  getFilteredAlgorithms(): AlgorithmInfo[] {
    const taskType = this.configForm.get('taskType')?.value;
    
    return this.algorithms.filter(algo => {
      if (taskType === 'classification') {
        return algo.supports_classification;
      } else {
        return algo.supports_regression;
      }
    });
  }
  
  onAlgorithmSelect(algorithm: AlgorithmInfo) {
    this.selectedAlgorithm = algorithm;
    this.configForm.patchValue({ algorithm: algorithm.name });
    
    // Mettre à jour les hyperparamètres
    this.updateHyperparametersForm();
  }
  
  updateHyperparametersForm() {
    if (!this.selectedAlgorithm) return;
    
    const hyperparamsGroup = this.fb.group({});
    
    Object.entries(this.selectedAlgorithm.hyperparameters).forEach(([key, config]) => {
      hyperparamsGroup.addControl(key, this.fb.control(config.default));
    });
    
    this.configForm.setControl('hyperparameters', hyperparamsGroup);
  }
  
  applyPreset(presetId: string) {
    this.selectedPreset = presetId;
    
    switch (presetId) {
      case 'quick':
        this.configForm.patchValue({
          testSize: 30,
          featureScaling: false,
          removeOutliers: false
        });
        if (this.selectedAlgorithm?.name === 'decision_tree') {
          this.configForm.get('hyperparameters')?.patchValue({
            max_depth: 3,
            min_samples_split: 5
          });
        }
        break;
        
      case 'balanced':
        this.configForm.patchValue({
          testSize: 20,
          featureScaling: true,
          removeOutliers: false
        });
        if (this.selectedAlgorithm?.name === 'random_forest') {
          this.configForm.get('hyperparameters')?.patchValue({
            n_estimators: 100,
            max_depth: 10
          });
        }
        break;
        
      case 'accurate':
        this.configForm.patchValue({
          testSize: 20,
          featureScaling: true,
          removeOutliers: true,
          outlierThreshold: 1.5
        });
        if (this.selectedAlgorithm?.name === 'random_forest') {
          this.configForm.get('hyperparameters')?.patchValue({
            n_estimators: 200,
            max_depth: 15,
            min_samples_split: 2
          });
        }
        break;
    }
  }
  
  nextStep() {
    if (this.currentStep < this.totalSteps) {
      this.currentStep++;
    }
  }
  
  previousStep() {
    if (this.currentStep > 1) {
      this.currentStep--;
    }
  }
  
  canProceed(): boolean {
    switch (this.currentStep) {
      case 1:
        return !!this.configForm.get('targetColumn')?.valid && 
               !!this.configForm.get('taskType')?.valid;
      case 2:
        return !!this.configForm.get('missingValueStrategy')?.valid;
      case 3:
        return !!this.configForm.get('algorithm')?.valid;
      case 4:
        return this.configForm.valid;
      default:
        return false;
    }
  }
  
  startTraining() {
    if (!this.configForm.valid || !this.dataset) return;
    
    const formValue = this.configForm.value;
    
    const experimentData: ExperimentCreate = {
      project_id: this.projectId,
      dataset_id: this.datasetId,
      algorithm: formValue.algorithm,
      hyperparameters: formValue.hyperparameters,
      preprocessing_config: {
        target_column: formValue.targetColumn,
        task_type: formValue.taskType,
        test_size: formValue.testSize / 100,
        missing_values: {
          strategy: formValue.missingValueStrategy
        },
        scaling: formValue.featureScaling,
        encoding: formValue.encoding
      }
    };
    
    this.isTraining = true;
    this.trainingProgress = 0;
    this.trainingStatus = 'ML_STUDIO.TRAINING.INITIALIZING';
    
    this.mlPipelineService.createExperiment(experimentData).subscribe({
      next: (experiment) => {
        this.experimentId = experiment.id;
        this.startProgressTracking();
        this.showSuccess('ML_STUDIO.TRAINING.STARTED');
      },
      error: () => {
        this.isTraining = false;
        this.showError('ML_STUDIO.ERRORS.START_TRAINING');
      }
    });
  }
  
  startProgressTracking() {
    this.statusCheckSubscription = interval(2000)
      .pipe(takeWhile(() => this.isTraining))
      .subscribe(() => {
        this.mlPipelineService.getExperimentStatus(this.experimentId).subscribe({
          next: (status) => {
            this.trainingProgress = status.progress || 0;
            
            switch (status.status) {
              case 'running':
                this.updateTrainingStatus();
                break;
              case 'completed':
                this.onTrainingComplete();
                break;
              case 'failed':
                this.onTrainingFailed(status.error_message);
                break;
            }
          }
        });
      });
  }
  
  updateTrainingStatus() {
    if (this.trainingProgress < 30) {
      this.trainingStatus = 'ML_STUDIO.TRAINING.LOADING_DATA';
    } else if (this.trainingProgress < 50) {
      this.trainingStatus = 'ML_STUDIO.TRAINING.PREPROCESSING';
    } else if (this.trainingProgress < 90) {
      this.trainingStatus = 'ML_STUDIO.TRAINING.TRAINING_MODEL';
    } else {
      this.trainingStatus = 'ML_STUDIO.TRAINING.FINALIZING';
    }
  }
  
  onTrainingComplete() {
    this.isTraining = false;
    this.trainingProgress = 100;
    this.trainingStatus = 'ML_STUDIO.TRAINING.COMPLETED';
    
    if (this.statusCheckSubscription) {
      this.statusCheckSubscription.unsubscribe();
    }
    
    this.showSuccess('ML_STUDIO.TRAINING.SUCCESS');
    
    // Rediriger vers les résultats après 2 secondes
    setTimeout(() => {
      this.router.navigate(['../experiment', this.experimentId], {
        relativeTo: this.route
      });
    }, 2000);
  }
  
  onTrainingFailed(error?: string) {
    this.isTraining = false;
    this.trainingStatus = 'ML_STUDIO.TRAINING.FAILED';
    
    if (this.statusCheckSubscription) {
      this.statusCheckSubscription.unsubscribe();
    }
    
    this.showError(error || 'ML_STUDIO.ERRORS.TRAINING_FAILED');
  }
  
  getDatasetColumns(): any[] {
    return this.dataset?.columns || [];
  }
  
  getHyperparameterType(config: any): string {
    return config.type || 'number';
  }
  
  showSuccess(message: string) {
    this.snackBar.open(this.translate.instant(message), '', {
      duration: 3000,
      panelClass: 'success-snackbar'
    });
  }
  
  showError(message: string) {
    this.snackBar.open(this.translate.instant(message), 'OK', {
      duration: 5000,
      panelClass: 'error-snackbar'
    });
  }
  
  formatTestSize(value: number): string {
    return `${value}%`;
  }
  
  getAlgorithmUseCases(algo: AlgorithmInfo): string[] {
    const useCases: { [key: string]: string[] } = {
      'decision_tree': [
        'Analyse de risque',
        'Diagnostic médical',
        'Classification client',
        'Détection de fraude'
      ],
      'random_forest': [
        'Prédiction de prix',
        'Analyse de sentiment',
        'Recommandation produit',
        'Scoring crédit'
      ]
    };
    
    return useCases[algo.name] || [];
  }
  
  getTopHyperparameters(algo: AlgorithmInfo): string[] {
    if (!algo.hyperparameters) return [];
    
    return Object.keys(algo.hyperparameters).slice(0, 3);
  }
  
  ngOnDestroy() {
    if (this.statusCheckSubscription) {
      this.statusCheckSubscription.unsubscribe();
    }
    
    if (this.dataQualityChart) {
      this.dataQualityChart.destroy();
    }
  }
}