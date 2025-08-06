import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { Observable, throwError, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { environment } from '../../environments/environment';
import { UserRead } from '../models/auth.models';
import { Dataset } from '../models/dataset.models';

export interface EthicalTemplate {
  domain: string;
  ethical: {
    informed_consent: boolean;
    transparency: boolean;
    user_control: boolean;
    equity_non_discrimination: boolean;
    security_measures_in_place: boolean;
    data_quality_documented: boolean;
    anonymization_applied: boolean;
    record_keeping_policy_exists: boolean;
    purpose_limitation_respected: boolean;
    accountability_defined: boolean;
  };
  technical: {
    representativity_level: string;
    sample_balance_level: string;
  };
  quality: {
    data_errors_description: string;
  };
}

export interface TemplateValidationResult {
  valid: boolean;
  templates_count: number;
  errors: string[];
  warnings: string[];
}

export interface AdminDashboardStats {
  total_datasets: number;
  total_users: number;
  recent_uploads: number;
  storage_used: string;
}

export interface DatasetCountResponse {
  total_datasets: number;
  unique_dataset_names: number;
  status: string;
}

export interface UsersListResponse {
  users: UserRead[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

export interface TemporaryPromotionResponse {
  message: string;
  user: {
    id: string;
    email: string;
    role: string;
    is_superuser: boolean;
    previous_role?: string;
  };
  action: 'promoted' | 'no_change' | 'self_promoted';
  granted_by?: string;
}

@Injectable({
  providedIn: 'root',
})
export class AdminService {
  private http = inject(HttpClient);
  
  // URL de base pour l'API admin (via l'API Gateway)
  private readonly baseUrl = `${environment.apiUrl}/admin`;

  constructor() {}

  /**
   * Récupère tous les templates éthiques
   */
  getEthicalTemplates(): Observable<EthicalTemplate[]> {
    return this.http.get<{ templates: EthicalTemplate[] }>(`${this.baseUrl}/ethical-templates`).pipe(
      map(response => response.templates),
      catchError(this.handleError)
    );
  }

  /**
   * Sauvegarde les templates éthiques
   */
  saveEthicalTemplates(templates: EthicalTemplate[]): Observable<any> {
    return this.http.put(`${this.baseUrl}/ethical-templates`, { templates }).pipe(
      catchError(this.handleError)
    );
  }

  /**
   * Restaure les templates par défaut
   */
  resetEthicalTemplates(): Observable<any> {
    return this.http.post(`${this.baseUrl}/ethical-templates/reset`, {}).pipe(
      catchError(this.handleError)
    );
  }

  /**
   * Valide les templates éthiques
   */
  validateEthicalTemplates(): Observable<TemplateValidationResult> {
    return this.http.get<TemplateValidationResult>(`${this.baseUrl}/ethical-templates/validate`).pipe(
      catchError(this.handleError)
    );
  }

  /**
   * Récupère les statistiques d'utilisation des templates
   */
  getTemplateUsageStats(): Observable<any> {
    return this.http.get(`${this.baseUrl}/ethical-templates/stats`).pipe(
      catchError(this.handleError)
    );
  }

  /**
   * Exporte les templates au format YAML
   */
  exportTemplatesAsYaml(): Observable<Blob> {
    return this.http.get(`${this.baseUrl}/ethical-templates/export`, {
      responseType: 'blob'
    }).pipe(
      catchError(this.handleError)
    );
  }

  /**
   * Importe des templates depuis un fichier YAML
   */
  importTemplatesFromYaml(file: File): Observable<any> {
    const formData = new FormData();
    formData.append('yaml_file', file);

    return this.http.post(`${this.baseUrl}/ethical-templates/import`, formData).pipe(
      catchError(this.handleError)
    );
  }

  /**
   * Récupère l'historique des modifications des templates
   */
  getTemplatesHistory(): Observable<any[]> {
    return this.http.get<any[]>(`${this.baseUrl}/ethical-templates/history`).pipe(
      catchError(this.handleError)
    );
  }

  /**
   * Teste l'application d'un template sur un dataset fictif
   */
  testTemplateOnSample(domain: string, template: EthicalTemplate): Observable<any> {
    return this.http.post(`${this.baseUrl}/ethical-templates/test`, {
      domain,
      template
    }).pipe(
      catchError(this.handleError)
    );
  }

  /**
   * Récupère les domaines les plus utilisés
   */
  getPopularDomains(): Observable<any[]> {
    return this.http.get<any[]>(`${this.baseUrl}/ethical-templates/popular-domains`).pipe(
      catchError(this.handleError)
    );
  }

  // === MÉTHODES POUR LES VRAIES DONNÉES ADMIN ===

  /**
   * Récupère le nombre total de datasets depuis service-selection
   */
  getTotalDatasets(): Observable<number> {
    return this.http.get<DatasetCountResponse>(`${environment.apiUrl}/debug/datasets-count`).pipe(
      map(response => response.total_datasets),
      catchError(this.handleError)
    );
  }

  /**
   * Récupère tous les utilisateurs depuis l'API Gateway (admin seulement)
   */
  getAllUsers(page: number = 1, pageSize: number = 100): Observable<UsersListResponse> {
    const params = new HttpParams()
      .set('page', page.toString())
      .set('page_size', pageSize.toString());
    
    return this.http.get<UsersListResponse>(`${environment.apiUrl}/admin/users`, { params }).pipe(
      catchError((error) => {
        console.error('Erreur lors du chargement des utilisateurs:', error);
        return of({
          users: [],
          total: 0,
          page: page,
          page_size: pageSize,
          total_pages: 0
        } as UsersListResponse);
      })
    );
  }

  /**
   * Récupère le nombre total d'utilisateurs
   */
  getTotalUsers(): Observable<number> {
    return this.http.get<{total: number}>(`${environment.apiUrl}/admin/users/count`).pipe(
      map(response => response.total),
      catchError((error) => {
        console.error('Erreur lors du chargement du nombre d\'utilisateurs:', error);
        return of(0);
      })
    );
  }

  /**
   * Récupère tous les datasets depuis service-selection
   */
  getAllDatasets(page: number = 1, pageSize: number = 100): Observable<Dataset[]> {
    const params = new HttpParams()
      .set('page', page.toString())
      .set('page_size', pageSize.toString());
    
    return this.http.get<{datasets: Dataset[], total_count: number}>(`${environment.apiUrl}/datasets`, { params }).pipe(
      map(response => response.datasets || []),
      catchError((error) => {
        console.error('Erreur lors du chargement des datasets:', error);
        // Retourner un tableau vide en cas d'erreur pour éviter les crashes
        return of([]);
      })
    );
  }

  /**
   * Calcule les uploads récents (datasets créés dans les 30 derniers jours)
   */
  getRecentUploads(): Observable<number> {
    return this.getAllDatasets().pipe(
      map(datasets => {
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        
        return datasets.filter(dataset => {
          if (dataset.created_at) {
            const createdDate = new Date(dataset.created_at);
            return createdDate >= thirtyDaysAgo;
          }
          return false;
        }).length;
      }),
      catchError(this.handleError)
    );
  }

  /**
   * Calcule l'utilisation approximative du stockage
   */
  getStorageUsed(): Observable<string> {
    return this.getAllDatasets().pipe(
      map(datasets => {
        // Estimation basée sur le nombre d'instances et de features
        let totalSizeBytes = 0;
        
        datasets.forEach(dataset => {
          const instances = dataset.instances_number || 0;
          const features = dataset.features_number || 0;
          // Estimation : instances * features * 8 bytes (float64) en moyenne
          const estimatedSize = instances * features * 8;
          totalSizeBytes += estimatedSize;
        });
        
        // Conversion en unités lisibles
        if (totalSizeBytes < 1024 * 1024) {
          return `${Math.round(totalSizeBytes / 1024)} KB`;
        } else if (totalSizeBytes < 1024 * 1024 * 1024) {
          return `${(totalSizeBytes / (1024 * 1024)).toFixed(1)} MB`;
        } else {
          return `${(totalSizeBytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
        }
      }),
      catchError(this.handleError)
    );
  }

  /**
   * Récupère toutes les statistiques du dashboard en une fois
   */
  getDashboardStats(): Observable<AdminDashboardStats> {
    return this.http.get<any>(`${environment.apiUrl}/debug/datasets-count`).pipe(
      map(datasetResponse => ({
        total_datasets: datasetResponse.total_datasets,
        total_users: 0, // Sera mis à jour par les autres appels
        recent_uploads: 0, // Sera mis à jour par les autres appels  
        storage_used: 'Calcul...' // Sera mis à jour par les autres appels
      })),
      catchError(this.handleError)
    );
  }

  // === MÉTHODES TEMPORAIRES POUR PROMOTION ADMIN ===

  /**
   * TEMPORAIRE - Promeut l'utilisateur actuel au rôle admin
   */
  selfPromoteToAdmin(): Observable<TemporaryPromotionResponse> {
    return this.http.get<TemporaryPromotionResponse>(`${environment.apiUrl}/admin/temporary-grant/current-user`).pipe(
      catchError(this.handleError)
    );
  }

  /**
   * TEMPORAIRE - Promeut un utilisateur au rôle admin par email
   */
  promoteUserToAdmin(userEmail: string): Observable<TemporaryPromotionResponse> {
    const params = new HttpParams().set('user_email', userEmail);
    
    return this.http.post<TemporaryPromotionResponse>(`${environment.apiUrl}/admin/temporary-grant`, null, { params }).pipe(
      catchError(this.handleError)
    );
  }

  /**
   * Gestion centralisée des erreurs
   */
  private handleError = (error: HttpErrorResponse): Observable<never> => {
    let errorMessage = 'Une erreur inattendue s\'est produite';
    
    if (error.error instanceof ErrorEvent) {
      // Erreur côté client
      errorMessage = `Erreur client: ${error.error.message}`;
    } else {
      // Erreur côté serveur
      switch (error.status) {
        case 400:
          errorMessage = 'Requête invalide - Vérifiez les données envoyées';
          break;
        case 401:
          errorMessage = 'Non autorisé - Veuillez vous reconnecter';
          break;
        case 403:
          errorMessage = 'Accès interdit - Droits administrateur requis';
          break;
        case 404:
          errorMessage = 'Ressource non trouvée';
          break;
        case 422:
          errorMessage = 'Données de validation incorrectes';
          if (error.error?.detail) {
            errorMessage += `: ${error.error.detail}`;
          }
          break;
        case 500:
          errorMessage = 'Erreur serveur interne - Contactez l\'administrateur';
          break;
        default:
          errorMessage = `Erreur ${error.status}: ${error.message}`;
      }
    }
    
    console.error('Erreur du service Admin:', error);
    return throwError(() => new Error(errorMessage));
  }
}