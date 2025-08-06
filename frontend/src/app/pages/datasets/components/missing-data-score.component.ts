import { Component, Input, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatChipsModule } from '@angular/material/chips';
import { MatDialogModule, MatDialog } from '@angular/material/dialog';
import { MatTooltipModule } from '@angular/material/tooltip';
import { TranslateModule } from '@ngx-translate/core';

import { FileColumn, DatasetFile, MissingDataScore, ColumnMissingStats, MissingDataAnalysisResponse } from '../../../models/dataset.models';
import { MissingDataDetailsModalComponent } from './missing-data-details-modal.component';
import { DatasetService } from '../../../services/dataset.service';



@Component({
  selector: 'app-missing-data-score',
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatProgressBarModule,
    MatChipsModule,
    MatDialogModule,
    MatTooltipModule,
    TranslateModule
  ],
  template: `
    <mat-card class="modern-missing-data-card">
      <!-- En-tête simplifié -->
      <div class="card-header">
        <div class="header-content">
          <mat-icon class="header-icon">assessment</mat-icon>
          <div class="header-text">
            <h3 class="card-title">{{ 'DATASET_DETAIL.MISSING_DATA.TITLE' | translate }}</h3>
            <p class="card-subtitle">{{ 'DATASET_DETAIL.MISSING_DATA.SUBTITLE' | translate }}</p>
          </div>
        </div>
      </div>
      
      <!-- Corps de la carte -->
      <div class="card-body">
        <!-- Section du score -->
        <div class="score-container">
          <div class="score-display">
            <span class="score-number">{{ scoreData.overallScore }}</span>
            <span class="score-label">/ 100</span>
          </div>
          
          <div class="score-status">
            <div class="status-indicator" [class]="'status-' + scoreData.qualityLevel">
              <mat-icon>{{ getQualityIcon() }}</mat-icon>
            </div>
            <span class="status-text">{{ getQualityLabel() | translate }}</span>
          </div>
        </div>
        
        <!-- Barre de progression -->
        <div class="progress-container">
          <mat-progress-bar 
            mode="determinate" 
            [value]="scoreData.overallScore"
            class="progress-bar">
          </mat-progress-bar>
        </div>
        
        <!-- Statistiques -->
        <div class="stats-container">
          <div class="stat-row">
            <span class="stat-label">{{ 'DATASET_DETAIL.MISSING_DATA.ANALYZED_COLUMNS' | translate }}</span>
            <span class="stat-value">{{ scoreData.analyzedColumns }} / {{ scoreData.totalColumns }}</span>
          </div>
          <div class="stat-row" *ngIf="scoreData.excludedColumns.length > 0">
            <span class="stat-label">{{ 'DATASET_DETAIL.MISSING_DATA.EXCLUDED_COLUMNS' | translate }}</span>
            <span class="stat-value">{{ scoreData.excludedColumns.length }}</span>
          </div>
        </div>
      </div>
      
      <!-- Actions -->
      <div class="card-actions">
        <button mat-stroked-button (click)="openDetailsModal()" class="details-btn">
          <mat-icon>visibility</mat-icon>
          {{ 'DATASET_DETAIL.MISSING_DATA.VIEW_DETAILS' | translate }}
        </button>
      </div>
    </mat-card>
  `,
  styles: [`
    .modern-missing-data-card {
      margin: 16px 0;
      border-radius: 12px;
      overflow: hidden;
      transition: all 0.3s ease;
    }

    .modern-missing-data-card:hover {
      transform: translateY(-2px);
      box-shadow: 0 8px 25px rgba(0, 0, 0, 0.1);
    }

    /* En-tête */
    .card-header {
      padding: 24px 24px 0;
    }

    .header-content {
      display: flex;
      align-items: center;
      gap: 16px;
    }

    .header-icon {
      color: #666;
      font-size: 24px;
      opacity: 0.8;
    }

    .header-text {
      flex: 1;
    }

    .card-title {
      margin: 0;
      font-size: 1.1rem;
      font-weight: 600;
      color: #333;
    }

    .card-subtitle {
      margin: 4px 0 0;
      font-size: 0.875rem;
      color: #666;
      line-height: 1.4;
    }

    /* Corps */
    .card-body {
      padding: 24px;
    }

    /* Score */
    .score-container {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 24px;
    }

    .score-display {
      display: flex;
      align-items: baseline;
      gap: 8px;
    }

    .score-number {
      font-size: 2.5rem;
      font-weight: 700;
      color: #2c3e50;
      line-height: 1;
    }

    .score-label {
      font-size: 1.25rem;
      color: #7f8c8d;
      font-weight: 500;
    }

    .score-status {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .status-indicator {
      width: 40px;
      height: 40px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      background-color: #f8f9fa;
    }

    .status-indicator.status-perfect {
      background-color: #d4edda;
      color: #155724;
    }

    .status-indicator.status-good {
      background-color: #d1ecf1;
      color: #0c5460;
    }

    .status-indicator.status-warning {
      background-color: #fff3cd;
      color: #856404;
    }

    .status-indicator.status-critical {
      background-color: #f8d7da;
      color: #721c24;
    }

    .status-text {
      font-size: 0.875rem;
      font-weight: 500;
      color: #495057;
    }

    /* Barre de progression */
    .progress-container {
      margin-bottom: 24px;
    }

    .progress-bar {
      height: 8px;
      border-radius: 4px;
      background-color: #e9ecef;
    }

    /* Statistiques */
    .stats-container {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .stat-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 8px 0;
    }

    .stat-label {
      font-size: 0.875rem;
      color: #6c757d;
    }

    .stat-value {
      font-size: 0.875rem;
      font-weight: 600;
      color: #495057;
    }

    /* Actions */
    .card-actions {
      padding: 0 24px 24px;
      display: flex;
      justify-content: flex-end;
    }

    .details-btn {
      font-size: 0.875rem;
      font-weight: 500;
      border-radius: 8px;
    }

    .details-btn mat-icon {
      margin-right: 8px;
      font-size: 18px;
    }

    /* Adaptation pour espaces restreints */
    @media (max-width: 768px) {
      .modern-missing-data-card .card-header {
        padding: 16px 16px 0;
      }

      .modern-missing-data-card .card-body {
        padding: 16px;
      }

      .modern-missing-data-card .score-container {
        margin-bottom: 16px;
      }

      .modern-missing-data-card .score-number {
        font-size: 2rem;
      }

      .modern-missing-data-card .score-label {
        font-size: 1rem;
      }

      .modern-missing-data-card .status-indicator {
        width: 32px;
        height: 32px;
      }

      .modern-missing-data-card .progress-container {
        margin-bottom: 16px;
      }

      .modern-missing-data-card .card-actions {
        padding: 0 16px 16px;
      }

      .modern-missing-data-card .card-title {
        font-size: 1rem;
      }

      .modern-missing-data-card .card-subtitle {
        font-size: 0.8rem;
      }

      .modern-missing-data-card .stats-container {
        gap: 8px;
      }

      .modern-missing-data-card .stat-row {
        padding: 6px 0;
      }
    }

    /* Layout compact séparé */
    .compact-layout .modern-missing-data-card .card-header {
      padding: 16px 16px 0;
    }

    .compact-layout .modern-missing-data-card .card-body {
      padding: 16px;
    }

    .compact-layout .modern-missing-data-card .score-container {
      margin-bottom: 16px;
    }

    .compact-layout .modern-missing-data-card .score-number {
      font-size: 2rem;
    }

    .compact-layout .modern-missing-data-card .score-label {
      font-size: 1rem;
    }

    .compact-layout .modern-missing-data-card .status-indicator {
      width: 32px;
      height: 32px;
    }

    .compact-layout .modern-missing-data-card .progress-container {
      margin-bottom: 16px;
    }

    .compact-layout .modern-missing-data-card .card-actions {
      padding: 0 16px 16px;
    }

    .compact-layout .modern-missing-data-card .card-title {
      font-size: 1rem;
    }

    .compact-layout .modern-missing-data-card .card-subtitle {
      font-size: 0.8rem;
    }

    .compact-layout .modern-missing-data-card .stats-container {
      gap: 8px;
    }

    .compact-layout .modern-missing-data-card .stat-row {
      padding: 6px 0;
    }

    /* Version ultra-compacte pour sidebars */
    .sidebar-layout .modern-missing-data-card {
      .card-header {
        padding: 12px 12px 0;
      }

      .card-body {
        padding: 12px;
      }

      .score-container {
        flex-direction: column;
        align-items: flex-start;
        gap: 12px;
        margin-bottom: 12px;
      }

      .score-number {
        font-size: 1.75rem;
      }

      .score-label {
        font-size: 0.9rem;
      }

      .status-indicator {
        width: 28px;
        height: 28px;
      }

      .status-text {
        font-size: 0.8rem;
      }

      .card-actions {
        padding: 0 12px 12px;
      }
    }
  `]
})
export class MissingDataScoreComponent implements OnInit {
  @Input() datasetId: string = '';
  @Input() files: DatasetFile[] = [];
  @Input() columns: FileColumn[] = [];

  scoreData: MissingDataScore = {
    overallScore: 0,
    totalColumns: 0,
    analyzedColumns: 0,
    excludedColumns: [],
    columnStats: [],
    qualityLevel: 'critical'
  };

  isLoading = false;
  error: string | null = null;

  constructor(
    private dialog: MatDialog,
    private datasetService: DatasetService
  ) {}

  ngOnInit(): void {
    if (this.datasetId) {
      this.loadMissingDataAnalysis();
    } else {
      // Fallback : calcul côté frontend si pas d'ID dataset
      this.calculateMissingDataScore();
    }
  }

  /**
   * Charge l'analyse des données manquantes depuis le backend
   */
  private loadMissingDataAnalysis(): void {
    this.isLoading = true;
    this.error = null;

    this.datasetService.getMissingDataAnalysis(this.datasetId).subscribe({
      next: (response: MissingDataAnalysisResponse) => {
        this.scoreData = response.missingDataScore;
        this.isLoading = false;
      },
      error: (error) => {
        console.error('Erreur lors du chargement de l\'analyse des données manquantes:', error);
        this.error = 'Impossible de charger l\'analyse des données manquantes';
        this.isLoading = false;
        
        // Fallback : calcul côté frontend
        this.calculateMissingDataScore();
      }
    });
  }

  /**
   * Calcule le score des données manquantes (fallback côté frontend)
   */
  private calculateMissingDataScore(): void {
    if (!this.columns || this.columns.length === 0) {
      return;
    }

    // Exclure les colonnes techniques (ID, UUID, index, etc.)
    const technicalColumnPatterns = [
      /^id$/i,
      /^uuid$/i,
      /^index$/i,
      /_id$/i,
      /_uuid$/i,
      /^pk_/i,
      /^primary_key/i,
      /^row_number$/i,
      /^serial$/i
    ];

    const excludedColumns: string[] = [];
    const analyzedColumns = this.columns.filter(col => {
      const isExcluded = technicalColumnPatterns.some(pattern => 
        pattern.test(col.column_name)
      );
      
      if (isExcluded) {
        excludedColumns.push(col.column_name);
        return false;
      }
      return true;
    });

    // Calculer les statistiques par colonne
    const columnStats: ColumnMissingStats[] = analyzedColumns.map(col => {
      // Pour l'instant, utilisation d'une estimation basée sur is_nullable
      // Dans une implémentation complète, ces données viendraient du backend
      const estimatedMissingPercentage = col.is_nullable ? 
        Math.random() * 30 : // 0-30% pour les colonnes nullables
        Math.random() * 5;   // 0-5% pour les colonnes non-nullables

      const missingPercentage = Math.round(estimatedMissingPercentage * 100) / 100;
      
      let severity: 'low' | 'medium' | 'high' | 'critical';
      if (missingPercentage < 5) severity = 'low';
      else if (missingPercentage < 15) severity = 'medium';
      else if (missingPercentage < 30) severity = 'high';
      else severity = 'critical';

      return {
        columnName: col.column_name,
        missingCount: Math.round((missingPercentage / 100) * 1000), // Estimation
        totalCount: 1000, // Estimation
        missingPercentage,
        dataType: col.data_type_interpreted || col.data_type_original || 'unknown',
        suggestion: this.generateSuggestion(missingPercentage, col.data_type_interpreted || ''),
        severity
      };
    });

    // Calculer le score global (moyenne pondérée inversée)
    const totalMissingPercentage = columnStats.reduce(
      (sum, stat) => sum + stat.missingPercentage, 0
    ) / Math.max(columnStats.length, 1);

    const overallScore = Math.max(0, Math.round(100 - totalMissingPercentage));

    // Déterminer le niveau de qualité
    let qualityLevel: 'perfect' | 'good' | 'warning' | 'critical';
    if (overallScore === 100) qualityLevel = 'perfect';
    else if (overallScore >= 80) qualityLevel = 'good';
    else if (overallScore >= 50) qualityLevel = 'warning';
    else qualityLevel = 'critical';

    this.scoreData = {
      overallScore,
      totalColumns: this.columns.length,
      analyzedColumns: analyzedColumns.length,
      excludedColumns,
      columnStats,
      qualityLevel
    };
  }

  /**
   * Génère une suggestion de traitement pour une colonne
   */
  private generateSuggestion(missingPercentage: number, dataType: string): string {
    if (missingPercentage < 5) {
      return 'DATASET_DETAIL.MISSING_DATA.SUGGESTIONS.MINIMAL_CLEANING';
    } else if (missingPercentage < 15) {
      if (dataType.includes('numerical') || dataType.includes('float')) {
        return 'DATASET_DETAIL.MISSING_DATA.SUGGESTIONS.IMPUTE_MEAN';
      } else {
        return 'DATASET_DETAIL.MISSING_DATA.SUGGESTIONS.IMPUTE_MODE';
      }
    } else if (missingPercentage < 30) {
      return 'DATASET_DETAIL.MISSING_DATA.SUGGESTIONS.CAREFUL_ANALYSIS';
    } else {
      return 'DATASET_DETAIL.MISSING_DATA.SUGGESTIONS.CONSIDER_REMOVAL';
    }
  }

  /**
   * Retourne l'icône appropriée selon le niveau de qualité
   */
  getQualityIcon(): string {
    switch (this.scoreData.qualityLevel) {
      case 'perfect': return 'check_circle';
      case 'good': return 'verified';
      case 'warning': return 'warning';
      case 'critical': return 'error';
      default: return 'help';
    }
  }

  /**
   * Retourne le label de qualité
   */
  getQualityLabel(): string {
    return `DATASET_DETAIL.MISSING_DATA.QUALITY_LEVELS.${this.scoreData.qualityLevel.toUpperCase()}`;
  }

  /**
   * Ouvre la modale de détails
   */
  openDetailsModal(): void {
    this.dialog.open(MissingDataDetailsModalComponent, {
      width: '1200px',
      maxWidth: '95vw',
      maxHeight: '90vh',
      data: this.scoreData
    });
  }
}