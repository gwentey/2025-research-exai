import { Injectable, NgZone } from '@angular/core';
import { Chart, ChartConfiguration, registerables } from 'chart.js';

interface SafeChartConfig {
  canvasId: string;
  chartConfig: ChartConfiguration;
  timeout?: number;
  retryCount?: number;
  fallbackImage?: string;
}

interface ChartRegistry {
  chart: Chart;
  canvasId: string;
  createdAt: number;
}

@Injectable({
  providedIn: 'root'
})
export class SafeChartService {
  private activeCharts = new Map<string, ChartRegistry>();
  private maxCharts = 10; // Limite pour éviter les memory leaks
  private defaultTimeout = 5000;

  constructor(private ngZone: NgZone) {
    // Enregistrer Chart.js modules une seule fois
    Chart.register(...registerables);
  }

  /**
   * Crée un graphique Chart.js de manière sécurisée avec timeout et error handling
   */
  async createSafeChart(config: SafeChartConfig): Promise<Chart | null> {
    const { canvasId, chartConfig, timeout = this.defaultTimeout } = config;

    console.log(`🎨 SafeChart: Creating chart for ${canvasId}`);

    // Cleanup du chart existant
    this.destroyChart(canvasId);

    // Vérifier la limite de charts actifs
    if (this.activeCharts.size >= this.maxCharts) {
      console.warn('🚨 SafeChart: Too many active charts, cleaning oldest');
      this.cleanupOldestChart();
    }

    return new Promise((resolve, reject) => {
      // Timeout de sécurité
      const timeoutId = setTimeout(() => {
        console.error(`⏰ SafeChart: Timeout creating chart ${canvasId}`);
        this.destroyChart(canvasId);
        reject(new Error(`Chart creation timeout for ${canvasId}`));
      }, timeout);

      // Utiliser requestIdleCallback pour éviter de bloquer le thread principal
      this.ngZone.runOutsideAngular(() => {
        try {
          // Délai pour éviter les conflicts de DOM
          setTimeout(() => {
            try {
              const canvas = document.getElementById(canvasId) as HTMLCanvasElement;

              if (!canvas) {
                console.error(`❌ SafeChart: Canvas ${canvasId} not found`);
                clearTimeout(timeoutId);
                reject(new Error(`Canvas ${canvasId} not found`));
                return;
              }

              // Vérifier que le canvas n'est pas déjà utilisé
              const ctx = canvas.getContext('2d');
              if (ctx && (ctx.canvas as any).chartInstance) {
                console.warn(`⚠️ SafeChart: Canvas ${canvasId} already has chart, destroying first`);
                this.destroyChart(canvasId);
              }

              // Créer le chart avec protection
              const chart = new Chart(canvas, chartConfig);

              // Enregistrer dans le registry
              this.activeCharts.set(canvasId, {
                chart,
                canvasId,
                createdAt: Date.now()
              });

              console.log(`✅ SafeChart: Chart ${canvasId} created successfully`);
              clearTimeout(timeoutId);
              resolve(chart);

            } catch (error) {
              console.error(`💥 SafeChart: Error creating chart ${canvasId}:`, error);
              clearTimeout(timeoutId);
              this.destroyChart(canvasId);
              reject(error);
            }
          }, 100); // Petit délai pour la stabilité du DOM

        } catch (error) {
          console.error(`💥 SafeChart: Outer error for ${canvasId}:`, error);
          clearTimeout(timeoutId);
          reject(error);
        }
      });
    });
  }

  /**
   * Détruit un graphique spécifique et nettoie les ressources
   */
  destroyChart(canvasId: string): boolean {
    const registry = this.activeCharts.get(canvasId);

    if (!registry) {
      return false;
    }

    try {
      console.log(`🧹 SafeChart: Destroying chart ${canvasId}`);

      // Détruire le chart Chart.js
      if (registry.chart) {
        registry.chart.destroy();
      }

      // Nettoyer le canvas
      const canvas = document.getElementById(canvasId) as HTMLCanvasElement;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.clearRect(0, 0, canvas.width, canvas.height);
        }
        // Supprimer la référence au chart
        (canvas as any).chartInstance = null;
      }

      // Supprimer du registry
      this.activeCharts.delete(canvasId);

      console.log(`✅ SafeChart: Chart ${canvasId} destroyed successfully`);
      return true;

    } catch (error) {
      console.error(`💥 SafeChart: Error destroying chart ${canvasId}:`, error);
      // Forcer la suppression du registry même en cas d'erreur
      this.activeCharts.delete(canvasId);
      return false;
    }
  }

  /**
   * Détruit tous les graphiques actifs
   */
  destroyAllCharts(): void {
    console.log(`🧹 SafeChart: Destroying all charts (${this.activeCharts.size} active)`);

    const chartIds = Array.from(this.activeCharts.keys());

    for (const canvasId of chartIds) {
      this.destroyChart(canvasId);
    }

    console.log('✅ SafeChart: All charts destroyed');
  }

  /**
   * Vérifie si un chart est actif
   */
  isChartActive(canvasId: string): boolean {
    return this.activeCharts.has(canvasId);
  }

  /**
   * Obtient les statistiques de memory usage
   */
  getChartStats(): { activeCount: number; oldestAge: number; totalMemory: string } {
    const now = Date.now();
    let oldestAge = 0;

    for (const registry of this.activeCharts.values()) {
      const age = now - registry.createdAt;
      if (age > oldestAge) {
        oldestAge = age;
      }
    }

    return {
      activeCount: this.activeCharts.size,
      oldestAge: Math.round(oldestAge / 1000), // en secondes
      totalMemory: `${this.activeCharts.size * 50}KB` // Estimation approximative
    };
  }

  /**
   * Nettoie le chart le plus ancien si on dépasse la limite
   */
  private cleanupOldestChart(): void {
    let oldestCanvasId = '';
    let oldestTime = Date.now();

    for (const [canvasId, registry] of this.activeCharts.entries()) {
      if (registry.createdAt < oldestTime) {
        oldestTime = registry.createdAt;
        oldestCanvasId = canvasId;
      }
    }

    if (oldestCanvasId) {
      console.log(`🗑️ SafeChart: Cleaning up oldest chart: ${oldestCanvasId}`);
      this.destroyChart(oldestCanvasId);
    }
  }

  /**
   * Crée un retry avec backoff exponentiel
   */
  async retryCreateChart(config: SafeChartConfig, maxRetries = 3): Promise<Chart | null> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`🔄 SafeChart: Retry attempt ${attempt}/${maxRetries} for ${config.canvasId}`);

        // Backoff exponentiel
        if (attempt > 1) {
          await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt - 1) * 1000));
        }

        const chart = await this.createSafeChart(config);

        if (chart) {
          console.log(`✅ SafeChart: Retry successful for ${config.canvasId}`);
          return chart;
        }

      } catch (error) {
        lastError = error as Error;
        console.warn(`⚠️ SafeChart: Retry ${attempt} failed for ${config.canvasId}:`, error);
      }
    }

    console.error(`❌ SafeChart: All retries failed for ${config.canvasId}:`, lastError);
    return null;
  }
}
