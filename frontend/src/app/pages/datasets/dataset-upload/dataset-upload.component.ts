import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatDialogModule, MatDialog } from '@angular/material/dialog';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

import { FileDropZoneComponent } from '../../../components/file-drop-zone/file-drop-zone.component';
import { DatasetUploadService, ValidationResult, PreviewResponse, UploadProgress } from '../../../services/dataset-upload.service';
import { TranslateModule } from '@ngx-translate/core';

@Component({
  selector: 'app-dataset-upload',
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatProgressBarModule,
    MatDialogModule,
    FileDropZoneComponent,
    TranslateModule
  ],
  template: `
    <div class="upload-container">
      <!-- Header -->
      <div class="header-section">
        <button mat-icon-button (click)="goBack()" class="back-button">
          <mat-icon>arrow_back</mat-icon>
        </button>
        <div class="title-area">
          <h1>{{ 'UPLOAD.TITLE' | translate }}</h1>
          <p class="subtitle">{{ 'UPLOAD.SUBTITLE' | translate }}</p>
        </div>
      </div>

      <!-- Progress Indicator -->
      <div *ngIf="uploadProgress" class="progress-section">
        <mat-card>
          <mat-card-content>
            <div class="progress-header">
              <h3>{{ getProgressTitle() }}</h3>
              <mat-icon [class]="getProgressIconClass()">{{ getProgressIcon() }}</mat-icon>
            </div>
            <p>{{ uploadProgress.message }}</p>
            <mat-progress-bar 
              mode="determinate" 
              [value]="uploadProgress.progress">
            </mat-progress-bar>
            <div class="progress-percentage">{{ uploadProgress.progress }}%</div>
          </mat-card-content>
        </mat-card>
      </div>

      <!-- Main Upload Area -->
      <mat-card class="upload-card">
        <mat-card-content>
          <app-file-drop-zone
            [maxFiles]="10"
            [maxFileSize]="104857600"
            [acceptedFormats]="['csv', 'xlsx', 'xls', 'json', 'xml', 'parquet']"
            (filesSelected)="onFilesSelected($event)"
            (validationChanged)="onValidationChanged($event)">
          </app-file-drop-zone>
        </mat-card-content>
      </mat-card>

      <!-- Actions -->
      <div class="actions-section" *ngIf="selectedFiles.length > 0">
        <mat-card>
          <mat-card-content>
            <div class="actions-header">
              <h3>{{ 'UPLOAD.ACTIONS.TITLE' | translate }}</h3>
              <p>{{ 'UPLOAD.ACTIONS.DESCRIPTION' | translate }}</p>
            </div>

            <div class="action-buttons">
              <!-- Analyser les fichiers -->
              <button 
                mat-raised-button 
                color="primary"
                [disabled]="!canAnalyze() || isLoading"
                (click)="analyzeFiles()"
                class="analyze-button">
                <mat-icon>analytics</mat-icon>
                {{ 'UPLOAD.ACTIONS.ANALYZE' | translate }}
              </button>

              <!-- Continuer vers le wizard -->
              <button 
                mat-stroked-button 
                color="primary"
                [disabled]="!canProceed() || isLoading"
                (click)="openWizard()"
                class="wizard-button">
                <mat-icon>assistant</mat-icon>
                {{ 'UPLOAD.ACTIONS.WIZARD' | translate }}
              </button>


            </div>

            <!-- Restaurer brouillon -->
            <div *ngIf="hasDraft" class="draft-section">
              <div class="draft-info">
                <mat-icon>draft</mat-icon>
                <span>{{ 'UPLOAD.DRAFT.FOUND' | translate }}</span>
              </div>
              <div class="draft-actions">
                <button mat-button (click)="loadDraft()">
                  {{ 'UPLOAD.DRAFT.LOAD' | translate }}
                </button>
                <button mat-button color="warn" (click)="clearDraft()">
                  {{ 'UPLOAD.DRAFT.CLEAR' | translate }}
                </button>
              </div>
            </div>
          </mat-card-content>
        </mat-card>
      </div>

      <!-- Analysis Results -->
      <div *ngIf="analysisResults" class="analysis-section">
        <mat-card>
          <mat-card-header>
            <mat-card-title>
              <mat-icon>insights</mat-icon>
              {{ 'UPLOAD.ANALYSIS.TITLE' | translate }}
            </mat-card-title>
          </mat-card-header>
          <mat-card-content>
            <!-- Summary -->
            <div class="analysis-summary">
              <div class="summary-item">
                <span class="label">{{ 'UPLOAD.ANALYSIS.TOTAL_FILES' | translate }}:</span>
                <span class="value">{{ analysisResults.summary.total_files }}</span>
              </div>
              <div class="summary-item">
                <span class="label">{{ 'UPLOAD.ANALYSIS.TOTAL_ROWS' | translate }}:</span>
                <span class="value">{{ analysisResults.summary.total_rows | number }}</span>
              </div>
              <div class="summary-item">
                <span class="label">{{ 'UPLOAD.ANALYSIS.TOTAL_SIZE' | translate }}:</span>
                <span class="value">{{ analysisResults.summary.total_size_mb }} MB</span>
              </div>
              <div class="summary-item">
                <span class="label">{{ 'UPLOAD.ANALYSIS.QUALITY_SCORE' | translate }}:</span>
                <span class="value quality-score" [class]="getQualityScoreClass()">
                  {{ analysisResults.suggestions.quality_score }}/100
                </span>
              </div>
            </div>

            <!-- Suggestions -->
            <div class="suggestions">
              <h4>{{ 'UPLOAD.ANALYSIS.SUGGESTIONS' | translate }}</h4>
              <div class="suggestion-item">
                <strong>{{ 'UPLOAD.ANALYSIS.SUGGESTED_NAME' | translate }}:</strong>
                {{ analysisResults.suggestions.suggested_dataset_name }}
              </div>
              <div class="suggestion-item">
                <strong>{{ 'UPLOAD.ANALYSIS.SUGGESTED_DOMAINS' | translate }}:</strong>
                <span class="tags">
                  <span *ngFor="let domain of analysisResults.suggestions.suggested_domains" 
                        class="tag domain-tag">
                    {{ domain }}
                  </span>
                </span>
              </div>
              <div class="suggestion-item">
                <strong>{{ 'UPLOAD.ANALYSIS.SUGGESTED_TASKS' | translate }}:</strong>
                <span class="tags">
                  <span *ngFor="let task of analysisResults.suggestions.suggested_tasks" 
                        class="tag task-tag">
                    {{ task }}
                  </span>
                </span>
              </div>
            </div>

            <!-- Files Analysis -->
            <div class="files-analysis" *ngIf="analysisResults.files_analysis.length > 0">
              <h4>{{ 'UPLOAD.ANALYSIS.FILES_DETAIL' | translate }}</h4>
              <div *ngFor="let fileAnalysis of analysisResults.files_analysis" 
                   class="file-analysis"
                   [class.error]="fileAnalysis.analysis_status === 'error'">
                <div class="file-header">
                  <mat-icon>{{ getFileIcon(fileAnalysis.filename) }}</mat-icon>
                  <span class="filename">{{ fileAnalysis.filename }}</span>
                  <span class="file-stats">
                    {{ fileAnalysis.row_count | number }} lignes • 
                    {{ fileAnalysis.column_count }} colonnes •
                    {{ fileAnalysis.size_mb }} MB
                  </span>
                </div>
                
                <div *ngIf="fileAnalysis.analysis_status === 'error'" class="error-message">
                  <mat-icon>error</mat-icon>
                  {{ fileAnalysis.error_message }}
                </div>
                
                <div *ngIf="fileAnalysis.quality_metrics" class="quality-indicators">
                  <div class="quality-item" 
                       [class.warning]="fileAnalysis.quality_metrics.missing_percentage > 10">
                    <span>{{ 'UPLOAD.ANALYSIS.MISSING_DATA' | translate }}:</span>
                    <span>{{ fileAnalysis.quality_metrics.missing_percentage }}%</span>
                  </div>
                  <div class="quality-item" 
                       [class.warning]="fileAnalysis.quality_metrics.has_duplicates">
                    <span>{{ 'UPLOAD.ANALYSIS.DUPLICATES' | translate }}:</span>
                    <span>{{ fileAnalysis.quality_metrics.has_duplicates ? 'Oui' : 'Non' }}</span>
                  </div>
                </div>
              </div>
            </div>

            <!-- Actions after analysis -->
            <div class="analysis-actions">
              <button mat-raised-button color="primary" (click)="openWizardWithAnalysis()">
                <mat-icon>assistant</mat-icon>
                {{ 'UPLOAD.ANALYSIS.CONTINUE_WIZARD' | translate }}
              </button>
              <button mat-stroked-button (click)="clearAnalysis()">
                <mat-icon>refresh</mat-icon>
                {{ 'UPLOAD.ANALYSIS.NEW_ANALYSIS' | translate }}
              </button>
            </div>
          </mat-card-content>
        </mat-card>
      </div>
    </div>
  `,
  styles: [`
    .upload-container {
      max-width: 1000px;
      margin: 0 auto;
      padding: 24px;
    }

    .header-section {
      display: flex;
      align-items: center;
      margin-bottom: 32px;
      gap: 16px;
    }

    .back-button {
      flex-shrink: 0;
    }

    .title-area h1 {
      margin: 0;
      font-size: 2rem;
      font-weight: 400;
      color: #1976d2;
    }

    .subtitle {
      margin: 4px 0 0 0;
      color: #666;
      font-size: 1.1rem;
    }

    .progress-section {
      margin-bottom: 24px;
    }

    .progress-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 12px;
    }

    .progress-header h3 {
      margin: 0;
    }

    .progress-percentage {
      text-align: right;
      margin-top: 8px;
      font-weight: 500;
      color: #1976d2;
    }

    .progress-icon-success {
      color: #4caf50;
    }

    .progress-icon-error {
      color: #f44336;
    }

    .progress-icon-loading {
      color: #1976d2;
      animation: pulse 1.5s ease-in-out infinite;
    }

    @keyframes pulse {
      0% { opacity: 1; }
      50% { opacity: 0.5; }
      100% { opacity: 1; }
    }

    .upload-card {
      margin-bottom: 24px;
    }

    .actions-section {
      margin-bottom: 24px;
    }

    .actions-header {
      margin-bottom: 20px;
    }

    .actions-header h3 {
      margin: 0 0 8px 0;
      color: #333;
    }

    .actions-header p {
      margin: 0;
      color: #666;
      font-size: 0.95rem;
    }

    .action-buttons {
      display: flex;
      gap: 16px;
      flex-wrap: wrap;
      margin-bottom: 20px;
    }

    .action-buttons button {
      min-width: 140px;
    }

    .draft-section {
      border-top: 1px solid #e0e0e0;
      padding-top: 20px;
      margin-top: 20px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .draft-info {
      display: flex;
      align-items: center;
      gap: 8px;
      color: #666;
    }

    .draft-actions {
      display: flex;
      gap: 8px;
    }

    .analysis-section {
      margin-bottom: 24px;
    }

    .analysis-summary {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 16px;
      margin-bottom: 24px;
      padding: 16px;
      background: #f9f9f9;
      border-radius: 8px;
    }

    .summary-item {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .label {
      font-weight: 500;
      color: #666;
    }

    .value {
      font-weight: 600;
      color: #333;
    }

    .quality-score.high {
      color: #4caf50;
    }

    .quality-score.medium {
      color: #ff9800;
    }

    .quality-score.low {
      color: #f44336;
    }

    .suggestions {
      margin-bottom: 24px;
    }

    .suggestions h4 {
      margin: 0 0 16px 0;
      color: #333;
    }

    .suggestion-item {
      margin-bottom: 12px;
      line-height: 1.5;
    }

    .tags {
      display: inline-flex;
      gap: 8px;
      flex-wrap: wrap;
      margin-left: 8px;
    }

    .tag {
      display: inline-block;
      padding: 4px 8px;
      border-radius: 12px;
      font-size: 0.85rem;
      font-weight: 500;
    }

    .domain-tag {
      background: #e3f2fd;
      color: #1976d2;
    }

    .task-tag {
      background: #f3e5f5;
      color: #7b1fa2;
    }

    .files-analysis h4 {
      margin: 0 0 16px 0;
      color: #333;
    }

    .file-analysis {
      border: 1px solid #e0e0e0;
      border-radius: 8px;
      padding: 16px;
      margin-bottom: 12px;
      background: white;
    }

    .file-analysis.error {
      border-color: #f44336;
      background: #ffebee;
    }

    .file-header {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 12px;
    }

    .filename {
      font-weight: 500;
      color: #333;
    }

    .file-stats {
      color: #666;
      font-size: 0.9rem;
      margin-left: auto;
    }

    .error-message {
      display: flex;
      align-items: center;
      gap: 8px;
      color: #f44336;
      background: white;
      padding: 8px;
      border-radius: 4px;
      margin-bottom: 12px;
    }

    .quality-indicators {
      display: flex;
      gap: 24px;
      flex-wrap: wrap;
    }

    .quality-item {
      display: flex;
      gap: 8px;
      font-size: 0.9rem;
    }

    .quality-item.warning {
      color: #f57c00;
      font-weight: 500;
    }

    .analysis-actions {
      display: flex;
      gap: 16px;
      margin-top: 24px;
      padding-top: 16px;
      border-top: 1px solid #e0e0e0;
    }

    /* Responsive */
    @media (max-width: 768px) {
      .upload-container {
        padding: 16px;
      }

      .action-buttons {
        flex-direction: column;
      }

      .action-buttons button {
        min-width: unset;
      }

      .analysis-summary {
        grid-template-columns: 1fr;
      }

      .analysis-actions {
        flex-direction: column;
      }
    }
  `]
})
export class DatasetUploadComponent implements OnInit, OnDestroy {
  selectedFiles: File[] = [];
  validationResult: ValidationResult | null = null;
  analysisResults: PreviewResponse | null = null;
  uploadProgress: UploadProgress | null = null;
  isLoading = false;
  hasDraft = false;

  private destroy$ = new Subject<void>();

  constructor(
    private uploadService: DatasetUploadService,
    private router: Router,
    private snackBar: MatSnackBar,
    private dialog: MatDialog
  ) {}

  ngOnInit() {
    // Vérifier s'il y a un brouillon
    this.hasDraft = this.uploadService.hasDraft();

    // Écouter la progression de l'upload
    this.uploadService.uploadProgress$
      .pipe(takeUntil(this.destroy$))
      .subscribe(progress => {
        this.uploadProgress = progress;
        if (progress?.stage === 'completed' && progress.result) {
          this.onUploadSuccess(progress.result);
        } else if (progress?.stage === 'error') {
          this.onUploadError(progress.error || 'Erreur inconnue');
        }
      });
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  onFilesSelected(files: File[]) {
    this.selectedFiles = files;
    // Réinitialiser l'analyse précédente
    this.analysisResults = null;
    this.uploadService.resetProgress();
  }

  onValidationChanged(result: ValidationResult) {
    this.validationResult = result;
  }

  canAnalyze(): boolean {
    return this.selectedFiles.length > 0 && 
           this.validationResult?.isValid === true;
  }

  canProceed(): boolean {
    return this.canAnalyze();
  }

  analyzeFiles() {
    if (!this.canAnalyze()) return;

    this.isLoading = true;
    this.uploadService.previewFiles(this.selectedFiles)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (result) => {
          this.analysisResults = result;
          this.isLoading = false;
          this.snackBar.open('Analyse terminée avec succès', 'Fermer', { duration: 3000 });
        },
        error: (error) => {
          this.isLoading = false;
          this.snackBar.open('Erreur lors de l\'analyse', 'Fermer', { duration: 5000 });
          console.error('Erreur d\'analyse:', error);
        }
      });
  }

  openWizard() {
    // Rediriger vers le wizard avec les fichiers dans l'état de navigation
    this.router.navigate(['/datasets/upload/wizard'], {
      state: { 
        selectedFiles: this.selectedFiles,
        analysisResults: this.analysisResults
      }
    });
  }

  openWizardWithAnalysis() {
    // Rediriger vers le wizard avec les fichiers et résultats d'analyse
    this.router.navigate(['/datasets/upload/wizard'], { 
      state: { 
        selectedFiles: this.selectedFiles,
        analysisResults: this.analysisResults
      } 
    });
  }



  loadDraft() {
    const draft = this.uploadService.loadDraft();
    if (draft) {
      // Rediriger vers le wizard avec le brouillon
      this.router.navigate(['/datasets/upload/wizard'], {
        state: { draftData: draft }
      });
    }
  }

  clearDraft() {
    this.uploadService.clearDraft();
    this.hasDraft = false;
    this.snackBar.open('Brouillon supprimé', 'Fermer', { duration: 3000 });
  }

  clearAnalysis() {
    this.analysisResults = null;
    this.uploadService.resetProgress();
  }

  goBack() {
    this.router.navigate(['/datasets']);
  }

  getProgressTitle(): string {
    if (!this.uploadProgress) return '';
    
    switch (this.uploadProgress.stage) {
      case 'uploading': return 'Upload en cours...';
      case 'analyzing': return 'Analyse en cours...';
      case 'converting': return 'Conversion en cours...';
      case 'saving': return 'Sauvegarde en cours...';
      case 'completed': return 'Upload terminé !';
      case 'error': return 'Erreur d\'upload';
      default: return 'Traitement...';
    }
  }

  getProgressIcon(): string {
    if (!this.uploadProgress) return 'info';
    
    switch (this.uploadProgress.stage) {
      case 'completed': return 'check_circle';
      case 'error': return 'error';
      default: return 'upload';
    }
  }

  getProgressIconClass(): string {
    if (!this.uploadProgress) return '';
    
    switch (this.uploadProgress.stage) {
      case 'completed': return 'progress-icon-success';
      case 'error': return 'progress-icon-error';
      default: return 'progress-icon-loading';
    }
  }

  getQualityScoreClass(): string {
    const score = this.analysisResults?.suggestions.quality_score || 0;
    if (score >= 80) return 'high';
    if (score >= 60) return 'medium';
    return 'low';
  }

  getFileIcon(filename: string): string {
    const extension = filename.split('.').pop()?.toLowerCase();
    
    switch (extension) {
      case 'csv': return 'table_chart';
      case 'xlsx':
      case 'xls': return 'description';
      case 'json': return 'data_object';
      case 'xml': return 'code';
      case 'parquet': return 'storage';
      default: return 'insert_drive_file';
    }
  }

  private saveCurrentState() {
    // Sauvegarder l'état actuel dans sessionStorage pour le wizard
    const state = {
      selectedFiles: this.selectedFiles.map(f => ({
        name: f.name,
        size: f.size,
        type: f.type
      })),
      analysisResults: this.analysisResults
    };
    sessionStorage.setItem('dataset-upload-state', JSON.stringify(state));
  }

  private onUploadSuccess(result: any) {
    this.isLoading = false;
    this.snackBar.open('Dataset créé avec succès !', 'Fermer', { duration: 5000 });
    
    // Rediriger vers le dataset créé après un délai
    setTimeout(() => {
      this.router.navigate(['/datasets', result.id]);
    }, 2000);
  }

  private onUploadError(error: string) {
    this.isLoading = false;
    this.snackBar.open(`Erreur: ${error}`, 'Fermer', { duration: 8000 });
  }
}