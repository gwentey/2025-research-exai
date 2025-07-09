import { Component, Input, OnChanges, SimpleChanges, ElementRef, ViewChild, AfterViewInit, OnDestroy, PLATFORM_ID, Inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { DatasetScored } from '../../../models/dataset.models';
import { CriterionWeight } from '../../../models/project.models';

// Déclaration globale pour ECharts
declare global {
  interface Window {
    echarts: any;
  }
}

@Component({
  selector: 'app-recommendation-heatmap',
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule,
    MatIconModule,
    MatTooltipModule
  ],
  template: `
    <mat-card class="heatmap-card" *ngIf="datasets.length > 0 && activeCriteria.length > 0">
      <mat-card-header>
        <mat-card-title class="d-flex align-items-center">
          <mat-icon class="m-r-8">insights</mat-icon>
          Heat Map des Recommandations Apache ECharts
        </mat-card-title>
        <mat-card-subtitle>
          Visualisation interactive Apache ECharts - {{ datasets.length }} datasets sur {{ activeCriteria.length }} critères
        </mat-card-subtitle>
      </mat-card-header>
      
      <mat-card-content class="heatmap-content">
        <!-- Légende explicative -->
        <div class="legend-info m-b-16">
          <div class="d-flex align-items-center gap-16">
            <div class="legend-item">
              <div class="legend-color" style="background: #f44336;"></div>
              <span class="mat-caption">Faible (0-30%)</span>
            </div>
            <div class="legend-item">
              <div class="legend-color" style="background: #ff9800;"></div>
              <span class="mat-caption">Moyen (30-60%)</span>
            </div>
            <div class="legend-item">
              <div class="legend-color" style="background: #4caf50;"></div>
              <span class="mat-caption">Bon (60-85%)</span>
            </div>
            <div class="legend-item">
              <div class="legend-color" style="background: #2196f3;"></div>
              <span class="mat-caption">Excellent (85%+)</span>
            </div>
          </div>
        </div>

        <!-- Container ECharts -->
        <div #chartContainer 
             id="echarts-heatmap-{{ componentId }}"
             style="width: 100%; height: 500px; background: white; border-radius: 4px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
        </div>

        <!-- Informations -->
        <div class="heatmap-info m-t-16">
          <div class="d-flex align-items-center gap-16">
            <div class="info-item">
              <mat-icon class="text-primary">analytics</mat-icon>
              <span class="mat-caption m-l-4">{{ activeCriteria.length }} critères analysés</span>
            </div>
            <div class="info-item">
              <mat-icon class="text-primary">storage</mat-icon>
              <span class="mat-caption m-l-4">{{ datasets.length }} datasets comparés</span>
            </div>
            <div class="info-item">
              <mat-icon class="text-primary">mouse</mat-icon>
              <span class="mat-caption m-l-4">Apache ECharts CDN</span>
            </div>
          </div>
        </div>

        <!-- Message de chargement -->
        <div *ngIf="isLoadingECharts" class="loading-echarts text-center p-20">
          <mat-icon class="icon-24 text-primary">hourglass_empty</mat-icon>
          <p class="mat-caption m-t-8">Chargement d'ECharts...</p>
        </div>

        <!-- Message si pas de données -->
        <div *ngIf="activeCriteria.length === 0" class="no-data text-center p-20">
          <mat-icon class="icon-48 text-muted">tune</mat-icon>
          <p class="mat-body-1 m-t-12">Configurez des poids pour afficher la heat map ECharts</p>
        </div>
      </mat-card-content>
    </mat-card>
  `,
  styles: [`
    .heatmap-card {
      margin-top: 20px;
    }

    .heatmap-content {
      overflow-x: auto;
    }

    .legend-info {
      .legend-item {
        display: flex;
        align-items: center;
        gap: 8px;

        .legend-color {
          width: 18px;
          height: 16px;
          border-radius: 3px;
          border: 1px solid #ddd;
        }
      }
    }

    .heatmap-info {
      border-top: 1px solid #e0e0e0;
      padding-top: 16px;

      .info-item {
        display: flex;
        align-items: center;
        color: #666;
      }
    }

    .no-data, .loading-echarts {
      .icon-48 {
        font-size: 48px !important;
        width: 48px !important;
        height: 48px !important;
      }
      .icon-24 {
        font-size: 24px !important;
        width: 24px !important;
        height: 24px !important;
      }
    }
  `]
})
export class RecommendationHeatmapComponent implements OnChanges, AfterViewInit, OnDestroy {
  @Input() datasets: DatasetScored[] = [];
  @Input() weights: CriterionWeight[] = [];
  @ViewChild('chartContainer', { static: false }) chartContainer!: ElementRef;

  activeCriteria: CriterionWeight[] = [];
  private myChart: any = null;
  isLoadingECharts = true;
  componentId: string;

  constructor(@Inject(PLATFORM_ID) private platformId: Object) {
    this.componentId = Math.random().toString(36).substr(2, 9);
  }

  ngAfterViewInit(): void {
    if (isPlatformBrowser(this.platformId)) {
      this.loadECharts();
    }
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['weights'] || changes['datasets']) {
      this.activeCriteria = this.weights.filter(w => w.weight > 0);
      if (!this.isLoadingECharts) {
        this.updateChart();
      }
    }
  }

  ngOnDestroy(): void {
    if (this.myChart) {
      this.myChart.dispose();
    }
  }

  private loadECharts(): void {
    // Vérifier si ECharts est déjà chargé
    if (typeof window !== 'undefined' && window.echarts) {
      this.isLoadingECharts = false;
      this.initChart();
      return;
    }

    // Charger ECharts via CDN
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/echarts@5.4.3/dist/echarts.min.js';
    script.onload = () => {
      this.isLoadingECharts = false;
      this.initChart();
    };
    script.onerror = () => {
      console.error('Impossible de charger ECharts depuis le CDN');
      this.isLoadingECharts = false;
    };
    document.head.appendChild(script);
  }

  private initChart(): void {
    if (this.chartContainer?.nativeElement && window.echarts) {
      this.myChart = window.echarts.init(this.chartContainer.nativeElement);
      this.updateChart();
    }
  }

  private updateChart(): void {
    if (!this.myChart || this.datasets.length === 0 || this.activeCriteria.length === 0) {
      return;
    }

    // Préparer les données pour ECharts heatmap
    const xAxisData = this.activeCriteria.map(c => this.getCriterionLabel(c.criterion_name));
    const yAxisData = this.datasets.map(d => d.dataset_name);

    // Données de la heatmap sous format [x, y, value]
    const data: (number | string)[][] = [];
    
    this.datasets.forEach((dataset, datasetIndex) => {
      this.activeCriteria.forEach((criterion, criterionIndex) => {
        const score = this.getCriterionScore(dataset, criterion.criterion_name);
        data.push([criterionIndex, datasetIndex, score]);
      });
    });

    // Configuration ECharts selon votre exemple
    const option = {
      tooltip: {
        position: 'top',
        formatter: (params: any) => {
          const criterionIndex = params.data[0];
          const datasetIndex = params.data[1];
          const score = params.data[2];
          
          const criterion = this.activeCriteria[criterionIndex];
          const dataset = this.datasets[datasetIndex];
          
          return `
            <div style="padding: 8px;">
              <strong>${dataset.dataset_name}</strong><br/>
              <span style="color: #666;">Critère:</span> ${this.getCriterionLabel(criterion.criterion_name)}<br/>
              <span style="color: #666;">Score:</span> <strong>${(score * 100).toFixed(1)}%</strong><br/>
              <span style="color: #666;">Poids:</span> ${(criterion.weight * 100).toFixed(0)}%<br/>
              <hr style="margin: 8px 0; border: none; border-top: 1px solid #eee;">
              <span style="color: #666; font-size: 12px;">
                ${dataset.instances_number?.toLocaleString()} instances
                ${dataset.features_number ? '• ' + dataset.features_number + ' variables' : ''}
              </span>
            </div>
          `;
        }
      },
      grid: {
        height: '70%',
        top: '10%',
        left: '15%',
        right: '10%'
      },
      xAxis: {
        type: 'category',
        data: xAxisData,
        splitArea: {
          show: true
        },
        axisLabel: {
          rotate: 45,
          fontSize: 11,
          color: '#666'
        }
      },
      yAxis: {
        type: 'category',
        data: yAxisData,
        splitArea: {
          show: true
        },
        axisLabel: {
          fontSize: 11,
          color: '#666',
          width: 120,
          overflow: 'truncate'
        }
      },
      visualMap: {
        min: 0,
        max: 1,
        calculable: true,
        orient: 'horizontal',
        left: 'center',
        bottom: '5%',
        inRange: {
          color: [
            '#ffebee', // 0% - Rouge très clair
            '#ffcdd2', // 20%
            '#fff3e0', // 40% - Orange clair  
            '#ffe0b2', // 60%
            '#e8f5e8', // 80% - Vert clair
            '#c8e6c9', // 90%
            '#e3f2fd', // 95% - Bleu clair
            '#2196f3'  // 100% - Bleu
          ]
        },
        text: ['Excellent', 'Faible'],
        textStyle: {
          color: '#666',
          fontSize: 11
        }
      },
      series: [
        {
          name: 'Scores par Critère',
          type: 'heatmap',
          data: data,
          label: {
            show: true,
            formatter: (params: any) => `${(params.data[2] * 100).toFixed(0)}%`,
            fontSize: 10,
            color: '#333',
            fontWeight: 'bold'
          },
          emphasis: {
            itemStyle: {
              shadowBlur: 10,
              shadowColor: 'rgba(0, 0, 0, 0.5)'
            }
          },
          itemStyle: {
            borderWidth: 1,
            borderColor: '#fff'
          }
        }
      ],
      animation: true,
      animationDuration: 1000
    };

    // Appliquer la configuration à ECharts
    this.myChart.setOption(option);

    // Redimensionnement responsive
    window.addEventListener('resize', () => {
      if (this.myChart) {
        this.myChart.resize();
      }
    });
  }

  getCriterionLabel(criterionName: string): string {
    const labels: { [key: string]: string } = {
      'ethical_score': 'Éthique',
      'technical_score': 'Technique',
      'popularity_score': 'Popularité',
      'anonymization': 'Anonymisation',
      'transparency': 'Transparence',
      'informed_consent': 'Consentement',
      'documentation': 'Documentation',
      'data_quality': 'Qualité'
    };
    return labels[criterionName] || criterionName;
  }

  getCriterionScore(dataset: DatasetScored, criterionName: string): number {
    switch (criterionName) {
      case 'ethical_score':
        return this.calculateEthicalScore(dataset);
      case 'technical_score':
        return this.calculateTechnicalScore(dataset);
      case 'popularity_score':
        return this.calculatePopularityScore(dataset);
      case 'anonymization':
        return dataset.anonymization_applied ? 1.0 : 0.0;
      case 'transparency':
        return dataset.transparency ? 1.0 : 0.0;
      case 'informed_consent':
        return dataset.informed_consent ? 1.0 : 0.0;
      case 'documentation':
        return dataset.external_documentation_available ? 1.0 : 0.0;
      case 'data_quality':
        return this.calculateDataQualityScore(dataset);
      default:
        return Math.random() * 0.5 + 0.3;
    }
  }

  private calculateEthicalScore(dataset: DatasetScored): number {
    let score = 0;
    let criteria = 0;
    
    const ethicalCriteria = [
      dataset.informed_consent,
      dataset.transparency, 
      dataset.anonymization_applied
    ];
    
    ethicalCriteria.forEach(criterion => {
      if (criterion !== undefined) {
        criteria++;
        if (criterion) score++;
      }
    });
    
    return criteria > 0 ? score / criteria : 0.5;
  }

  private calculateTechnicalScore(dataset: DatasetScored): number {
    let score = 0.5;
    
    if (dataset.external_documentation_available) score += 0.2;
    if (dataset.split) score += 0.15;
    if (!dataset.has_missing_values) score += 0.15;
    if (dataset.instances_number && dataset.instances_number > 10000) score += 0.1;
    
    return Math.min(score, 1.0);
  }

  private calculatePopularityScore(dataset: DatasetScored): number {
    if (!dataset.num_citations) return 0.1;
    const logCitations = Math.log10(Math.max(1, dataset.num_citations));
    return Math.min(logCitations / 4, 1.0);
  }

  private calculateDataQualityScore(dataset: DatasetScored): number {
    let score = 0.5;
    
    if (!dataset.has_missing_values) {
      score += 0.3;
    } else if (dataset.global_missing_percentage !== undefined) {
      score += (100 - dataset.global_missing_percentage) / 100 * 0.3;
    }
    
    return Math.min(score, 1.0);
  }
} 