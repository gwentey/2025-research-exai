import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, ActivatedRoute } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatCardModule } from '@angular/material/card';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatChipsModule } from '@angular/material/chips';
import { MatMenuModule } from '@angular/material/menu';
import { MatDividerModule } from '@angular/material/divider';
import { MatTabsModule } from '@angular/material/tabs';
import { Subject, takeUntil } from 'rxjs';
import { TranslateModule } from '@ngx-translate/core';

import { ProjectService } from '../../services/project.service';
import { Project, ProjectRecommendationResponse, DatasetScoredWithDetails, CriterionWeight } from '../../models/project.models';
import { DatasetScored } from '../../models/dataset.models';
import { RecommendationHeatmapComponent } from './components/recommendation-heatmap.component';

@Component({
  selector: 'app-project-detail',
  standalone: true,
  imports: [
    CommonModule,
    MatButtonModule,
    MatIconModule,
    MatCardModule,
    MatProgressSpinnerModule,
    MatTooltipModule,
    MatChipsModule,
    MatMenuModule,
    MatDividerModule,
    MatTabsModule,
    TranslateModule,
    RecommendationHeatmapComponent
  ],
  templateUrl: './project-detail.component.html',
  styleUrls: ['./project-detail.component.scss']
})
export class ProjectDetailComponent implements OnInit, OnDestroy {
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private projectService = inject(ProjectService);
  private destroy$ = new Subject<void>();

  // État
  isLoading = false;
  isLoadingRecommendations = false;
  error: string | null = null;
  projectId: string | null = null;

  // Données
  project: Project | null = null;
  recommendations: DatasetScoredWithDetails[] = [];
  totalRecommendations = 0;

  // Vue
  selectedTab = 0;
  showHeatmap = true;

  // Données pour la heatmap ECharts
  get heatmapDatasets(): DatasetScored[] {
    // Conversion des données pour la heatmap ECharts
    return this.recommendations.map(dataset => ({
      ...dataset,
      // Les données criterion_scores sont déjà disponibles dans DatasetScoredWithDetails
      // On les passe telles quelles car RecommendationHeatmapComponent les utilisera via getCriterionScore
    }));
  }

  get heatmapWeights(): CriterionWeight[] {
    // Utilise les poids du projet ou les poids par défaut
    return this.project?.weights || this.projectService.getDefaultWeights();
  }

  ngOnInit(): void {
    this.route.params.pipe(takeUntil(this.destroy$)).subscribe(params => {
      if (params['id']) {
        this.projectId = params['id'];
        this.loadProject();
        this.loadRecommendations();
      }
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /**
   * Charge le projet
   */
  private loadProject(): void {
    if (!this.projectId) return;

    this.isLoading = true;
    this.projectService.getProject(this.projectId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (project) => {
          this.project = project;
          this.isLoading = false;
        },
        error: (error) => {
          console.error('Erreur lors du chargement du projet:', error);
          this.error = 'Projet non trouvé';
          this.isLoading = false;
        }
      });
  }

  /**
   * Charge les recommandations
   */
  private loadRecommendations(): void {
    if (!this.projectId) return;

    this.isLoadingRecommendations = true;
    this.projectService.getProjectRecommendations(this.projectId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response: ProjectRecommendationResponse) => {
          this.recommendations = response.datasets;
          this.totalRecommendations = response.total_count;
          this.isLoadingRecommendations = false;
        },
        error: (error) => {
          console.error('Erreur lors du chargement des recommandations:', error);
          this.isLoadingRecommendations = false;
        }
      });
  }

  /**
   * Navigation vers l'édition
   */
  editProject(): void {
    if (this.projectId) {
      this.router.navigate(['/projects', this.projectId, 'edit']);
    }
  }

  /**
   * Suppression du projet
   */
  deleteProject(): void {
    if (!this.project || !this.projectId) return;

    const confirmed = confirm(`Êtes-vous sûr de vouloir supprimer le projet "${this.project.name}" ?`);
    
    if (confirmed) {
      this.projectService.deleteProject(this.projectId)
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: () => {
            this.router.navigate(['/projects']);
          },
          error: (error) => {
            console.error('Erreur lors de la suppression:', error);
            this.error = 'Erreur lors de la suppression du projet.';
          }
        });
    }
  }

  /**
   * Retour à la liste des projets
   */
  goBack(): void {
    this.router.navigate(['/projects']);
  }

  /**
   * Toggle de la vue heatmap
   */
  toggleHeatmap(): void {
    this.showHeatmap = !this.showHeatmap;
  }

  /**
   * Obtient les critères formatés pour l'affichage
   */
  getFormattedCriteria(): string {
    if (!this.project?.criteria) {
      return 'Aucun critère défini';
    }
    return this.projectService.formatCriteriaDisplay(this.project.criteria);
  }

  /**
   * Compte le nombre de critères actifs
   */
  getCriteriaCount(): number {
    if (!this.project?.criteria) {
      return 0;
    }
    return this.projectService.calculateCriteriaCount(this.project.criteria);
  }

  /**
   * Obtient les poids formatés pour l'affichage
   */
  getFormattedWeights(): string {
    if (!this.project?.weights || this.project.weights.length === 0) {
      return 'Poids par défaut';
    }
    
    return this.project.weights
      .map(w => `${w.criterion_name} (${(w.weight * 100).toFixed(0)}%)`)
      .join(', ');
  }

  /**
   * Obtient la couleur du score
   */
  getScoreColor(score: number): string {
    return this.projectService.getScoreColor(score);
  }

  /**
   * Formate le score pour l'affichage
   */
  formatScore(score: number): string {
    return this.projectService.formatScore(score);
  }



  /**
   * Navigation vers un dataset
   */
  onViewDataset(dataset: DatasetScoredWithDetails): void {
    // TODO: Navigation vers la page de détail du dataset
    console.log('Visualisation du dataset:', dataset);
  }

  /**
   * Sélection d'un dataset pour le pipeline ML
   */
  onSelectDataset(dataset: DatasetScoredWithDetails): void {
    this.router.navigate(['/projects', this.projectId, 'ml-pipeline', 'wizard'], { 
      queryParams: { 
        datasetId: dataset.id, 
        returnUrl: this.router.url 
      } 
    });
  }

  /**
   * Actualise les recommandations
   */
  refreshRecommendations(): void {
    this.loadRecommendations();
  }

  /**
   * Calcule le score moyen des recommandations
   */
  getAverageScore(): number {
    if (this.recommendations.length === 0) return 0;
    const total = this.recommendations.reduce((acc, r) => acc + r.score, 0);
    return (total / this.recommendations.length) * 100;
  }
} 
