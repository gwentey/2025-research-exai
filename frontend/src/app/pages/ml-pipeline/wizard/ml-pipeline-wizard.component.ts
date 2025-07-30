import { Component, OnInit, ViewChild } from '@angular/core';
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
import { trigger, transition, style, animate, query, stagger, keyframes } from '@angular/animations';

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
        style({ opacity: 0, transform: 'translateY(20px)' }),
        animate('0.5s ease-out', style({ opacity: 1, transform: 'translateY(0)' }))
      ])
    ]),
    trigger('slideIn', [
      transition(':enter', [
        style({ opacity: 0, transform: 'translateX(-30px)' }),
        animate('0.4s ease-out', style({ opacity: 1, transform: 'translateX(0)' }))
      ])
    ]),
    trigger('fadeInScale', [
      transition(':enter', [
        style({ opacity: 0, transform: 'scale(0.95)' }),
        animate('0.3s ease-out', style({ opacity: 1, transform: 'scale(1)' }))
      ])
    ]),
    trigger('scaleIn', [
      transition(':enter', [
        style({ opacity: 0, transform: 'scale(0.8)' }),
        animate('0.4s cubic-bezier(0.35, 0, 0.25, 1)', style({ opacity: 1, transform: 'scale(1)' }))
      ])
    ]),
    trigger('staggeredAnimation', [
      transition('* => *', [
        query(':enter', [
          style({ opacity: 0, transform: 'translateY(30px)' }),
          stagger(100, [
            animate('0.5s ease-out', style({ opacity: 1, transform: 'translateY(0)' }))
          ])
        ], { optional: true })
      ])
    ]),
    trigger('pulse', [
      transition('* => active', [
        animate('1s ease-in-out', keyframes([
          style({ transform: 'scale(1)' }),
          style({ transform: 'scale(1.05)' }),
          style({ transform: 'scale(1)' })
        ]))
      ])
    ]),
    trigger('fadeIn', [
      transition(':enter', [
        style({ opacity: 0 }),
        animate('0.5s ease-out', style({ opacity: 1 }))
      ])
    ])
  ]
})
export class MlPipelineWizardComponent implements OnInit {
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
  isLoading = false;
  isTraining = false;
  trainingProgress = 0;
  
  constructor(
    private fb: FormBuilder,
    private router: Router,
    private route: ActivatedRoute,
    private datasetService: DatasetService,
    private mlPipelineService: MlPipelineService,
    private translate: TranslateService
  ) {}
  
  ngOnInit() {
    // Get route parameters
    this.projectId = this.route.snapshot.parent?.params['id'] || '';
    
    // Check if coming from dataset selection
    this.route.queryParams.subscribe(params => {
      this.datasetId = params['datasetId'] || '';
      const datasetName = params['datasetName'] || '';
      
      // Initialize forms
      this.initializeForms();
      
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
  }
  
  initializeForms() {
    // Step 1: Dataset Overview
    this.datasetForm = this.fb.group({
      datasetId: [this.datasetId, Validators.required],
      confirmed: [false, Validators.requiredTrue]
    });
    
    // Step 2: Data Quality Analysis
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
    this.isLoading = true;
    this.datasetService.getDatasetDetails(this.datasetId)
      .pipe(finalize(() => this.isLoading = false))
      .subscribe({
        next: (data) => {
          this.dataset = data; // data is already the DatasetDetailView
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
          
          // Move to results step
          setTimeout(() => {
            this.renderCharts();
          }, 100);
        },
        error: (error) => {
          console.error('Error loading results:', error);
          this.isTraining = false;
        }
      });
  }
  
  renderCharts() {
    // Render visualizations using Chart.js
    // This will be implemented based on the results structure
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
    if (!this.stepper || this.stepper.selectedIndex === undefined) return 0;
    return ((this.stepper.selectedIndex + 1) / 5) * 100;
  }
  
  getCurrentStepNumber(): number {
    if (!this.stepper || this.stepper.selectedIndex === undefined) return 1;
    return this.stepper.selectedIndex + 1;
  }
  
  nextStep(): void {
    if (this.stepper && this.isCurrentStepValid()) {
      this.stepper.next();
    }
  }
  
  previousStep(): void {
    if (this.stepper) {
      this.stepper.previous();
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
  
  getMetricIcon(metric: string): string {
    const iconMap: { [key: string]: string } = {
      'accuracy': 'analytics',
      'precision': 'center_focus_strong',
      'recall': 'radar',
      'f1_score': 'score',
      'auc': 'trending_up'
    };
    return iconMap[metric.toLowerCase()] || 'bar_chart';
  }
  
  getTopHyperparameters(algo: AlgorithmInfo): string[] {
    return Object.keys(algo.hyperparameters || {});
  }
  
  displayWithPercent = (value: number): string => {
    return `${value}%`;
  }
  
  objectKeys = Object.keys;
} 