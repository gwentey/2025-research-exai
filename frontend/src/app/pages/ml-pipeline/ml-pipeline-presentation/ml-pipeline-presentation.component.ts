import { Component, OnInit, OnDestroy, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatCardModule } from '@angular/material/card';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { MlPipelineService } from '../../../services/ml-pipeline.service';
import { AuthService } from '../../../services/auth.service';
import { ExperimentRead } from '../../../models/ml-pipeline.models';
import { UserRead } from '../../../models/auth.models';

interface MLConcept {
  id: string;
  name: string;
  description: string;
  icon: string;
}

interface Tutorial {
  id: string;
  title: string;
  duration: string;
  icon: string;
  url?: string;
}

interface ActivityItem {
  id: string;
  type: 'training' | 'completed' | 'failed' | 'started';
  title: string;
  description: string;
  timestamp: Date;
  actionUrl?: string;
}

interface FeatureImportance {
  name: string;
  importance: number;
}

interface Explanation {
  icon: string;
  factor: string;
  impact: string;
  contribution: string;
}

@Component({
  selector: 'app-ml-pipeline-presentation',
  standalone: true,
  imports: [
    CommonModule,
    MatButtonModule,
    MatIconModule,
    MatProgressBarModule,
    MatCardModule,
    TranslateModule
  ],
  templateUrl: './ml-pipeline-presentation.component.html',
  styleUrls: ['./ml-pipeline-presentation.component.scss']
})
export class MlPipelinePresentationComponent implements OnInit, OnDestroy, AfterViewInit {

  private intervals: any[] = [];

  // User data
  currentUser: UserRead | null = null;
  userCredits = 0;

  // Experiments data
  runningExperiments: ExperimentRead[] = [];
  completedExperiments: ExperimentRead[] = [];
  latestExperiment: ExperimentRead | null = null;

  // UI state
  focusedStep: number | null = null;

  // Stats
  userStats = {
    totalExperiments: 0,
    avgAccuracy: 0,
    bestAccuracy: 0,
    totalTime: 0
  };

  // Activity feed
  recentActivity: ActivityItem[] = [];

  // ML Concepts for education
  mlConcepts: MLConcept[] = [
    {
      id: 'classification',
      name: 'Classification',
      description: 'Predict categories (spam/not spam, buy/not buy)',
      icon: '🎯'
    },
    {
      id: 'regression',
      name: 'Regression',
      description: 'Predict numbers (price, temperature, score)',
      icon: '📈'
    },
    {
      id: 'feature-importance',
      name: 'Feature Importance',
      description: 'Which data columns matter most for predictions',
      icon: '⭐'
    },
    {
      id: 'overfitting',
      name: 'Overfitting',
      description: 'When model memorizes instead of learning patterns',
      icon: '🧠'
    },
    {
      id: 'cross-validation',
      name: 'Cross-Validation',
      description: 'Testing model reliability on different data splits',
      icon: '✅'
    },
    {
      id: 'hyperparameters',
      name: 'Hyperparameters',
      description: 'Settings that control how the AI learns',
      icon: '⚙️'
    }
  ];

  // Tutorials
  tutorials: Tutorial[] = [
    {
      id: 'intro',
      title: 'ML Pipeline Introduction',
      duration: '3:45',
      icon: 'play_circle'
    },
    {
      id: 'data-prep',
      title: 'Data Preparation Basics',
      duration: '5:12',
      icon: 'cleaning_services'
    },
    {
      id: 'algorithms',
      title: 'Choosing the Right Algorithm',
      duration: '4:30',
      icon: 'psychology'
    },
    {
      id: 'explainability',
      title: 'Understanding Predictions',
      duration: '6:20',
      icon: 'visibility'
    }
  ];

  // Sample XAI data for demo
  sampleFeatures: FeatureImportance[] = [
    { name: 'Purchase History', importance: 45 },
    { name: 'Website Time', importance: 28 },
    { name: 'Age', importance: 18 },
    { name: 'Location', importance: 9 }
  ];

  sampleExplanations: Explanation[] = [
    {
      icon: '🛒',
      factor: 'Purchase History',
      impact: 'Strong positive influence',
      contribution: '+45%'
    },
    {
      icon: '⏱️',
      factor: 'Time on Website',
      impact: 'Moderate positive influence',
      contribution: '+28%'
    },
    {
      icon: '👤',
      factor: 'Customer Age',
      impact: 'Slight positive influence',
      contribution: '+18%'
    }
  ];

    constructor(
    private router: Router,
    private translate: TranslateService,
    private mlPipelineService: MlPipelineService,
    private authService: AuthService
  ) {}

  ngOnInit(): void {
    this.loadUserData();
    this.loadExperiments();
    this.loadRecentActivity();
  }

  ngAfterViewInit(): void {
    // Component fully loaded
  }

  ngOnDestroy(): void {
    this.intervals.forEach(interval => clearInterval(interval));
  }

  // Data loading methods
  loadUserData(): void {
    this.authService.getCurrentUser().subscribe({
      next: (user) => {
        this.currentUser = user;
        this.userCredits = user.credits || 0;
      },
      error: (error) => console.error('Error loading user:', error)
    });
  }

  loadExperiments(): void {
    this.mlPipelineService.getUserExperiments().subscribe({
      next: (experiments) => {
        this.runningExperiments = experiments.filter(exp => exp.status === 'running' || exp.status === 'pending');
        this.completedExperiments = experiments.filter(exp => exp.status === 'completed');
        this.latestExperiment = experiments[0] || null;

        this.calculateUserStats(experiments);
      },
      error: (error) => console.error('Error loading experiments:', error)
    });
  }

  loadRecentActivity(): void {
    // Mock recent activity - in real app, this would come from an API
    this.recentActivity = [
      {
        id: '1',
        type: 'completed',
        title: 'Customer Classification Model',
        description: 'Training completed with 94% accuracy',
        timestamp: new Date(Date.now() - 10 * 60 * 1000), // 10 minutes ago
        actionUrl: '/ml-pipeline/experiments/1'
      },
      {
        id: '2',
        type: 'started',
        title: 'Sales Prediction Model',
        description: 'Training started with XGBoost algorithm',
        timestamp: new Date(Date.now() - 30 * 60 * 1000) // 30 minutes ago
      }
    ];
  }

  calculateUserStats(experiments: ExperimentRead[]): void {
    const completed = experiments.filter(exp => exp.status === 'completed');

    this.userStats = {
      totalExperiments: experiments.length,
      avgAccuracy: completed.length > 0 ? 94 : 0, // Mock data for now
      bestAccuracy: completed.length > 0 ? 97 : 0, // Mock data for now
      totalTime: completed.length * 3.5 // Mock: 3.5 minutes average per experiment
    };
  }

  // Pipeline step methods
  focusStep(stepIndex: number): void {
    this.focusedStep = stepIndex;
  }

  closeFocus(): void {
    this.focusedStep = null;
  }

  getStepTitle(stepIndex: number): string {
    const titles = [
      'Dataset Selection',
      'Data Cleaning',
      'Define Objective',
      'Data Division',
      'Feature Preparation',
      'Algorithm Selection',
      'Parameter Tuning',
      'Model Training'
    ];
    return titles[stepIndex] || 'Unknown Step';
  }

  getStepDescription(stepIndex: number): string {
    const descriptions = [
      'Choose your dataset from our catalog or upload your own. We automatically validate data quality and suggest improvements.',
      'Our AI detects data quality issues and suggests fixes. Handle missing values, outliers, and inconsistencies with one click.',
      'Define what you want to predict. Our system automatically determines the best machine learning approach (classification or regression).',
      'Split your data into training and testing sets. We use smart stratification to ensure representative samples.',
      'Prepare your features for training. Automatic encoding of categories, scaling of numbers, and selection of relevant features.',
      'Choose from our curated algorithms or let AutoML select the best one. Compare performance across different approaches.',
      'Fine-tune algorithm parameters for optimal performance. Our system automatically optimizes settings using cross-validation.',
      'Train your model with real-time progress tracking. Watch performance metrics and get explainable AI insights.'
    ];
    return descriptions[stepIndex] || 'No description available';
  }

  getStepFeatures(stepIndex: number): string[] {
    const features = [
      ['500+ curated datasets', 'Auto quality validation', 'Upload support (CSV, Excel, JSON)'],
      ['Smart missing value imputation', 'Outlier detection', 'Data consistency checks'],
      ['Visual target selection', 'Auto task type detection', 'Guided objective definition'],
      ['Stratified sampling', 'Custom split ratios', 'Preview before training'],
      ['Auto feature selection', 'Smart encoding', 'Scaling optimization'],
      ['AutoML recommendations', 'Algorithm comparison', 'Performance prediction'],
      ['Auto hyperparameter tuning', 'Cross-validation', 'Visual parameter controls'],
      ['Real-time training visualization', 'Built-in explainability (XAI)', 'Performance monitoring']
    ];
    return features[stepIndex] || [];
  }

  getActivityIcon(type: string): string {
    const icons: { [key: string]: string } = {
      'completed': 'check_circle',
      'training': 'hourglass_empty',
      'failed': 'error',
      'started': 'play_arrow'
    };
    return icons[type] || 'info';
  }

  getExperimentProgress(experiment: ExperimentRead): number {
    // Mock progress based on status
    switch(experiment.status) {
      case 'pending': return 0;
      case 'running': return Math.floor(Math.random() * 80) + 10; // 10-90%
      case 'completed': return 100;
      case 'failed': return 0;
      default: return 0;
    }
  }

  // Navigation and action methods
  startNewExperiment(): void {
    this.router.navigate(['/datasets']);
  }

  viewExperiments(): void {
    this.router.navigate(['/ml-pipeline/experiments']);
  }

  viewExperiment(experimentId: string): void {
    this.router.navigate(['/ml-pipeline/experiment', experimentId]);
  }

  continueLatest(): void {
    if (this.latestExperiment) {
      this.router.navigate(['/ml-pipeline/wizard'], {
        queryParams: { experimentId: this.latestExperiment.id }
      });
    }
  }

  refillCredits(): void {
    this.router.navigate(['/profile/credits-refill']);
  }

  viewTutorials(): void {
    // Navigate to tutorials section or open modal
    console.log('Opening tutorials');
  }

  viewAllActivity(): void {
    this.router.navigate(['/ml-pipeline/experiments']);
  }

  navigateToActivity(url: string): void {
    this.router.navigate([url]);
  }

  explainConcept(conceptId: string): void {
    console.log('Explaining concept:', conceptId);
    // Open concept explanation modal or navigate to guide
  }

  watchTutorial(tutorialId: string): void {
    console.log('Playing tutorial:', tutorialId);
    // Open video modal or navigate to tutorial
  }

  viewAllTutorials(): void {
    console.log('View all tutorials');
    // Navigate to tutorials page
  }
}
