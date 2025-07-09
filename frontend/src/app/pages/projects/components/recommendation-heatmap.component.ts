import { Component, Input, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatChipsModule } from '@angular/material/chips';
import { DatasetScored } from '../../../models/dataset.models';
import { CriterionWeight } from '../../../models/project.models';

interface HeatmapCell {
  dataset: DatasetScored;
  criterionName: string;
  criterionScore: number;
  weight: number;
  displayValue: string;
}

@Component({
  selector: 'app-recommendation-heatmap',
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule,
    MatIconModule,
    MatTooltipModule,
    MatChipsModule
  ],
  template: `
    <mat-card class="heatmap-card" *ngIf="datasets.length > 0">
      <mat-card-header>
        <mat-card-title class="d-flex align-items-center">
          <mat-icon class="m-r-8">insights</mat-icon>
          Heat Map des Recommandations
        </mat-card-title>
        <mat-card-subtitle>
          Visualisation des scores par critère pour les {{ datasets.length }} meilleurs datasets
        </mat-card-subtitle>
      </mat-card-header>
      
      <mat-card-content class="heatmap-content">
        <!-- Légende -->
        <div class="heatmap-legend m-b-16">
          <div class="d-flex align-items-center gap-16">
            <div class="legend-item d-flex align-items-center">
              <div class="legend-color low-score"></div>
              <span class="mat-caption">Faible (0-30%)</span>
            </div>
            <div class="legend-item d-flex align-items-center">
              <div class="legend-color medium-score"></div>
              <span class="mat-caption">Moyen (30-60%)</span>
            </div>
            <div class="legend-item d-flex align-items-center">
              <div class="legend-color high-score"></div>
              <span class="mat-caption">Bon (60-85%)</span>
            </div>
            <div class="legend-item d-flex align-items-center">
              <div class="legend-color excellent-score"></div>
              <span class="mat-caption">Excellent (85%+)</span>
            </div>
          </div>
        </div>

        <!-- Table de la heatmap -->
        <div class="heatmap-table">
          <!-- En-têtes des critères -->
          <div class="heatmap-header">
            <div class="dataset-column-header">Dataset</div>
            <div 
              *ngFor="let criterion of activeCriteria" 
              class="criterion-header"
              [matTooltip]="getCriterionTooltip(criterion.criterion_name)"
            >
              <div class="criterion-name">{{ getCriterionLabel(criterion.criterion_name) }}</div>
              <div class="criterion-weight">{{ (criterion.weight * 100) | number:'1.0-0' }}%</div>
            </div>
            <div class="score-header">Score Total</div>
          </div>

          <!-- Lignes des datasets -->
          <div 
            *ngFor="let dataset of datasets; trackBy: trackByDataset" 
            class="heatmap-row"
          >
            <div class="dataset-info">
              <div class="dataset-name">{{ dataset.dataset_name }}</div>
              <div class="dataset-meta mat-caption text-muted">
                {{ dataset.instances_number | number }} instances
                <span *ngIf="dataset.features_number"> • {{ dataset.features_number }} variables</span>
              </div>
            </div>
            
            <div 
              *ngFor="let criterion of activeCriteria" 
              class="heatmap-cell"
              [class]="getScoreClass(getCriterionScore(dataset, criterion.criterion_name))"
              [matTooltip]="getCellTooltip(dataset, criterion.criterion_name)"
            >
              {{ (getCriterionScore(dataset, criterion.criterion_name) * 100) | number:'1.0-0' }}%
            </div>
            
            <div class="total-score-cell" [style.background-color]="getScoreColor(dataset.score)">
              <span class="score-text">{{ (dataset.score * 100) | number:'1.0-0' }}%</span>
            </div>
          </div>
        </div>

        <!-- Message si pas de données -->
        <div *ngIf="activeCriteria.length === 0" class="no-criteria text-center p-20">
          <mat-icon class="icon-48 text-muted">tune</mat-icon>
          <p class="mat-body-1 m-t-12">Définissez des poids pour afficher la heat map</p>
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

    .heatmap-legend {
      .legend-item {
        .legend-color {
          width: 16px;
          height: 16px;
          border-radius: 2px;
          margin-right: 8px;
        }
        
        .low-score { background-color: #ffebee; border: 1px solid #f44336; }
        .medium-score { background-color: #fff3e0; border: 1px solid #ff9800; }
        .high-score { background-color: #e8f5e8; border: 1px solid #4caf50; }
        .excellent-score { background-color: #e3f2fd; border: 1px solid #2196f3; }
      }
    }

    .heatmap-table {
      min-width: 600px;
      border: 1px solid #e0e0e0;
      border-radius: 4px;
      overflow: hidden;
    }

    .heatmap-header {
      display: flex;
      background-color: #f5f5f5;
      border-bottom: 2px solid #e0e0e0;
      font-weight: 600;

      .dataset-column-header {
        width: 200px;
        padding: 12px;
        border-right: 1px solid #e0e0e0;
      }

      .criterion-header {
        flex: 1;
        min-width: 100px;
        padding: 8px;
        border-right: 1px solid #e0e0e0;
        text-align: center;

        .criterion-name {
          font-size: 12px;
          font-weight: 600;
          margin-bottom: 4px;
        }

        .criterion-weight {
          font-size: 10px;
          color: #666;
          background-color: rgba(0, 0, 0, 0.1);
          padding: 2px 6px;
          border-radius: 8px;
          display: inline-block;
        }
      }

      .score-header {
        width: 100px;
        padding: 12px;
        text-align: center;
        background-color: #e3f2fd;
      }
    }

    .heatmap-row {
      display: flex;
      border-bottom: 1px solid #e0e0e0;

      &:last-child {
        border-bottom: none;
      }

      &:hover {
        background-color: rgba(0, 0, 0, 0.02);
      }

      .dataset-info {
        width: 200px;
        padding: 12px;
        border-right: 1px solid #e0e0e0;

        .dataset-name {
          font-weight: 500;
          margin-bottom: 4px;
          font-size: 14px;
        }

        .dataset-meta {
          font-size: 11px;
        }
      }

      .heatmap-cell {
        flex: 1;
        min-width: 100px;
        padding: 12px;
        border-right: 1px solid #e0e0e0;
        text-align: center;
        font-weight: 500;
        font-size: 13px;
        transition: all 0.2s ease;

        &.low-score {
          background-color: #ffebee;
          color: #c62828;
        }

        &.medium-score {
          background-color: #fff3e0;
          color: #ef6c00;
        }

        &.high-score {
          background-color: #e8f5e8;
          color: #2e7d32;
        }

        &.excellent-score {
          background-color: #e3f2fd;
          color: #1565c0;
        }

        &:hover {
          transform: scale(1.05);
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
          z-index: 1;
          position: relative;
        }
      }

      .total-score-cell {
        width: 100px;
        padding: 12px;
        text-align: center;
        font-weight: 700;
        
        .score-text {
          color: white;
          text-shadow: 1px 1px 2px rgba(0, 0, 0, 0.3);
        }
      }
    }

    .no-criteria {
      .icon-48 {
        font-size: 48px;
        width: 48px;
        height: 48px;
      }
    }

    // Responsive
    @media (max-width: 768px) {
      .heatmap-table {
        min-width: 500px;
      }
      
      .dataset-column-header,
      .dataset-info {
        width: 150px;
      }
      
      .criterion-header,
      .heatmap-cell {
        min-width: 80px;
      }
    }
  `]
})
export class RecommendationHeatmapComponent implements OnChanges {
  @Input() datasets: DatasetScored[] = [];
  @Input() weights: CriterionWeight[] = [];

  activeCriteria: CriterionWeight[] = [];

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['weights']) {
      this.activeCriteria = this.weights.filter(w => w.weight > 0);
    }
  }

  trackByDataset(index: number, dataset: DatasetScored): string {
    return dataset.id;
  }

  getCriterionLabel(criterionName: string): string {
    const labels: { [key: string]: string } = {
      'ethical_score': 'Éthique',
      'technical_score': 'Technique',
      'popularity_score': 'Popularité',
      'anonymization': 'Anonymisation',
      'documentation': 'Documentation',
      'data_quality': 'Qualité'
    };
    return labels[criterionName] || criterionName;
  }

  getCriterionTooltip(criterionName: string): string {
    const tooltips: { [key: string]: string } = {
      'ethical_score': 'Score basé sur les pratiques éthiques du dataset',
      'technical_score': 'Score technique incluant documentation et qualité des données',
      'popularity_score': 'Score de popularité basé sur les citations',
      'anonymization': 'Dataset anonymisé (protection des données)',
      'documentation': 'Disponibilité de la documentation',
      'data_quality': 'Qualité des données (valeurs manquantes, etc.)'
    };
    return tooltips[criterionName] || `Score pour ${criterionName}`;
  }

  getCriterionScore(dataset: DatasetScored, criterionName: string): number {
    // Pour l'instant, on simule les scores de critères
    // Dans une implémentation complète, ces scores viendraient du backend
    switch (criterionName) {
      case 'ethical_score':
        return this.calculateEthicalScore(dataset);
      case 'technical_score':
        return this.calculateTechnicalScore(dataset);
      case 'popularity_score':
        return this.calculatePopularityScore(dataset);
      case 'anonymization':
        return dataset.anonymization_applied ? 1.0 : 0.0;
      case 'documentation':
        return dataset.external_documentation_available ? 1.0 : 0.0;
      case 'data_quality':
        return this.calculateDataQualityScore(dataset);
      default:
        return Math.random() * 0.5 + 0.3; // Score simulé entre 0.3 et 0.8
    }
  }

  private calculateEthicalScore(dataset: DatasetScored): number {
    let score = 0;
    let criteria = 0;
    
    if (dataset.informed_consent !== undefined) {
      criteria++;
      if (dataset.informed_consent) score++;
    }
    if (dataset.transparency !== undefined) {
      criteria++;
      if (dataset.transparency) score++;
    }
    if (dataset.anonymization_applied !== undefined) {
      criteria++;
      if (dataset.anonymization_applied) score++;
    }
    
    return criteria > 0 ? score / criteria : 0.5;
  }

  private calculateTechnicalScore(dataset: DatasetScored): number {
    let score = 0.5; // Score de base
    
    if (dataset.external_documentation_available) score += 0.2;
    if (dataset.split) score += 0.2;
    if (!dataset.has_missing_values) score += 0.1;
    
    return Math.min(score, 1.0);
  }

  private calculatePopularityScore(dataset: DatasetScored): number {
    if (!dataset.num_citations) return 0.1;
    // Score logarithmique basé sur les citations
    const logCitations = Math.log10(Math.max(1, dataset.num_citations));
    return Math.min(logCitations / 4, 1.0); // Normalisation
  }

  private calculateDataQualityScore(dataset: DatasetScored): number {
    let score = 0.5;
    
    if (!dataset.has_missing_values) {
      score += 0.3;
    } else if (dataset.global_missing_percentage !== undefined) {
      score += (100 - dataset.global_missing_percentage) / 100 * 0.3;
    }
    
    if (dataset.data_quality_documented) score += 0.2;
    
    return Math.min(score, 1.0);
  }

  getScoreClass(score: number): string {
    if (score >= 0.85) return 'excellent-score';
    if (score >= 0.6) return 'high-score';
    if (score >= 0.3) return 'medium-score';
    return 'low-score';
  }

  getScoreColor(score: number): string {
    if (score >= 0.85) return '#2196f3';
    if (score >= 0.6) return '#4caf50';
    if (score >= 0.3) return '#ff9800';
    return '#f44336';
  }

  getCellTooltip(dataset: DatasetScored, criterionName: string): string {
    const score = this.getCriterionScore(dataset, criterionName);
    const label = this.getCriterionLabel(criterionName);
    return `${dataset.dataset_name} - ${label}: ${(score * 100).toFixed(0)}%`;
  }
} 