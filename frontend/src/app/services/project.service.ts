import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { environment } from '../../environments/environment';
import { 
  Project, 
  ProjectCreate, 
  ProjectUpdate, 
  ProjectListResponse, 
  ProjectRecommendationResponse,
  CriterionWeight 
} from '../models/project.models';
import { DatasetFilterCriteria, PaginationParams } from '../models/dataset.models';

@Injectable({
  providedIn: 'root',
})
export class ProjectService {
  private http = inject(HttpClient);
  
  // URL de base pour l'API des projets (via l'API Gateway)
  private readonly baseUrl = `${environment.apiUrl}/projects`;

  constructor() {}

  /**
   * Récupère la liste des projets avec pagination
   * @param params - Paramètres de pagination
   * @returns Observable avec la liste paginée des projets
   */
  getProjects(params: PaginationParams = {}): Observable<ProjectListResponse> {
    let httpParams = new HttpParams();
    
    // Paramètres de pagination
    if (params.page !== undefined) {
      httpParams = httpParams.set('page', params.page.toString());
    }
    if (params.page_size !== undefined) {
      httpParams = httpParams.set('page_size', params.page_size.toString());
    }
    
    return this.http.get<ProjectListResponse>(this.baseUrl, { params: httpParams }).pipe(
      catchError(this.handleError)
    );
  }

  /**
   * Récupère un projet spécifique par son ID
   * @param id - ID du projet
   * @returns Observable avec le projet
   */
  getProject(id: string): Observable<Project> {
    return this.http.get<Project>(`${this.baseUrl}/${id}`).pipe(
      catchError(this.handleError)
    );
  }

  /**
   * Crée un nouveau projet
   * @param project - Données du projet à créer
   * @returns Observable avec le projet créé
   */
  createProject(project: ProjectCreate): Observable<Project> {
    return this.http.post<Project>(this.baseUrl, project).pipe(
      catchError(this.handleError)
    );
  }

  /**
   * Met à jour un projet existant
   * @param id - ID du projet
   * @param project - Données de mise à jour
   * @returns Observable avec le projet mis à jour
   */
  updateProject(id: string, project: ProjectUpdate): Observable<Project> {
    return this.http.put<Project>(`${this.baseUrl}/${id}`, project).pipe(
      catchError(this.handleError)
    );
  }

  /**
   * Supprime un projet
   * @param id - ID du projet à supprimer
   * @returns Observable avec la confirmation de suppression
   */
  deleteProject(id: string): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(`${this.baseUrl}/${id}`).pipe(
      catchError(this.handleError)
    );
  }

  /**
   * Récupère les recommandations de datasets pour un projet
   * @param projectId - ID du projet
   * @returns Observable avec les recommandations
   */
  getProjectRecommendations(projectId: string): Observable<ProjectRecommendationResponse> {
    return this.http.get<ProjectRecommendationResponse>(`${this.baseUrl}/${projectId}/recommendations`).pipe(
      catchError(this.handleError)
    );
  }

  /**
   * Aperçu des recommandations sans sauvegarder le projet
   * @param criteria - Critères de filtrage
   * @param weights - Poids des critères
   * @returns Observable avec un aperçu des datasets recommandés
   */
  previewRecommendations(criteria: DatasetFilterCriteria, weights: CriterionWeight[]): Observable<any> {
    const previewData = {
      filters: criteria,
      weights: weights
    };
    
    console.log('📤 Service - Envoi des données preview:', JSON.stringify(previewData, null, 2));
    
    // Utilise l'endpoint de scoring des datasets pour l'aperçu
    return this.http.post<any>(`${environment.apiUrl}/datasets/score`, previewData).pipe(
      catchError(this.handleError)
    );
  }

  /**
   * Formate l'affichage des critères d'un projet
   * @param criteria - Critères de filtrage
   * @returns Chaîne formatée des critères actifs
   */
  formatCriteriaDisplay(criteria: DatasetFilterCriteria): string {
    if (!criteria) {
      return 'Aucun critère défini';
    }

    const activeCriteria: string[] = [];

    // Critères textuels
    if (criteria.dataset_name) {
      activeCriteria.push(`Nom: "${criteria.dataset_name}"`);
    }

    // Domaines
    if (criteria.domain && criteria.domain.length > 0) {
      activeCriteria.push(`Domaines: ${criteria.domain.join(', ')}`);
    }

    // Tâches
    if (criteria.task && criteria.task.length > 0) {
      activeCriteria.push(`Tâches: ${criteria.task.join(', ')}`);
    }

    // Plages numériques
    if (criteria.instances_number_min || criteria.instances_number_max) {
      const min = criteria.instances_number_min || 0;
      const max = criteria.instances_number_max || '∞';
      activeCriteria.push(`Instances: ${min} - ${max}`);
    }

    if (criteria.features_number_min || criteria.features_number_max) {
      const min = criteria.features_number_min || 0;
      const max = criteria.features_number_max || '∞';
      activeCriteria.push(`Features: ${min} - ${max}`);
    }

    if (criteria.year_min || criteria.year_max) {
      const min = criteria.year_min || 1990;
      const max = criteria.year_max || new Date().getFullYear();
      activeCriteria.push(`Année: ${min} - ${max}`);
    }

    // Score éthique
    if (criteria.ethical_score_min) {
      activeCriteria.push(`Score éthique ≥ ${criteria.ethical_score_min}%`);
    }

    // Critères booléens
    if (criteria.is_split) {
      activeCriteria.push('Déjà divisé');
    }
    if (criteria.is_anonymized) {
      activeCriteria.push('Anonymisé');
    }
    if (criteria.has_temporal_factors) {
      activeCriteria.push('Facteurs temporels');
    }
    if (criteria.is_public) {
      activeCriteria.push('Accès public');
    }

    return activeCriteria.length > 0 ? activeCriteria.join(', ') : 'Aucun critère défini';
  }

  /**
   * Compte le nombre de critères actifs dans un objet de filtrage
   * @param criteria - Critères de filtrage
   * @returns Nombre de critères actifs
   */
  calculateCriteriaCount(criteria: DatasetFilterCriteria): number {
    if (!criteria) {
      return 0;
    }

    let count = 0;

    // Critères textuels
    if (criteria.dataset_name) count++;
    if (criteria.objective) count++;

    // Listes
    if (criteria.domain && criteria.domain.length > 0) count++;
    if (criteria.task && criteria.task.length > 0) count++;

    // Plages numériques
    if (criteria.instances_number_min || criteria.instances_number_max) count++;
    if (criteria.features_number_min || criteria.features_number_max) count++;
    if (criteria.year_min || criteria.year_max) count++;

    // Scores
    if (criteria.ethical_score_min) count++;

    // Booléens
    if (criteria.is_split) count++;
    if (criteria.is_anonymized) count++;
    if (criteria.has_temporal_factors) count++;
    if (criteria.is_public) count++;
    if (criteria.has_missing_values !== undefined) count++;

    return count;
  }

  /**
   * Génère des poids par défaut pour les critères
   * @returns Tableau de poids par défaut équilibrés
   */
  getDefaultWeights(): CriterionWeight[] {
    return [
      { criterion_name: 'ethical_score', weight: 0.4 },
      { criterion_name: 'technical_score', weight: 0.4 },
      { criterion_name: 'popularity_score', weight: 0.2 }
    ];
  }

  /**
   * Valide les poids des critères (la somme doit être <= 1.0)
   * @param weights - Poids à valider
   * @returns true si les poids sont valides
   */
  validateWeights(weights: CriterionWeight[]): boolean {
    if (!weights || weights.length === 0) {
      return true; // Les poids par défaut seront utilisés
    }

    const totalWeight = weights.reduce((sum, weight) => sum + weight.weight, 0);
    return totalWeight <= 1.0 && totalWeight > 0;
  }

  /**
   * Normalise les poids pour que leur somme soit égale à 1.0
   * @param weights - Poids à normaliser
   * @returns Poids normalisés
   */
  normalizeWeights(weights: CriterionWeight[]): CriterionWeight[] {
    if (!weights || weights.length === 0) {
      return this.getDefaultWeights();
    }

    const totalWeight = weights.reduce((sum, weight) => sum + weight.weight, 0);
    
    if (totalWeight === 0) {
      return this.getDefaultWeights();
    }

    return weights.map(weight => ({
      ...weight,
      weight: weight.weight / totalWeight
    }));
  }

  /**
   * Récupère la couleur associée à un score de critère pour la heatmap
   * @param score - Score entre 0 et 1
   * @returns Classe CSS pour la couleur
   */
  getScoreColor(score: number): string {
    if (score >= 0.8) return 'score-high';
    if (score >= 0.6) return 'score-medium-high';
    if (score >= 0.4) return 'score-medium';
    if (score >= 0.2) return 'score-medium-low';
    return 'score-low';
  }

  /**
   * Formate un score pour affichage (pourcentage)
   * @param score - Score entre 0 et 1
   * @returns Score formaté en pourcentage
   */
  formatScore(score: number): string {
    return `${Math.round(score * 100)}%`;
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
        case 409:
          errorMessage = 'Conflit - La ressource existe déjà';
          break;
        case 500:
          errorMessage = 'Erreur serveur interne';
          break;
        default:
          errorMessage = `Erreur ${error.status}: ${error.message}`;
      }
    }
    
    console.error('Erreur du service Project:', error);
    return throwError(() => new Error(errorMessage));
  }
} 
