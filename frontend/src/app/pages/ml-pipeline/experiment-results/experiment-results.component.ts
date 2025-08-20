import { Component, OnInit, OnDestroy, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { trigger, state, style, transition, animate } from '@angular/animations';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatTabsModule } from '@angular/material/tabs';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatChipsModule } from '@angular/material/chips';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDividerModule } from '@angular/material/divider';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { Chart, registerables, ChartConfiguration, ChartType } from 'chart.js';
import { MlPipelineService } from '../../../services/ml-pipeline.service';
import { SafeChartService } from '../../../services/safe-chart.service';
import { VisualizationManagerService } from '../../../services/visualization-manager.service';
import { ExperimentStatus, ExperimentResults, VisualizationType } from '../../../models/ml-pipeline.models';
import { VisualizationContainerComponent } from '../../../components/shared/visualization-container/visualization-container.component';

Chart.register(...registerables);

@Component({
  selector: 'app-experiment-results',
  standalone: true,
  imports: [
    CommonModule,
    MatIconModule,
    MatButtonModule,
    MatCardModule,
    MatTabsModule,
    MatProgressBarModule,
    MatChipsModule,
    MatTooltipModule,
    MatDividerModule,
    TranslateModule,
    VisualizationContainerComponent
  ],
  templateUrl: './experiment-results.component.html',
  styleUrls: ['./experiment-results.component.scss'],
  animations: [
    trigger('fadeIn', [
      transition(':enter', [
        style({ opacity: 0 }),
        animate('600ms ease-in', style({ opacity: 1 }))
      ])
    ]),
    trigger('slideUp', [
      transition(':enter', [
        style({ transform: 'translateY(50px)', opacity: 0 }),
        animate('600ms cubic-bezier(0.35, 0, 0.25, 1)',
          style({ transform: 'translateY(0)', opacity: 1 }))
      ])
    ])
  ]
})
export class ExperimentResultsComponent implements OnInit, OnDestroy, AfterViewInit {
  experimentId: string = '';
  projectId: string = '';
  experiment: ExperimentStatus | null = null; // ✅ Interface corrigée avec algorithm
  results: ExperimentResults | null = null;
  isLoading = true;

  // Exposer l'enum pour le template
  readonly VisualizationType = VisualizationType;

  // Charts interactifs
  confusionMatrixChart: Chart | null = null;
  rocCurveChart: Chart | null = null;
  featureImportanceChart: Chart | null = null;
  decisionTreeChart: Chart | null = null;
  predictionsChart: Chart | null = null;
  performanceChart: Chart | null = null;
  metricCharts: { [key: string]: Chart } = {};

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private mlPipelineService: MlPipelineService,
    private translate: TranslateService,
    private safeChartService: SafeChartService,
    private visualizationManager: VisualizationManagerService
  ) {}

  ngOnInit() {
    this.experimentId = this.route.snapshot.params['id'];

    // Essayer différentes façons de récupérer le projectId
    this.projectId = this.route.snapshot.parent?.parent?.params['id'] ||
                     this.route.snapshot.parent?.params['projectId'] ||
                     this.route.snapshot.queryParams['projectId'] || '';

    console.log('🎯 Experiment Results Page - Debug info:');
    console.log('- Experiment ID:', this.experimentId);
    console.log('- Project ID:', this.projectId);
    console.log('- Route params:', this.route.snapshot.params);
    console.log('- Route parent params:', this.route.snapshot.parent?.params);
    console.log('- Route parent.parent params:', this.route.snapshot.parent?.parent?.params);
    console.log('- Query params:', this.route.snapshot.queryParams);

    if (!this.experimentId) {
      console.error('❌ No experiment ID found in route!');
      this.isLoading = false;
      return;
    }

    // Si projectId toujours vide, extraire de l'URL
    if (!this.projectId) {
      const url = this.router.url;
      console.log('📍 Current URL:', url);
      const urlParts = url.split('/');
      const projectIndex = urlParts.indexOf('projects');
      if (projectIndex !== -1 && urlParts[projectIndex + 1]) {
        this.projectId = urlParts[projectIndex + 1];
        console.log('✅ Extracted projectId from URL:', this.projectId);
      }
    }

    this.loadExperimentDetails();
  }

  ngAfterViewInit() {
    // Les graphiques seront créés après chargement des données
  }

  ngOnDestroy() {
    // Nettoyer tous les graphiques lors de la destruction
    this.destroyExistingCharts();
    this.safeChartService.destroyAllCharts();
  }

  loadExperimentDetails() {
    console.log('📊 Loading experiment details for ID:', this.experimentId);

    this.mlPipelineService.getExperimentStatus(this.experimentId).subscribe({
      next: (status) => {
                console.log('✅ Experiment status loaded:', status);
        console.log('🔍 Algorithm in status:', status.algorithm);
        this.experiment = status;

        // Stocker l'algorithme pour être sûr
        if (status.algorithm) {
          console.log('✅ Algorithm found:', status.algorithm);
        } else {
          console.warn('⚠️ No algorithm in experiment status!');
        }

        if (status.status === 'completed') {
          console.log('🎯 Experiment completed, loading results...');
          this.loadResults();
        } else {
          console.log('⏳ Experiment not completed yet, status:', status.status);
          this.isLoading = false;
        }
      },
      error: (error) => {
        console.error('❌ Error loading experiment details:', error);
        this.isLoading = false;
      }
    });
  }

  loadResults() {
    console.log('📈 Loading experiment results for ID:', this.experimentId);

    this.mlPipelineService.getExperimentResults(this.experimentId).subscribe({
      next: (results) => {
        console.log('✅ Results loaded successfully:', results);
        this.results = results;
        this.isLoading = false;

        // Créer les visualisations après un court délai
        console.log('🎨 Creating hybrid visualization charts...');
        setTimeout(() => {
          this.createVisualizationCharts().then(() => {
            console.log('✅ Hybrid charts created successfully');
          }).catch((error: Error) => {
            console.error('❌ Error creating hybrid charts:', error);
          });
        }, 100);
      },
      error: (error) => {
        console.error('❌ Error loading results:', error);
        this.isLoading = false;
      }
    });
  }

  async createVisualizationCharts(): Promise<void> {
    console.log('🎨 Starting hybrid visualization creation...');

    if (!this.results) {
      console.warn('⚠️ No results available for charts');
      return;
    }

    // Nettoyer les graphiques existants
    console.log('🧹 Cleaning existing charts...');
    this.destroyExistingCharts();

    // Attendre que le DOM soit prêt
    setTimeout(async () => {
      try {
        console.log('📊 Creating safe metric charts...');
        await this.createSafeMetricCharts();

        console.log('🌳 Creating hybrid algorithm-specific charts...');
        await this.createHybridAlgorithmCharts();

        console.log('📈 Creating hybrid common visualization charts...');
        await this.createHybridCommonCharts();

        console.log('✅ Hybrid visualization system initialized!');
      } catch (error) {
        console.error('❌ Error in hybrid chart creation:', error);
      }
    }, 200);
  }

  destroyExistingCharts() {
    // Utiliser le SafeChartService pour le cleanup complet
    this.safeChartService.destroyAllCharts();

    // Cleanup des références locales
    Object.values(this.metricCharts).forEach(chart => {
      try {
        chart?.destroy();
      } catch (error) {
        console.warn('⚠️ Error destroying metric chart:', error);
      }
    });
    this.metricCharts = {};

    // Cleanup sécurisé des autres charts
    [this.confusionMatrixChart, this.rocCurveChart, this.featureImportanceChart,
     this.decisionTreeChart, this.predictionsChart, this.performanceChart].forEach(chart => {
      try {
        chart?.destroy();
      } catch (error) {
        console.warn('⚠️ Error destroying chart:', error);
      }
    });

    this.confusionMatrixChart = null;
    this.rocCurveChart = null;
    this.featureImportanceChart = null;
    this.decisionTreeChart = null;
    this.predictionsChart = null;
    this.performanceChart = null;
  }

  // Nouvelle méthode sécurisée pour créer les métriques charts
  async createSafeMetricCharts(): Promise<void> {
    if (!this.results?.metrics) {
      console.warn('⚠️ No metrics available for charts');
      return;
    }

    console.log('📊 Creating safe metric charts for metrics:', Object.keys(this.results.metrics));

    for (const [key, value] of Object.entries(this.results.metrics)) {
      if (typeof value !== 'number') continue;

      const canvasId = `metric-chart-${key}`;
      console.log(`🎨 Creating safe chart for ${key}:`, { canvasId, value });

        try {
                const chartConfig: ChartConfiguration<'doughnut'> = {
          type: 'doughnut',
          data: {
            datasets: [{
              data: [value * 100, (1 - value) * 100],
              backgroundColor: [
                this.getMetricGradient(value),
                '#f1f5f9'
              ],
              borderWidth: 0
            }]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: '75%',
            plugins: {
              legend: { display: false },
              tooltip: { enabled: false }
            }
          }
        };

        const chart = await this.safeChartService.createSafeChart({
          canvasId,
          chartConfig,
          timeout: 3000 // Timeout plus court pour les métriques simples
        });

        if (chart) {
          this.metricCharts[key] = chart;
          console.log(`✅ Safe chart created for ${key}`);
        }

        } catch (error) {
        console.error(`❌ Error creating safe chart for ${key}:`, error);
      }
    }
  }

  // Nouvelles méthodes hybrides pour l'approche sécurisée
  async createHybridAlgorithmCharts(): Promise<void> {
    const algorithm = this.experiment?.algorithm;

    if (!algorithm) {
      console.warn('⚠️ No algorithm found for hybrid charts');
      return;
    }

    console.log(`🔍 Creating hybrid charts for algorithm: ${algorithm}`);

    switch (algorithm) {
      case 'random_forest':
        await this.createHybridFeatureImportance();
        break;
      case 'decision_tree':
        await this.createHybridDecisionTree();
        break;
      case 'logistic_regression':
        await this.createHybridLogisticRegression();
        break;
      default:
        console.log('📊 Creating generic hybrid chart for algorithm:', algorithm);
        await this.createHybridGenericChart();
    }
  }

  async createHybridCommonCharts(): Promise<void> {
    console.log('📈 Creating hybrid common visualization charts...');

    // Ces graphiques sont problématiques avec Chart.js, donc priorité aux images backend
    const problematicCharts = [
      VisualizationType.CONFUSION_MATRIX,
      VisualizationType.ROC_CURVE,
      VisualizationType.PREDICTIONS_DISTRIBUTION,
      VisualizationType.PERFORMANCE_TIMELINE
    ];

    for (const chartType of problematicCharts) {
      await this.createHybridVisualization(chartType);
    }
  }

  async createHybridFeatureImportance(): Promise<void> {
    console.log('🌲 Creating hybrid feature importance chart...');

    // Feature importance est problématique avec Chart.js (bar chart horizontal)
    // Priorité à l'image backend
    const hasBackendImage = this.hasVisualization('feature_importance');

    if (hasBackendImage) {
      console.log('✅ Using backend-generated feature importance image');
      return; // L'image sera affichée par le template
    }

    // Fallback vers Chart.js sécurisé avec données réelles
    console.log('🔄 Fallback to safe Chart.js for feature importance');
    await this.createSafeFeatureImportanceChart();
  }

  async createHybridDecisionTree(): Promise<void> {
    console.log('🌳 Creating hybrid decision tree chart...');

    const hasBackendImage = this.hasVisualization('decision_tree');

    if (hasBackendImage) {
      console.log('✅ Using backend-generated decision tree image');
      return;
    }

    // Fallback Chart.js pour structure simple
    await this.createSafeDecisionTreeChart();
  }

  async createHybridLogisticRegression(): Promise<void> {
    console.log('📈 Creating hybrid logistic regression charts...');

    // Toutes les visualisations logistic regression sont complexes
    // Privilégier les images backend
    if (this.hasVisualization('probability_curve')) {
      console.log('✅ Using backend-generated probability curve');
      return;
    }

    console.log('🔄 No backend visualization available for logistic regression');
  }

  async createHybridGenericChart(): Promise<void> {
    console.log('🎨 Creating hybrid generic chart...');

    // Chart générique simple et sûr (radar chart)
    await this.createSafeGenericChart();
  }

  async createHybridVisualization(chartType: VisualizationType): Promise<void> {
    console.log(`🎯 Creating hybrid visualization for ${chartType}`);

    const strategy = this.visualizationManager.getVisualizationStrategy(
      chartType,
      this.experiment?.algorithm || 'unknown',
      this.hasVisualization(chartType)
    );

    console.log(`📊 Strategy selected for ${chartType}: ${strategy}`);

    switch (strategy) {
      case 'backend-image':
        console.log(`🖼️ Using backend image for ${chartType}`);
        break;

      case 'chartjs':
        console.log(`📊 Using safe Chart.js for ${chartType}`);
        await this.createSafeChartForType(chartType);
        break;

      case 'fallback':
      default:
        console.log(`⚠️ Using fallback for ${chartType}`);
        break;
    }
  }

  async createSafeChartForType(chartType: VisualizationType): Promise<void> {
    switch (chartType) {
      case VisualizationType.CONFUSION_MATRIX:
        await this.createSafeConfusionMatrixChart();
        break;
      case VisualizationType.ROC_CURVE:
        await this.createSafeROCCurveChart();
        break;
      default:
        console.warn(`⚠️ No safe Chart.js implementation for ${chartType}`);
    }
  }

  async createSafeFeatureImportanceChart(): Promise<void> {
    const canvasId = 'featureImportanceChart';

    // Utiliser les vraies données si disponibles
    const featureData = this.results?.feature_importance || {};
    const features = Object.keys(featureData);
    const importance = Object.values(featureData) as number[];

    // Fallback vers données d'exemple si pas de vraies données
    const labels = features.length > 0 ? features : ['Feature 1', 'Feature 2', 'Feature 3', 'Feature 4', 'Feature 5'];
    const data = importance.length > 0 ? importance : [0.35, 0.25, 0.18, 0.12, 0.10];

    const chartConfig: ChartConfiguration = {
      type: 'bar', // Garder bar simple (pas indexAxis: 'y' qui est problématique)
      data: {
        labels,
        datasets: [{
          label: 'Importance',
          data,
          backgroundColor: '#667eea',
          borderRadius: 8,
          borderSkipped: false
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          title: {
            display: true,
            text: 'Importance des variables (mode sécurisé)'
          },
          legend: { display: false }
        },
        scales: {
          y: {
            beginAtZero: true,
            title: {
              display: true,
              text: 'Score d\'importance'
            }
          }
        }
      }
    };

    try {
      const chart = await this.safeChartService.createSafeChart({
        canvasId,
        chartConfig,
        timeout: 4000
      });

      if (chart) {
        this.featureImportanceChart = chart;
        console.log('✅ Safe feature importance chart created');
      }
    } catch (error) {
      console.error('❌ Failed to create safe feature importance chart:', error);
    }
  }

  async createSafeDecisionTreeChart(): Promise<void> {
    const canvasId = 'decisionTreeChart';

    const treeData = {
      labels: ['Racine', 'Nœud 1', 'Nœud 2', 'Feuille A', 'Feuille B', 'Feuille C'],
      datasets: [{
        label: 'Profondeur de l\'arbre',
        data: [0, 1, 1, 2, 2, 2],
        backgroundColor: ['#667eea', '#3b82f6', '#3b82f6', '#10b981', '#10b981', '#10b981'],
        borderColor: '#334155',
        borderWidth: 2
      }]
    };

    const chartConfig: ChartConfiguration = {
      type: 'bar',
      data: treeData,
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          title: {
            display: true,
            text: 'Structure de l\'arbre de décision (mode sécurisé)'
          },
          legend: { display: false }
        },
        scales: {
          y: {
            beginAtZero: true,
            title: {
              display: true,
              text: 'Profondeur'
            }
          }
        }
      }
    };

    try {
      const chart = await this.safeChartService.createSafeChart({
        canvasId,
        chartConfig,
        timeout: 3000
      });

      if (chart) {
        this.decisionTreeChart = chart;
        console.log('✅ Safe decision tree chart created');
      }
    } catch (error) {
      console.error('❌ Failed to create safe decision tree chart:', error);
    }
  }

  async createSafeGenericChart(): Promise<void> {
    const canvasId = 'featureImportanceChart';

    const metrics = this.results?.metrics || {};
    const metricNames = Object.keys(metrics);
    const metricValues = Object.values(metrics) as number[];

    if (metricNames.length === 0) {
      console.warn('⚠️ No metrics for generic chart');
      return;
    }

    const chartConfig: ChartConfiguration = {
      type: 'radar',
      data: {
        labels: metricNames.map(name => this.getMetricLabel(name)),
        datasets: [{
          label: 'Performance du modèle',
          data: metricValues.map(val => (val || 0) * 100),
          backgroundColor: 'rgba(102, 126, 234, 0.2)',
          borderColor: '#667eea',
          borderWidth: 2,
          pointBackgroundColor: '#667eea'
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          title: {
            display: true,
            text: 'Vue d\'ensemble des métriques (mode sécurisé)'
          }
        },
        scales: {
          r: {
            beginAtZero: true,
            max: 100
          }
        }
      }
    };

    try {
      const chart = await this.safeChartService.createSafeChart({
        canvasId,
        chartConfig,
        timeout: 3000
      });

      if (chart) {
        this.featureImportanceChart = chart;
        console.log('✅ Safe generic chart created');
      }
    } catch (error) {
      console.error('❌ Failed to create safe generic chart:', error);
    }
  }

  async createSafeConfusionMatrixChart(): Promise<void> {
    const canvasId = 'confusionMatrixChart';

    // Données simplifiées pour éviter les problèmes Chart.js
    const chartConfig: ChartConfiguration = {
      type: 'doughnut', // Plus sûr que bar chart stacked
      data: {
        labels: ['Vrais Positifs', 'Faux Positifs', 'Vrais Négatifs', 'Faux Négatifs'],
        datasets: [{
          data: [120, 15, 155, 10], // Simulation données confusion matrix
          backgroundColor: ['#10b981', '#ef4444', '#3b82f6', '#f59e0b'],
          borderWidth: 0
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          title: {
            display: true,
            text: 'Résumé Matrice de Confusion (simplifié)'
          }
        }
      }
    };

    try {
      const chart = await this.safeChartService.createSafeChart({
        canvasId,
        chartConfig,
        timeout: 3000
      });

      if (chart) {
        this.confusionMatrixChart = chart;
        console.log('✅ Safe confusion matrix chart created');
      }
    } catch (error) {
      console.error('❌ Failed to create safe confusion matrix chart:', error);
    }
  }

  async createSafeROCCurveChart(): Promise<void> {
    console.log('⚠️ ROC Curve Chart.js is problematic - skipping for safety');
    // Cette méthode existe mais ne crée pas de chart pour éviter les plantages
    // L'image backend sera utilisée si disponible
  }

      createAlgorithmSpecificCharts() {
    // L'algorithme est seulement dans experiment (pas dans results)
    const algorithm = this.experiment?.algorithm;

    console.log('🔍 Algorithm detection:', {
      'from_experiment': this.experiment?.algorithm,
      'final_algorithm': algorithm
    });

    if (!algorithm) {
      console.warn('⚠️ No algorithm found - creating generic visualizations');
      // ⚠️ ROBUSTESSE : Fallback vers graphiques génériques
      this.createGenericAlgorithmChart();
      return;
    }

    switch (algorithm) {
      case 'decision_tree':
        console.log('🌳 Creating decision tree chart');
        this.createDecisionTreeChart();
        break;
      case 'random_forest':
        console.log('🌲 Creating random forest chart');
        this.createFeatureImportanceChart();
        break;
      case 'logistic_regression':
        console.log('📈 Creating logistic regression chart');
        this.createLogisticRegressionChart();
        break;
      default:
        console.log('📊 Creating generic chart for algorithm:', algorithm);
        this.createGenericAlgorithmChart();
    }
  }

  createGenericAlgorithmChart() {
    console.log('🎨 Creating generic algorithm visualization');

    const canvas = document.getElementById('featureImportanceChart') as HTMLCanvasElement;
    if (!canvas) return;

    // Graphique générique basé sur les métriques disponibles
    const metrics = this.results?.metrics || {};
    const metricNames = Object.keys(metrics);
    const metricValues = Object.values(metrics) as number[];

    if (metricNames.length > 0) {
      this.featureImportanceChart = new Chart(canvas, {
        type: 'radar',
        data: {
          labels: metricNames.map(name => this.getMetricLabel(name)),
          datasets: [{
            label: 'Performance du modèle',
            data: metricValues.map(val => (val || 0) * 100),
            backgroundColor: 'rgba(102, 126, 234, 0.2)',
            borderColor: '#667eea',
            borderWidth: 2,
            pointBackgroundColor: '#667eea'
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            title: {
              display: true,
              text: 'Vue d\'ensemble des métriques'
            }
          },
          scales: {
            r: {
              beginAtZero: true,
              max: 100
            }
          }
        }
      });
    }
  }

  createCommonVisualizationCharts() {
    this.createConfusionMatrixChart();
    this.createROCCurveChart();
    this.createPredictionsDistributionChart();
    this.createPerformanceTimelineChart();
  }

  createDecisionTreeChart() {
    const canvas = document.getElementById('decisionTreeChart') as HTMLCanvasElement;
    if (!canvas) return;

    // Simulation d'un arbre de décision simple
    const treeData = {
      labels: ['Racine', 'Nœud 1', 'Nœud 2', 'Feuille A', 'Feuille B', 'Feuille C'],
      datasets: [{
        label: 'Profondeur de l\'arbre',
        data: [0, 1, 1, 2, 2, 2],
        backgroundColor: [
          '#667eea',
          '#3b82f6',
          '#3b82f6',
          '#10b981',
          '#10b981',
          '#10b981'
        ],
        borderColor: '#334155',
        borderWidth: 2
      }]
    };

    this.decisionTreeChart = new Chart(canvas, {
      type: 'bar',
      data: treeData,
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          title: {
            display: true,
            text: 'Structure de l\'arbre de décision'
          },
          legend: { display: false }
        },
        scales: {
          y: {
            beginAtZero: true,
            title: {
              display: true,
              text: 'Profondeur'
            }
          }
        }
      }
    });
  }

  createFeatureImportanceChart() {
    const canvas = document.getElementById('featureImportanceChart') as HTMLCanvasElement;
    if (!canvas) return;

    // Simulation de l'importance des features
    const features = ['Feature 1', 'Feature 2', 'Feature 3', 'Feature 4', 'Feature 5'];
    const importance = [0.35, 0.25, 0.18, 0.12, 0.10];

    this.featureImportanceChart = new Chart(canvas, {
      type: 'bar',
      data: {
        labels: features,
        datasets: [{
          label: 'Importance',
          data: importance,
          backgroundColor: [
            '#667eea',
            '#764ba2',
            '#f093fb',
            '#f5576c',
            '#4facfe'
          ],
          borderRadius: 8,
          borderSkipped: false
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        indexAxis: 'y',
        plugins: {
          title: {
            display: true,
            text: 'Importance des variables dans la Random Forest'
          },
          legend: { display: false }
        },
        scales: {
          x: {
            beginAtZero: true,
            max: 0.4,
            title: {
              display: true,
              text: 'Score d\'importance'
            }
          }
        }
      }
    });
  }

  createLogisticRegressionChart() {
    // Chart pour régression logistique - courbe de probabilité
    const canvas = document.getElementById('logisticChart') as HTMLCanvasElement;
    if (!canvas) return;

    console.log('📊 Creating logistic regression chart');
  }

  createConfusionMatrixChart() {
    const canvas = document.getElementById('confusionMatrixChart') as HTMLCanvasElement;
    if (!canvas || !this.results?.metrics) return;

    // Simulation d'une matrice de confusion
    const confusionData = [
      [120, 15],  // Vraie classe 0
      [10, 155]   // Vraie classe 1
    ];

    // Transformation en format Chart.js
    const chartData = {
      labels: ['Prédite: Non', 'Prédite: Oui'],
      datasets: [
        {
          label: 'Vraie: Non',
          data: confusionData[0],
          backgroundColor: ['#10b981', '#ef4444']
        },
        {
          label: 'Vraie: Oui',
          data: confusionData[1],
          backgroundColor: ['#ef4444', '#10b981']
        }
      ]
    };

    this.confusionMatrixChart = new Chart(canvas, {
      type: 'bar',
      data: chartData,
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          title: {
            display: true,
            text: 'Matrice de confusion'
          }
        },
        scales: {
          x: { stacked: true },
          y: { stacked: true }
        }
      }
    });
  }

  createROCCurveChart() {
    const canvas = document.getElementById('rocCurveChart') as HTMLCanvasElement;
    if (!canvas) return;

    // Simulation d'une courbe ROC
    const rocPoints = [];
    for (let i = 0; i <= 100; i++) {
      const x = i / 100;
      const y = Math.min(1, x + 0.3 + Math.random() * 0.1);
      rocPoints.push({ x, y });
    }

    this.rocCurveChart = new Chart(canvas, {
      type: 'line',
      data: {
        datasets: [
          {
            label: 'Courbe ROC',
            data: rocPoints,
            borderColor: '#667eea',
            backgroundColor: 'rgba(102, 126, 234, 0.1)',
            fill: true,
            tension: 0.4
          },
          {
            label: 'Ligne de référence',
            data: [{ x: 0, y: 0 }, { x: 1, y: 1 }],
            borderColor: '#94a3b8',
            borderDash: [5, 5]
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          title: {
            display: true,
            text: `Courbe ROC (AUC = ${(this.results?.metrics?.roc_auc || 0.85).toFixed(3)})`
          }
        },
        scales: {
          x: {
            title: { display: true, text: 'Taux de faux positifs' },
            min: 0,
            max: 1
          },
          y: {
            title: { display: true, text: 'Taux de vrais positifs' },
            min: 0,
            max: 1
          }
        }
      }
    });
  }

  createPredictionsDistributionChart() {
    const canvas = document.getElementById('predictionsChart') as HTMLCanvasElement;
    if (!canvas) return;

    // Simulation de distribution des prédictions
    const distributionData = {
      labels: ['0.0-0.2', '0.2-0.4', '0.4-0.6', '0.6-0.8', '0.8-1.0'],
      datasets: [{
        label: 'Nombre de prédictions',
        data: [25, 45, 120, 180, 130],
        backgroundColor: '#667eea',
        borderColor: '#334155',
        borderRadius: 6
      }]
    };

    this.predictionsChart = new Chart(canvas, {
      type: 'bar',
      data: distributionData,
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          title: {
            display: true,
            text: 'Distribution des scores de prédiction'
          }
        }
      }
    });
  }

  createPerformanceTimelineChart() {
    const canvas = document.getElementById('performanceChart') as HTMLCanvasElement;
    if (!canvas) return;

    // Simulation de l'évolution des métriques pendant l'entraînement
    const timelineData = {
      labels: ['Époque 1', 'Époque 2', 'Époque 3', 'Époque 4', 'Époque 5'],
      datasets: [
        {
          label: 'Précision',
          data: [0.72, 0.76, 0.81, 0.85, 0.87],
          borderColor: '#10b981',
          backgroundColor: 'rgba(16, 185, 129, 0.1)',
          tension: 0.4
        },
        {
          label: 'Loss',
          data: [0.45, 0.35, 0.28, 0.21, 0.18],
          borderColor: '#ef4444',
          backgroundColor: 'rgba(239, 68, 68, 0.1)',
          tension: 0.4
        }
      ]
    };

    this.performanceChart = new Chart(canvas, {
      type: 'line',
      data: timelineData,
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          title: {
            display: true,
            text: 'Évolution des performances pendant l\'entraînement'
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            max: 1
          }
        }
      }
    });
  }

  getMetricIcon(metric: string): string {
    const icons: { [key: string]: string } = {
      'accuracy': 'speed',
      'precision': 'center_focus_strong',
      'recall': 'radar',
      'f1_score': 'balance',
      'mae': 'trending_down',
      'mse': 'show_chart',
      'rmse': 'insights',
      'r2': 'analytics'
    };

    return icons[metric] || 'assessment';
  }

  getMetricColor(value: number): string {
    if (value >= 0.9) return 'excellent';
    if (value >= 0.75) return 'good';
    if (value >= 0.6) return 'medium';
    return 'low';
  }

  getMetricGradient(value: number): string {
    if (value >= 0.9) return '#10b981'; // Vert excellent
    if (value >= 0.75) return '#3b82f6'; // Bleu bon
    if (value >= 0.6) return '#f59e0b'; // Orange moyen
    return '#ef4444'; // Rouge faible
  }

  getMetricLabel(key: string): string {
    const labels: { [key: string]: string } = {
      'accuracy': 'Précision',
      'precision': 'Précision',
      'recall': 'Rappel',
      'f1_score': 'Score F1',
      'roc_auc': 'AUC-ROC',
      'mae': 'Erreur absolue moyenne',
      'mse': 'Erreur quadratique moyenne',
      'rmse': 'RMSE',
      'r2': 'Coefficient R²'
    };
    return labels[key] || key;
  }

  getTrendClass(value: number): string {
    if (value >= 0.9) return 'trend-excellent';
    if (value >= 0.75) return 'trend-good';
    if (value >= 0.6) return 'trend-medium';
    return 'trend-low';
  }

  getTrendIcon(value: number): string {
    if (value >= 0.9) return 'trending_up';
    if (value >= 0.75) return 'trending_flat';
    return 'trending_down';
  }

  getTrendText(value: number): string {
    if (value >= 0.9) return 'Excellent';
    if (value >= 0.75) return 'Bon';
    if (value >= 0.6) return 'Moyen';
    return 'À améliorer';
  }

  formatMetricValue(key: string, value: any): string {
    if (typeof value !== 'number') return value;

    // Pour les métriques de classification (entre 0 et 1)
    if (['accuracy', 'precision', 'recall', 'f1_score', 'roc_auc'].includes(key)) {
      return (value * 100).toFixed(1) + '%';
    }

    // Pour les métriques de régression
    return value.toFixed(4);
  }

  getMetricsArray(): Array<{key: string, value: number}> {
    if (!this.results?.metrics) return [];

    return Object.entries(this.results.metrics)
      .filter(([_, value]) => value !== undefined && value !== null && typeof value === 'number')
      .map(([key, value]) => ({ key, value: value as number }));
  }

  getStatusColor(status: string): string {
    switch (status) {
      case 'completed': return 'primary';
      case 'running': return 'accent';
      case 'failed': return 'warn';
      default: return 'primary'; // Fallback pour éviter les erreurs
    }
  }

  // ⚠️ ROBUSTESSE : Getters sécurisés pour le template
  getAlgorithmDisplay(): string {
    return this.experiment?.algorithm ? this.experiment.algorithm : 'Non spécifié';
  }

  getStatusDisplay(): string {
    return this.experiment?.status ? this.experiment.status : 'Inconnu';
  }

  downloadModel() {
    if (this.results?.model_uri) {
      console.log('📥 Télécharger le modèle:', this.results.model_uri);
      // Implémenter le téléchargement du modèle
    }
  }

  goBack() {
    this.router.navigate(['../../wizard'], { relativeTo: this.route });
  }

  runNewExperiment() {
    this.router.navigate(['../../wizard'], {
      relativeTo: this.route,
      queryParams: {
        copyFrom: this.experimentId
      }
    });
  }

  // Méthode originale renommée pour éviter la duplication
  getVisualizationUrlOriginal(vizKey: string): string {
    if (!this.results?.visualizations || !this.results.visualizations[vizKey]) {
      return '';
    }

    const vizData = this.results.visualizations[vizKey];

    // Si c'est déjà une URL data:image base64
    if (typeof vizData === 'string') {
      if (vizData.startsWith('data:image')) {
        return vizData;
      }
      // Si c'est juste le chemin du fichier dans le storage
      return vizData;
    }

    // Si c'est un objet avec une propriété image
    if (vizData && typeof vizData === 'object' && 'image' in vizData) {
      return `data:image/png;base64,${(vizData as any).image}`;
    }

    return '';
  }

  formatDuration(start: string, end: string): string {
    const startDate = new Date(start);
    const endDate = new Date(end);
    const duration = endDate.getTime() - startDate.getTime();

    const minutes = Math.floor(duration / 60000);
    if (minutes < 60) {
      return `${minutes} min`;
    }

    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}h ${mins}min`;
  }

  // Méthodes pour l'approche hybride - vérifier la présence des visualizations
  hasVisualization(vizType: string): boolean {
    return !!(this.results?.visualizations && this.results.visualizations[vizType]);
  }

  hasBackendVisualization(vizType: string): boolean {
    return this.hasVisualization(vizType);
  }

      // Méthode unifiée pour obtenir l'URL de visualisation
  getVisualizationUrl(vizType: string): string {
    console.log(`🔍 Getting visualization URL for ${vizType}`, this.results?.visualizations);

    if (!this.hasVisualization(vizType)) {
      console.warn(`⚠️ No visualization data for ${vizType}`);
      return '';
    }

    const vizData = this.results?.visualizations?.[vizType];
    console.log(`📊 Visualization data for ${vizType}:`, vizData);

    if (!vizData) return '';

    // Si c'est déjà une URL data:image base64
    if (typeof vizData === 'string') {
      if (vizData.startsWith('data:image')) {
        console.log(`✅ Using base64 data URL for ${vizType}`);
        return vizData;
      }
      // Si c'est un chemin MinIO storage - construire l'URL du storage
      if (vizData.includes('ibis-x-models')) {
        console.log(`🗄️ Using MinIO storage path for ${vizType}: ${vizData}`);
        // TODO: Adapter selon l'endpoint de storage réel
        return `/api/storage/${vizData}`;
      }
      // Autre format de chemin
      console.log(`📁 Using storage path for ${vizType}: ${vizData}`);
      return vizData;
    }

    // Si c'est un objet avec une propriété image (données base64)
    if (vizData && typeof vizData === 'object' && 'image' in vizData) {
      console.log(`🖼️ Using embedded base64 image for ${vizType}`);
      return `data:image/png;base64,${(vizData as any).image}`;
    }

    console.warn(`⚠️ Unknown visualization format for ${vizType}:`, typeof vizData);
    return '';
  }

  getVisualizationStrategy(vizType: string): 'backend-image' | 'chartjs' | 'fallback' {
    const strategy = this.visualizationManager.getVisualizationStrategy(
      vizType,
      this.experiment?.algorithm || 'unknown',
      this.hasVisualization(vizType)
    );

    // Filtrer les états internes pour ne retourner que les stratégies valides
    if (strategy === 'loading' || strategy === 'error') {
      return 'fallback';
    }

    return strategy;
  }

  // Méthodes pour le composant VisualizationContainer
  getAlgorithm(): string {
    return this.experiment?.algorithm || 'unknown';
  }

  getTaskType(): 'classification' | 'regression' {
    // Détecter le type de tâche basé sur les métriques disponibles
    const metrics = this.results?.metrics || {};
    const hasClassificationMetrics = ['accuracy', 'precision', 'recall', 'f1_score'].some(metric => metric in metrics);
    const hasRegressionMetrics = ['mae', 'mse', 'rmse', 'r2'].some(metric => metric in metrics);

    return hasClassificationMetrics ? 'classification' : 'regression';
  }

  hasConfusionMatrix(): boolean {
    return this.hasVisualization('confusion_matrix');
  }

  hasRocCurve(): boolean {
    return this.hasVisualization('roc_curve');
  }

  hasFeatureImportance(): boolean {
    return this.hasVisualization('feature_importance');
  }

  hasRegressionPlot(): boolean {
    return this.hasVisualization('regression_plot');
  }

  // ⚠️ ROBUSTESSE : Méthodes pour éviter les plantages
  getBestMetric(): string {
    const metrics = this.getMetricsArray();
    if (metrics.length === 0) return 'N/A';

    // Trouver la meilleure métrique (la plus élevée)
    const best = metrics.reduce((prev, current) =>
      current.value > prev.value ? current : prev
    );

    return `${this.getMetricLabel(best.key)}: ${this.formatMetricValue(best.key, best.value)}`;
  }
}
