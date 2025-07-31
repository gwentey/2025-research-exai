import { Component, OnInit, ViewChild, ChangeDetectorRef, AfterViewInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
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
import { HyperparameterConfig, AlgorithmInfo, ExperimentCreate } from '../../../models/ml-pipeline.models';
import { DatasetDetailView } from '../../../models/dataset.models';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { finalize } from 'rxjs/operators';
import { Chart, registerables } from 'chart.js';
import { trigger, transition, style, animate } from '@angular/animations';

Chart.register(...registerables);

@Component({
  selector: 'app-ml-pipeline-wizard',
  standalone: true,
  imports: [
    CommonModule,
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
    ])
  ]
})
export class MlPipelineWizardComponent implements OnInit, AfterViewInit {
  @ViewChild('stepper') stepper!: MatStepper;
  
  // Forms for each step
  datasetForm!: FormGroup;
  dataQualityForm!: FormGroup;
  algorithmForm!: FormGroup;
  hyperparametersForm!: FormGroup;
  summaryForm!: FormGroup;
  
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
  
  // UI State
  isLoading = true;
  isTraining = false;
  trainingProgress = 0;
  
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
    private cdr: ChangeDetectorRef
  ) {}
  
  ngOnInit() {
    // Initialize forms first
    this.initializeForms();
    
    // Get route parameters
    this.projectId = this.route.snapshot.parent?.params['id'] || '';
    
    // Check if coming from dataset selection
    this.route.queryParams.subscribe(params => {
      this.datasetId = params['datasetId'] || '';
      const datasetName = params['datasetName'] || '';
      
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
      datasetId: [this.datasetId, Validators.required],
      confirmed: [false, Validators.requiredTrue]
    });
    
    // Step 2: Data Configuration
    this.dataQualityForm = this.fb.group({
      targetColumn: ['', Validators.required],
      taskType: ['classification', Validators.required],
      missingValueStrategy: ['mean', Validators.required],
      featureScaling: [true],
      categoricalEncoding: ['onehot'],
      testSize: [20, [Validators.required, Validators.min(10), Validators.max(50)]]
    });
    
    // Step 3: Algorithm Selection
    this.algorithmForm = this.fb.group({
      algorithm: ['', Validators.required]
    });
    
    // Step 4: Hyperparameters (dynamic based on algorithm)
    this.hyperparametersForm = this.fb.group({});
    
    // Step 5: Summary
    this.summaryForm = this.fb.group({
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
          
          // Auto-suggest target column and task type based on dataset metadata
          this.suggestTargetAndTaskType(data);
        },
        error: (error) => {
          console.error('Error loading dataset:', error);
        }
      });
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
  
  startTraining() {
    if (!this.isFormValid()) {
      return;
    }
    
    this.isTraining = true;
    this.trainingProgress = 0;
    
    const experimentData = {
      project_id: this.projectId,
      dataset_id: this.datasetId,
      algorithm: this.algorithmForm.value.algorithm,
      hyperparameters: this.hyperparametersForm.value,
      preprocessing_config: {
        target_column: this.dataQualityForm.value.targetColumn,
        task_type: this.dataQualityForm.value.taskType,
        missing_values: {
          strategy: this.dataQualityForm.value.missingValueStrategy
        },
        scaling: this.dataQualityForm.value.featureScaling,
        encoding: this.dataQualityForm.value.categoricalEncoding,
        test_size: this.dataQualityForm.value.testSize / 100
      }
    };
    
    this.mlPipelineService.createExperiment(experimentData)
      .subscribe({
        next: (experiment) => {
          this.experimentId = experiment.id;
          this.pollTrainingStatus();
        },
        error: (error) => {
          console.error('Error starting training:', error);
          this.isTraining = false;
        }
      });
  }
  
  pollTrainingStatus() {
    const poll = setInterval(() => {
      this.mlPipelineService.getExperimentStatus(this.experimentId)
        .subscribe({
          next: (status) => {
            this.experimentStatus = status;
            this.trainingProgress = status.progress;
            
            if (status.status === 'completed') {
              clearInterval(poll);
              this.loadResults();
            } else if (status.status === 'failed') {
              clearInterval(poll);
              this.isTraining = false;
              console.error('Training failed:', status.error_message);
            }
          },
          error: (error) => {
            console.error('Error polling status:', error);
            clearInterval(poll);
            this.isTraining = false;
          }
        });
    }, 5000); // Poll every 5 seconds
  }
  
  loadResults() {
    this.mlPipelineService.getExperimentResults(this.experimentId)
      .subscribe({
        next: (results) => {
          this.experimentResults = results;
          this.isTraining = false;
        },
        error: (error) => {
          console.error('Error loading results:', error);
          this.isTraining = false;
        }
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
    return this.datasetForm.valid &&
           this.dataQualityForm.valid &&
           this.algorithmForm.valid &&
           this.hyperparametersForm.valid &&
           this.summaryForm.valid;
  }
  
  goBack() {
    const returnUrl = this.route.snapshot.queryParams['returnUrl'] || `/ml-pipeline`;
    this.router.navigateByUrl(returnUrl);
  }
  
  backToApp() {
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
    if (this.stepper && this.isCurrentStepValid()) {
      // Synchronize the forms with the stepper
      this.updateStepperForms();
      setTimeout(() => {
        this.stepper.next();
        this.cdr.detectChanges();
      });
    }
  }
  
  previousStep(): void {
    if (this.stepper) {
      setTimeout(() => {
        this.stepper.previous();
        this.cdr.detectChanges();
      });
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
  
  objectKeys = Object.keys;
}