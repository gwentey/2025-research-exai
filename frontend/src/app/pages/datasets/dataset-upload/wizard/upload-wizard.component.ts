import { Component, OnInit, OnDestroy, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, ActivatedRoute } from '@angular/router';
import { FormControl, Validators } from '@angular/forms';
import { MatStepperModule, MatStepper } from '@angular/material/stepper';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatCardModule } from '@angular/material/card';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

import { FileDropZoneComponent } from '../../../../components/file-drop-zone/file-drop-zone.component';
import { MetadataFormComponent } from '../metadata-form/metadata-form.component';
import { MissingDataScoreComponent } from '../../components/missing-data-score.component';
import { DatasetUploadService, ValidationResult, PreviewResponse, UploadProgress, DatasetMetadata } from '../../../../services/dataset-upload.service';
import { TranslateModule } from '@ngx-translate/core';

@Component({
  selector: 'app-upload-wizard',
  standalone: true,
  imports: [
    CommonModule,
    MatStepperModule,
    MatButtonModule,
    MatIconModule,
    MatCardModule,
    MatProgressBarModule,
    FileDropZoneComponent,
    MetadataFormComponent,
    MissingDataScoreComponent,
    TranslateModule
  ],
  template: `
    <div class="wizard-container">
      <!-- Header -->
      <div class="wizard-header">
        <button mat-icon-button (click)="goBack()" class="back-button">
          <mat-icon>arrow_back</mat-icon>
        </button>
        <div class="title-area">
          <h1>{{ 'UPLOAD_WIZARD.TITLE' | translate }}</h1>
          <p class="subtitle">{{ 'UPLOAD_WIZARD.SUBTITLE' | translate }}</p>
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

      <!-- Wizard Steps -->
      <mat-stepper #stepper orientation="horizontal" [linear]="true" class="upload-stepper">
        
        <!-- Étape 1: Sélection des fichiers -->
        <mat-step [stepControl]="filesStepControl" [editable]="isStepEditable(0)">
          <ng-template matStepLabel>
            <mat-icon>upload_file</mat-icon>
            {{ 'UPLOAD_WIZARD.STEPS.FILES' | translate }}
          </ng-template>
          
          <div class="step-content">
            <div class="step-header">
              <h2>{{ 'UPLOAD_WIZARD.FILES.TITLE' | translate }}</h2>
              <p>{{ 'UPLOAD_WIZARD.FILES.DESCRIPTION' | translate }}</p>
            </div>

            <app-file-drop-zone
              [maxFiles]="10"
              [maxFileSize]="104857600"
              [acceptedFormats]="['csv', 'xlsx', 'xls', 'json', 'xml', 'parquet']"
              (filesSelected)="onFilesSelected($event)"
              (validationChanged)="onValidationChanged($event)">
            </app-file-drop-zone>

            <div class="step-actions">
              <button mat-raised-button color="primary" 
                      [disabled]="!canProceedToAnalysis()"
                      (click)="analyzeFiles()">
                <mat-icon>analytics</mat-icon>
                {{ 'UPLOAD_WIZARD.FILES.ANALYZE' | translate }}
              </button>
            </div>
          </div>
        </mat-step>

        <!-- Étape 2: Analyse des données -->
        <mat-step [stepControl]="analysisStepControl" [editable]="isStepEditable(1)">
          <ng-template matStepLabel>
            <mat-icon>insights</mat-icon>
            {{ 'UPLOAD_WIZARD.STEPS.ANALYSIS' | translate }}
          </ng-template>
          
          <div class="step-content">
            <div class="step-header">
              <h2>{{ 'UPLOAD_WIZARD.ANALYSIS.TITLE' | translate }}</h2>
              <p>{{ 'UPLOAD_WIZARD.ANALYSIS.DESCRIPTION' | translate }}</p>
            </div>

            <!-- Résultats d'analyse -->
            <div *ngIf="analysisResults" class="analysis-results">
              <mat-card class="summary-card">
                <mat-card-header>
                  <mat-card-title>
                    <mat-icon>summarize</mat-icon>
                    {{ 'UPLOAD_WIZARD.ANALYSIS.SUMMARY' | translate }}
                  </mat-card-title>
                </mat-card-header>
                
                <mat-card-content>
                  <div class="summary-grid">
                    <div class="summary-item">
                      <span class="label">{{ 'UPLOAD_WIZARD.ANALYSIS.TOTAL_FILES' | translate }}:</span>
                      <span class="value">{{ analysisResults.summary.total_files }}</span>
                    </div>
                    <div class="summary-item">
                      <span class="label">{{ 'UPLOAD_WIZARD.ANALYSIS.TOTAL_ROWS' | translate }}:</span>
                      <span class="value">{{ analysisResults.summary.total_rows | number }}</span>
                    </div>
                    <div class="summary-item">
                      <span class="label">{{ 'UPLOAD_WIZARD.ANALYSIS.TOTAL_SIZE' | translate }}:</span>
                      <span class="value">{{ analysisResults.summary.total_size_mb }} MB</span>
                    </div>
                    <div class="summary-item">
                      <span class="label">{{ 'UPLOAD_WIZARD.ANALYSIS.QUALITY_SCORE' | translate }}:</span>
                      <span class="value quality-score" [class]="getQualityScoreClass()">
                        {{ analysisResults.suggestions.quality_score }}/100
                      </span>
                    </div>
                  </div>
                </mat-card-content>
              </mat-card>

              <!-- Analyse des données manquantes -->
              <div *ngIf="hasMissingDataIssues()" class="missing-data-analysis">
                <app-missing-data-score 
                  [files]="getMockFilesForAnalysis()"
                  [columns]="getMockColumnsForAnalysis()">
                </app-missing-data-score>
              </div>

              <!-- Problèmes détectés -->
              <mat-card *ngIf="hasQualityIssues()" class="issues-card">
                <mat-card-header>
                  <mat-card-title>
                    <mat-icon color="warn">warning</mat-icon>
                    {{ 'UPLOAD_WIZARD.ANALYSIS.ISSUES_DETECTED' | translate }}
                  </mat-card-title>
                </mat-card-header>
                
                <mat-card-content>
                  <div *ngFor="let file of analysisResults.files_analysis" class="file-issues">
                    <div *ngIf="file.quality_metrics && hasFileIssues(file)" class="file-header">
                      <mat-icon>{{ getFileIcon(file.filename) }}</mat-icon>
                      <span class="filename">{{ file.filename }}</span>
                    </div>
                    
                    <!-- Données manquantes analysées séparément dans le composant dédié -->
                    <!-- <div *ngIf="file.quality_metrics && file.quality_metrics.missing_percentage > 10" class="issue-item">
                      <mat-icon color="warn">error</mat-icon>
                      <span>{{ file.quality_metrics.missing_percentage }}% {{ 'UPLOAD_WIZARD.ANALYSIS.MISSING_DATA' | translate }}</span>
                    </div> -->
                    
                    <div *ngIf="file.quality_metrics?.has_duplicates" class="issue-item">
                      <mat-icon color="warn">content_copy</mat-icon>
                      <span>{{ 'UPLOAD_WIZARD.ANALYSIS.DUPLICATES_FOUND' | translate }}</span>
                    </div>
                    
                    <div *ngIf="file.quality_metrics?.is_empty" class="issue-item">
                      <mat-icon color="warn">inbox</mat-icon>
                      <span>{{ 'UPLOAD_WIZARD.ANALYSIS.EMPTY_FILE' | translate }}</span>
                    </div>
                  </div>
                </mat-card-content>
              </mat-card>
            </div>

            <!-- État de chargement -->
            <div *ngIf="!analysisResults && isAnalyzing" class="loading-state">
              <mat-card>
                <mat-card-content>
                  <div class="loading-content">
                    <mat-icon class="spinning">refresh</mat-icon>
                    <h3>{{ 'UPLOAD_WIZARD.ANALYSIS.ANALYZING' | translate }}</h3>
                    <p>{{ 'UPLOAD_WIZARD.ANALYSIS.PLEASE_WAIT' | translate }}</p>
                  </div>
                </mat-card-content>
              </mat-card>
            </div>

            <div class="step-actions">
              <button mat-button (click)="stepper.previous()">
                <mat-icon>arrow_back</mat-icon>
                {{ 'UPLOAD_WIZARD.ACTIONS.PREVIOUS' | translate }}
              </button>
              
              <button mat-raised-button color="primary" 
                      [disabled]="!canProceedToMetadata()"
                      (click)="stepper.next()">
                {{ 'UPLOAD_WIZARD.ACTIONS.CONTINUE_METADATA' | translate }}
                <mat-icon>arrow_forward</mat-icon>
              </button>
            </div>
          </div>
        </mat-step>

        <!-- Étape 3: Métadonnées -->
        <mat-step [stepControl]="metadataStepControl" [editable]="isStepEditable(2)">
          <ng-template matStepLabel>
            <mat-icon>edit</mat-icon>
            {{ 'UPLOAD_WIZARD.STEPS.METADATA' | translate }}
          </ng-template>
          
          <div class="step-content">
            <app-metadata-form
              [suggestions]="analysisResults?.suggestions || null"
              [initialData]="draftMetadata"
              (formSubmit)="onMetadataSubmit($event)"
              (formCancel)="onMetadataCancel()">
            </app-metadata-form>
          </div>
        </mat-step>

        <!-- Étape 4: Confirmation et Upload -->
        <mat-step [stepControl]="confirmationStepControl" [editable]="isStepEditable(3)">
          <ng-template matStepLabel>
            <mat-icon>check_circle</mat-icon>
            {{ 'UPLOAD_WIZARD.STEPS.CONFIRMATION' | translate }}
          </ng-template>
          
          <div class="step-content">
            <div class="step-header">
              <h2>{{ 'UPLOAD_WIZARD.CONFIRMATION.TITLE' | translate }}</h2>
              <p>{{ 'UPLOAD_WIZARD.CONFIRMATION.DESCRIPTION' | translate }}</p>
            </div>

            <!-- Récapitulatif -->
            <div *ngIf="finalMetadata" class="confirmation-summary">
              <mat-card>
                <mat-card-header>
                  <mat-card-title>{{ finalMetadata.dataset_name }}</mat-card-title>
                  <mat-card-subtitle>{{ 'UPLOAD_WIZARD.CONFIRMATION.SUMMARY' | translate }}</mat-card-subtitle>
                </mat-card-header>
                
                <mat-card-content>
                  <div class="summary-section">
                    <h4>{{ 'UPLOAD_WIZARD.CONFIRMATION.FILES' | translate }}</h4>
                    <ul>
                      <li *ngFor="let file of selectedFiles">
                        {{ file.name }} ({{ formatFileSize(file.size) }})
                      </li>
                    </ul>
                  </div>
                  
                  <div class="summary-section">
                    <h4>{{ 'UPLOAD_WIZARD.CONFIRMATION.METADATA' | translate }}</h4>
                    <div class="metadata-summary">
                      <div class="meta-item">
                        <strong>{{ 'UPLOAD_WIZARD.CONFIRMATION.DOMAINS' | translate }}:</strong>
                        <span>{{ (finalMetadata.domain || []).join(', ') || 'Non spécifié' }}</span>
                      </div>
                      <div class="meta-item">
                        <strong>{{ 'UPLOAD_WIZARD.CONFIRMATION.TASKS' | translate }}:</strong>
                        <span>{{ (finalMetadata.task || []).join(', ') || 'Non spécifié' }}</span>
                      </div>
                      <div class="meta-item">
                        <strong>{{ 'UPLOAD_WIZARD.CONFIRMATION.ACCESS' | translate }}:</strong>
                        <span>{{ finalMetadata.access || 'Public' }}</span>
                      </div>
                    </div>
                  </div>
                </mat-card-content>
              </mat-card>
            </div>

            <div class="step-actions">
              <button mat-button (click)="stepper.previous()">
                <mat-icon>arrow_back</mat-icon>
                {{ 'UPLOAD_WIZARD.ACTIONS.PREVIOUS' | translate }}
              </button>
              
              <button mat-raised-button color="primary" 
                      [disabled]="isUploading"
                      (click)="startUpload()">
                <mat-icon>cloud_upload</mat-icon>
                {{ isUploading ? ('UPLOAD_WIZARD.ACTIONS.UPLOADING' | translate) : ('UPLOAD_WIZARD.ACTIONS.CREATE_DATASET' | translate) }}
              </button>
            </div>
          </div>
        </mat-step>
      </mat-stepper>
    </div>
  `,
  styles: [`
    .wizard-container {
      max-width: 1200px;
      margin: 0 auto;
      padding: 24px;
    }

    .wizard-header {
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
      margin-bottom: 32px;
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

    .upload-stepper {
      margin-bottom: 32px;
    }

    .step-content {
      padding: 32px 0;
    }

    .step-header {
      text-align: center;
      margin-bottom: 32px;
    }

    .step-header h2 {
      margin: 0 0 8px 0;
      color: #333;
    }

    .step-header p {
      margin: 0;
      color: #666;
      font-size: 1.1rem;
    }

    .step-actions {
      display: flex;
      justify-content: space-between;
      margin-top: 32px;
      padding-top: 24px;
      border-top: 1px solid #e0e0e0;
    }

    .analysis-results {
      display: flex;
      flex-direction: column;
      gap: 24px;
    }

    .summary-card {
      background: #f8f9fa;
    }

    .summary-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 16px;
    }

    .summary-item {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 8px;
      background: white;
      border-radius: 4px;
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

    .issues-card {
      border-left: 4px solid #ff9800;
    }

    .file-issues {
      margin-bottom: 16px;
    }

    .file-header {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 8px;
      font-weight: 500;
    }

    .issue-item {
      display: flex;
      align-items: center;
      gap: 8px;
      margin: 4px 0 4px 16px;
      color: #f57c00;
    }

    .loading-state {
      text-align: center;
    }

    .loading-content {
      padding: 40px;
    }

    .spinning {
      animation: spin 2s linear infinite;
      font-size: 48px;
      color: #1976d2;
      margin-bottom: 16px;
    }

    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }

    .confirmation-summary {
      margin-bottom: 32px;
    }

    .summary-section {
      margin-bottom: 24px;
    }

    .summary-section h4 {
      margin: 0 0 12px 0;
      color: #333;
    }

    .summary-section ul {
      margin: 0;
      padding-left: 20px;
    }

    .summary-section li {
      margin: 4px 0;
    }

    .metadata-summary {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .meta-item {
      display: flex;
      gap: 8px;
    }

    .meta-item strong {
      min-width: 120px;
      color: #666;
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

    /* Responsive */
    @media (max-width: 768px) {
      .wizard-container {
        padding: 16px;
      }

      .step-actions {
        flex-direction: column;
        gap: 12px;
      }

      .summary-grid {
        grid-template-columns: 1fr;
      }

      .meta-item {
        flex-direction: column;
        gap: 4px;
      }
    }
  `]
})
export class UploadWizardComponent implements OnInit, OnDestroy {
  @ViewChild('stepper', { static: true }) stepper!: MatStepper;

  // State
  selectedFiles: File[] = [];
  validationResult: ValidationResult | null = null;
  analysisResults: PreviewResponse | null = null;
  finalMetadata: DatasetMetadata | null = null;
  draftMetadata: Partial<DatasetMetadata> | null = null;
  uploadProgress: UploadProgress | null = null;

  // Loading states
  isAnalyzing = false;
  isUploading = false;

  // Step controls (for stepper validation)
  filesStepControl = new FormControl(false, Validators.requiredTrue);
  analysisStepControl = new FormControl(false, Validators.requiredTrue);
  metadataStepControl = new FormControl(false, Validators.requiredTrue);
  confirmationStepControl = new FormControl(false, Validators.requiredTrue);

  private destroy$ = new Subject<void>();

  constructor(
    private uploadService: DatasetUploadService,
    private router: Router,
    private route: ActivatedRoute,
    private snackBar: MatSnackBar
  ) {}

  ngOnInit() {
    // Charger les données du state si disponibles
    this.loadStateFromNavigation();

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

  private loadStateFromNavigation() {
    // Charger depuis l'historique de navigation
    const navigationState = history.state;
    
    // Récupérer les fichiers sélectionnés depuis l'état de navigation
    if (navigationState?.selectedFiles && Array.isArray(navigationState.selectedFiles)) {
      this.selectedFiles = navigationState.selectedFiles;
      this.filesStepControl.setValue(this.selectedFiles.length > 0);
      console.log(`[WIZARD] Fichiers récupérés depuis l'état de navigation: ${this.selectedFiles.length} fichiers`);
    }
    
    if (navigationState?.analysisResults) {
      this.analysisResults = navigationState.analysisResults;
      this.analysisStepControl.setValue(true);
      console.log('[WIZARD] Résultats d\'analyse récupérés depuis l\'état de navigation');
    }
    
    if (navigationState?.draftData) {
      this.draftMetadata = navigationState.draftData;
    }

    // Charger depuis sessionStorage (fallback pour les anciens flux)
    try {
      const savedState = sessionStorage.getItem('dataset-upload-state');
      if (savedState) {
        const state = JSON.parse(savedState);
        if (state.analysisResults && !this.analysisResults) {
          this.analysisResults = state.analysisResults;
          this.analysisStepControl.setValue(true);
        }
      }
    } catch (error) {
      console.warn('Impossible de charger l\'état sauvegardé:', error);
    }
  }

  onFilesSelected(files: File[]) {
    this.selectedFiles = files;
    this.filesStepControl.setValue(files.length > 0 && this.validationResult?.isValid === true);
  }

  onValidationChanged(result: ValidationResult) {
    this.validationResult = result;
    this.filesStepControl.setValue(this.selectedFiles.length > 0 && result.isValid);
  }

  canProceedToAnalysis(): boolean {
    return this.selectedFiles.length > 0 && this.validationResult?.isValid === true;
  }

  analyzeFiles() {
    if (!this.canProceedToAnalysis()) return;

    this.isAnalyzing = true;
    this.uploadService.previewFiles(this.selectedFiles)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (result) => {
          this.analysisResults = result;
          this.analysisStepControl.setValue(true);
          this.isAnalyzing = false;
          this.stepper.next();
          this.snackBar.open('Analyse terminée avec succès', 'Fermer', { duration: 3000 });
        },
        error: (error) => {
          this.isAnalyzing = false;
          this.snackBar.open('Erreur lors de l\'analyse', 'Fermer', { duration: 5000 });
          console.error('Erreur d\'analyse:', error);
        }
      });
  }

  canProceedToMetadata(): boolean {
    return this.analysisResults !== null;
  }

  onMetadataSubmit(metadata: DatasetMetadata) {
    this.finalMetadata = metadata;
    this.metadataStepControl.setValue(true);
    this.confirmationStepControl.setValue(true);
    this.stepper.next();
  }

  onMetadataCancel() {
    this.stepper.previous();
  }

  startUpload() {
    if (!this.finalMetadata || !this.selectedFiles.length) return;

    this.isUploading = true;
    this.uploadService.uploadDataset(this.finalMetadata, this.selectedFiles)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        error: (error) => {
          this.isUploading = false;
          console.error('Erreur d\'upload:', error);
        }
      });
  }

  hasQualityIssues(): boolean {
    if (!this.analysisResults) return false;
    
    return this.analysisResults.files_analysis.some(file => 
      this.hasFileIssues(file)
    );
  }

  hasFileIssues(file: any): boolean {
    return file.quality_metrics && (
      // Les données manquantes sont traitées séparément dans le composant dédié
      file.quality_metrics.has_duplicates ||
      file.quality_metrics.is_empty
    );
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

  formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 B';
    
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
  }

  isStepEditable(stepIndex: number): boolean {
    // Permettre l'édition des étapes précédentes seulement si l'étape actuelle est valide
    switch (stepIndex) {
      case 0: return true; // Toujours éditable
      case 1: return this.filesStepControl.value === true;
      case 2: return this.analysisStepControl.value === true;
      case 3: return this.metadataStepControl.value === true;
      default: return false;
    }
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

  /**
   * Vérifie s'il y a des problèmes de données manquantes
   */
  hasMissingDataIssues(): boolean {
    if (!this.analysisResults?.files_analysis) return false;
    
    return this.analysisResults.files_analysis.some(file => 
      file.quality_metrics && file.quality_metrics.missing_percentage > 0
    );
  }

  /**
   * Crée des données de fichier mock pour le composant d'analyse
   */
  getMockFilesForAnalysis(): any[] {
    if (!this.analysisResults?.files_analysis) return [];
    
    return this.analysisResults.files_analysis.map(file => ({
      id: file.filename,
      dataset_id: 'temp',
      file_name_in_storage: file.filename,
      original_filename: file.filename,
      format: this.getFileFormat(file.filename),
      size_bytes: file.size_bytes || 0,
      row_count: file.row_count || 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }));
  }

  /**
   * Crée des données de colonne mock pour le composant d'analyse
   */
  getMockColumnsForAnalysis(): any[] {
    if (!this.analysisResults?.files_analysis) return [];
    
    const columns: any[] = [];
    this.analysisResults.files_analysis.forEach((file, fileIndex) => {
      if (file.columns_analysis) {
        file.columns_analysis.forEach((col, colIndex) => {
          columns.push({
            id: `${fileIndex}-${colIndex}`,
            dataset_file_id: file.filename,
            column_name: col.column_name,
            data_type_original: col.data_type_interpreted,
            data_type_interpreted: col.data_type_interpreted,
            is_primary_key_component: false,
            is_nullable: col.missing_count > 0,
            is_pii: false,
            position: colIndex,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          });
        });
      }
    });
    
    return columns;
  }

  /**
   * Extrait le format de fichier depuis le nom
   */
  private getFileFormat(filename: string): string {
    const extension = filename.split('.').pop()?.toLowerCase();
    return extension || 'unknown';
  }

  goBack() {
    this.router.navigate(['/datasets/upload']);
  }

  private onUploadSuccess(result: any) {
    this.isUploading = false;
    this.snackBar.open('Dataset créé avec succès !', 'Fermer', { duration: 5000 });
    
    // Nettoyer le state sauvegardé
    sessionStorage.removeItem('dataset-upload-state');
    
    // Rediriger vers le dataset créé après un délai
    setTimeout(() => {
      // Vérification de la structure de la réponse avant navigation
      if (result && result.id) {
        this.router.navigate(['/datasets', result.id]);
      } else {
        console.error('Erreur: ID du dataset non trouvé dans la réponse', result);
        // Redirection de fallback vers la liste des datasets
        this.router.navigate(['/datasets']);
      }
    }, 2000);
  }

  private onUploadError(error: string) {
    this.isUploading = false;
    this.snackBar.open(`Erreur: ${error}`, 'Fermer', { duration: 8000 });
  }
}