import { Component, EventEmitter, Input, Output, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatChipsModule } from '@angular/material/chips';
import { MatTooltipModule } from '@angular/material/tooltip';
import { DragDropModule } from '@angular/cdk/drag-drop';
import { TranslateModule } from '@ngx-translate/core';
import { DatasetUploadService, ValidationResult } from '../../services/dataset-upload.service';

@Component({
  selector: 'app-file-drop-zone',
  standalone: true,
  imports: [
    CommonModule,
    MatButtonModule,
    MatIconModule,
    MatProgressBarModule,
    MatChipsModule,
    MatTooltipModule,
    DragDropModule,
    TranslateModule
  ],
  template: `
    <div
      class="drop-zone"
      [class.drag-over]="isDragOver"
      [class.has-files]="selectedFiles.length > 0"
      (dragover)="onDragOver($event)"
      (dragleave)="onDragLeave($event)"
      (drop)="onDrop($event)"
      (click)="fileInput.click()">

      <!-- Zone de drop vide -->
      <div *ngIf="selectedFiles.length === 0" class="drop-content">
        <mat-icon class="drop-icon">cloud_upload</mat-icon>
        <h3>{{ 'UPLOAD.DROP_ZONE.TITLE' | translate }}</h3>
        <p>{{ 'UPLOAD.DROP_ZONE.DESCRIPTION' | translate }}</p>
        <p class="formats">{{ 'UPLOAD.DROP_ZONE.SUPPORTED_FORMATS' | translate }}</p>
        <button mat-raised-button color="primary" class="browse-button">
          <mat-icon>folder_open</mat-icon>
          {{ 'UPLOAD.DROP_ZONE.BROWSE' | translate }}
        </button>
      </div>

      <!-- Liste des fichiers sélectionnés -->
      <div *ngIf="selectedFiles.length > 0" class="files-list">
        <div class="files-header">
          <h4>{{ selectedFiles.length }} {{ 'UPLOAD.DROP_ZONE.FILES_SELECTED' | translate }}</h4>
          <button
            mat-icon-button
            color="warn"
            (click)="clearFiles(); $event.stopPropagation();"
            matTooltip="{{ 'UPLOAD.DROP_ZONE.CLEAR_ALL' | translate }}">
            <mat-icon>clear_all</mat-icon>
          </button>
        </div>

        <div class="file-items">
          <div
            *ngFor="let file of selectedFiles; let i = index"
            class="file-item"
            [class.error]="hasFileError(file)">

            <div class="file-icon">
              <mat-icon>{{ getFileIcon(file) }}</mat-icon>
            </div>

            <div class="file-info">
              <div class="file-name">{{ file.name }}</div>
              <div class="file-details">
                {{ formatFileSize(file.size) }} • {{ getFileExtension(file.name) }}
                <span *ngIf="hasFileError(file)" class="error-indicator">
                  • {{ 'UPLOAD.DROP_ZONE.ERROR' | translate }}
                </span>
              </div>
            </div>

            <div class="file-actions">
              <button
                mat-icon-button
                (click)="removeFile(i); $event.stopPropagation();"
                matTooltip="{{ 'UPLOAD.DROP_ZONE.REMOVE_FILE' | translate }}">
                <mat-icon>close</mat-icon>
              </button>
            </div>
          </div>
        </div>

        <!-- Erreurs de validation -->
        <div *ngIf="validationResult && !validationResult.isValid" class="validation-errors">
          <div class="error-header">
            <mat-icon>error</mat-icon>
            <strong>{{ getErrorSummary() }}</strong>
          </div>

          <div class="error-list">
            <div *ngFor="let error of validationResult.errors" class="error-item">
              {{ error }}
            </div>
          </div>

          <!-- Explication PoC pour les erreurs de taille -->
          <div *ngIf="hasSizeErrors()" class="size-error-help">
            <div class="help-title">
              <mat-icon>info</mat-icon>
              Pourquoi cette limitation ?
            </div>
            <div class="poc-explanation">
              <p><strong>🧪 Version démonstration (PoC)</strong></p>
              <p>Cette version d'IBIS-X est une démonstration technique avec des ressources limitées.
                 Le traitement de gros fichiers nécessite beaucoup de mémoire RAM et de puissance CPU,
                 ce qui représente un coût important sur notre infrastructure actuelle.</p>
              <p><strong>💡 Solutions :</strong> Réduisez la taille de votre fichier en supprimant des colonnes
                 inutiles, en filtrant les données, ou en utilisant un échantillon représentatif.</p>
              <p><em>En production avec un budget adapté, ces limites seraient considérablement augmentées.</em></p>
            </div>
          </div>
        </div>

        <!-- Avertissements -->
        <div *ngIf="validationResult && validationResult.warnings.length > 0" class="validation-warnings">
          <div *ngFor="let warning of validationResult.warnings" class="warning-message">
            <mat-icon>warning</mat-icon>
            {{ warning }}
          </div>
        </div>

        <!-- Bouton pour ajouter plus de fichiers -->
        <button
          mat-stroked-button
          class="add-more-button"
          (click)="fileInput.click(); $event.stopPropagation();">
          <mat-icon>add</mat-icon>
          {{ 'UPLOAD.DROP_ZONE.ADD_MORE' | translate }}
        </button>
      </div>

      <!-- Input file caché -->
      <input
        #fileInput
        type="file"
        multiple
        accept=".csv,.xlsx,.xls,.json,.xml,.parquet"
        style="display: none"
        (change)="onFileSelect($event)">
    </div>
  `,
  styles: [`
    .drop-zone {
      border: 2px dashed #ccc;
      border-radius: 12px;
      padding: 40px 20px;
      text-align: center;
      cursor: pointer;
      transition: all 0.3s ease;
      min-height: 200px;
      display: flex;
      flex-direction: column;
      justify-content: center;
      background: #fafafa;
    }

    .drop-zone:hover {
      border-color: #1976d2;
      background: #f5f5f5;
    }

    .drop-zone.drag-over {
      border-color: #1976d2;
      background: #e3f2fd;
      transform: scale(1.02);
    }

    .drop-zone.has-files {
      border-color: #4caf50;
      background: #f9f9f9;
      text-align: left;
      padding: 20px;
    }

    .drop-content {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 16px;
    }

    .drop-icon {
      font-size: 48px;
      width: 48px;
      height: 48px;
      color: #1976d2;
      margin-bottom: 8px;
    }

    .drop-content h3 {
      margin: 0;
      color: #333;
      font-weight: 500;
    }

    .drop-content p {
      margin: 0;
      color: #666;
    }

    .formats {
      font-size: 0.9em;
      font-style: italic;
    }

    .browse-button {
      margin-top: 8px;
    }

    .files-list {
      width: 100%;
    }

    .files-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 16px;
      padding-bottom: 8px;
      border-bottom: 1px solid #e0e0e0;
    }

    .files-header h4 {
      margin: 0;
      color: #333;
    }

    .file-items {
      margin-bottom: 16px;
    }

    .file-item {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 12px;
      margin: 8px 0;
      background: white;
      border-radius: 8px;
      border: 1px solid #e0e0e0;
      transition: all 0.2s ease;
    }

    .file-item:hover {
      border-color: #1976d2;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
    }

    .file-item.error {
      border-color: #f44336;
      background: #ffebee;
    }

    .file-icon {
      width: 40px;
      height: 40px;
      display: flex;
      align-items: center;
      justify-content: center;
      background: #f5f5f5;
      border-radius: 8px;
      flex-shrink: 0;
    }

    .file-icon mat-icon {
      color: #1976d2;
    }

    .file-info {
      flex: 1;
      min-width: 0;
    }

    .file-name {
      font-weight: 500;
      color: #333;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .file-details {
      font-size: 0.9em;
      color: #666;
      margin-top: 2px;
    }

    .error-indicator {
      color: #f44336;
      font-weight: 500;
    }

    .file-actions {
      flex-shrink: 0;
    }

    .validation-errors {
      background: #ffebee;
      border: 1px solid #f44336;
      border-radius: 8px;
      padding: 16px;
      margin: 16px 0;
    }

    .error-header {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 12px;
      color: #d32f2f;
      font-size: 1.1em;
    }

    .error-list {
      margin-bottom: 16px;
    }

    .error-item {
      display: flex;
      align-items: flex-start;
      gap: 8px;
      margin: 6px 0;
      padding: 8px 12px;
      background: rgba(255, 255, 255, 0.7);
      border-radius: 4px;
      font-size: 0.95em;
      color: #c62828;
    }

    .size-error-help {
      border-top: 1px solid #f8bbd9;
      padding-top: 16px;
      margin-top: 16px;
    }

    .help-title {
      display: flex;
      align-items: center;
      gap: 8px;
      font-weight: 500;
      color: #e65100;
      margin-bottom: 8px;
    }

    .size-error-help p {
      color: #666;
      margin: 8px 0;
      line-height: 1.4;
    }

    .poc-explanation {
      background: rgba(33, 150, 243, 0.05);
      border: 1px solid rgba(33, 150, 243, 0.2);
      border-radius: 6px;
      padding: 14px;
      margin-top: 8px;
    }

    .poc-explanation p {
      margin: 8px 0;
      line-height: 1.5;
    }

    .poc-explanation p:first-child {
      margin-top: 0;
    }

    .poc-explanation p:last-child {
      margin-bottom: 0;
      font-style: italic;
      color: #666;
      font-size: 0.9em;
    }

    .poc-explanation strong {
      color: #1976d2;
    }

    .error-message {
      display: flex;
      align-items: center;
      gap: 8px;
      color: #f44336;
      margin: 4px 0;
    }

    .validation-warnings {
      background: #fff3e0;
      border: 1px solid #ff9800;
      border-radius: 4px;
      padding: 12px;
      margin: 16px 0;
    }

    .warning-message {
      display: flex;
      align-items: center;
      gap: 8px;
      color: #f57c00;
      margin: 4px 0;
    }

    .add-more-button {
      width: 100%;
      margin-top: 12px;
    }
  `]
})
export class FileDropZoneComponent implements OnInit {
  @Input() maxFiles: number = 10;
  @Input() maxFileSize: number = 100 * 1024 * 1024; // 100MB
  @Input() acceptedFormats: string[] = ['csv', 'xlsx', 'xls', 'json', 'xml', 'parquet'];

  @Output() filesSelected = new EventEmitter<File[]>();
  @Output() validationChanged = new EventEmitter<ValidationResult>();

  selectedFiles: File[] = [];
  isDragOver = false;
  validationResult: ValidationResult | null = null;

  constructor(private uploadService: DatasetUploadService) {}

  ngOnInit() {
    this.validateFiles();
  }

  onDragOver(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    this.isDragOver = true;
  }

  onDragLeave(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    this.isDragOver = false;
  }

  onDrop(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    this.isDragOver = false;

    const files = Array.from(event.dataTransfer?.files || []) as File[];
    this.addFiles(files);
  }

  onFileSelect(event: any) {
    const files = Array.from(event.target.files || []) as File[];
    this.addFiles(files);
    // Reset l'input pour permettre de sélectionner le même fichier à nouveau
    event.target.value = '';
  }

  private addFiles(newFiles: File[]) {
    // Éviter les doublons basés sur le nom et la taille
    const uniqueFiles = newFiles.filter(newFile =>
      !this.selectedFiles.some(existing =>
        existing.name === newFile.name && existing.size === newFile.size
      )
    );

    this.selectedFiles = [...this.selectedFiles, ...uniqueFiles];
    this.validateFiles();
  }

  removeFile(index: number) {
    this.selectedFiles.splice(index, 1);
    this.validateFiles();
  }

  clearFiles() {
    this.selectedFiles = [];
    this.validateFiles();
  }

  private validateFiles() {
    this.validationResult = this.uploadService.validateFiles(this.selectedFiles);
    this.filesSelected.emit(this.selectedFiles);
    this.validationChanged.emit(this.validationResult);
  }

  hasFileError(file: File): boolean {
    if (!this.validationResult) return false;

    const extension = file.name.split('.').pop()?.toLowerCase();
    return !extension ||
           !this.acceptedFormats.includes(extension) ||
           file.size > this.maxFileSize ||
           file.size === 0;
  }

  getFileIcon(file: File): string {
    const extension = file.name.split('.').pop()?.toLowerCase();

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

  getFileExtension(filename: string): string {
    return filename.split('.').pop()?.toUpperCase() || 'UNKNOWN';
  }

    formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 B';

    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
  }

  getErrorSummary(): string {
    if (!this.validationResult || this.validationResult.isValid) return '';

    const errorCount = this.validationResult.errors.length;
    const sizeErrors = this.validationResult.errors.filter(err => err.includes('limite PoC')).length;

    if (sizeErrors > 0) {
      return sizeErrors === 1
        ? '1 fichier dépasse la limite de taille'
        : `${sizeErrors} fichiers dépassent la limite de taille`;
    }

    return errorCount === 1
      ? '1 erreur détectée'
      : `${errorCount} erreurs détectées`;
  }

  hasSizeErrors(): boolean {
    if (!this.validationResult) return false;
    return this.validationResult.errors.some(error => error.includes('limite PoC'));
  }
}
