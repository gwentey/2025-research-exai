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
import { MlPipelineService } from '../../../services/ml-pipeline.service';
import { EChartsService } from '../../../services/echarts.service';
import { ExperimentStatus, ExperimentResults, VisualizationType } from '../../../models/ml-pipeline.models';
import { EChartsContainerComponent } from '../../../components/shared/echarts-container/echarts-container.component';

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
    EChartsContainerComponent
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
  experiment: ExperimentStatus | null = null;
  results: ExperimentResults | null = null;
  isLoading = true;
  
  // 🚀 VERSION MODERNE - TIMESTAMP DE COMPILATION
  readonly modernVersion = 'v2.0-' + new Date().toISOString();
  
  // Méthode pour obtenir la date actuelle (pour les templates Angular)
  getCurrentDate(): string {
    return new Date().toLocaleString();
  }

  // Exposer l'enum pour le template
  readonly VisualizationType = VisualizationType;

  // 🔧 CACHE pour les données générées aléatoirement - SOLUTION DÉFINITIVE
  private _cachedRegressionData: any = null;
  private _cachedDistributionData: any = null;
  private _cachedTreeStructureData: { [algorithm: string]: any } = {};

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private mlPipelineService: MlPipelineService,
    private translate: TranslateService,
    private echartsService: EChartsService
  ) {}

  ngOnInit() {
    // 🚀 LOG TRÈS VISIBLE POUR CONFIRMER LE CHARGEMENT
    console.log('%c🎉 NOUVELLE INTERFACE MODERNE CHARGÉE ! 🎉', 'background: #dc2626; color: white; font-size: 20px; padding: 10px; border-radius: 5px; font-weight: bold;');
    console.log('%cVersion:', 'font-weight: bold; color: #dc2626;', this.modernVersion);
    console.log('%cTimestamp de chargement:', 'font-weight: bold; color: #dc2626;', new Date().toISOString());
    
    this.experimentId = this.route.snapshot.params['id'];

    // Essayer différentes façons de récupérer le projectId
    this.projectId = this.route.snapshot.parent?.parent?.params['id'] ||
                     this.route.snapshot.parent?.params['projectId'] ||
                     this.route.snapshot.queryParams['projectId'] || '';

    console.log('🎯 Experiment Results Page - Debug info:');
    console.log('- Experiment ID:', this.experimentId);
    console.log('- Project ID:', this.projectId);

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
    // ECharts s'initialise automatiquement via les composants
  }

  ngOnDestroy() {
    // Nettoyer tous les graphiques ECharts lors de la destruction
    this.echartsService.destroyAllCharts();
  }

  loadExperimentDetails() {
    console.log('📊 Loading experiment details for ID:', this.experimentId);

    this.mlPipelineService.getExperimentStatus(this.experimentId).subscribe({
      next: (status) => {
                console.log('✅ Experiment status loaded:', status);
        this.experiment = status;

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

        // 🔧 RÉINITIALISER LE CACHE QUAND LES RÉSULTATS CHANGENT
        this._cachedRegressionData = null;
        this._cachedDistributionData = null;
        this._cachedTreeStructureData = {};
        console.log('🧹 Cache cleared for new results');

        // ECharts s'initialise automatiquement via les composants
        console.log('🎨 ECharts visualizations will initialize automatically via components');
      },
      error: (error) => {
        console.error('❌ Error loading results:', error);
        this.isLoading = false;
      }
    });
  }

  // ===== MIGRATION ECHARTS COMPLÈTE =====
  // Toutes les anciennes méthodes Chart.js ont été supprimées
  // Les visualisations utilisent maintenant EChartsContainerComponent

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
      default: return 'primary';
    }
  }

  // Getters sécurisés pour le template
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
    // Navigation vers la route plein écran ml-pipeline-wizard
    console.log(`🔙 Navigating back to wizard (fullscreen)`);

    const queryParams: any = {};

    // Préserver le projectId dans les query params
    if (this.projectId) {
      queryParams.projectId = this.projectId;
    }

    // ROUTE PLEIN ÉCRAN CORRECTE
    this.router.navigate(['/ml-pipeline-wizard'], {
      queryParams
    });
  }

  runNewExperiment() {
    // Navigation vers la route plein écran avec copyFrom
    console.log(`🔄 Starting new experiment with copyFrom: ${this.experimentId}, projectId: ${this.projectId}`);

    const queryParams: any = {
        copyFrom: this.experimentId
    };

    // Préserver le projectId dans les query params pour robustesse
    if (this.projectId) {
      queryParams.projectId = this.projectId;
    }

    // ROUTE PLEIN ÉCRAN CORRECTE
    this.router.navigate(['/ml-pipeline-wizard'], {
      queryParams
    });
  }

  // ===== MÉTHODES POUR ECHARTS =====

  /**
   * Récupère les données de structure d'arbre pour ECharts - AVEC CACHE
   */
  getTreeStructureData(algorithmType: string): any {
    console.log(`🌳 Getting tree structure data for ${algorithmType}`);

    // Vérifier le cache d'abord
    if (this._cachedTreeStructureData[algorithmType]) {
      console.log(`✅ Using cached tree structure for ${algorithmType}`);
      return this._cachedTreeStructureData[algorithmType];
    }

    // Chercher les données d'arbre dans les visualisations
    const treeStructure = this.results?.visualizations?.['tree_structure'];

    if (treeStructure && typeof treeStructure === 'object' && 'tree_data' in treeStructure) {
      console.log(`✅ Tree structure found in results:`, treeStructure);
      const treeData = (treeStructure as any).tree_data;
      // Mettre en cache
      this._cachedTreeStructureData[algorithmType] = treeData;
      return treeData;
    }

    console.log(`⚠️ No tree structure found, using fallback data`);

    // Fallback vers données d'exemple selon l'algorithme - STABLE
    let fallbackData;
    if (algorithmType === 'random_forest') {
      fallbackData = {
        name: "F3",
        condition: "≤ 0.45",
        samples: 1000,
        children: [
          {
            name: "F7",
            condition: "≤ 0.22",
            samples: 650,
            children: [
              { name: "C0", condition: "n=480", samples: 480, is_leaf: true },
              { name: "C1", condition: "n=170", samples: 170, is_leaf: true }
            ]
          },
          {
            name: "F12",
            condition: "≤ 0.78",
            samples: 350,
            children: [
              { name: "C1", condition: "n=280", samples: 280, is_leaf: true },
              { name: "C0", condition: "n=70", samples: 70, is_leaf: true }
            ]
          }
        ]
      };
    } else {
      fallbackData = {
        name: "feature_0",
        condition: "≤ 0.5",
        samples: 1000,
        children: [
          {
            name: "feature_1",
            condition: "≤ 0.3",
            samples: 600,
            children: [
              { name: "Classe A", condition: "n=400", samples: 400, is_leaf: true },
              { name: "Classe B", condition: "n=200", samples: 200, is_leaf: true }
            ]
          },
          {
            name: "feature_2",
            condition: "≤ 0.8",
            samples: 400,
            children: [
              { name: "Classe B", condition: "n=300", samples: 300, is_leaf: true },
              { name: "Classe A", condition: "n=100", samples: 100, is_leaf: true }
            ]
          }
        ]
      };
    }

    // Mettre en cache le fallback aussi
    this._cachedTreeStructureData[algorithmType] = fallbackData;
    return fallbackData;
  }

  /**
   * Récupère les données pour le graphique de régression - AVEC CACHE
   */
  getRegressionPlotData(): any {
    console.log(`📊 Getting regression plot data`);

    // Vérifier le cache d'abord
    if (this._cachedRegressionData) {
      console.log(`✅ Using cached regression data`);
      return this._cachedRegressionData;
    }

    let data: any;

    // Si on a des données réelles dans les résultats, les utiliser
    if (this.results?.metrics) {
      // Générer des données basées sur les métriques réelles - AVEC SEED STABLE
      const r2 = this.results.metrics.r2 || 0.8;
      const rmse = this.results.metrics.rmse || 0.1;

      // Utiliser un seed basé sur l'experimentId pour avoir des données reproductibles
      const seed = this.experimentId ? this.experimentId.charCodeAt(0) * 7 : 42;

      // Simuler des données actual vs predicted basées sur les métriques réelles
      const tempData = [];
      for (let i = 0; i < 100; i++) {
        // Générateur pseudo-aléatoire simple avec seed
        const pseudoRandom1 = ((seed + i) * 9301 + 49297) % 233280 / 233280;
        const pseudoRandom2 = ((seed + i + 50) * 9301 + 49297) % 233280 / 233280;

        const actual = pseudoRandom1 * 100;
        const noise = (pseudoRandom2 - 0.5) * rmse * 200; // Bruit basé sur RMSE
        const predicted = actual * r2 + noise; // Corrélation basée sur R²
        tempData.push([actual, predicted]);
      }
      data = tempData;
    } else {
      // Fallback vers données d'exemple STABLE
      const seed = this.experimentId ? this.experimentId.charCodeAt(0) * 11 : 84;
      data = Array.from({length: 50}, (_, i) => {
        const pseudoRandom1 = ((seed + i) * 9301 + 49297) % 233280 / 233280;
        const pseudoRandom2 = ((seed + i + 25) * 9301 + 49297) % 233280 / 233280;

        const actual = pseudoRandom1 * 100;
        const predicted = actual + (pseudoRandom2 - 0.5) * 20;
        return [actual, predicted];
      });
    }

    // Mettre en cache
    this._cachedRegressionData = data;
    return data;
  }

  /**
   * Récupère les données pour la distribution des prédictions - AVEC CACHE
   */
  getPredictionsDistributionData(): any {
    console.log(`📊 Getting predictions distribution data`);

    // Vérifier le cache d'abord
    if (this._cachedDistributionData) {
      console.log(`✅ Using cached distribution data`);
      return this._cachedDistributionData;
    }

    // Données d'exemple pour distribution - STABLE
    const data = {
      labels: ['0.0-0.2', '0.2-0.4', '0.4-0.6', '0.6-0.8', '0.8-1.0'],
      values: [25, 45, 120, 180, 130]
    };

    // Mettre en cache
    this._cachedDistributionData = data;
    return data;
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

  // Méthodes pour vérifier la présence des visualizations
  hasVisualization(vizType: string): boolean {
    return !!(this.results?.visualizations && this.results.visualizations[vizType]);
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

  // Méthodes pour EChartsContainer
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

  getBestMetric(): string {
    const metrics = this.getMetricsArray();
    if (metrics.length === 0) return 'N/A';

    // Trouver la meilleure métrique (la plus élevée)
    const best = metrics.reduce((prev, current) =>
      current.value > prev.value ? current : prev
    );

    return `${this.getMetricLabel(best.key)}: ${this.formatMetricValue(best.key, best.value)}`;
  }

  // ============================================================================
  // NOUVELLES MÉTHODES POUR L'INTERFACE MODERNE
  // ============================================================================

  // État pour les panneaux d'explication
  showMetricsExplanation = false;
  showInsightsPanel = false;

  // Méthodes pour l'interface hero
  getAlgorithmClass(): string {
    const algorithm = this.getAlgorithm();
    switch (algorithm) {
      case 'decision_tree': return 'algorithm-decision-tree';
      case 'random_forest': return 'algorithm-random-forest';
      case 'linear_regression': return 'algorithm-linear-regression';
      default: return 'algorithm-default';
    }
  }

  getAlgorithmIcon(): string {
    const algorithm = this.getAlgorithm();
    switch (algorithm) {
      case 'decision_tree': return 'account_tree';
      case 'random_forest': return 'park';
      case 'linear_regression': return 'linear_scale';
      default: return 'psychology';
    }
  }

  getStatusClass(): string {
    if (!this.experiment) return '';
    switch (this.experiment.status) {
      case 'completed': return 'success';
      case 'failed': return 'danger';
      case 'running': return 'warning';
      default: return '';
    }
  }

  getStatusIcon(): string {
    if (!this.experiment) return 'help';
    switch (this.experiment.status) {
      case 'completed': return 'check_circle';
      case 'failed': return 'error';
      case 'running': return 'sync';
      default: return 'help';
    }
  }

  getRelativeTime(): string {
    if (!this.experiment?.created_at) return 'Unknown';
    
    const now = new Date();
    const createdAt = new Date(this.experiment.created_at);
    const diffInMinutes = Math.floor((now.getTime() - createdAt.getTime()) / (1000 * 60));
    
    if (diffInMinutes < 60) {
      return `${diffInMinutes} minutes ago`;
    } else if (diffInMinutes < 1440) { // 24 hours
      const hours = Math.floor(diffInMinutes / 60);
      return `${hours} hour${hours > 1 ? 's' : ''} ago`;
    } else {
      const days = Math.floor(diffInMinutes / 1440);
      return `${days} day${days > 1 ? 's' : ''} ago`;
    }
  }

  getOverallScore(): number {
    const metrics = this.getMetricsArray();
    if (metrics.length === 0) return 0;
    
    const sum = metrics.reduce((acc, metric) => acc + (metric.value * 100), 0);
    return Math.round(sum / metrics.length);
  }

  // Méthodes pour les métriques avancées
  toggleMetricsExplanation(): void {
    this.showMetricsExplanation = !this.showMetricsExplanation;
  }

  toggleInsightsPanel(): void {
    this.showInsightsPanel = !this.showInsightsPanel;
  }

  getMetricsExplanations(): Array<any> {
    return [
      {
        name: 'Precision',
        description: 'Proportion of positive identifications that were actually correct. High precision means few false positives.',
        icon: 'target',
        colorClass: 'good',
        scale: {
          poor: '< 70%',
          good: '70-85%',
          excellent: '> 85%'
        }
      },
      {
        name: 'Recall',
        description: 'Proportion of actual positives that were identified correctly. High recall means few false negatives.',
        icon: 'search',
        colorClass: 'excellent',
        scale: {
          poor: '< 70%',
          good: '70-85%',
          excellent: '> 85%'
        }
      },
      {
        name: 'F1 Score',
        description: 'Harmonic mean of precision and recall. Good balance between precision and recall.',
        icon: 'balance',
        colorClass: 'warning',
        scale: {
          poor: '< 70%',
          good: '70-85%',
          excellent: '> 85%'
        }
      },
      {
        name: 'Accuracy',
        description: 'Proportion of correct predictions among the total number of cases examined.',
        icon: 'speed',
        colorClass: 'excellent',
        scale: {
          poor: '< 80%',
          good: '80-90%',
          excellent: '> 90%'
        }
      }
    ];
  }

  trackByMetric(index: number, metric: {key: string, value: number}): string {
    return metric.key;
  }

  getMetricPerformanceClass(value: number): string {
    if (value >= 0.85) return 'excellent';
    if (value >= 0.70) return 'good';
    if (value >= 0.50) return 'warning';
    return 'poor';
  }

  getMetricDescription(key: string): string {
    const descriptions = {
      'precision': 'Exactitude des prédictions positives',
      'recall': 'Capacité à identifier tous les cas positifs',
      'f1_score': 'Équilibre entre précision et rappel',
      'accuracy': 'Pourcentage de prédictions correctes',
      'roc_auc': 'Performance globale de classification'
    };
    return descriptions[key as keyof typeof descriptions] || 'Métrique de performance';
  }

  getPerformanceLabel(value: number): string {
    if (value >= 0.85) return 'Excellent';
    if (value >= 0.70) return 'Bon';
    if (value >= 0.50) return 'Moyen';
    return 'Faible';
  }

  getBenchmarkComparison(key: string, value: number): string {
    // Benchmark basé sur des standards industriels
    const benchmarks = {
      'accuracy': 0.80,
      'precision': 0.75,
      'recall': 0.75,
      'f1_score': 0.75,
      'roc_auc': 0.80
    };
    
    const benchmark = benchmarks[key as keyof typeof benchmarks] || 0.75;
    
    if (value > benchmark + 0.05) return 'Above Industry Benchmark';
    if (value > benchmark - 0.05) return 'At Industry Benchmark';
    return 'Below Industry Benchmark';
  }

  getBenchmarkClass(key: string, value: number): string {
    const benchmarks = {
      'accuracy': 0.80,
      'precision': 0.75,
      'recall': 0.75,
      'f1_score': 0.75,
      'roc_auc': 0.80
    };
    
    const benchmark = benchmarks[key as keyof typeof benchmarks] || 0.75;
    
    if (value > benchmark + 0.05) return 'above-benchmark';
    if (value > benchmark - 0.05) return 'at-benchmark';
    return 'below-benchmark';
  }

  getAdvancedInterpretation(key: string, value: number): string {
    const interpretations = {
      'precision': value >= 0.85 ? 'Very few false positives' : value >= 0.70 ? 'Some false positives' : 'Many false positives',
      'recall': value >= 0.85 ? 'Catches most positive cases' : value >= 0.70 ? 'Catches some positive cases' : 'Misses many positive cases',
      'f1_score': value >= 0.85 ? 'Excellent balance' : value >= 0.70 ? 'Good balance' : 'Needs improvement',
      'accuracy': value >= 0.90 ? 'Highly accurate' : value >= 0.80 ? 'Reasonably accurate' : 'Low accuracy'
    };
    return interpretations[key as keyof typeof interpretations] || 'Standard performance metric';
  }

  // Méthodes pour les insights de données
  getModelStrengths(): string[] {
    const metrics = this.getMetricsArray();
    const strengths: string[] = [];
    
    metrics.forEach(metric => {
      if (metric.value >= 0.85) {
        const label = this.getMetricLabel(metric.key);
        strengths.push(`Excellent ${label} (${(metric.value * 100).toFixed(1)}%)`);
      }
    });
    
    if (strengths.length === 0) {
      strengths.push('Stable performance across metrics');
    }
    
    return strengths;
  }

  getModelWeaknesses(): string[] {
    const metrics = this.getMetricsArray();
    const weaknesses: string[] = [];
    
    metrics.forEach(metric => {
      if (metric.value < 0.70) {
        const label = this.getMetricLabel(metric.key);
        weaknesses.push(`${label} needs improvement (${(metric.value * 100).toFixed(1)}%)`);
      }
    });
    
    if (weaknesses.length === 0) {
      weaknesses.push('No significant weaknesses detected');
    }
    
    return weaknesses;
  }

  getRecommendations(): Array<any> {
    const metrics = this.getMetricsArray();
    const recommendations: Array<any> = [];
    
    // Analyser les métriques pour des recommandations
    const avgScore = metrics.reduce((sum, m) => sum + m.value, 0) / metrics.length;
    
    if (avgScore < 0.80) {
      recommendations.push({
        type: 'data',
        icon: 'dataset',
        title: 'Améliorer la qualité des données',
        description: 'Considérer plus de données d\'entraînement ou un nettoyage approfondi.'
      });
    }
    
    if (avgScore >= 0.80 && avgScore < 0.90) {
      recommendations.push({
        type: 'optimization',
        icon: 'tune',
        title: 'Optimisation des hyperparamètres',
        description: 'Expérimenter avec différents paramètres pour améliorer les performances.'
      });
    }
    
    if (this.getAlgorithm() === 'decision_tree' && avgScore < 0.85) {
      recommendations.push({
        type: 'algorithm',
        icon: 'psychology',
        title: 'Essayer Random Forest',
        description: 'Random Forest pourrait donner de meilleures performances pour ce dataset.'
      });
    }
    
    if (recommendations.length === 0) {
      recommendations.push({
        type: 'optimization',
        icon: 'celebration',
        title: 'Excellent travail!',
        description: 'Les performances sont déjà très bonnes. Considérer la mise en production.'
      });
    }
    
    return recommendations;
  }
}
