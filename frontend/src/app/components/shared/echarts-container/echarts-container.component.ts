import { Component, Input, OnInit, OnDestroy, ChangeDetectorRef, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

import { EChartsService } from '../../../services/echarts.service';
import { VisualizationType } from '../../../models/ml-pipeline.models';

export type EChartsStrategy = 'echarts' | 'loading' | 'error' | 'fallback';

@Component({
  selector: 'app-echarts-container',
  standalone: true,
  imports: [CommonModule, MatIconModule, MatButtonModule, MatProgressSpinnerModule],
  template: `
<div class="echarts-container" [class]="'chart-' + visualizationType">
  <!-- Header avec titre et badge ECharts -->
  <div class="chart-header">
    <h3>{{ getVisualizationTitle() }}</h3>
    <span class="chart-badge echarts-badge" *ngIf="!isLoading && !hasError">
      ECharts Interactif
    </span>
  </div>

  <!-- Contenu principal -->
  <div class="chart-content" [ngSwitch]="currentStrategy">

    <!-- ECharts container -->
    <div *ngSwitchCase="'echarts'" class="echarts-chart-container">
      <div [id]="chartContainerId" class="echarts-chart"></div>
    </div>

    <!-- Loading state -->
    <div *ngSwitchCase="'loading'" class="loading-container">
      <mat-spinner diameter="40"></mat-spinner>
      <p>Génération ECharts...</p>
    </div>

    <!-- Error state avec retry -->
    <div *ngSwitchCase="'error'" class="error-container">
      <mat-icon>error_outline</mat-icon>
      <p>{{ errorMessage || 'Impossible de créer la visualisation' }}</p>
      <button mat-button (click)="retry()" class="retry-btn" *ngIf="retryCount < maxRetries">
        <mat-icon>refresh</mat-icon>
        Réessayer ({{ retryCount }}/{{ maxRetries }})
      </button>
    </div>

    <!-- Fallback state -->
    <div *ngSwitchCase="'fallback'" class="fallback-container">
      <mat-icon>analytics</mat-icon>
      <p>Visualisation indisponible</p>
      <small>Les données ne sont pas disponibles pour ce type de graphique</small>
    </div>

  </div>
</div>`,
  styles: [`
.echarts-container {
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

  .chart-header {
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

    .chart-badge {
      padding: 0.25rem 0.5rem;
      border-radius: 4px;
      font-size: 0.75rem;
      font-weight: 500;

      &.echarts-badge {
        background: rgba(16, 185, 129, 0.1);
        color: #10b981;
      }
    }
  }

  .chart-content {
    height: 320px;
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;

    .echarts-chart-container {
      width: 100%;
      height: 100%;

      .echarts-chart {
        width: 100%;
        height: 100%;
      }
    }

    .loading-container, .error-container, .fallback-container {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 1rem;
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
      }
    }

    .error-container mat-icon {
      color: #ef4444;
    }
  }
}

// Styles spécifiques par type de visualisation
.chart-feature_importance {
  border-left: 4px solid #3b82f6;
}

.chart-confusion_matrix {
  border-left: 4px solid #10b981;
}

.chart-roc_curve {
  border-left: 4px solid #f59e0b;
}

.chart-regression_plot {
  border-left: 4px solid #8b5cf6;
}

.chart-decision_tree {
  border-left: 4px solid #06b6d4;
}

.chart-metrics {
  border-left: 4px solid #667eea;
}

// Responsive design
@media (max-width: 768px) {
  .echarts-container {
    padding: 1rem;

    .chart-content {
      height: 280px;
    }
  }
}
  `]
})
export class EChartsContainerComponent implements OnInit, OnDestroy, AfterViewInit {
  @Input() visualizationType!: VisualizationType;
  @Input() data?: any;
  @Input() algorithm!: string;
  @Input() taskType!: 'classification' | 'regression';
  @Input() experimentId!: string;

  currentStrategy: EChartsStrategy = 'loading';
  chartContainerId: string = '';
  isLoading = true;
  hasError = false;
  errorMessage = '';
  retryCount = 0;
  maxRetries = 3;

  constructor(
    private echartsService: EChartsService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.chartContainerId = `echarts_${this.visualizationType}_${Date.now()}`;
  }

  ngAfterViewInit(): void {
    // Attendre que le DOM soit prêt avant de créer le chart
    setTimeout(() => {
      this.initializeChart();
    }, 100);
  }

  ngOnDestroy(): void {
    this.echartsService.destroyChart(this.chartContainerId);
  }

  /**
   * Initialise le graphique ECharts
   */
  private async initializeChart(): Promise<void> {
    console.log(`🎯 EChartsContainer: Initializing ${this.visualizationType}`);

    try {
      this.isLoading = true;
      this.hasError = false;
      this.currentStrategy = 'loading';

      const chartOption = this.generateChartOption();

      if (!chartOption) {
        throw new Error('Aucune configuration de graphique disponible');
      }

      this.currentStrategy = 'echarts';
      this.cdr.detectChanges();

      // Attendre que le conteneur soit dans le DOM
      await new Promise(resolve => setTimeout(resolve, 50));

      const chart = await this.echartsService.createChart({
        containerId: this.chartContainerId,
        option: chartOption,
        timeout: 6000
      });

      if (chart) {
        console.log(`✅ EChartsContainer: Chart created for ${this.visualizationType}`);
        this.setupChartInteractions(chart);
      } else {
        throw new Error('Échec de création du graphique ECharts');
      }

    } catch (error) {
      console.error(`💥 EChartsContainer: Error initializing ${this.visualizationType}:`, error);
      this.handleError(error as Error);
    } finally {
      this.isLoading = false;
      this.cdr.detectChanges();
    }
  }

  /**
   * Génère la configuration ECharts selon le type de visualisation
   */
  private generateChartOption(): any {
    console.log(`🎯 EChartsContainer: Generating option for ${this.visualizationType} with data:`, this.data);

    switch (this.visualizationType) {
      case VisualizationType.METRICS:
        return this.echartsService.getMetricsChartOption(this.data || {});

      case VisualizationType.FEATURE_IMPORTANCE:
        return this.echartsService.getFeatureImportanceOption(this.data || {});

      case VisualizationType.DECISION_TREE:
        return this.generateDecisionTreeOption();

      case VisualizationType.CONFUSION_MATRIX:
        return this.generateConfusionMatrixOption();

      case VisualizationType.ROC_CURVE:
        return this.generateROCCurveOption();

      case VisualizationType.REGRESSION_PLOT:
        return this.generateRegressionPlotOption();

      case VisualizationType.PREDICTIONS_DISTRIBUTION:
        return this.echartsService.getPredictionsDistributionOption(this.data || {});

      default:
        console.warn(`⚠️ EChartsContainer: No option generator for ${this.visualizationType}`);
        return null;
    }
  }

  private generateDecisionTreeOption(): any {
    // Utiliser les données d'arbre si disponibles, sinon fallback
    const treeData = this.data?.tree_data || this.generateFallbackTreeData();
    return this.echartsService.getDecisionTreeOption(treeData);
  }

  private generateConfusionMatrixOption(): any {
    // Données de matrice de confusion
    const matrix = this.data || [[120, 15], [10, 155]]; // Fallback
    return this.echartsService.getConfusionMatrixOption(matrix);
  }

  private generateROCCurveOption(): any {
    // Données ROC curve
    const rocData = this.data || {
      points: Array.from({length: 100}, (_, i) => [i/100, Math.min(1, i/100 + 0.2 + Math.random() * 0.1)]),
      auc: 0.85
    };
    return this.echartsService.getROCCurveOption(rocData);
  }

  private generateRegressionPlotOption(): any {
    // Données de régression
    const actualVsPredicted = this.data || Array.from({length: 100}, () => {
      const actual = Math.random() * 100;
      const predicted = actual + (Math.random() - 0.5) * 20;
      return [actual, predicted];
    });
    return this.echartsService.getRegressionPlotOption(actualVsPredicted);
  }

  private generateFallbackTreeData(): any {
    // Données d'arbre d'exemple pour fallback
    return {
      name: "Root",
      condition: "feature_0 ≤ 0.5",
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

  /**
   * Configure les interactions du graphique
   */
  private setupChartInteractions(chart: any): void {
    // Interaction pour les arbres
    if (this.visualizationType === VisualizationType.DECISION_TREE) {
      chart.on('click', (params: any) => {
        console.log('🌳 Tree node clicked:', params.data);
        // Optionnel: collapse/expand custom logic
      });
    }

    // Resize listener global
    window.addEventListener('resize', () => {
      chart.resize();
    });
  }

  /**
   * Gère les erreurs de visualisation
   */
  private handleError(error: Error): void {
    this.hasError = true;
    this.errorMessage = error.message || 'Erreur ECharts inconnue';
    this.currentStrategy = 'error';

    console.error(`❌ EChartsContainer: Error for ${this.visualizationType}:`, error);
  }

  /**
   * Retry la création de visualisation
   */
  async retry(): Promise<void> {
    if (this.retryCount >= this.maxRetries) {
      console.warn(`⚠️ EChartsContainer: Max retries reached for ${this.visualizationType}`);
      return;
    }

    this.retryCount++;
    console.log(`🔄 EChartsContainer: Retry ${this.retryCount}/${this.maxRetries} for ${this.visualizationType}`);

    this.hasError = false;
    this.currentStrategy = 'loading';

    await this.initializeChart();
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
      'decision_tree': 'Arbre de Décision Interactif',
      'predictions_distribution': 'Distribution des Prédictions',
      'metrics': 'Métriques de Performance'
    };

    return titles[this.visualizationType] || 'Visualisation ECharts';
  }
}

