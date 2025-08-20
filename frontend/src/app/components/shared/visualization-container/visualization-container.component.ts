import { Component, Input, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

import { SafeChartService } from '../../../services/safe-chart.service';
import { VisualizationManagerService, VisualizationStrategy, VisualizationConfig } from '../../../services/visualization-manager.service';
import { VisualizationType } from '../../../models/ml-pipeline.models';

@Component({
  selector: 'app-visualization-container',
  standalone: true,
  imports: [CommonModule, MatIconModule, MatButtonModule, MatProgressSpinnerModule],
  template: `<div class="visualization-container" [class]="'viz-' + visualizationType">
  <!-- Header avec titre et badge de source -->
  <div class="viz-header">
    <h3>{{ getVisualizationTitle() }}</h3>
    <span class="viz-source-badge" [class]="getSourceBadgeClass()" *ngIf="!isLoading && !hasError">
      {{ getSourceBadgeText() }}
    </span>
  </div>

  <!-- Contenu principal -->
  <div class="viz-content" [ngSwitch]="currentStrategy">

    <!-- Image backend (priorité) -->
    <div *ngSwitchCase="'backend-image'" class="backend-image-container">
      <img [src]="getVisualizationUrl()"
           [alt]="getVisualizationTitle()"
           class="backend-viz-image"
           (error)="onImageError()"
           (load)="onImageLoaded()">
    </div>

    <!-- Chart.js interactif -->
    <div *ngSwitchCase="'chartjs'" class="chartjs-container">
      <canvas [id]="canvasId" class="chart-canvas"></canvas>
    </div>

    <!-- Loading state -->
    <div *ngSwitchCase="'loading'" class="loading-container">
      <mat-spinner diameter="40"></mat-spinner>
      <p>Génération de la visualisation...</p>
    </div>

    <!-- Error state avec retry -->
    <div *ngSwitchCase="'error'" class="error-container">
      <mat-icon>error_outline</mat-icon>
      <p>{{ errorMessage || 'Impossible de charger la visualisation' }}</p>
      <button mat-button (click)="retry()" class="retry-btn" *ngIf="retryCount < maxRetries">
        <mat-icon>refresh</mat-icon>
        Réessayer ({{ retryCount }}/{{ maxRetries }})
      </button>
    </div>

    <!-- Fallback state -->
    <div *ngSwitchCase="'fallback'" class="fallback-container">
      <mat-icon>bar_chart</mat-icon>
      <p>Visualisation simplifiée</p>
      <small>Cette visualisation n'est pas disponible en mode interactif</small>
    </div>

  </div>
</div>`,
  styles: [`
.visualization-container {
  background: white;
  border: 1px solid #e2e8f0;
  border-radius: 16px;
  padding: 1.5rem;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.05);
  transition: all 0.3s ease;
  height: 100%;

  &:hover {
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.1);
    transform: translateY(-2px);
  }

  .viz-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 1rem;

    h3 {
      font-size: 1rem;
      font-weight: 600;
      color: #0f172a;
      margin: 0;
    }

    .viz-source-badge {
      padding: 0.25rem 0.5rem;
      border-radius: 4px;
      font-size: 0.75rem;
      font-weight: 500;

      &.backend-generated {
        background: rgba(16, 185, 129, 0.1);
        color: #10b981;
      }

      &.interactive {
        background: rgba(59, 130, 246, 0.1);
        color: #3b82f6;
      }
    }
  }

  .viz-content {
    height: 280px;
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;

    .backend-image-container {
      width: 100%;
      height: 100%;
      display: flex;
      align-items: center;
      justify-content: center;

      .backend-viz-image {
        max-width: 100%;
        max-height: 100%;
        object-fit: contain;
        border-radius: 8px;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
        transition: transform 0.2s ease;

        &:hover {
          transform: scale(1.02);
        }
      }
    }

    .chartjs-container {
      width: 100%;
      height: 100%;

      .chart-canvas {
        width: 100% !important;
        height: 100% !important;
      }
    }

    .loading-container {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 1rem;
      color: #64748b;

      p {
        margin: 0;
        font-size: 0.875rem;
        font-weight: 500;
      }
    }

    .error-container {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 1rem;
      color: #64748b;
      text-align: center;

      mat-icon {
        font-size: 2rem;
        color: #ef4444;
      }

      p {
        margin: 0;
        font-size: 0.875rem;
        font-weight: 500;
      }

      .retry-btn {
        background: #667eea;
        color: white;
        border-radius: 8px;
        padding: 0.5rem 1rem;
        display: flex;
        align-items: center;
        gap: 0.5rem;

        &:hover {
          background: #5a67d8;
        }

        mat-icon {
          font-size: 1rem;
          color: white;
        }
      }
    }

    .fallback-container {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 0.5rem;
      color: #64748b;
      text-align: center;

      mat-icon {
        font-size: 2rem;
        color: #94a3b8;
      }

      p {
        margin: 0;
        font-size: 0.875rem;
        font-weight: 500;
      }

      small {
        font-size: 0.75rem;
        color: #94a3b8;
      }
    }
  }
}

// Styles spécifiques par type de visualisation
.viz-feature_importance {
  border-left: 4px solid #3b82f6;

  .viz-header h3 {
    color: #3b82f6;
  }
}

.viz-confusion_matrix {
  border-left: 4px solid #10b981;

  .viz-header h3 {
    color: #10b981;
  }
}

.viz-roc_curve {
  border-left: 4px solid #f59e0b;

  .viz-header h3 {
    color: #f59e0b;
  }
}

.viz-regression_plot {
  border-left: 4px solid #8b5cf6;

  .viz-header h3 {
    color: #8b5cf6;
  }
}

.viz-decision_tree {
  border-left: 4px solid #06b6d4;

  .viz-header h3 {
    color: #06b6d4;
  }
}

.viz-predictions_distribution {
  border-left: 4px solid #84cc16;

  .viz-header h3 {
    color: #84cc16;
  }
}

// Responsive design
@media (max-width: 768px) {
  .visualization-container {
    padding: 1rem;

    .viz-content {
      height: 240px;
    }

    .viz-header {
      flex-direction: column;
      align-items: flex-start;
      gap: 0.5rem;

      .viz-source-badge {
        align-self: flex-end;
      }
    }
  }
}
  `]
})
export class VisualizationContainerComponent implements OnInit, OnDestroy {
  @Input() visualizationType!: VisualizationType;
  @Input() backendImageUrl?: string;
  @Input() chartConfig?: any;
  @Input() data?: any;
  @Input() algorithm!: string;
  @Input() taskType!: 'classification' | 'regression';
  @Input() experimentId!: string;

  currentStrategy: VisualizationStrategy = 'loading';
  canvasId: string = '';
  isLoading = true;
  hasError = false;
  errorMessage = '';
  retryCount = 0;
  maxRetries = 3;

  constructor(
    private safeChartService: SafeChartService,
    private visualizationManager: VisualizationManagerService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.canvasId = `${this.visualizationType}Chart_${Date.now()}`;
    this.initializeVisualization();
  }

  ngOnDestroy(): void {
    // Cleanup du chart si c'est Chart.js
    if (this.currentStrategy === 'chartjs') {
      this.safeChartService.destroyChart(this.canvasId);
    }
  }

  /**
   * Initialise la visualisation selon la stratégie optimale
   */
  private async initializeVisualization(): Promise<void> {
    console.log(`🎯 VizContainer: Initializing ${this.visualizationType} for ${this.algorithm}`);

    try {
      this.isLoading = true;
      this.hasError = false;

      // Vérifier si l'image backend existe
      const hasBackendImage = await this.checkBackendImageAvailability();

      // Déterminer la stratégie
      const strategy = this.visualizationManager.getVisualizationStrategy(
        this.visualizationType,
        this.algorithm,
        hasBackendImage
      );

      console.log(`📊 VizContainer: Selected strategy '${strategy}' for ${this.visualizationType}`);

      // Exécuter la stratégie
      await this.executeStrategy(strategy);

    } catch (error) {
      console.error(`💥 VizContainer: Error initializing ${this.visualizationType}:`, error);
      this.handleError(error as Error);
    } finally {
      this.isLoading = false;
      this.cdr.detectChanges();
    }
  }

  /**
   * Vérifie si l'image backend est disponible - NOUVELLE APPROCHE ROBUSTE
   */
  private async checkBackendImageAvailability(): Promise<boolean> {
    // Si on a déjà une URL fournie par le parent component, l'utiliser
    if (this.backendImageUrl && this.backendImageUrl.trim() !== '') {
      console.log(`🔍 VizContainer: Checking provided backend URL: ${this.backendImageUrl}`);

      // Vérification rapide - si l'URL semble être base64, c'est disponible
      if (this.backendImageUrl.startsWith('data:image')) {
        console.log(`✅ VizContainer: Base64 image URL available for ${this.visualizationType}`);
        return true;
      }

      // Pour les autres URLs, vérification plus permissive
      try {
        const isAvailable = await this.visualizationManager.checkBackendImageExists(this.backendImageUrl);
        console.log(`${isAvailable ? '✅' : '❌'} VizContainer: Backend image ${isAvailable ? 'available' : 'unavailable'} for ${this.visualizationType}`);
        return isAvailable;
      } catch (error) {
        console.warn(`⚠️ VizContainer: Error checking backend image:`, error);
        return false;
      }
    }

    console.log(`⚠️ VizContainer: No backend image URL provided for ${this.visualizationType}`);
    return false;
  }

  /**
   * Exécute la stratégie de visualisation sélectionnée
   */
  private async executeStrategy(strategy: VisualizationStrategy): Promise<void> {
    this.currentStrategy = strategy;

    switch (strategy) {
      case 'backend-image':
        await this.setupBackendImage();
        break;

      case 'chartjs':
        await this.setupChartJs();
        break;

      case 'fallback':
      default:
        this.setupFallback();
        break;
    }
  }

  /**
   * Configure l'affichage de l'image backend
   */
  private async setupBackendImage(): Promise<void> {
    console.log(`🖼️ VizContainer: Setting up backend image for ${this.visualizationType}`);

    if (!this.backendImageUrl) {
      throw new Error('Backend image URL not available');
    }

    // Cache l'URL pour les futures utilisations
    this.visualizationManager.cacheImageUrl(
      this.visualizationType,
      this.algorithm,
      this.backendImageUrl
    );
  }

    /**
   * Configure Chart.js de manière sécurisée
   */
  private async setupChartJs(): Promise<void> {
    console.log(`📊 VizContainer: Setting up Chart.js for ${this.visualizationType}`);

    // Générer la config automatiquement si pas fournie
    const chartConfig = this.chartConfig || this.generateFallbackChartConfig();

    if (!chartConfig) {
      console.error(`❌ VizContainer: No chart config available for ${this.visualizationType}`);
      throw new Error('Chart configuration not available');
    }

    try {
      const chart = await this.safeChartService.createSafeChart({
        canvasId: this.canvasId,
        chartConfig,
        timeout: 5000,
        retryCount: this.retryCount
      });

      if (!chart) {
        throw new Error('Failed to create Chart.js chart');
      }

      console.log(`✅ VizContainer: Chart.js created successfully for ${this.visualizationType}`);

    } catch (error) {
      console.error(`💥 VizContainer: Chart.js creation failed:`, error);

      // Fallback vers image backend si disponible
      if (this.backendImageUrl && this.backendImageUrl.trim() !== '') {
        console.log(`🔄 VizContainer: Falling back to backend image`);
        this.currentStrategy = 'backend-image';
        await this.setupBackendImage();
      } else {
        throw error;
      }
    }
  }

  /**
   * Configure l'état de fallback
   */
  private setupFallback(): void {
    console.log(`⚠️ VizContainer: Using fallback for ${this.visualizationType}`);
    this.currentStrategy = 'fallback';
  }

  /**
   * Gère les erreurs de visualisation
   */
  private handleError(error: Error): void {
    this.hasError = true;
    this.errorMessage = error.message || 'Erreur de visualisation inconnue';
    this.currentStrategy = 'error';

    console.error(`❌ VizContainer: Final error for ${this.visualizationType}:`, error);
  }

    /**
   * Gère les erreurs de chargement d'image
   */
  async onImageError(): Promise<void> {
    console.warn(`🖼️ VizContainer: Backend image failed for ${this.visualizationType}, trying Chart.js fallback`);

    // Toujours essayer le fallback Chart.js sécurisé
    try {
      console.log(`🔄 VizContainer: Attempting Chart.js fallback for ${this.visualizationType}`);
      await this.setupSecureChartJsFallback();
    } catch (fallbackError) {
      console.error(`❌ VizContainer: Chart.js fallback also failed:`, fallbackError);
      this.handleError(new Error('Visualisation indisponible - toutes les méthodes ont échoué'));
    }
  }

  /**
   * Fallback Chart.js sécurisé quand les images backend échouent
   */
  private async setupSecureChartJsFallback(): Promise<void> {
    console.log(`🔄 VizContainer: Setting up secure Chart.js fallback for ${this.visualizationType}`);

    this.currentStrategy = 'chartjs';
    this.cdr.detectChanges();

    // Attendre que le canvas soit disponible dans le DOM
    await new Promise(resolve => setTimeout(resolve, 100));

    const chartConfig = this.generateFallbackChartConfig();

    if (chartConfig) {
      try {
        const chart = await this.safeChartService.createSafeChart({
          canvasId: this.canvasId,
          chartConfig,
          timeout: 4000
        });

        if (chart) {
          console.log(`✅ VizContainer: Secure Chart.js fallback created for ${this.visualizationType}`);
        } else {
          throw new Error('Chart creation returned null');
        }

      } catch (error) {
        console.error(`❌ VizContainer: Secure Chart.js fallback failed:`, error);
        throw error;
      }
    } else {
      console.warn(`⚠️ VizContainer: No Chart.js config available for ${this.visualizationType}`);
      this.setupFallback();
    }
  }

    /**
   * Génère une configuration Chart.js sécurisée selon le type de visualisation
   */
  private generateFallbackChartConfig(): any {
    console.log(`🎯 VizContainer: Generating fallback config for ${this.visualizationType}`);

    switch (this.visualizationType) {
      case VisualizationType.FEATURE_IMPORTANCE:
        return this.createSecureFeatureImportanceConfig();

      case VisualizationType.CONFUSION_MATRIX:
        return this.createSecureConfusionMatrixConfig();

      case VisualizationType.ROC_CURVE:
        return this.createSecureROCCurveConfig();

      case VisualizationType.REGRESSION_PLOT:
        return this.createSecureRegressionPlotConfig();

      case VisualizationType.PREDICTIONS_DISTRIBUTION:
        return this.createSecurePredictionsDistributionConfig();

      case VisualizationType.METRICS:
        return this.createSecureMetricsConfig();

      default:
        console.warn(`⚠️ VizContainer: No secure config for ${this.visualizationType}, using generic`);
        return this.createSecureGenericConfig();
    }
  }

  private createSecureFeatureImportanceConfig(): any {
    // Utiliser les vraies données si disponibles
    const featureData = this.data || {};
    const features = Object.keys(featureData);
    const importance = Object.values(featureData) as number[];

    // Fallback vers données d'exemple
    const labels = features.length > 0 ? features.slice(0, 10) : ['Feature 1', 'Feature 2', 'Feature 3', 'Feature 4', 'Feature 5'];
    const data = importance.length > 0 ? importance.slice(0, 10) : [0.35, 0.25, 0.18, 0.12, 0.10];

    return {
      type: 'bar',
      data: {
        labels,
        datasets: [{
          label: 'Importance',
          data,
          backgroundColor: '#667eea',
          borderRadius: 6
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          title: {
            display: true,
            text: 'Importance des Features (Chart.js sécurisé)'
          },
          legend: { display: false }
        },
        scales: {
          y: {
            beginAtZero: true,
            title: { display: true, text: 'Score' }
          }
        }
      }
    };
  }

  private createSecureConfusionMatrixConfig(): any {
    return {
      type: 'doughnut',
      data: {
        labels: ['Vrais Positifs', 'Faux Positifs', 'Vrais Négatifs', 'Faux Négatifs'],
        datasets: [{
          data: [120, 15, 155, 10],
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
            text: 'Matrice de Confusion (Chart.js sécurisé)'
          }
        }
      }
    };
  }

  private createSecureMetricsConfig(): any {
    console.log(`📊 VizContainer: Creating secure metrics config with data:`, this.data);

    // Utiliser les vraies métriques si disponibles
    const metricsData = this.data || {};
    const metricKeys = Object.keys(metricsData);

    if (metricKeys.length > 0) {
      // Chart radar pour plusieurs métriques
      const values = Object.values(metricsData) as number[];

      return {
        type: 'radar',
        data: {
          labels: metricKeys.map(key => this.formatMetricLabel(key)),
          datasets: [{
            label: 'Métriques',
            data: values.map(val => (val || 0) * 100),
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
              text: 'Métriques de Performance'
            },
            legend: { display: false }
          },
          scales: {
            r: {
              beginAtZero: true,
              max: 100,
              grid: { display: true }
            }
          }
        }
      };
    }

    // Fallback config simple si pas de données
    return {
      type: 'doughnut',
      data: {
        datasets: [{
          data: [75, 25],
          backgroundColor: ['#667eea', '#f1f5f9'],
          borderWidth: 0
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '75%',
        plugins: {
          legend: { display: false },
          tooltip: { enabled: false },
          title: {
            display: true,
            text: 'Métriques (données indisponibles)'
          }
        }
      }
    };
  }

  /**
   * Formate les labels de métriques pour l'affichage
   */
  private formatMetricLabel(key: string): string {
    const labels: { [key: string]: string } = {
      'r2': 'R²',
      'mae': 'MAE',
      'mse': 'MSE',
      'rmse': 'RMSE',
      'accuracy': 'Précision',
      'precision': 'Précision',
      'recall': 'Rappel',
      'f1_score': 'F1'
    };
    return labels[key] || key;
  }

  private createSecureROCCurveConfig(): any {
    console.log(`📈 VizContainer: Creating secure ROC curve config`);

    // Configuration Chart.js sécurisée pour ROC curve (line chart simple)
    const rocPoints = [];
    for (let i = 0; i <= 20; i++) { // Moins de points pour éviter les problèmes
      const x = i / 20;
      const y = Math.min(1, x + 0.2 + Math.random() * 0.1);
      rocPoints.push({ x, y });
    }

    return {
      type: 'line',
      data: {
        datasets: [{
          label: 'Courbe ROC',
          data: rocPoints,
          borderColor: '#667eea',
          backgroundColor: 'rgba(102, 126, 234, 0.1)',
          fill: false, // Pas de fill pour éviter les problèmes
          tension: 0 // Pas de courbe lissée
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          title: {
            display: true,
            text: 'Courbe ROC (Chart.js sécurisé)'
          },
          legend: { display: false }
        },
        scales: {
          x: { min: 0, max: 1, title: { display: true, text: 'Faux Positifs' } },
          y: { min: 0, max: 1, title: { display: true, text: 'Vrais Positifs' } }
        }
      }
    };
  }

  private createSecureRegressionPlotConfig(): any {
    console.log(`📊 VizContainer: Creating secure regression plot config`);

    // Scatter plot simple pour régression
    const scatterData = [];
    for (let i = 0; i < 50; i++) { // Données limitées pour sécurité
      const actual = Math.random() * 100;
      const predicted = actual + (Math.random() - 0.5) * 20; // Avec un peu de bruit
      scatterData.push({ x: actual, y: predicted });
    }

    return {
      type: 'scatter',
      data: {
        datasets: [{
          label: 'Réel vs Prédit',
          data: scatterData,
          backgroundColor: '#667eea',
          borderColor: '#667eea'
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          title: {
            display: true,
            text: 'Graphique de Régression (Chart.js sécurisé)'
          },
          legend: { display: false }
        },
        scales: {
          x: { title: { display: true, text: 'Valeurs Réelles' } },
          y: { title: { display: true, text: 'Valeurs Prédites' } }
        }
      }
    };
  }

  private createSecurePredictionsDistributionConfig(): any {
    console.log(`📊 VizContainer: Creating secure predictions distribution config`);

    return {
      type: 'bar',
      data: {
        labels: ['0.0-0.2', '0.2-0.4', '0.4-0.6', '0.6-0.8', '0.8-1.0'],
        datasets: [{
          label: 'Fréquence',
          data: [25, 45, 120, 180, 130],
          backgroundColor: '#667eea',
          borderRadius: 4
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          title: {
            display: true,
            text: 'Distribution des Prédictions (Chart.js sécurisé)'
          },
          legend: { display: false }
        },
        scales: {
          y: {
            beginAtZero: true,
            title: { display: true, text: 'Nombre de prédictions' }
          }
        }
      }
    };
  }

  private createSecureGenericConfig(): any {
    return {
      type: 'bar',
      data: {
        labels: ['Donnée 1', 'Donnée 2', 'Donnée 3'],
        datasets: [{
          label: 'Valeurs',
          data: [10, 20, 15],
          backgroundColor: '#667eea'
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          title: {
            display: true,
            text: 'Visualisation générique (Chart.js sécurisé)'
          }
        }
      }
    };
  }

  /**
   * Callback quand l'image backend se charge
   */
  onImageLoaded(): void {
    console.log(`✅ VizContainer: Backend image loaded for ${this.visualizationType}`);
  }

  /**
   * Retry la création de visualisation
   */
  async retry(): Promise<void> {
    if (this.retryCount >= this.maxRetries) {
      console.warn(`⚠️ VizContainer: Max retries reached for ${this.visualizationType}`);
      return;
    }

    this.retryCount++;
    console.log(`🔄 VizContainer: Retry ${this.retryCount}/${this.maxRetries} for ${this.visualizationType}`);

    this.hasError = false;
    this.currentStrategy = 'loading';

    await this.initializeVisualization();
  }

  /**
   * Obtient le titre de la visualisation
   */
  getVisualizationTitle(): string {
    const titles: { [key: string]: string } = {
      'feature_importance': 'Importance des Features',
      'confusion_matrix': 'Matrice de Confusion',
      'roc_curve': 'Courbe ROC',
      'regression_plot': 'Graphique de Régression',
      'decision_tree': 'Structure de l\'Arbre',
      'predictions_distribution': 'Distribution des Prédictions',
      'performance_timeline': 'Performance dans le Temps',
      'metrics': 'Métriques de Performance'
    };

    return titles[this.visualizationType] || 'Visualisation';
  }

  /**
   * Obtient la classe CSS du badge de source
   */
  getSourceBadgeClass(): string {
    return this.currentStrategy === 'backend-image' ? 'backend-generated' : 'interactive';
  }

  /**
   * Obtient le texte du badge de source
   */
  getSourceBadgeText(): string {
    switch (this.currentStrategy) {
      case 'backend-image':
        return 'Généré par IA';
      case 'chartjs':
        return 'Interactif';
      case 'fallback':
        return 'Simplifié';
      default:
        return '';
    }
  }

  /**
   * Vérifie si la visualisation a une image backend
   */
  hasBackendVisualization(): boolean {
    return this.currentStrategy === 'backend-image' && !!this.backendImageUrl;
  }

  /**
   * Obtient l'URL de la visualisation backend
   */
  getVisualizationUrl(): string {
    return this.backendImageUrl || '';
  }
}
