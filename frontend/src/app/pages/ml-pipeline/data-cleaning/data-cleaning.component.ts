import { Component, Input, Output, EventEmitter, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSelectModule } from '@angular/material/select';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatBadgeModule } from '@angular/material/badge';
import { FormsModule, ReactiveFormsModule, FormGroup, FormBuilder } from '@angular/forms';
import { trigger, state, style, transition, animate } from '@angular/animations';
import { TranslateModule } from '@ngx-translate/core';

interface ColumnAnalysis {
  columnName: string;
  dataType: string;
  missingCount: number;
  missingPercentage: number;
  uniqueValues: number;
  distribution: string;
  outliers?: {
    count: number;
    percentage: number;
  };
  recommendedStrategy: {
    strategy: string;
    reason: string;
    impact: string;
  };
  selectedStrategy?: string;
}

interface DataQualityOverview {
  totalRows: number;
  totalColumns: number;
  qualityScore: number;
  issuesCount: number;
  columnsWithMissing: number;
  columnsWithOutliers: number;
}

@Component({
  selector: 'app-data-cleaning',
  standalone: true,
  imports: [
    CommonModule,
    MatProgressBarModule,
    MatButtonModule,
    MatIconModule,
    MatCardModule,
    MatChipsModule,
    MatTooltipModule,
    MatSelectModule,
    MatSlideToggleModule,
    MatExpansionModule,
    MatBadgeModule,
    FormsModule,
    ReactiveFormsModule,
    TranslateModule
  ],
  templateUrl: './data-cleaning.component.html',
  styleUrls: ['./data-cleaning.component.scss'],
  animations: [
    trigger('slideIn', [
      transition(':enter', [
        style({ transform: 'translateX(-100%)', opacity: 0 }),
        animate('300ms ease-in', style({ transform: 'translateX(0)', opacity: 1 }))
      ])
    ]),
    trigger('fadeIn', [
      transition(':enter', [
        style({ opacity: 0 }),
        animate('300ms ease-in', style({ opacity: 1 }))
      ])
    ])
  ]
})
export class DataCleaningComponent implements OnInit {
  @Input() datasetId!: string;
  @Input() analysisData: any;
  @Output() cleaningConfigChanged = new EventEmitter<any>();
  @Output() autoApplyRequested = new EventEmitter<void>();
  
  // État du composant
  isLoading = false;
  showAdvancedOptions = false;
  selectedView: 'overview' | 'columns' | 'strategies' = 'overview';
  
  // Données transformées
  overview: DataQualityOverview | null = null;
  columnsAnalysis: ColumnAnalysis[] = [];
  criticalIssues: any[] = [];
  
  // Configuration du nettoyage
  cleaningForm!: FormGroup;
  
  // Stratégies disponibles
  availableStrategies = {
    missing: [
      { value: 'drop', label: 'Supprimer', icon: 'delete', complexity: 'simple' },
      { value: 'mean', label: 'Moyenne', icon: 'functions', complexity: 'simple' },
      { value: 'median', label: 'Médiane', icon: 'equalizer', complexity: 'simple' },
      { value: 'mode', label: 'Mode', icon: 'bar_chart', complexity: 'simple' },
      { value: 'forward_fill', label: 'Propagation avant', icon: 'arrow_forward', complexity: 'intermediate' },
      { value: 'backward_fill', label: 'Propagation arrière', icon: 'arrow_back', complexity: 'intermediate' },
      { value: 'interpolate', label: 'Interpolation', icon: 'timeline', complexity: 'advanced' },
      { value: 'knn', label: 'KNN', icon: 'hub', complexity: 'advanced' },
      { value: 'iterative', label: 'Imputation itérative', icon: 'autorenew', complexity: 'advanced' }
    ],
    outliers: [
      { value: 'keep', label: 'Conserver', icon: 'check_circle' },
      { value: 'cap', label: 'Plafonner', icon: 'vertical_align_center' },
      { value: 'remove', label: 'Supprimer', icon: 'remove_circle' },
      { value: 'transform', label: 'Transformer', icon: 'transform' }
    ]
  };
  
  constructor(private fb: FormBuilder) {}
  
  ngOnInit() {
    this.initializeForm();
    if (this.analysisData) {
      this.processAnalysisData();
    }
  }
  
  private initializeForm() {
    this.cleaningForm = this.fb.group({
      globalMissingStrategy: ['auto'],
      globalOutlierStrategy: ['keep'],
      dropThreshold: [0.8], // Supprimer colonnes avec >80% de valeurs manquantes
      enableAdvanced: [false]
    });
    
    // Écouter les changements
    this.cleaningForm.valueChanges.subscribe(values => {
      this.onConfigurationChange();
    });
  }
  
  private processAnalysisData() {
    if (!this.analysisData) return;
    
    // Vue d'ensemble
    this.overview = {
      totalRows: this.analysisData.dataset_overview?.total_rows || 0,
      totalColumns: this.analysisData.dataset_overview?.total_columns || 0,
      qualityScore: this.analysisData.data_quality_score || 0,
      issuesCount: 0,
      columnsWithMissing: 0,
      columnsWithOutliers: 0
    };
    
    // Analyse par colonne
    this.columnsAnalysis = [];
    const missingData = this.analysisData.missing_data_analysis?.columns_with_missing || {};
    const outlierData = this.analysisData.outliers_analysis || {};
    
    for (const [columnName, columnInfo] of Object.entries(missingData)) {
      const info = columnInfo as any;
      
      // Chercher les outliers pour cette colonne
      const iqrOutliers = outlierData.iqr_method?.[columnName];
      const zscoreOutliers = outlierData.zscore_method?.[columnName];
      
      const columnAnalysis: ColumnAnalysis = {
        columnName,
        dataType: info.data_type || 'unknown',
        missingCount: info.missing_count || 0,
        missingPercentage: info.missing_percentage || 0,
        uniqueValues: info.unique_values || 0,
        distribution: info.distribution_type || 'unknown',
        recommendedStrategy: info.recommended_strategy || {
          strategy: 'drop',
          reason: 'Trop de valeurs manquantes',
          impact: 'minimal'
        },
        selectedStrategy: info.recommended_strategy?.strategy || 'drop'
      };
      
      // Ajouter les outliers si présents
      if (iqrOutliers || zscoreOutliers) {
        const outlierInfo = iqrOutliers || zscoreOutliers;
        columnAnalysis.outliers = {
          count: outlierInfo.outliers_count || 0,
          percentage: outlierInfo.outliers_percentage || 0
        };
        this.overview.columnsWithOutliers++;
      }
      
      if (columnAnalysis.missingPercentage > 0) {
        this.overview.columnsWithMissing++;
        this.overview.issuesCount++;
      }
      
      this.columnsAnalysis.push(columnAnalysis);
    }
    
    // Trier par sévérité (pourcentage de valeurs manquantes)
    this.columnsAnalysis.sort((a, b) => b.missingPercentage - a.missingPercentage);
    
    // Identifier les problèmes critiques
    this.criticalIssues = this.columnsAnalysis
      .filter(col => col.missingPercentage > 50)
      .map(col => ({
        type: 'missing',
        column: col.columnName,
        severity: col.missingPercentage > 75 ? 'critical' : 'high',
        message: `${col.missingPercentage.toFixed(1)}% de valeurs manquantes`
      }));
  }
  
  // Actions utilisateur
  applyAutoRecommendations() {
    this.isLoading = true;
    
    // Appliquer automatiquement les recommandations
    this.columnsAnalysis.forEach(column => {
      column.selectedStrategy = column.recommendedStrategy.strategy;
    });
    
    setTimeout(() => {
      this.isLoading = false;
      this.onConfigurationChange();
      this.autoApplyRequested.emit();
    }, 1000);
  }
  
  onColumnStrategyChange(column: ColumnAnalysis, strategy: string) {
    column.selectedStrategy = strategy;
    this.onConfigurationChange();
  }
  
  private onConfigurationChange() {
    const config = {
      global: this.cleaningForm.value,
      columns: this.columnsAnalysis.reduce((acc, col) => {
        acc[col.columnName] = {
          strategy: col.selectedStrategy,
          dataType: col.dataType,
          missingPercentage: col.missingPercentage
        };
        return acc;
      }, {} as any)
    };
    
    this.cleaningConfigChanged.emit(config);
  }
  
  // Helpers pour l'affichage
  getQualityScoreClass(score: number): string {
    if (score >= 80) return 'excellent';
    if (score >= 60) return 'good';
    if (score >= 40) return 'fair';
    return 'poor';
  }
  
  getQualityScoreIcon(score: number): string {
    if (score >= 80) return 'verified';
    if (score >= 60) return 'check_circle';
    if (score >= 40) return 'warning';
    return 'error';
  }
  
  getSeverityClass(percentage: number): string {
    if (percentage > 75) return 'critical';
    if (percentage > 50) return 'high';
    if (percentage > 25) return 'medium';
    if (percentage > 0) return 'low';
    return 'none';
  }
  
  getDataTypeIcon(type: string): string {
    switch (type) {
      case 'numeric': return 'pin';
      case 'categorical': return 'category';
      case 'datetime': return 'calendar_today';
      case 'text': return 'text_fields';
      default: return 'help_outline';
    }
  }
  
  getStrategyComplexity(strategy: string): string {
    const strat = this.availableStrategies.missing.find(s => s.value === strategy);
    return strat?.complexity || 'simple';
  }
  
  getComplexityColor(complexity: string): string {
    switch (complexity) {
      case 'simple': return 'primary';
      case 'intermediate': return 'accent';
      case 'advanced': return 'warn';
      default: return 'basic';
    }
  }
  
  getEstimatedImpact(): string {
    const droppedColumns = this.columnsAnalysis.filter(
      col => col.selectedStrategy === 'drop'
    ).length;
    
    const totalColumns = this.columnsAnalysis.length;
    const impactPercentage = (droppedColumns / totalColumns) * 100;
    
    if (impactPercentage > 30) return 'Fort impact - Beaucoup de colonnes seront supprimées';
    if (impactPercentage > 15) return 'Impact modéré - Quelques colonnes seront supprimées';
    if (impactPercentage > 0) return 'Impact faible - Peu de modifications';
    return 'Impact minimal - Préservation maximale des données';
  }
  
  toggleAdvancedOptions() {
    this.showAdvancedOptions = !this.showAdvancedOptions;
  }
}