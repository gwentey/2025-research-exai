import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, ActivatedRoute } from '@angular/router';
import { trigger, state, style, transition, animate, query, stagger } from '@angular/animations';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTableModule } from '@angular/material/table';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatSortModule, Sort } from '@angular/material/sort';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatChipsModule } from '@angular/material/chips';
import { MatCardModule } from '@angular/material/card';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { MlPipelineService } from '../../../services/ml-pipeline.service';
import { ExperimentRead } from '../../../models/ml-pipeline.models';

@Component({
  selector: 'app-experiments-list',
  standalone: true,
  imports: [
    CommonModule,
    MatIconModule,
    MatButtonModule,
    MatTableModule,
    MatPaginatorModule,
    MatSortModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatChipsModule,
    MatCardModule,
    MatProgressBarModule,
    MatTooltipModule,
    TranslateModule
  ],
  templateUrl: './experiments-list.component.html',
  styleUrls: ['./experiments-list.component.scss'],
  animations: [
    trigger('fadeIn', [
      transition(':enter', [
        style({ opacity: 0, transform: 'translateY(20px)' }),
        animate('600ms cubic-bezier(0.35, 0, 0.25, 1)', style({ opacity: 1, transform: 'translateY(0)' }))
      ])
    ]),
    trigger('slideInUp', [
      transition(':enter', [
        style({ opacity: 0, transform: 'translateY(30px)' }),
        animate('{{ delay || "0ms" }} {{ duration || "400ms" }} cubic-bezier(0.35, 0, 0.25, 1)', 
                style({ opacity: 1, transform: 'translateY(0)' }))
      ])
    ]),
    trigger('slideInLeft', [
      transition(':enter', [
        style({ opacity: 0, transform: 'translateX(-20px)' }),
        animate('400ms cubic-bezier(0.35, 0, 0.25, 1)', style({ opacity: 1, transform: 'translateX(0)' }))
      ])
    ]),
    trigger('scaleIn', [
      transition(':enter', [
        style({ opacity: 0, transform: 'scale(0.8)' }),
        animate('500ms cubic-bezier(0.35, 0, 0.25, 1)', style({ opacity: 1, transform: 'scale(1)' }))
      ])
    ]),
    trigger('expandCollapse', [
      transition(':enter', [
        style({ height: '0', opacity: 0, overflow: 'hidden' }),
        animate('300ms ease-in-out', style({ height: '*', opacity: 1 }))
      ]),
      transition(':leave', [
        style({ height: '*', opacity: 1, overflow: 'hidden' }),
        animate('300ms ease-in-out', style({ height: '0', opacity: 0 }))
      ])
    ])
  ]
})
export class ExperimentsListComponent implements OnInit {
  projectId: string = '';
  experiments: ExperimentRead[] = [];
  filteredExperiments: ExperimentRead[] = [];
  displayedColumns: string[] = ['algorithm', 'status', 'accuracy', 'created_at', 'actions'];
  
  // Filtres
  searchTerm: string = '';
  statusFilter: string = 'all';
  algorithmFilter: string = 'all';
  
  // Quick Filters
  isHighPerformanceFilterActive = false;
  isRecentFilterActive = false;
  
  // UI State
  showCodeInsights = false;
  searchSuggestions: string[] = [];
  
  // Pagination
  pageSize = 10;
  pageIndex = 0;
  totalItems = 0;
  
  isLoading = true;
  
  constructor(
    public router: Router, // 👈 Rendu public pour l'accès depuis le template
    private route: ActivatedRoute,
    private mlPipelineService: MlPipelineService,
    private translate: TranslateService
  ) {}
  
  ngOnInit() {
    // 🐛 DEBUG: Analysons la structure des routes pour trouver le projectId
    console.log('🔍 DEBUG Route Analysis:');
    console.log('- Current route:', this.route.snapshot);
    console.log('- Parent route:', this.route.snapshot.parent);
    console.log('- Parent.parent route:', this.route.snapshot.parent?.parent);
    console.log('- URL segments:', this.route.snapshot.url);
    console.log('- Full URL:', this.router.url);
    
    // Plusieurs méthodes pour extraire le projectId
    let projectId = '';
    
    // Méthode 1: parent.parent.params
    const method1 = this.route.snapshot.parent?.parent?.params['id'];
    console.log('📋 Method 1 (parent.parent.params):', method1);
    
    // Méthode 2: analyser l'URL directement
    const urlParts = this.router.url.split('/');
    const projectIndex = urlParts.indexOf('projects');
    const method2 = projectIndex !== -1 && urlParts[projectIndex + 1] && urlParts[projectIndex + 1] !== '' ? urlParts[projectIndex + 1] : '';
    console.log('📋 Method 2 (URL parsing):', method2);
    
    // Méthode 3: params de la route actuelle si elle contient l'id
    const method3 = this.route.snapshot.params['id'];
    console.log('📋 Method 3 (current params):', method3);
    
    // Utiliser la meilleure méthode
    projectId = method1 || method2 || method3 || '';
    console.log('✅ Final projectId selected:', projectId);
    
    this.projectId = projectId;
    this.loadExperiments();
  }
  
  loadExperiments() {
    this.isLoading = true;
    this.mlPipelineService.getUserExperiments(this.projectId).subscribe({
      next: (experiments) => {
        this.experiments = experiments;
        this.applyFilters();
        this.isLoading = false;
      },
      error: () => {
        this.isLoading = false;
      }
    });
  }
  

  
  onSearch(event: Event) {
    this.searchTerm = (event.target as HTMLInputElement).value;
    this.applyFilters();
  }
  
  onStatusFilterChange(status: string) {
    this.statusFilter = status;
    this.applyFilters();
  }
  
  onAlgorithmFilterChange(algorithm: string) {
    this.algorithmFilter = algorithm;
    this.applyFilters();
  }
  
  viewResults(experimentId: string) {
    console.log('🎯 Navigating to experiment:', experimentId, 'for project:', this.projectId);
    
    // Si projectId vide, réessayer de l'extraire en temps réel
    if (!this.projectId) {
      const urlParts = this.router.url.split('/');
      const projectIndex = urlParts.indexOf('projects');
      const dynamicProjectId = projectIndex !== -1 && urlParts[projectIndex + 1] ? urlParts[projectIndex + 1] : '';
      console.log('🔄 Re-extracted projectId from URL:', dynamicProjectId);
      
      if (dynamicProjectId) {
        this.projectId = dynamicProjectId;
      }
    }
    
    if (this.projectId && this.projectId.trim() !== '') {
      // Navigation absolue avec projectId pour éviter le double slash
      const targetUrl = `/projects/${this.projectId}/ml-pipeline/experiment/${experimentId}`;
      console.log('✅ Navigating to:', targetUrl);
      this.router.navigateByUrl(targetUrl);
    } else {
      // Fallback vers navigation sans projectId
      console.warn('⚠️ No projectId found, using fallback navigation');
      const fallbackUrl = `/ml-pipeline/experiment/${experimentId}`;
      console.log('🔄 Fallback navigation to:', fallbackUrl);
      this.router.navigateByUrl(fallbackUrl);
    }
  }
  
  duplicateExperiment(experimentId: string) {
    this.router.navigate(['../ml-studio'], { 
      relativeTo: this.route,
      queryParams: { copyFrom: experimentId }
    });
  }
  
  getStatusIcon(status: string): string {
    switch (status) {
      case 'completed': return 'check_circle';
      case 'running': return 'sync';
      case 'failed': return 'error';
      default: return 'pending';
    }
  }
  
  getStatusColor(status: string): string {
    switch (status) {
      case 'completed': return 'success';
      case 'running': return 'primary';
      case 'failed': return 'warn';
      default: return '';
    }
  }
  
  getAccuracy(experiment: ExperimentRead): string {
    if (experiment.metrics && experiment.metrics['accuracy']) {
      return (experiment.metrics['accuracy'] * 100).toFixed(1) + '%';
    }
    return '-';
  }

  getCompletedCount(): number {
    return this.experiments.filter(e => e.status === 'completed').length;
  }

  getRunningCount(): number {
    return this.experiments.filter(e => e.status === 'running').length;
  }
  
  goBack() {
    this.router.navigate(['../../'], { relativeTo: this.route });
  }
  
  createNewExperiment() {
    this.router.navigate(['../ml-studio'], { relativeTo: this.route });
  }
  
  calculateAverageAccuracy(): string {
    const completedExperiments = this.experiments.filter(e => 
      e.status === 'completed' && e.metrics && e.metrics['accuracy']
    );
    
    if (completedExperiments.length === 0) return '0';
    
    const totalAccuracy = completedExperiments.reduce((sum, exp) => 
      sum + ((exp.metrics && exp.metrics['accuracy']) || 0), 0
    );
    
    return ((totalAccuracy / completedExperiments.length) * 100).toFixed(1);
  }
  
  calculateSuccessRate(): string {
    if (this.experiments.length === 0) return '0';
    
    const successCount = this.experiments.filter(e => 
      e.status === 'completed'
    ).length;
    
    return ((successCount / this.experiments.length) * 100).toFixed(0);
  }
  
  // === NOUVELLES MÉTHODES POUR L'INTERFACE MODERNE ===
  
  /**
   * Toggle code insights panel
   */
  toggleCodeInsights(): void {
    this.showCodeInsights = !this.showCodeInsights;
  }
  
  /**
   * Open insights panel
   */
  openInsightsPanel(): void {
    this.showCodeInsights = true;
  }
  
  /**
   * Apply search suggestion
   */
  applySuggestion(suggestion: string): void {
    this.searchTerm = suggestion;
    this.applyFilters();
    this.searchSuggestions = [];
  }
  
  /**
   * Filter by high performance (>80% accuracy)
   */
  filterByHighPerformance(): void {
    this.isHighPerformanceFilterActive = !this.isHighPerformanceFilterActive;
    this.isRecentFilterActive = false;
    this.applyFilters();
  }
  
  /**
   * Filter by recent (last 7 days)
   */
  filterByRecent(): void {
    this.isRecentFilterActive = !this.isRecentFilterActive;
    this.isHighPerformanceFilterActive = false;
    this.applyFilters();
  }
  
  /**
   * Track by function for ngFor
   */
  trackByExperiment(index: number, experiment: ExperimentRead): string {
    return experiment.id;
  }
  
  /**
   * Get algorithm CSS class
   */
  getAlgorithmClass(algorithm: string): string {
    return algorithm.replace('_', '-').toLowerCase();
  }
  
  /**
   * Get algorithm icon
   */
  getAlgorithmIcon(algorithm: string): string {
    return algorithm === 'decision_tree' ? 'account_tree' : 'forest';
  }
  
  /**
   * Get algorithm display name
   */
  getAlgorithmDisplayName(algorithm: string): string {
    const names: { [key: string]: string } = {
      'decision_tree': 'Decision Tree',
      'random_forest': 'Random Forest'
    };
    return names[algorithm] || algorithm;
  }
  
  /**
   * Get status CSS class
   */
  getStatusClass(status: string): string {
    return status.toLowerCase();
  }
  
  /**
   * Get status display name
   */
  getStatusDisplayName(status: string): string {
    return `ML_PIPELINE.STATUS.${status.toUpperCase()}`;
  }
  
  /**
   * Get accuracy as progress value (0-100)
   */
  getAccuracyProgress(experiment: ExperimentRead): number {
    if (!experiment.metrics?.['accuracy']) return 0;
    return Math.round(experiment.metrics['accuracy'] * 100);
  }
  
  /**
   * Check if experiment has additional metrics
   */
  hasAdditionalMetrics(experiment: ExperimentRead): boolean {
    if (!experiment.metrics) return false;
    const basicMetrics = ['accuracy'];
    return Object.keys(experiment.metrics).some(key => !basicMetrics.includes(key));
  }
  
  /**
   * Get top 3 additional metrics for display
   */
  getTopMetrics(experiment: ExperimentRead): Array<{name: string, value: string}> {
    if (!experiment.metrics) return [];
    
    const excludeKeys = ['accuracy'];
    const metrics = Object.entries(experiment.metrics)
      .filter(([key]) => !excludeKeys.includes(key))
      .slice(0, 3)
      .map(([key, value]) => ({
        name: this.getMetricShortName(key),
        value: this.formatMetricValue(key, value)
      }));
    
    return metrics;
  }
  
  /**
   * Get short name for metric
   */
  getMetricShortName(metricKey: string): string {
    const shortNames: { [key: string]: string } = {
      'precision': 'Prec.',
      'recall': 'Rec.',
      'f1_score': 'F1',
      'roc_auc': 'AUC',
      'mae': 'MAE',
      'mse': 'MSE',
      'rmse': 'RMSE',
      'r2': 'R²'
    };
    return shortNames[metricKey] || metricKey;
  }
  
  /**
   * Format metric value for display
   */
  formatMetricValue(key: string, value: any): string {
    if (typeof value !== 'number') return String(value);
    
    if (['accuracy', 'precision', 'recall', 'f1_score', 'roc_auc'].includes(key)) {
      return (value * 100).toFixed(1) + '%';
    }
    
    return value.toFixed(3);
  }
  
  /**
   * Get relative time for display
   */
  getRelativeTime(dateString: string): string {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);
    
    if (diffMins < 60) {
      return `${diffMins}m`;
    } else if (diffHours < 24) {
      return `${diffHours}h`;
    } else if (diffDays < 7) {
      return `${diffDays}j`;
    } else {
      return date.toLocaleDateString();
    }
  }
  
  /**
   * Delete experiment
   */
  deleteExperiment(experimentId: string): void {
    // TODO: Implement delete functionality
    console.log('Delete experiment:', experimentId);
  }
  
  /**
   * Calculate accuracy standard deviation for pandas insights
   */
  calculateAccuracyStd(): string {
    const completedExperiments = this.experiments.filter(e => 
      e.status === 'completed' && e.metrics && e.metrics['accuracy']
    );
    
    if (completedExperiments.length === 0) return '0.0';
    
    const accuracies = completedExperiments.map(e => e.metrics!['accuracy'] as number);
    const mean = accuracies.reduce((sum, acc) => sum + acc, 0) / accuracies.length;
    const variance = accuracies.reduce((sum, acc) => sum + Math.pow(acc - mean, 2), 0) / accuracies.length;
    const std = Math.sqrt(variance);
    
    return (std * 100).toFixed(1);
  }
  
  /**
   * Get best accuracy for pandas insights
   */
  getBestAccuracy(): string {
    const completedExperiments = this.experiments.filter(e => 
      e.status === 'completed' && e.metrics && e.metrics['accuracy']
    );
    
    if (completedExperiments.length === 0) return '0.0';
    
    const maxAccuracy = Math.max(...completedExperiments.map(e => e.metrics!['accuracy'] as number));
    return (maxAccuracy * 100).toFixed(1);
  }
  
  /**
   * Get algorithm performance summary for pandas insights
   */
  getAlgorithmPerformance(): Array<{name: string, icon: string, avgScore: string, scoreClass: string}> {
    const algorithms = ['decision_tree', 'random_forest'];
    
    return algorithms.map(algo => {
      const experiments = this.experiments.filter(e => 
        e.algorithm === algo && e.status === 'completed' && e.metrics?.['accuracy']
      );
      
      if (experiments.length === 0) {
        return {
          name: this.getAlgorithmDisplayName(algo),
          icon: this.getAlgorithmIcon(algo),
          avgScore: '0.0',
          scoreClass: 'low'
        };
      }
      
      const avgAccuracy = experiments.reduce((sum, exp) => 
        sum + (exp.metrics!['accuracy'] as number), 0) / experiments.length;
      
      const score = (avgAccuracy * 100).toFixed(1);
      let scoreClass = 'low';
      if (avgAccuracy >= 0.9) scoreClass = 'excellent';
      else if (avgAccuracy >= 0.8) scoreClass = 'good';
      else if (avgAccuracy >= 0.7) scoreClass = 'medium';
      
      return {
        name: this.getAlgorithmDisplayName(algo),
        icon: this.getAlgorithmIcon(algo),
        avgScore: score,
        scoreClass
      };
    }).filter(algo => algo.avgScore !== '0.0'); // Only show algorithms with data
  }
  
  /**
   * Apply filters to include new filter types
   */
  applyFilters() {
    let filtered = [...this.experiments];
    
    // Filtre par recherche
    if (this.searchTerm) {
      const term = this.searchTerm.toLowerCase();
      filtered = filtered.filter(exp => 
        exp.algorithm.toLowerCase().includes(term) ||
        exp.id.toLowerCase().includes(term)
      );
    }
    
    // Filtre par statut
    if (this.statusFilter !== 'all') {
      filtered = filtered.filter(exp => exp.status === this.statusFilter);
    }
    
    // Filtre par algorithme
    if (this.algorithmFilter !== 'all') {
      filtered = filtered.filter(exp => exp.algorithm === this.algorithmFilter);
    }
    
    // Quick filters
    if (this.isHighPerformanceFilterActive) {
      filtered = filtered.filter(exp => 
        exp.metrics?.['accuracy'] && exp.metrics['accuracy'] > 0.8
      );
    }
    
    if (this.isRecentFilterActive) {
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      filtered = filtered.filter(exp => 
        new Date(exp.created_at) > weekAgo
      );
    }
    
    this.filteredExperiments = filtered;
    this.totalItems = filtered.length;
  }
}