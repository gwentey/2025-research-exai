import { Component, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTableModule } from '@angular/material/table';
import { MatChipsModule } from '@angular/material/chips';
import { MatCardModule } from '@angular/material/card';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDividerModule } from '@angular/material/divider';
import { TranslateModule } from '@ngx-translate/core';

import { MissingDataScore, ColumnMissingStats } from '../../../models/dataset.models';

@Component({
  selector: 'app-missing-data-details-modal',
  standalone: true,
  imports: [
    CommonModule,
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    MatTableModule,
    MatChipsModule,
    MatCardModule,
    MatTooltipModule,
    MatDividerModule,
    TranslateModule
  ],
  template: `
    <div class="modal-header">
      <h2 mat-dialog-title>
        <mat-icon>analytics</mat-icon>
        {{ 'DATASET_DETAIL.MISSING_DATA.DETAILS_TITLE' | translate }}
      </h2>
      <button mat-icon-button mat-dialog-close class="close-button">
        <mat-icon>close</mat-icon>
      </button>
    </div>

    <mat-dialog-content class="modal-content">
      <!-- Résumé global -->
      <mat-card class="summary-card">
        <mat-card-content>
          <div class="summary-grid">
            <div class="summary-item">
              <div class="summary-value">{{ data.overallScore }}</div>
              <div class="summary-label">{{ 'DATASET_DETAIL.MISSING_DATA.OVERALL_SCORE' | translate }}</div>
            </div>
            <div class="summary-item">
              <div class="summary-value">{{ data.analyzedColumns }}</div>
              <div class="summary-label">{{ 'DATASET_DETAIL.MISSING_DATA.ANALYZED_COLUMNS' | translate }}</div>
            </div>
            <div class="summary-item">
              <div class="summary-value">{{ getAverageCompleteness() }}%</div>
              <div class="summary-label">{{ 'DATASET_DETAIL.MISSING_DATA.AVG_COMPLETENESS' | translate }}</div>
            </div>
          </div>
        </mat-card-content>
      </mat-card>

      <!-- Colonnes exclues -->
      <div class="excluded-section" *ngIf="data.excludedColumns.length > 0">
        <h3>{{ 'DATASET_DETAIL.MISSING_DATA.EXCLUDED_COLUMNS' | translate }}</h3>
        <p class="excluded-explanation">{{ 'DATASET_DETAIL.MISSING_DATA.EXCLUDED_EXPLANATION' | translate }}</p>
        <mat-chip-set>
          <mat-chip *ngFor="let column of data.excludedColumns" class="excluded-chip">
            <mat-icon matChipAvatar>block</mat-icon>
            {{ column }}
          </mat-chip>
        </mat-chip-set>
      </div>

      <mat-divider></mat-divider>

      <!-- Tableau des colonnes analysées -->
      <div class="columns-section">
        <h3>{{ 'DATASET_DETAIL.MISSING_DATA.COLUMN_ANALYSIS' | translate }}</h3>
        
        <table mat-table [dataSource]="data.columnStats" class="columns-table">
          <!-- Colonne nom -->
          <ng-container matColumnDef="columnName">
            <th mat-header-cell *matHeaderCellDef>{{ 'DATASET_DETAIL.MISSING_DATA.TABLE.COLUMN_NAME' | translate }}</th>
            <td mat-cell *matCellDef="let column">
              <span class="column-name">{{ column.columnName }}</span>
            </td>
          </ng-container>

          <!-- Colonne type de données -->
          <ng-container matColumnDef="dataType">
            <th mat-header-cell *matHeaderCellDef>{{ 'DATASET_DETAIL.MISSING_DATA.TABLE.DATA_TYPE' | translate }}</th>
            <td mat-cell *matCellDef="let column">
              <span class="data-type">{{ column.dataType }}</span>
            </td>
          </ng-container>

          <!-- Colonne pourcentage manquant -->
          <ng-container matColumnDef="missingPercentage">
            <th mat-header-cell *matHeaderCellDef>{{ 'DATASET_DETAIL.MISSING_DATA.TABLE.MISSING_PERCENTAGE' | translate }}</th>
            <td mat-cell *matCellDef="let column">
              {{ column.missingPercentage }}%
            </td>
          </ng-container>

          <!-- Colonne nombre manquant -->
          <ng-container matColumnDef="missingCount">
            <th mat-header-cell *matHeaderCellDef>{{ 'DATASET_DETAIL.MISSING_DATA.TABLE.MISSING_COUNT' | translate }}</th>
            <td mat-cell *matCellDef="let column">
              {{ column.missingCount | number }} / {{ column.totalCount | number }}
            </td>
          </ng-container>

          <!-- Colonne gravité -->
          <ng-container matColumnDef="severity">
            <th mat-header-cell *matHeaderCellDef>{{ 'DATASET_DETAIL.MISSING_DATA.TABLE.SEVERITY' | translate }}</th>
            <td mat-cell *matCellDef="let column">
              {{ ('DATASET_DETAIL.MISSING_DATA.SEVERITIES.' + column.severity.toUpperCase()) | translate }}
            </td>
          </ng-container>

          <!-- Colonne suggestion -->
          <ng-container matColumnDef="suggestion">
            <th mat-header-cell *matHeaderCellDef>{{ 'DATASET_DETAIL.MISSING_DATA.TABLE.SUGGESTION' | translate }}</th>
            <td mat-cell *matCellDef="let column">
              <span [matTooltip]="(column.suggestion + '_TOOLTIP') | translate"
                   matTooltipPosition="left">
                {{ column.suggestion | translate }}
              </span>
            </td>
          </ng-container>

          <tr mat-header-row *matHeaderRowDef="displayedColumns"></tr>
          <tr mat-row *matRowDef="let row; columns: displayedColumns;" class="data-row"></tr>
        </table>
      </div>
    </mat-dialog-content>

    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close>
        {{ 'COMMON.CLOSE' | translate }}
      </button>
      <button mat-raised-button color="primary" (click)="exportReport()">
        <mat-icon>download</mat-icon>
        {{ 'DATASET_DETAIL.MISSING_DATA.EXPORT_REPORT' | translate }}
      </button>
    </mat-dialog-actions>
  `,
  styles: [`
    .modal-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 16px 24px 0;
    }

    .modal-header h2 {
      display: flex;
      align-items: center;
      gap: 8px;
      margin: 0;
    }

    .close-button {
      color: #666;
    }

    .modal-content {
      max-height: 70vh;
      padding: 16px 24px;
    }

    .summary-card {
      margin-bottom: 24px;
    }

    .summary-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
      gap: 16px;
    }

    .summary-item {
      text-align: center;
    }

    .summary-value {
      font-size: 2rem;
      font-weight: 700;
      color: #333;
    }

    .summary-label {
      font-size: 0.875rem;
      color: #666;
      margin-top: 4px;
    }

    .excluded-section {
      margin: 24px 0;
    }

    .excluded-section h3 {
      color: #333;
      margin-bottom: 8px;
    }

    .excluded-explanation {
      color: #666;
      font-size: 0.875rem;
      margin-bottom: 12px;
    }

    .excluded-chip {
      background-color: #f5f5f5 !important;
      color: #666 !important;
    }

    .columns-section {
      margin-top: 24px;
    }

    .columns-section h3 {
      color: #333;
      margin-bottom: 16px;
    }

    .columns-table {
      width: 100%;
      margin-top: 16px;
    }

    .column-name {
      font-weight: 500;
      color: #333;
    }

    .data-type {
      color: #666;
      font-size: 0.875rem;
      text-transform: capitalize;
    }

    .percentage-value {
      font-weight: 500;
    }

    .missing-count {
      font-size: 0.875rem;
    }

    .severity-badge {
      font-size: 0.75rem;
      font-weight: 500;
      text-transform: uppercase;
    }

    .suggestion-text {
      font-size: 0.875rem;
      cursor: help;
    }

    .data-row {
      height: 48px;
    }

    .data-row:hover {
      background-color: rgba(0, 0, 0, 0.04);
    }

    mat-dialog-actions {
      padding: 16px 24px;
    }
  `]
})
export class MissingDataDetailsModalComponent {
  displayedColumns: string[] = [
    'columnName', 
    'dataType', 
    'missingPercentage', 
    'missingCount', 
    'severity', 
    'suggestion'
  ];

  constructor(
    public dialogRef: MatDialogRef<MissingDataDetailsModalComponent>,
    @Inject(MAT_DIALOG_DATA) public data: MissingDataScore
  ) {}

  /**
   * Calcule la complétude moyenne
   */
  getAverageCompleteness(): number {
    if (this.data.columnStats.length === 0) return 100;
    
    const totalCompleteness = this.data.columnStats.reduce(
      (sum: number, stat: ColumnMissingStats) => sum + (100 - stat.missingPercentage), 0
    );
    
    return Math.round(totalCompleteness / this.data.columnStats.length);
  }

  /**
   * Retourne l'icône appropriée pour le type de données
   */
  getDataTypeIcon(dataType: string): string {
    if (dataType.includes('numerical') || dataType.includes('float') || dataType.includes('int')) {
      return 'tag';
    } else if (dataType.includes('temporal') || dataType.includes('date') || dataType.includes('time')) {
      return 'schedule';
    } else if (dataType.includes('categorical')) {
      return 'category';
    } else if (dataType.includes('text') || dataType.includes('string')) {
      return 'text_fields';
    } else {
      return 'help';
    }
  }

  /**
   * Retourne l'icône appropriée pour la gravité
   */
  getSeverityIcon(severity: string): string {
    switch (severity) {
      case 'low': return 'check_circle';
      case 'medium': return 'warning';
      case 'high': return 'error';
      case 'critical': return 'dangerous';
      default: return 'help';
    }
  }

  /**
   * Exporte un rapport des données manquantes
   */
  exportReport(): void {
    const reportData = {
      timestamp: new Date().toISOString(),
      overallScore: this.data.overallScore,
      qualityLevel: this.data.qualityLevel,
      summary: {
        totalColumns: this.data.totalColumns,
        analyzedColumns: this.data.analyzedColumns,
        excludedColumns: this.data.excludedColumns,
        averageCompleteness: this.getAverageCompleteness()
      },
      columnDetails: this.data.columnStats
    };

    const blob = new Blob([JSON.stringify(reportData, null, 2)], {
      type: 'application/json'
    });
    
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `missing-data-report-${new Date().toISOString().split('T')[0]}.json`;
    link.click();
    
    window.URL.revokeObjectURL(url);
  }
}