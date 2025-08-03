import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { environment } from '../../environments/environment';

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