import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, ActivatedRoute } from '@angular/router';
import { trigger, state, style, transition, animate } from '@angular/animations';
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
        style({ opacity: 0 }),
        animate('600ms ease-in', style({ opacity: 1 }))
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
  
  // Pagination
  pageSize = 10;
  pageIndex = 0;
  totalItems = 0;
  
  isLoading = true;
  
  constructor(
    private router: Router,
    private route: ActivatedRoute,
    private mlPipelineService: MlPipelineService,
    private translate: TranslateService
  ) {}
  
  ngOnInit() {
    this.projectId = this.route.snapshot.parent?.parent?.params['id'] || '';
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
    
    this.filteredExperiments = filtered;
    this.totalItems = filtered.length;
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
    this.router.navigate(['../experiment', experimentId], { relativeTo: this.route });
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
}