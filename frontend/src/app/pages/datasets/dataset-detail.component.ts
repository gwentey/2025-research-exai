import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MatTabsModule } from '@angular/material/tabs';
import { MatTableModule } from '@angular/material/table';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatDividerModule } from '@angular/material/divider';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatListModule } from '@angular/material/list';
import { MatBadgeModule } from '@angular/material/badge';
import { MatMenuModule } from '@angular/material/menu';
import { MatDialogModule } from '@angular/material/dialog';
import { MatSnackBarModule } from '@angular/material/snack-bar';
import { Subject, takeUntil, forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

import { DatasetService } from '../../services/dataset.service';
import { 
  DatasetDetailView, 
  DatasetPreview, 
  DatasetQualityMetrics,
  DataDistributionAnalysis,
  ColumnStatistics,
  DatasetFileMetadata,
  Dataset,
  DataQualityAlert
} from '../../models/dataset.models';

@Component({
  selector: 'app-dataset-detail',
  standalone: true,
  imports: [
    CommonModule,
    MatButtonModule,
    MatIconModule,
    MatCardModule,
    MatChipsModule,
    MatTabsModule,
    MatTableModule,
    MatProgressSpinnerModule,
    MatProgressBarModule,
    MatDividerModule,
    MatTooltipModule,
    MatExpansionModule,
    MatListModule,
    MatBadgeModule,
    MatMenuModule,
    MatDialogModule,
    MatSnackBarModule,
    TranslateModule
  ],
  templateUrl: './dataset-detail.component.html',
  styleUrls: ['./dataset-detail.component.scss']
})
export class DatasetDetailComponent implements OnInit, OnDestroy {
  private datasetService = inject(DatasetService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private translateService = inject(TranslateService);
  private destroy$ = new Subject<void>();

  // État du composant
  isLoading = true;
  error: string | null = null;
  datasetId: string | null = null;

  // Données du dataset
  dataset: DatasetDetailView | null = null;
  preview: DatasetPreview | null = null;
  qualityMetrics: DatasetQualityMetrics | null = null;
  distributionAnalysis: DataDistributionAnalysis | null = null;
  similarDatasets: Dataset[] = [];

  // État de l'interface
  selectedTabIndex = 0;
  selectedFileIndex = 0;
  showAllColumns = false;
  showAllCorrelations = false;

  // Alertes de qualité calculées
  qualityAlerts: DataQualityAlert[] = [];

  // Colonnes à afficher dans les tableaux
  previewDisplayColumns: string[] = [];
  correlationDisplayColumns = ['feature1', 'feature2', 'correlation', 'type'];
  qualityDisplayColumns = ['metric', 'score', 'status', 'description'];

  // Exposer Math pour utilisation dans le template
  Math = Math;

  ngOnInit(): void {
    this.route.params.pipe(takeUntil(this.destroy$)).subscribe(params => {
      this.datasetId = params['id'];
      if (this.datasetId) {
        this.loadDatasetDetails();
      }
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /**
   * Charge tous les détails du dataset
   */
  loadDatasetDetails(): void {
    if (!this.datasetId) return;

    this.isLoading = true;
    this.error = null;

    // Charger toutes les données en parallèle
    forkJoin({
      dataset: this.datasetService.getDatasetDetails(this.datasetId).pipe(
        catchError(error => {
          console.error('Erreur lors du chargement des détails:', error);
          return of(null);
        })
      ),
      preview: this.datasetService.getDatasetPreview(this.datasetId).pipe(
        catchError(error => {
          console.error('Erreur lors du chargement de l\'aperçu:', error);
          return of(null);
        })
      ),
      similarDatasets: this.datasetService.getSimilarDatasets(this.datasetId).pipe(
        catchError(error => {
          console.error('Erreur lors du chargement des datasets similaires:', error);
          return of([]);
        })
      )
    }).pipe(takeUntil(this.destroy$)).subscribe({
      next: (data) => {
        this.dataset = data.dataset;
        this.preview = data.preview;
        this.similarDatasets = data.similarDatasets;

        if (this.dataset) {
          this.qualityMetrics = this.dataset.quality_metrics;
          this.distributionAnalysis = this.dataset.distribution_analysis;
          this.generateQualityAlerts();
          this.setupPreviewColumns();
        }

        this.isLoading = false;
      },
      error: (error) => {
        console.error('Erreur lors du chargement:', error);
        this.error = 'Erreur lors du chargement des détails du dataset';
        this.isLoading = false;
      }
    });
  }

  /**
   * Configure les colonnes à afficher dans l'aperçu
   */
  setupPreviewColumns(): void {
    if (this.preview && this.preview.columns_info.length > 0) {
      this.previewDisplayColumns = this.preview.columns_info
        .slice(0, 8) // Limiter à 8 colonnes pour l'affichage
        .map(col => col.name);
    }
  }

  /**
   * Génère des alertes de qualité basées sur les métriques
   */
  generateQualityAlerts(): void {
    this.qualityAlerts = [];

    if (!this.qualityMetrics) return;

    // Alerte pour la complétude
    if (this.qualityMetrics.completeness < 0.8) {
      this.qualityAlerts.push({
        type: this.qualityMetrics.completeness < 0.5 ? 'error' : 'warning',
        title: 'Données manquantes importantes',
        description: `${Math.round((1 - this.qualityMetrics.completeness) * 100)}% des données sont manquantes`,
        severity: Math.round((1 - this.qualityMetrics.completeness) * 10),
        recommendation: 'Considérez des techniques d\'imputation ou filtrez les colonnes avec trop de valeurs manquantes'
      });
    }

    // Alerte pour les outliers
    if (this.qualityMetrics.outliers_percentage > 0.05) {
      this.qualityAlerts.push({
        type: 'warning',
        title: 'Valeurs aberrantes détectées',
        description: `${Math.round(this.qualityMetrics.outliers_percentage * 100)}% de valeurs aberrantes détectées`,
        severity: Math.round(this.qualityMetrics.outliers_percentage * 100),
        recommendation: 'Analysez ces valeurs pour déterminer si elles sont légitimes ou doivent être traitées'
      });
    }

    // Alerte pour les données personnelles
    if (this.qualityMetrics.pii_exposure_risk > 0.3) {
      this.qualityAlerts.push({
        type: 'error',
        title: 'Risque d\'exposition de données personnelles',
        description: 'Des colonnes contiennent potentiellement des informations personnelles identifiables',
        severity: Math.round(this.qualityMetrics.pii_exposure_risk * 10),
        recommendation: 'Vérifiez l\'anonymisation et la conformité RGPD avant utilisation'
      });
    }

    // Trier par sévérité décroissante
    this.qualityAlerts.sort((a, b) => b.severity - a.severity);
  }

  /**
   * Retourne la couleur pour un score de qualité
   */
  getQualityColor(score: number): string {
    if (score >= 0.8) return 'primary';
    if (score >= 0.6) return 'accent';
    if (score >= 0.4) return 'warn';
    return 'warn';
  }

  /**
   * Retourne l'icône pour un score de qualité
   */
  getQualityIcon(score: number): string {
    if (score >= 0.8) return 'check_circle';
    if (score >= 0.6) return 'warning';
    return 'error';
  }

  /**
   * Formate un nombre avec des séparateurs de milliers
   */
  formatNumber(num: number | undefined): string {
    if (num === undefined || num === null) return 'N/A';
    return num.toLocaleString('fr-FR');
  }

  /**
   * Formate un pourcentage
   */
  formatPercentage(value: number | undefined): string {
    if (value === undefined || value === null) return 'N/A';
    return `${Math.round(value * 100)}%`;
  }

  /**
   * Formate la taille d'un fichier
   */
  formatFileSize(bytes: number | undefined): string {
    if (!bytes) return 'N/A';
    return this.datasetService.formatFileSize(bytes);
  }

  /**
   * Retourne la classe CSS pour un niveau de représentativité
   */
  getRepresentativityClass(level: string | undefined): string {
    switch (level?.toLowerCase()) {
      case 'excellent': return 'excellent';
      case 'good': case 'bon': return 'good';
      case 'fair': case 'moyen': return 'fair';
      case 'poor': case 'faible': return 'poor';
      default: return 'unknown';
    }
  }

  /**
   * Retourne les corrélations les plus importantes
   */
  getTopCorrelations(limit: number = 10) {
    if (!this.distributionAnalysis?.correlations) return [];
    
    return this.distributionAnalysis.correlations
      .filter(corr => Math.abs(corr.correlation) > 0.1)
      .sort((a, b) => Math.abs(b.correlation) - Math.abs(a.correlation))
      .slice(0, limit);
  }

  /**
   * Retourne les patterns de données manquantes les plus fréquents
   */
  getTopMissingPatterns(limit: number = 5) {
    if (!this.distributionAnalysis?.missing_patterns) return [];
    
    return this.distributionAnalysis.missing_patterns
      .sort((a, b) => b.count - a.count)
      .slice(0, limit);
  }

  /**
   * Change l'onglet sélectionné
   */
  onTabChange(index: number): void {
    this.selectedTabIndex = index;
  }

  /**
   * Change le fichier sélectionné
   */
  onFileChange(index: number): void {
    this.selectedFileIndex = index;
    if (this.dataset?.files[index] && this.datasetId) {
      // Charger l'aperçu du fichier sélectionné
      this.datasetService.getDatasetPreview(
        this.datasetId, 
        this.dataset.files[index].id
      ).pipe(takeUntil(this.destroy$)).subscribe({
        next: (preview) => {
          this.preview = preview;
          this.setupPreviewColumns();
        },
        error: (error) => {
          console.error('Erreur lors du chargement de l\'aperçu du fichier:', error);
        }
      });
    }
  }

  /**
   * Navigue vers un dataset similaire
   */
  viewSimilarDataset(datasetId: string): void {
    this.router.navigate(['/datasets', datasetId]);
  }

  /**
   * Retourne en arrière
   */
  goBack(): void {
    this.router.navigate(['/datasets']);
  }

  /**
   * Télécharge le dataset (placeholder)
   */
  downloadDataset(): void {
    // TODO: Implémenter le téléchargement
    console.log('Téléchargement du dataset:', this.datasetId);
  }

  /**
   * Ajoute le dataset aux favoris (placeholder)
   */
  addToFavorites(): void {
    // TODO: Implémenter les favoris
    console.log('Ajout aux favoris:', this.datasetId);
  }

  /**
   * Partage le dataset (placeholder)
   */
  shareDataset(): void {
    // TODO: Implémenter le partage
    console.log('Partage du dataset:', this.datasetId);
  }

  /**
   * Navigue vers la page de completion des métadonnées
   */
  completeMetadata(): void {
    this.router.navigate(['/datasets', this.datasetId, 'complete-metadata']);
  }
} 
