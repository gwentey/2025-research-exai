import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { environment } from '../../environments/environment';
import { 
  ExperimentRead, 
  ExperimentCreate, 
  ExperimentStatus, 
  ExperimentResults, 
  AlgorithmInfo,
  DataQualityAnalysisRequest,
  DataQualityAnalysis,
  PreprocessingStrategyRequest,
  PreprocessingStrategy
} from '../models/ml-pipeline.models';

@Injectable({
  providedIn: 'root'
})
export class MlPipelineService {
  private apiUrl = environment.apiUrl + '/api/v1/ml-pipeline';

  constructor(private http: HttpClient) {}

  /**
   * Create a new ML experiment
   */
  createExperiment(experimentData: ExperimentCreate): Observable<ExperimentRead> {
    return this.http.post<ExperimentRead>(`${this.apiUrl}/experiments`, experimentData)
      .pipe(
        catchError(this.handleError)
      );
  }

  /**
   * Get the status of an experiment
   */
  getExperimentStatus(experimentId: string): Observable<ExperimentStatus> {
    return this.http.get<ExperimentStatus>(`${this.apiUrl}/experiments/${experimentId}`)
      .pipe(
        catchError(this.handleError)
      );
  }

  /**
   * Get the results of a completed experiment
   */
  getExperimentResults(experimentId: string): Observable<ExperimentResults> {
    return this.http.get<ExperimentResults>(`${this.apiUrl}/experiments/${experimentId}/results`)
      .pipe(
        catchError(this.handleError)
      );
  }

  /**
   * Get list of available algorithms
   */
  getAvailableAlgorithms(): Observable<AlgorithmInfo[]> {
    return this.http.get<AlgorithmInfo[]>(`${this.apiUrl}/algorithms`)
      .pipe(
        catchError(this.handleError)
      );
  }

  /**
   * Get user's experiments
   */
  getUserExperiments(projectId?: string, skip: number = 0, limit: number = 100): Observable<ExperimentRead[]> {
    let params = new HttpParams()
      .set('skip', skip.toString())
      .set('limit', limit.toString());
    
    if (projectId) {
      params = params.set('project_id', projectId);
    }
    
    return this.http.get<ExperimentRead[]>(`${this.apiUrl}/experiments`, { params })
      .pipe(
        catchError(this.handleError)
      );
  }

  /**
   * Analyser la qualité des données d'un dataset
   */
  analyzeDataQuality(request: DataQualityAnalysisRequest): Observable<DataQualityAnalysis> {
    return this.http.post<DataQualityAnalysis>(`${this.apiUrl}/data-quality/analyze`, request)
      .pipe(
        catchError(this.handleError)
      );
  }

  /**
   * Obtenir des suggestions de stratégie de preprocessing
   */
  suggestPreprocessingStrategy(request: PreprocessingStrategyRequest): Observable<PreprocessingStrategy> {
    return this.http.post<PreprocessingStrategy>(`${this.apiUrl}/data-quality/suggest-strategy`, request)
      .pipe(
        catchError(this.handleError)
      );
  }

  /**
   * Analyser rapidement un dataset pour obtenir des recommandations de base
   */
  getDatasetRecommendations(datasetId: string, targetColumn?: string): Observable<any> {
    const request: DataQualityAnalysisRequest = {
      dataset_id: datasetId,
      target_column: targetColumn,
      sample_size: 1000 // Échantillon plus petit pour une analyse rapide
    };
    
    return this.analyzeDataQuality(request).pipe(
      map(analysis => ({
        missingDataSummary: {
          totalColumns: analysis.missing_data_analysis.total_columns,
          columnsWithMissing: Object.keys(analysis.missing_data_analysis.columns_with_missing).length,
          severityLevel: analysis.missing_data_analysis.severity_assessment.level,
          actionRequired: analysis.missing_data_analysis.severity_assessment.action_required
        },
        recommendations: analysis.preprocessing_recommendations,
        qualityScore: analysis.data_quality_score,
        priorityActions: analysis.preprocessing_recommendations.priority_actions
      }))
    );
  }

  /**
   * Handle HTTP errors
   */
  private handleError(error: any): Observable<never> {
    console.error('ML Pipeline Service Error:', error);
    let errorMessage = 'An error occurred';
    
    if (error.error instanceof ErrorEvent) {
      // Client-side error
      errorMessage = error.error.message;
    } else if (error.error && error.error.detail) {
      // Server-side error with detail
      errorMessage = error.error.detail;
    } else if (error.status) {
      // Server-side error with status
      errorMessage = `Error ${error.status}: ${error.statusText}`;
    }
    
    return throwError(() => new Error(errorMessage));
  }
} 