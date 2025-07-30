import { Component, OnInit, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, ActivatedRoute } from '@angular/router';
import { trigger, state, style, transition, animate, query, stagger } from '@angular/animations';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatRippleModule } from '@angular/material/core';
import { MatBadgeModule } from '@angular/material/badge';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { DatasetService } from '../../../services/dataset.service';
import { MlPipelineService } from '../../../services/ml-pipeline.service';
import { ProjectService } from '../../../services/project.service';
import { DatasetDetailView } from '../../../models/dataset.models';
import { AlgorithmInfo } from '../../../models/ml-pipeline.models';
import { Project } from '../../../models/project.models';

@Component({
  selector: 'app-ml-pipeline-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    MatIconModule,
    MatButtonModule,
    MatCardModule,
    MatProgressBarModule,
    MatTooltipModule,
    MatRippleModule,
    MatBadgeModule,
    TranslateModule
  ],
  templateUrl: './ml-pipeline-dashboard.component.html',
  styleUrls: ['./ml-pipeline-dashboard.component.scss'],
  animations: [
    trigger('fadeInUp', [
      transition(':enter', [
        style({ opacity: 0, transform: 'translateY(30px)' }),
        animate('600ms cubic-bezier(0.35, 0, 0.25, 1)', 
          style({ opacity: 1, transform: 'translateY(0)' }))
      ])
    ]),
    trigger('staggerList', [
      transition(':enter', [
        query(':enter', [
          style({ opacity: 0, transform: 'translateY(30px)' }),
          stagger(100, [
            animate('600ms cubic-bezier(0.35, 0, 0.25, 1)', 
              style({ opacity: 1, transform: 'translateY(0)' }))
          ])
        ], { optional: true })
      ])
    ]),
    trigger('pulse', [
      state('active', style({ transform: 'scale(1)' })),
      transition('* => active', [
        animate('300ms ease-in', style({ transform: 'scale(1.05)' })),
        animate('300ms ease-out', style({ transform: 'scale(1)' }))
      ])
    ]),
    trigger('slideIn', [
      transition(':enter', [
        style({ transform: 'translateX(-100%)' }),
        animate('500ms cubic-bezier(0.35, 0, 0.25, 1)')
      ])
    ])
  ]
})
export class MlPipelineDashboardComponent implements OnInit {
  projectId: string = '';
  project: Project | null = null;
  dataset: DatasetDetailView | null = null;
  algorithms: AlgorithmInfo[] = [];
  recentExperiments: any[] = [];
  
  stats = {
    totalExperiments: 0,
    successRate: 0,
    averageAccuracy: 0,
    processingTime: 0
  };
  
  isLoading = false;
  showWelcome = true;
  activeSection = '';
  
  constructor(
    private router: Router,
    private route: ActivatedRoute,
    private datasetService: DatasetService,
    private mlPipelineService: MlPipelineService,
    private projectService: ProjectService,
    private translate: TranslateService
  ) {}
  
  ngOnInit() {
    this.projectId = this.route.snapshot.parent?.params['id'] || '';
    this.loadProjectData();
    this.loadAlgorithms();
    this.checkForDataset();
    this.loadRecentExperiments();
    
    // Animation de bienvenue
    setTimeout(() => {
      this.showWelcome = false;
    }, 3000);
  }
  
  loadProjectData() {
    if (this.projectId) {
      this.projectService.getProject(this.projectId).subscribe({
        next: (project) => {
          this.project = project;
        }
      });
    }
  }
  
  loadAlgorithms() {
    this.mlPipelineService.getAvailableAlgorithms().subscribe({
      next: (algorithms) => {
        this.algorithms = algorithms;
      }
    });
  }
  
  checkForDataset() {
    this.route.queryParams.subscribe(params => {
      const datasetId = params['datasetId'];
      if (datasetId) {
        this.loadDataset(datasetId);
      }
    });
  }
  
  loadDataset(datasetId: string) {
    this.isLoading = true;
    this.datasetService.getDatasetDetails(datasetId).subscribe({
      next: (dataset: any) => {
        this.dataset = dataset;
        this.isLoading = false;
      },
      error: () => {
        this.isLoading = false;
      }
    });
  }
  
  loadRecentExperiments() {
    if (this.projectId) {
      this.mlPipelineService.getUserExperiments(this.projectId).subscribe({
        next: (experiments) => {
          this.recentExperiments = experiments.slice(0, 5);
          this.calculateStats(experiments);
        }
      });
    }
  }
  
  calculateStats(experiments: any[]) {
    this.stats.totalExperiments = experiments.length;
    
    const completed = experiments.filter(e => e.status === 'completed');
    this.stats.successRate = experiments.length > 0 
      ? (completed.length / experiments.length) * 100 
      : 0;
    
    const accuracies = completed
      .map(e => e.metrics?.accuracy || 0)
      .filter(acc => acc > 0);
    
    this.stats.averageAccuracy = accuracies.length > 0
      ? accuracies.reduce((sum, acc) => sum + acc, 0) / accuracies.length * 100
      : 0;
    
    // Temps moyen (simulé pour la démo)
    this.stats.processingTime = completed.length > 0 ? 15 : 0;
  }
  
  navigateToDatasetSelection() {
    // Rediriger vers la page datasets principale si on n'a pas de projet
    if (!this.projectId) {
      this.router.navigate(['/datasets']);
    } else {
      this.router.navigate(['/projects', this.projectId, 'datasets']);
    }
  }
  
  startNewExperiment() {
    if (this.dataset) {
      this.router.navigate(['/ml-pipeline-wizard'], {
        queryParams: {
          datasetId: this.dataset.id,
          datasetName: this.dataset.dataset_name
        }
      });
    } else {
      this.navigateToDatasetSelection();
    }
  }
  
  viewExperimentDetails(experimentId: string) {
    this.router.navigate(['experiment', experimentId], {
      relativeTo: this.route
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
  
  getStatusClass(status: string): string {
    return `status-${status}`;
  }
  
  formatDuration(minutes: number): string {
    if (minutes < 60) {
      return `${minutes} min`;
    }
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}h ${mins}min`;
  }
  
  getTopHyperparameters(algo: AlgorithmInfo): string[] {
    if (!algo.hyperparameters) return [];
    
    return Object.keys(algo.hyperparameters).slice(0, 3);
  }
}