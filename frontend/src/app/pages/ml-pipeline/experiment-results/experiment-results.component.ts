import { Component, OnInit } from '@angular/core';
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
import { Chart, registerables } from 'chart.js';
import { MlPipelineService } from '../../../services/ml-pipeline.service';
import { ExperimentStatus, ExperimentResults } from '../../../models/ml-pipeline.models';

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
    TranslateModule
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
export class ExperimentResultsComponent implements OnInit {
  experimentId: string = '';
  projectId: string = '';
  experiment: any = null;
  results: ExperimentResults | null = null;
  isLoading = true;
  
  // Charts
  confusionMatrixChart: Chart | null = null;
  rocCurveChart: Chart | null = null;
  featureImportanceChart: Chart | null = null;
  
  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private mlPipelineService: MlPipelineService,
    private translate: TranslateService
  ) {}
  
  ngOnInit() {
    this.experimentId = this.route.snapshot.params['id'];
    this.projectId = this.route.snapshot.parent?.parent?.params['id'] || '';
    
    this.loadExperimentDetails();
  }
  
  loadExperimentDetails() {
    this.mlPipelineService.getExperimentStatus(this.experimentId).subscribe({
      next: (status) => {
        this.experiment = status;
        
        if (status.status === 'completed') {
          this.loadResults();
        } else {
          this.isLoading = false;
        }
      },
      error: () => {
        this.isLoading = false;
      }
    });
  }
  
  loadResults() {
    this.mlPipelineService.getExperimentResults(this.experimentId).subscribe({
      next: (results) => {
        this.results = results;
        this.isLoading = false;
        
        // Créer les visualisations après un court délai
        setTimeout(() => {
          this.createVisualizationCharts();
        }, 100);
      },
      error: () => {
        this.isLoading = false;
      }
    });
  }
  
  createVisualizationCharts() {
    // Les visualisations sont déjà générées côté backend
    // Nous affichons simplement les images base64
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
      case 'completed': return 'success';
      case 'running': return 'primary';
      case 'failed': return 'warn';
      default: return '';
    }
  }
  
  downloadModel() {
    if (this.results?.model_uri) {
      // Implémenter le téléchargement du modèle
      console.log('Télécharger le modèle:', this.results.model_uri);
    }
  }
  
  goBack() {
    this.router.navigate(['../../'], { relativeTo: this.route });
  }
  
  runNewExperiment() {
    this.router.navigate(['../../ml-studio'], { 
      relativeTo: this.route,
      queryParams: {
        copyFrom: this.experimentId
      }
    });
  }
  
  getVisualizationUrl(vizKey: string): string {
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
}