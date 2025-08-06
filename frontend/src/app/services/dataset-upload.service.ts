import { Injectable } from '@angular/core';
import { HttpClient, HttpEventType } from '@angular/common/http';
import { Observable, BehaviorSubject, throwError } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { environment } from '../../environments/environment';

export interface FileAnalysis {
  filename: string;
  size_bytes: number;
  size_mb: number;
  format: string;
  row_count: number;
  column_count: number;
  columns_analysis: ColumnAnalysis[];
  preview_data: any[];
  quality_metrics: QualityMetrics;
  analysis_status: 'success' | 'error';
  error_message?: string;
}

export interface ColumnAnalysis {
  column_name: string;
  position: number;
  data_type_interpreted: string;
  is_nullable: boolean;
  unique_values: number;
  missing_count: number;
  example_values: string[];
}

export interface QualityMetrics {
  missing_percentage: number;
  has_duplicates: boolean;
  is_empty: boolean;
}

export interface DatasetSuggestions {
  suggested_domains: string[];
  suggested_tasks: string[];
  suggested_dataset_name: string;
  total_instances: number;
  total_features: number;
  recommended_split: boolean;
  quality_score: number;
}

export interface PreviewResponse {
  files_analysis: FileAnalysis[];
  suggestions: DatasetSuggestions;
  summary: {
    total_files: number;
    total_size_mb: number;
    total_rows: number;
    analysis_timestamp: string;
  };
}

export interface UploadProgress {
  progress: number;
  stage: 'uploading' | 'converting' | 'analyzing' | 'saving' | 'completed' | 'preview_completed' | 'error';
  message: string;
  result?: any;
  error?: string;
}

export interface DatasetMetadata {
  dataset_name: string;
  display_name: string;
  year?: number;
  objective?: string;
  access?: string;
  availability?: string;
  num_citations?: number;
  citation_link?: string;
  sources?: string;
  storage_uri?: string;
  instances_number?: number;
  features_description?: string;
  features_number?: number;
  domain?: string[];
  representativity_description?: string;
  representativity_level?: string;
  sample_balance_description?: string;
  sample_balance_level?: string;
  split?: boolean;
  missing_values_description?: string;
  has_missing_values?: boolean;
  global_missing_percentage?: number;
  missing_values_handling_method?: string;
  temporal_factors?: boolean;
  metadata_provided_with_dataset?: boolean;
  external_documentation_available?: boolean;
  documentation_link?: string;
  task?: string[];
  // Critères éthiques
  informed_consent?: boolean;
  transparency?: boolean;
  user_control?: boolean;
  equity_non_discrimination?: boolean;
  security_measures_in_place?: boolean;
  data_quality_documented?: boolean;
  data_errors_description?: string;
  anonymization_applied?: boolean;
  record_keeping_policy_exists?: boolean;
  purpose_limitation_respected?: boolean;
  accountability_defined?: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class DatasetUploadService {
  private apiUrl = environment.apiUrl;
  private uploadProgressSubject = new BehaviorSubject<UploadProgress | null>(null);
  
  // Cache pour les brouillons
  private readonly DRAFT_STORAGE_KEY = 'ibis-x-dataset-draft';

  constructor(private http: HttpClient) {}

  /**
   * Observable pour suivre la progression de l'upload
   */
  get uploadProgress$(): Observable<UploadProgress | null> {
    return this.uploadProgressSubject.asObservable();
  }

  /**
   * Prévisualise les fichiers sans les sauvegarder
   */
  previewFiles(files: File[]): Observable<PreviewResponse> {
    const formData = new FormData();
    
    files.forEach(file => {
      formData.append('files', file);
    });

    this.updateProgress({
      progress: 10,
      stage: 'analyzing',
      message: 'Analyse des fichiers en cours...'
    });

    return this.http.post<PreviewResponse>(`${this.apiUrl}/datasets/preview`, formData).pipe(
      map(response => {
        this.updateProgress({
          progress: 100,
          stage: 'preview_completed',
          message: 'Analyse terminée avec succès',
          result: response
        });
        return response;
      }),
      catchError(error => {
        this.updateProgress({
          progress: 0,
          stage: 'error',
          message: 'Erreur lors de l\'analyse',
          error: error.error?.detail || error.message
        });
        return throwError(error);
      })
    );
  }

  /**
   * Upload complet d'un dataset avec métadonnées
   */
  uploadDataset(metadata: DatasetMetadata, files: File[]): Observable<any> {
    const formData = new FormData();
    
    // Ajouter les métadonnées
    Object.keys(metadata).forEach(key => {
      const value = (metadata as any)[key];
      if (value !== null && value !== undefined) {
        if (Array.isArray(value)) {
          formData.append(key, JSON.stringify(value));
        } else {
          formData.append(key, value.toString());
        }
      }
    });
    
    // Ajouter les fichiers
    files.forEach(file => {
      formData.append('files', file);
    });

    this.updateProgress({
      progress: 0,
      stage: 'uploading',
      message: 'Upload des fichiers en cours...'
    });

    return this.http.post(`${this.apiUrl}/datasets`, formData, {
      reportProgress: true,
      observe: 'events'
    }).pipe(
      map(event => {
        switch (event.type) {
          case HttpEventType.UploadProgress:
            const progress = Math.round(100 * event.loaded / (event.total || 1));
            this.updateProgress({
              progress: progress,
              stage: 'uploading',
              message: `Upload en cours: ${progress}%`
            });
            break;
          case HttpEventType.Response:
            this.updateProgress({
              progress: 100,
              stage: 'completed',
              message: 'Dataset créé avec succès !',
              result: event.body
            });
            // Nettoyer le brouillon après succès
            this.clearDraft();
            return event.body;
        }
        return null;
      }),
      catchError(error => {
        this.updateProgress({
          progress: 0,
          stage: 'error',
          message: 'Erreur lors de l\'upload',
          error: error.error?.detail || error.message
        });
        return throwError(error);
      })
    );
  }

  /**
   * Valide les fichiers avant upload
   */
  validateFiles(files: File[]): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    
    // Formats supportés
    const supportedFormats = ['csv', 'xlsx', 'xls', 'json', 'xml', 'parquet'];
    
    // Taille maximale par fichier (100MB)
    const maxFileSize = 100 * 1024 * 1024;
    
    // Nombre maximum de fichiers
    const maxFiles = 10;
    
    if (files.length === 0) {
      errors.push('Aucun fichier sélectionné');
    }
    
    if (files.length > maxFiles) {
      errors.push(`Trop de fichiers sélectionnés (maximum: ${maxFiles})`);
    }
    
    files.forEach((file, index) => {
      const extension = file.name.split('.').pop()?.toLowerCase();
      
      if (!extension || !supportedFormats.includes(extension)) {
        errors.push(`Fichier ${index + 1}: Format non supporté (.${extension})`);
      }
      
      if (file.size > maxFileSize) {
        errors.push(`Fichier ${index + 1}: Taille trop importante (max: 100MB)`);
      }
      
      if (file.size === 0) {
        errors.push(`Fichier ${index + 1}: Fichier vide`);
      }
      
      // Avertissements
      if (file.size > 10 * 1024 * 1024) { // > 10MB
        warnings.push(`Fichier ${index + 1}: Fichier volumineux, la conversion peut prendre du temps`);
      }
    });
    
    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Sauvegarde un brouillon des métadonnées
   */
  saveDraft(metadata: Partial<DatasetMetadata>): void {
    try {
      const draft = {
        ...metadata,
        savedAt: new Date().toISOString()
      };
      localStorage.setItem(this.DRAFT_STORAGE_KEY, JSON.stringify(draft));
    } catch (error) {
      console.warn('Impossible de sauvegarder le brouillon:', error);
    }
  }

  /**
   * Charge le brouillon des métadonnées
   */
  loadDraft(): Partial<DatasetMetadata> | null {
    try {
      const draftStr = localStorage.getItem(this.DRAFT_STORAGE_KEY);
      if (draftStr) {
        const draft = JSON.parse(draftStr);
        // Vérifier que le brouillon n'est pas trop ancien (24h)
        const savedAt = new Date(draft.savedAt);
        const now = new Date();
        const hoursDiff = (now.getTime() - savedAt.getTime()) / (1000 * 60 * 60);
        
        if (hoursDiff < 24) {
          delete draft.savedAt;
          return draft;
        } else {
          this.clearDraft();
        }
      }
    } catch (error) {
      console.warn('Impossible de charger le brouillon:', error);
    }
    return null;
  }

  /**
   * Supprime le brouillon
   */
  clearDraft(): void {
    localStorage.removeItem(this.DRAFT_STORAGE_KEY);
  }

  /**
   * Vérifie s'il y a un brouillon disponible
   */
  hasDraft(): boolean {
    return this.loadDraft() !== null;
  }

  /**
   * Met à jour le statut de progression
   */
  private updateProgress(progress: UploadProgress): void {
    this.uploadProgressSubject.next(progress);
  }

  /**
   * Réinitialise la progression
   */
  resetProgress(): void {
    this.uploadProgressSubject.next(null);
  }

  /**
   * Parse les erreurs du backend pour extraire des messages utilisateur clairs
   */
  parseBackendError(error: any): { message: string; isRetryable: boolean } {
    // Tenter d'extraire les détails d'erreur structurés
    let errorDetail = error.error;
    
    if (typeof errorDetail === 'string') {
      try {
        errorDetail = JSON.parse(errorDetail);
      } catch {
        // Fallback si ce n'est pas du JSON
        return {
          message: errorDetail || 'Une erreur inattendue s\'est produite.',
          isRetryable: true
        };
      }
    }
    
    // Messages d'erreur spécifiques par type
    if (errorDetail && errorDetail.error_code) {
      switch (errorDetail.error_code) {
        case 'FILE_VALIDATION_ERROR':
          return {
            message: errorDetail.message || 'Un ou plusieurs fichiers ne respectent pas les critères requis.',
            isRetryable: false
          };
          
        case 'STORAGE_ERROR':
          return {
            message: 'Erreur lors de la sauvegarde. Veuillez réessayer dans quelques instants.',
            isRetryable: true
          };
          
        case 'CONVERSION_ERROR':
          return {
            message: errorDetail.message || 'Erreur lors de la conversion de vos fichiers. Vérifiez leur format.',
            isRetryable: false
          };
          
        case 'METADATA_VALIDATION_ERROR':
          return {
            message: errorDetail.message || 'Certaines informations obligatoires sont manquantes.',
            isRetryable: false
          };
          
        case 'PERMISSION_DENIED':
          return {
            message: 'Vous n\'avez pas les permissions nécessaires pour cette action.',
            isRetryable: false
          };
          
        case 'UNSUPPORTED_FORMAT':
          if (errorDetail.details?.supported_formats) {
            return {
              message: `Format non supporté. Formats acceptés: ${errorDetail.details.supported_formats.join(', ')}`,
              isRetryable: false
            };
          }
          break;
          
        case 'FILE_TOO_LARGE':
          if (errorDetail.details?.max_size_mb) {
            return {
              message: `Fichier trop volumineux. Taille maximale: ${errorDetail.details.max_size_mb}MB`,
              isRetryable: false
            };
          }
          break;
          
        case 'EMPTY_FILE':
          return {
            message: 'Un ou plusieurs fichiers sont vides. Veuillez sélectionner des fichiers valides.',
            isRetryable: false
          };
      }
    }
    
    // Messages par code de statut HTTP
    if (error.status) {
      switch (error.status) {
        case 400:
          return {
            message: 'Données invalides. Vérifiez vos fichiers et métadonnées.',
            isRetryable: false
          };
          
        case 401:
          return {
            message: 'Session expirée. Veuillez vous reconnecter.',
            isRetryable: false
          };
          
        case 403:
          return {
            message: 'Accès refusé. Vous devez être administrateur ou contributeur.',
            isRetryable: false
          };
          
        case 413:
          return {
            message: 'Fichiers trop volumineux. Réduisez la taille ou le nombre de fichiers.',
            isRetryable: false
          };
          
        case 429:
          return {
            message: 'Trop de requêtes. Veuillez patienter avant de réessayer.',
            isRetryable: true
          };
          
        case 500:
          return {
            message: 'Erreur serveur temporaire. Veuillez réessayer dans quelques instants.',
            isRetryable: true
          };
          
        case 502:
        case 503:
        case 504:
          return {
            message: 'Service temporairement indisponible. Veuillez réessayer plus tard.',
            isRetryable: true
          };
      }
    }
    
    // Message par défaut
    return {
      message: errorDetail?.message || error.message || 'Une erreur inattendue s\'est produite.',
      isRetryable: true
    };
  }
}

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}