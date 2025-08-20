import { Injectable } from '@angular/core';

export type VisualizationStrategy = 'backend-image' | 'chartjs' | 'fallback' | 'loading' | 'error';

export interface VisualizationConfig {
  type: 'backend-image' | 'chartjs';
  source: string;
  fallback?: string;
  metadata?: {
    algorithm: string;
    task_type: 'classification' | 'regression';
    generated_by: 'backend' | 'frontend';
  };
}

@Injectable({
  providedIn: 'root'
})
export class VisualizationManagerService {

  // Configuration des graphiques problématiques qui doivent utiliser les images backend
  private readonly PROBLEMATIC_CHARTS = new Set([
    'feature_importance',
    'confusion_matrix',
    'roc_curve',
    'regression_plot',
    'predictions_distribution',
    'performance_timeline'
  ]);

  // Configuration par algorithme
  private readonly ALGORITHM_CHARTS: { [key: string]: { [key: string]: string } } = {
    'random_forest': {
      'feature_importance': 'backend-image', // Bar chart horizontal problématique
      'decision_tree': 'chartjs', // Simple structure
      'metrics': 'chartjs' // Doughnut charts OK
    },
    'decision_tree': {
      'decision_tree': 'backend-image', // Structure complexe
      'feature_importance': 'backend-image',
      'metrics': 'chartjs'
    },
    'logistic_regression': {
      'probability_curve': 'backend-image',
      'confusion_matrix': 'backend-image',
      'roc_curve': 'backend-image',
      'metrics': 'chartjs'
    },
    'default': {
      'metrics': 'chartjs',
      'default': 'backend-image'
    }
  };

  // Cache des URLs d'images pour éviter les requêtes répétées
  private imageUrlCache = new Map<string, string>();

  constructor() {
    console.log('🎯 VisualizationManager: Service initialized');
  }

    /**
   * Détermine la stratégie de visualisation optimale - NOUVELLE APPROCHE ROBUSTE
   */
  getVisualizationStrategy(
    vizType: string,
    algorithm: string,
    hasBackendImage: boolean = false
  ): VisualizationStrategy {

    console.log(`🤔 VisualizationManager: Determining strategy for ${vizType} (${algorithm}) - Backend available: ${hasBackendImage}`);

    // NOUVELLE STRATÉGIE : Privilégier Chart.js sécurisé par défaut
    // Utiliser les images backend seulement si elles sont vraiment disponibles et accessibles

    // 1. Pour les métriques simples, toujours Chart.js (sûr)
    if (vizType === 'metrics') {
      console.log(`✅ VisualizationManager: Using chartjs for safe metrics`);
      return 'chartjs';
    }

    // 2. Si on a une image backend accessible ET vérifiée, l'utiliser
    if (hasBackendImage) {
      console.log(`🖼️ VisualizationManager: Using verified backend-image for ${vizType}`);
      return 'backend-image';
    }

    // 3. Sinon, utiliser Chart.js sécurisé avec configs simplifiées
    console.log(`📊 VisualizationManager: Using secure Chart.js fallback for ${vizType}`);
    return 'chartjs';
  }

  /**
   * Détermine si on doit utiliser l'image backend pour un type de viz
   */
  shouldUseBackendImage(vizType: string): boolean {
    // Toujours utiliser l'image backend pour les graphiques complexes/problématiques
    return this.PROBLEMATIC_CHARTS.has(vizType);
  }

  /**
   * Détermine si on peut fallback vers Chart.js de manière sûre
   */
  private shouldFallbackToChartjs(vizType: string): boolean {
    // Seulement pour les métriques simples (doughnut charts)
    return vizType === 'metrics' || vizType === 'simple_bar';
  }

  /**
   * Cache une URL d'image backend
   */
  cacheImageUrl(vizType: string, algorithm: string, url: string): void {
    const cacheKey = `${algorithm}_${vizType}`;
    this.imageUrlCache.set(cacheKey, url);
    console.log(`💾 VisualizationManager: Cached image URL for ${cacheKey}`);
  }

  /**
   * Récupère une URL d'image depuis le cache
   */
  getCachedImageUrl(vizType: string, algorithm: string): string | null {
    const cacheKey = `${algorithm}_${vizType}`;
    return this.imageUrlCache.get(cacheKey) || null;
  }

  /**
   * Construit l'URL de l'image backend depuis les chemins MinIO stockés
   */
  buildBackendImageUrl(experimentId: string, vizType: string, storagePath?: string): string {
    // Utiliser le nouvel endpoint backend pour servir les images
    return `/api/ml-pipeline/experiments/${experimentId}/visualizations/${vizType}`;
  }

  /**
   * Vérifie si une image backend existe
   */
  async checkBackendImageExists(url: string): Promise<boolean> {
    try {
      const response = await fetch(url, { method: 'HEAD' });
      return response.ok;
    } catch (error) {
      console.warn(`⚠️ VisualizationManager: Backend image check failed for ${url}:`, error);
      return false;
    }
  }

  /**
   * Obtient la configuration optimale pour un type de visualisation
   */
  getVisualizationConfig(
    vizType: string,
    algorithm: string,
    experimentId: string,
    hasBackendImage: boolean = false
  ): VisualizationConfig {

    const strategy = this.getVisualizationStrategy(vizType, algorithm, hasBackendImage);

    const config: VisualizationConfig = {
      type: strategy === 'backend-image' ? 'backend-image' : 'chartjs',
      source: strategy === 'backend-image'
        ? this.buildBackendImageUrl(experimentId, vizType)
        : `${vizType}Chart`,
      metadata: {
        algorithm,
        task_type: this.getTaskType(algorithm),
        generated_by: strategy === 'backend-image' ? 'backend' : 'frontend'
      }
    };

    // Ajouter fallback si nécessaire
    if (strategy === 'backend-image') {
      config.fallback = `${vizType}Chart`; // Canvas ID pour fallback Chart.js
    }

    return config;
  }

  /**
   * Détermine le type de tâche ML selon l'algorithme
   */
  private getTaskType(algorithm: string): 'classification' | 'regression' {
    const classificationAlgorithms = ['logistic_regression', 'svm_classification', 'naive_bayes'];
    return classificationAlgorithms.includes(algorithm) ? 'classification' : 'regression';
  }

  /**
   * Obtient les graphiques recommandés pour un algorithme
   */
  getRecommendedCharts(algorithm: string): string[] {
    switch (algorithm) {
      case 'random_forest':
        return ['metrics', 'feature_importance', 'regression_plot'];
      case 'decision_tree':
        return ['metrics', 'decision_tree', 'feature_importance'];
      case 'logistic_regression':
        return ['metrics', 'probability_curve', 'confusion_matrix', 'roc_curve'];
      default:
        return ['metrics'];
    }
  }

  /**
   * Nettoie le cache des images
   */
  clearImageCache(): void {
    console.log('🧹 VisualizationManager: Clearing image cache');
    this.imageUrlCache.clear();
  }

  /**
   * Obtient les statistiques du service
   */
  getStats(): { cachedImages: number; supportedAlgorithms: number; problematicCharts: number } {
    return {
      cachedImages: this.imageUrlCache.size,
      supportedAlgorithms: Object.keys(this.ALGORITHM_CHARTS).length - 1, // -1 pour 'default'
      problematicCharts: this.PROBLEMATIC_CHARTS.size
    };
  }
}
