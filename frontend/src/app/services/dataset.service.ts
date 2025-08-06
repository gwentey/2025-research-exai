import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { environment } from '../../environments/environment';
import { 
  Dataset, 
  DatasetComplete, 
  DatasetScored, 
  DatasetListResponse, 
  DatasetFilterCriteria, 
  DatasetScoreRequest, 
  CriterionWeight,
  PaginationParams,
  DatasetStats,
  DatasetDetailView,
  DatasetPreview,
  DatasetQualityMetrics,
  DataDistributionAnalysis,
  ColumnStatistics,
  MissingDataAnalysisResponse
} from '../models/dataset.models';

@Injectable({
  providedIn: 'root',
})
export class DatasetService {
  private http = inject(HttpClient);
  
  // URL de base pour l'API des datasets (via l'API Gateway)
  private readonly baseUrl = `${environment.apiUrl}/datasets`;

  constructor() {}

  /**
   * Récupère la liste des datasets avec pagination et filtres
   * @param params - Paramètres de pagination et de tri
   * @param filters - Critères de filtrage
   * @returns Observable avec la liste paginée des datasets
   */
  getDatasets(params: PaginationParams = {}, filters: DatasetFilterCriteria = {}): Observable<DatasetListResponse> {
    let httpParams = new HttpParams();
    
    // Paramètres de pagination
    if (params.page !== undefined) {
      httpParams = httpParams.set('page', params.page.toString());
    }
    if (params.page_size !== undefined) {
      httpParams = httpParams.set('page_size', params.page_size.toString());
    }
    if (params.sort_by) {
      httpParams = httpParams.set('sort_by', params.sort_by);
    }
    if (params.sort_order) {
      httpParams = httpParams.set('sort_order', params.sort_order);
    }
    
    // Filtres de recherche
    if (filters.dataset_name) {
      httpParams = httpParams.set('dataset_name', filters.dataset_name);
    }
    if (filters.objective) {
      httpParams = httpParams.set('objective', filters.objective);
    }
    if (filters.domain && filters.domain.length > 0) {
      httpParams = httpParams.set('domain', filters.domain.join(','));
    }
    if (filters.task && filters.task.length > 0) {
      httpParams = httpParams.set('task', filters.task.join(','));
    }
    if (filters.instances_number_min !== undefined) {
      httpParams = httpParams.set('instances_number_min', filters.instances_number_min.toString());
    }
    if (filters.instances_number_max !== undefined) {
      httpParams = httpParams.set('instances_number_max', filters.instances_number_max.toString());
    }
    if (filters.features_number_min !== undefined) {
      httpParams = httpParams.set('features_number_min', filters.features_number_min.toString());
    }
    if (filters.features_number_max !== undefined) {
      httpParams = httpParams.set('features_number_max', filters.features_number_max.toString());
    }
    if (filters.year_min !== undefined) {
      httpParams = httpParams.set('year_min', filters.year_min.toString());
    }
    if (filters.year_max !== undefined) {
      httpParams = httpParams.set('year_max', filters.year_max.toString());
    }
    if (filters.ethical_score_min !== undefined) {
      httpParams = httpParams.set('ethical_score_min', filters.ethical_score_min.toString());
    }
    if (filters.representativity_level) {
      httpParams = httpParams.set('representativity_level', filters.representativity_level);
    }
    if (filters.has_missing_values !== undefined) {
      httpParams = httpParams.set('has_missing_values', filters.has_missing_values.toString());
    }
    if (filters.split !== undefined) {
      httpParams = httpParams.set('split', filters.split.toString());
    }
    if (filters.is_split !== undefined) {
      httpParams = httpParams.set('is_split', filters.is_split.toString());
    }
    if (filters.anonymization_applied !== undefined) {
      httpParams = httpParams.set('anonymization_applied', filters.anonymization_applied.toString());
    }
    if (filters.is_anonymized !== undefined) {
      httpParams = httpParams.set('is_anonymized', filters.is_anonymized.toString());
    }
    if (filters.has_temporal_factors !== undefined) {
      httpParams = httpParams.set('has_temporal_factors', filters.has_temporal_factors.toString());
    }
    if (filters.is_public !== undefined) {
      httpParams = httpParams.set('is_public', filters.is_public.toString());
    }
    if (filters.informed_consent !== undefined) {
      httpParams = httpParams.set('informed_consent', filters.informed_consent.toString());
    }
    if (filters.transparency !== undefined) {
      httpParams = httpParams.set('transparency', filters.transparency.toString());
    }
    if (filters.user_control !== undefined) {
      httpParams = httpParams.set('user_control', filters.user_control.toString());
    }
    if (filters.equity_non_discrimination !== undefined) {
      httpParams = httpParams.set('equity_non_discrimination', filters.equity_non_discrimination.toString());
    }
    if (filters.security_measures_in_place !== undefined) {
      httpParams = httpParams.set('security_measures_in_place', filters.security_measures_in_place.toString());
    }
    if (filters.data_quality_documented !== undefined) {
      httpParams = httpParams.set('data_quality_documented', filters.data_quality_documented.toString());
    }
    if (filters.record_keeping_policy_exists !== undefined) {
      httpParams = httpParams.set('record_keeping_policy_exists', filters.record_keeping_policy_exists.toString());
    }
    if (filters.purpose_limitation_respected !== undefined) {
      httpParams = httpParams.set('purpose_limitation_respected', filters.purpose_limitation_respected.toString());
    }
    if (filters.accountability_defined !== undefined) {
      httpParams = httpParams.set('accountability_defined', filters.accountability_defined.toString());
    }
    
    return this.http.get<DatasetListResponse>(this.baseUrl, { params: httpParams }).pipe(
      catchError(this.handleError)
    );
  }

  /**
   * Récupère un dataset spécifique par son ID
   * @param id - ID du dataset
   * @returns Observable avec le dataset complet
   */
  getDataset(id: string): Observable<DatasetComplete> {
    return this.http.get<DatasetComplete>(`${this.baseUrl}/${id}`).pipe(
      catchError(this.handleError)
    );
  }

  /**
   * Récupère les datasets avec scoring selon des critères (endpoint backend amélioré)
   * @param scoreRequest - Critères de filtrage et poids pour le scoring
   * @returns Observable avec la liste des datasets scorés triés par pertinence
   */
  getDatasetsByScore(scoreRequest: DatasetScoreRequest): Observable<DatasetScored[]> {
    return this.http.post<DatasetScored[]>(`${this.baseUrl}/score`, scoreRequest).pipe(
      catchError(this.handleError)
    );
  }

  /**
   * Récupère les datasets avec scoring automatique basé sur des critères prédéfinis
   * @param filters - Critères de filtrage (optionnel)
   * @param scoringProfile - Profil de scoring prédéfini ('ethical', 'technical', 'popularity', 'balanced')
   * @returns Observable avec la liste des datasets scorés
   */
  getDatasetsByAutoScore(filters?: DatasetFilterCriteria, scoringProfile: string = 'balanced'): Observable<DatasetScored[]> {
    // Profils de scoring prédéfinis
    const scoringProfiles: { [key: string]: CriterionWeight[] } = {
      'ethical': [
        { criterion_name: 'ethical_score', weight: 0.7 },
        { criterion_name: 'anonymization', weight: 0.2 },
        { criterion_name: 'informed_consent', weight: 0.1 }
      ],
      'technical': [
        { criterion_name: 'technical_score', weight: 0.6 },
        { criterion_name: 'data_quality', weight: 0.3 },
        { criterion_name: 'documentation', weight: 0.1 }
      ],
      'popularity': [
        { criterion_name: 'popularity_score', weight: 0.8 },
        { criterion_name: 'citations', weight: 0.2 }
      ],
      'balanced': [
        { criterion_name: 'ethical_score', weight: 0.4 },
        { criterion_name: 'technical_score', weight: 0.4 },
        { criterion_name: 'popularity_score', weight: 0.2 }
      ]
    };

    const weights = scoringProfiles[scoringProfile] || scoringProfiles['balanced'];
    
    const scoreRequest: DatasetScoreRequest = {
      filters: filters || {},
      weights: weights
    };

    return this.getDatasetsByScore(scoreRequest);
  }

  /**
   * Récupère les statistiques générales des datasets
   * @returns Observable avec les statistiques
   */
  getDatasetStats(): Observable<DatasetStats> {
    return this.http.get<DatasetStats>(`${this.baseUrl}/stats`).pipe(
      catchError(this.handleError)
    );
  }

  /**
   * Récupère les domaines d'application disponibles
   * @returns Observable avec la liste des domaines
   */
  getAvailableDomains(): Observable<string[]> {
    return this.http.get<{ domains: string[] }>(`${this.baseUrl}/domains`).pipe(
      map(response => response.domains),
      catchError(this.handleError)
    );
  }

  /**
   * Récupère les types de tâches ML disponibles
   * @returns Observable avec la liste des types de tâches
   */
  getAvailableTasks(): Observable<string[]> {
    return this.http.get<{ tasks: string[] }>(`${this.baseUrl}/tasks`).pipe(
      map(response => response.tasks),
      catchError(this.handleError)
    );
  }

  /**
   * Recherche de datasets par terme textuel
   * @param searchTerm - Terme de recherche
   * @param params - Paramètres de pagination
   * @returns Observable avec la liste des datasets trouvés
   */
  searchDatasets(searchTerm: string, params: PaginationParams = {}): Observable<DatasetListResponse> {
    const filters: DatasetFilterCriteria = {
      dataset_name: searchTerm,
      objective: searchTerm
    };
    
    return this.getDatasets(params, filters);
  }

  /**
   * Récupère les datasets recommandés (les plus populaires ou récents)
   * @param limit - Nombre maximum de datasets à retourner
   * @returns Observable avec la liste des datasets recommandés
   */
  getRecommendedDatasets(limit: number = 10): Observable<Dataset[]> {
    const params: PaginationParams = {
      page: 1,
      page_size: limit,
      sort_by: 'num_citations',
      sort_order: 'desc'
    };
    
    return this.getDatasets(params).pipe(
      map(response => response.datasets)
    );
  }

  /**
   * Récupère les datasets récemment ajoutés
   * @param limit - Nombre maximum de datasets à retourner
   * @returns Observable avec la liste des datasets récents
   */
  getRecentDatasets(limit: number = 10): Observable<Dataset[]> {
    const params: PaginationParams = {
      page: 1,
      page_size: limit,
      sort_by: 'created_at',
      sort_order: 'desc'
    };
    
    return this.getDatasets(params).pipe(
      map(response => response.datasets)
    );
  }

  /**
   * Récupère les détails complets d'un dataset (vue Kaggle-like)
   * @param id - ID du dataset
   * @returns Observable avec tous les détails du dataset
   */
  getDatasetDetails(id: string): Observable<DatasetDetailView> {
    return this.http.get<DatasetDetailView>(`${this.baseUrl}/${id}/details`).pipe(
      catchError(this.handleError)
    );
  }

  /**
   * Récupère l'aperçu des données d'un dataset
   * @param id - ID du dataset
   * @param fileId - ID du fichier (optionnel, prend le premier fichier par défaut)
   * @param limit - Nombre de lignes à récupérer (par défaut 100)
   * @returns Observable avec l'aperçu des données
   */
  getDatasetPreview(id: string, fileId?: string, limit: number = 100): Observable<DatasetPreview> {
    let params = new HttpParams().set('limit', limit.toString());
    if (fileId) {
      params = params.set('file_id', fileId);
    }

    return this.http.get<DatasetPreview>(`${this.baseUrl}/${id}/preview`, { params }).pipe(
      catchError(this.handleError)
    );
  }

  /**
   * Récupère les métriques de qualité d'un dataset
   * @param id - ID du dataset
   * @returns Observable avec les métriques de qualité
   */
  getDatasetQualityMetrics(id: string): Observable<DatasetQualityMetrics> {
    return this.http.get<DatasetQualityMetrics>(`${this.baseUrl}/${id}/quality`).pipe(
      catchError(this.handleError)
    );
  }

  /**
   * Récupère l'analyse de distribution des données d'un dataset
   * @param id - ID du dataset
   * @returns Observable avec l'analyse de distribution
   */
  getDataDistributionAnalysis(id: string): Observable<DataDistributionAnalysis> {
    return this.http.get<DataDistributionAnalysis>(`${this.baseUrl}/${id}/distribution`).pipe(
      catchError(this.handleError)
    );
  }

  /**
   * Récupère les statistiques détaillées des colonnes d'un fichier
   * @param datasetId - ID du dataset
   * @param fileId - ID du fichier
   * @returns Observable avec les statistiques des colonnes
   */
  getColumnStatistics(datasetId: string, fileId: string): Observable<ColumnStatistics[]> {
    return this.http.get<ColumnStatistics[]>(`${this.baseUrl}/${datasetId}/files/${fileId}/columns/stats`).pipe(
      catchError(this.handleError)
    );
  }

  /**
   * Récupère les datasets similaires à un dataset donné
   * @param id - ID du dataset de référence
   * @param limit - Nombre maximum de datasets similaires à retourner
   * @returns Observable avec la liste des datasets similaires
   */
  getSimilarDatasets(id: string, limit: number = 5): Observable<Dataset[]> {
    let params = new HttpParams().set('limit', limit.toString());

    return this.http.get<{ datasets: Dataset[] }>(`${this.baseUrl}/${id}/similar`, { params }).pipe(
      map(response => response.datasets),
      catchError(this.handleError)
    );
  }

  /**
   * Formate la taille d'un fichier en octets en format lisible
   * @param bytes - Taille en octets
   * @returns Taille formatée avec unité
   */
  formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  /**
   * Formate un nombre d'instances en format lisible
   * @param instances - Nombre d'instances
   * @returns Nombre formaté
   */
  formatInstancesCount(instances: number): string {
    if (instances >= 1000000) {
      return (instances / 1000000).toFixed(1) + 'M';
    } else if (instances >= 1000) {
      return (instances / 1000).toFixed(1) + 'K';
    }
    return instances.toString();
  }

  /**
   * Récupère la couleur associée à un domaine d'application
   * @param domain - Domaine d'application
   * @returns Classe CSS pour la couleur
   */
  getDomainColor(domain: string): string {
    const colors: { [key: string]: string } = {
      'éducation': 'primary',
      'santé': 'accent',
      'finance': 'warn',
      'e-commerce': 'primary',
      'réseaux sociaux': 'accent',
      'gouvernement': 'warn',
      'transport': 'primary',
      'divertissement': 'accent',
      'agriculture': 'warn',
      'énergie': 'primary',
      'manufacturing': 'accent',
      'télécommunications': 'warn',
      'immobilier': 'primary',
      'retail': 'accent',
      'sport': 'warn',
      'météo': 'primary',
      'environnement': 'accent',
      'sécurité': 'warn'
    };
    
    return colors[domain] || 'primary';
  }

  /**
   * Récupère l'icône associée à un type de tâche ML
   * @param task - Type de tâche ML
   * @returns Nom de l'icône Material
   */
  getTaskIcon(task: string): string {
    const icons: { [key: string]: string } = {
      'classification': 'category',
      'regression': 'trending_up',
      'clustering': 'scatter_plot',
      'dimensionality_reduction': 'compress',
      'association_rules': 'link',
      'anomaly_detection': 'warning',
      'reinforcement_learning': 'psychology',
      'time_series': 'show_chart',
      'nlp': 'translate',
      'computer_vision': 'visibility'
    };
    
    return icons[task] || 'dataset';
  }

  /**
   * Gestionnaire d'erreurs HTTP
   * @param error - Erreur HTTP
   * @returns Observable avec l'erreur
   */
  private handleError(error: HttpErrorResponse): Observable<never> {
    let errorMessage = 'Une erreur est survenue';
    
    if (error.error instanceof ErrorEvent) {
      // Erreur côté client
      errorMessage = `Erreur: ${error.error.message}`;
    } else {
      // Erreur côté serveur
      switch (error.status) {
        case 400:
          errorMessage = 'Requête invalide';
          break;
        case 401:
          errorMessage = 'Non autorisé';
          break;
        case 403:
          errorMessage = 'Accès interdit';
          break;
        case 404:
          errorMessage = 'Ressource non trouvée';
          break;
        case 500:
          errorMessage = 'Erreur serveur interne';
          break;
        default:
          errorMessage = `Erreur ${error.status}: ${error.message}`;
      }
    }
    
    console.error('Erreur du service Dataset:', error);
    return throwError(() => new Error(errorMessage));
  }
  
  /**
   * Récupère tous les datasets d'un projet
   * @param projectId - ID du projet
   * @returns Observable avec la liste des datasets du projet
   */
  getProjectDatasets(projectId: string): Observable<any[]> {
    const params = { project_id: projectId };
    return this.http.get<any[]>(`${this.baseUrl}/project/${projectId}`, { params }).pipe(
      catchError(this.handleError)
    );
  }

  // =====================================
  // MÉTADONNÉES - COMPLETION
  // =====================================

  /**
   * Récupère le statut de complétude des métadonnées d'un dataset
   * @param datasetId - ID du dataset
   * @returns Observable avec le statut de complétude
   */
  getCompletionStatus(datasetId: string): Observable<any> {
    return this.http.get(`${this.baseUrl}/metadata/${datasetId}/completion-status`).pipe(
      catchError(this.handleError)
    );
  }

  /**
   * Récupère le formulaire de métadonnées pré-rempli pour un dataset
   * @param datasetId - ID du dataset
   * @returns Observable avec la structure du formulaire
   */
  getMetadataForm(datasetId: string): Observable<any> {
    return this.http.get(`${this.baseUrl}/metadata/${datasetId}/metadata-form`).pipe(
      catchError(this.handleError)
    );
  }

  /**
   * Met à jour les métadonnées d'un dataset
   * @param datasetId - ID du dataset
   * @param updates - Objet contenant les mises à jour
   * @returns Observable avec le résultat de la mise à jour
   */
  completeMetadata(datasetId: string, updates: any): Observable<any> {
    return this.http.put(`${this.baseUrl}/metadata/${datasetId}/complete`, updates).pipe(
      catchError(this.handleError)
    );
  }

  /**
   * Récupère l'analyse des données manquantes pour un dataset
   * @param datasetId - ID du dataset
   * @returns Observable avec l'analyse des données manquantes
   */
  getMissingDataAnalysis(datasetId: string): Observable<MissingDataAnalysisResponse> {
    return this.http.get<MissingDataAnalysisResponse>(`${this.baseUrl}/${datasetId}/missing-data-analysis`).pipe(
      catchError(this.handleError)
    );
  }

} 
