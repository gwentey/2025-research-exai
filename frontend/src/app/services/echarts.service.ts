import { Injectable, NgZone } from '@angular/core';
import * as echarts from 'echarts';

interface EChartsConfig {
  containerId: string;
  option: any;
  theme?: string;
  timeout?: number;
}

interface ChartRegistry {
  chart: echarts.ECharts;
  containerId: string;
  createdAt: number;
}

@Injectable({
  providedIn: 'root'
})
export class EChartsService {
  private activeCharts = new Map<string, ChartRegistry>();
  private maxCharts = 15; // Plus que Chart.js car ECharts est plus efficace
  private defaultTimeout = 8000;

  constructor(private ngZone: NgZone) {
    console.log('🎯 EChartsService: Service initialized');
  }

  /**
   * Crée un graphique ECharts de manière sécurisée
   */
  async createChart(config: EChartsConfig): Promise<echarts.ECharts | null> {
    const { containerId, option, theme = 'default', timeout = this.defaultTimeout } = config;

    console.log(`🎨 ECharts: Creating chart for ${containerId}`);

    // Cleanup du chart existant
    this.destroyChart(containerId);

    // Vérifier la limite de charts actifs
    if (this.activeCharts.size >= this.maxCharts) {
      console.warn('🚨 ECharts: Too many active charts, cleaning oldest');
      this.cleanupOldestChart();
    }

    return new Promise((resolve, reject) => {
      // Timeout de sécurité
      const timeoutId = setTimeout(() => {
        console.error(`⏰ ECharts: Timeout creating chart ${containerId}`);
        this.destroyChart(containerId);
        reject(new Error(`ECharts creation timeout for ${containerId}`));
      }, timeout);

      this.ngZone.runOutsideAngular(() => {
        try {
          setTimeout(() => {
            try {
              const container = document.getElementById(containerId);

              if (!container) {
                console.error(`❌ ECharts: Container ${containerId} not found`);
                clearTimeout(timeoutId);
                reject(new Error(`Container ${containerId} not found`));
                return;
              }

              // Créer le chart ECharts
              const chart = echarts.init(container, theme, {
                renderer: 'canvas', // Plus stable que SVG
                useDirtyRect: false // Désactiver l'optimisation qui peut causer des bugs
              });

              // Appliquer l'option
              chart.setOption(option, true);

              // Enregistrer dans le registry
              this.activeCharts.set(containerId, {
                chart,
                containerId,
                createdAt: Date.now()
              });

              console.log(`✅ ECharts: Chart ${containerId} created successfully`);
              clearTimeout(timeoutId);
              resolve(chart);

            } catch (error) {
              console.error(`💥 ECharts: Error creating chart ${containerId}:`, error);
              clearTimeout(timeoutId);
              this.destroyChart(containerId);
              reject(error);
            }
          }, 100);

        } catch (error) {
          console.error(`💥 ECharts: Outer error for ${containerId}:`, error);
          clearTimeout(timeoutId);
          reject(error);
        }
      });
    });
  }

  /**
   * Détruit un graphique spécifique
   */
  destroyChart(containerId: string): boolean {
    const registry = this.activeCharts.get(containerId);

    if (!registry) {
      return false;
    }

    try {
      console.log(`🧹 ECharts: Destroying chart ${containerId}`);

      // Détruire le chart ECharts
      if (registry.chart) {
        registry.chart.dispose();
      }

      // Supprimer du registry
      this.activeCharts.delete(containerId);

      console.log(`✅ ECharts: Chart ${containerId} destroyed successfully`);
      return true;

    } catch (error) {
      console.error(`💥 ECharts: Error destroying chart ${containerId}:`, error);
      this.activeCharts.delete(containerId);
      return false;
    }
  }

  /**
   * Détruit tous les graphiques actifs
   */
  destroyAllCharts(): void {
    console.log(`🧹 ECharts: Destroying all charts (${this.activeCharts.size} active)`);

    const chartIds = Array.from(this.activeCharts.keys());

    for (const containerId of chartIds) {
      this.destroyChart(containerId);
    }

    console.log('✅ ECharts: All charts destroyed');
  }

  /**
   * Vérifie si un chart est actif
   */
  isChartActive(containerId: string): boolean {
    return this.activeCharts.has(containerId);
  }

  /**
   * Redimensionne un chart (utile pour responsive)
   */
  resizeChart(containerId: string): void {
    const registry = this.activeCharts.get(containerId);
    if (registry && registry.chart) {
      registry.chart.resize();
    }
  }

  /**
   * Redimensionne tous les charts actifs
   */
  resizeAllCharts(): void {
    for (const registry of this.activeCharts.values()) {
      if (registry.chart) {
        registry.chart.resize();
      }
    }
  }

  /**
   * Nettoie le chart le plus ancien
   */
  private cleanupOldestChart(): void {
    let oldestContainerId = '';
    let oldestTime = Date.now();

    for (const [containerId, registry] of this.activeCharts.entries()) {
      if (registry.createdAt < oldestTime) {
        oldestTime = registry.createdAt;
        oldestContainerId = containerId;
      }
    }

    if (oldestContainerId) {
      console.log(`🗑️ ECharts: Cleaning up oldest chart: ${oldestContainerId}`);
      this.destroyChart(oldestContainerId);
    }
  }

  /**
   * Configurations prédéfinies pour différents types de charts
   */
  getMetricsChartOption(metrics: any): any {
    const keys = Object.keys(metrics);
    const values = Object.values(metrics) as number[];

    if (keys.length === 1) {
      // Single metric - gauge chart
      return {
        series: [{
          type: 'gauge',
          min: 0,
          max: 1,
          progress: {
            show: true,
            width: 18
          },
          axisLine: {
            lineStyle: {
              width: 18,
              color: [[1, '#e2e8f0']]
            }
          },
          data: [{
            value: values[0],
            name: keys[0].toUpperCase(),
            title: {
              offsetCenter: [0, '70%']
            },
            detail: {
              offsetCenter: [0, '50%'],
              formatter: '{value}%',
              fontSize: 16
            }
          }]
        }]
      };
    } else {
      // Multiple metrics - radar chart
      return {
        radar: {
          indicator: keys.map(key => ({
            name: this.formatMetricLabel(key),
            max: 1
          }))
        },
        series: [{
          type: 'radar',
          data: [{
            value: values,
            name: 'Métriques',
            areaStyle: {
              opacity: 0.3,
              color: '#667eea'
            },
            lineStyle: {
              color: '#667eea',
              width: 2
            },
            symbol: 'circle',
            symbolSize: 6
          }]
        }]
      };
    }
  }

  getFeatureImportanceOption(featureData: any): any {
    const features = Object.keys(featureData);
    const importance = Object.values(featureData) as number[];

    return {
      grid: {
        left: '10%',
        right: '10%',
        bottom: '10%',
        top: '15%'
      },
      xAxis: {
        type: 'value',
        name: 'Importance',
        nameLocation: 'middle',
        nameGap: 30
      },
      yAxis: {
        type: 'category',
        data: features,
        inverse: true
      },
      series: [{
        type: 'bar',
        data: importance,
        itemStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 1, 0, [
            { offset: 0, color: '#667eea' },
            { offset: 1, color: '#764ba2' }
          ]),
          borderRadius: [0, 4, 4, 0]
        },
        label: {
          show: true,
          position: 'right',
          formatter: '{c}',
          fontSize: 12
        }
      }],
      title: {
        text: 'Importance des Features',
        left: 'center',
        textStyle: {
          color: '#0f172a',
          fontSize: 16,
          fontWeight: 600
        }
      },
      tooltip: {
        trigger: 'axis',
        axisPointer: {
          type: 'shadow'
        }
      }
    };
  }

  getDecisionTreeOption(treeData: any): any {
    return {
      series: [{
        type: 'tree',
        data: [treeData],
        layout: 'orthogonal',
        orient: 'vertical',
        symbol: 'rect',
        symbolSize: [80, 40],
        roam: true, // Enable zoom/pan
        expandAndCollapse: true,
        initialTreeDepth: 3,
        lineStyle: {
          color: '#667eea',
          width: 2,
          curveness: 0.5
        },
        itemStyle: {
          color: '#667eea',
          borderColor: '#334155',
          borderWidth: 1
        },
        label: {
          fontSize: 10,
          fontWeight: 'bold',
          color: '#ffffff'
        },
        leaves: {
          label: {
            position: 'bottom',
            fontSize: 9,
            color: '#10b981'
          },
          itemStyle: {
            color: '#10b981'
          }
        }
      }],
      title: {
        text: 'Arbre de Décision Interactif',
        left: 'center',
        textStyle: {
          color: '#0f172a',
          fontSize: 16,
          fontWeight: 600
        }
      },
      tooltip: {
        trigger: 'item',
        formatter: function (params: any) {
          return `<strong>${params.name}</strong><br/>
                  Condition: ${params.data.condition || 'N/A'}<br/>
                  Échantillons: ${params.data.samples || 'N/A'}`;
        }
      }
    };
  }

  getRandomForestTreeOption(treeData: any): any {
    return {
      series: [{
        type: 'tree',
        data: [treeData],
        layout: 'radial',
        symbol: 'circle',
        symbolSize: 12,
        roam: true,
        expandAndCollapse: true,
        initialTreeDepth: 2,
        lineStyle: {
          color: '#10b981',
          width: 1.5
        },
        itemStyle: {
          color: '#10b981',
          borderWidth: 0
        },
        label: {
          fontSize: 8,
          fontWeight: 'normal'
        }
      }],
      title: {
        text: 'Structure Random Forest (Premier Arbre)',
        left: 'center',
        textStyle: {
          color: '#0f172a',
          fontSize: 16,
          fontWeight: 600
        }
      },
      tooltip: {
        trigger: 'item',
        formatter: function (params: any) {
          return `<strong>Nœud ${params.name}</strong><br/>
                  Feature: ${params.data.feature || 'N/A'}<br/>
                  Seuil: ${params.data.threshold || 'N/A'}`;
        }
      }
    };
  }

  getRegressionPlotOption(actualVsPredicted: any): any {
    return {
      xAxis: {
        type: 'value',
        name: 'Valeurs Réelles',
        nameLocation: 'middle',
        nameGap: 30
      },
      yAxis: {
        type: 'value',
        name: 'Valeurs Prédites',
        nameLocation: 'middle',
        nameGap: 40
      },
      series: [
        {
          type: 'scatter',
          data: actualVsPredicted,
          symbolSize: 6,
          itemStyle: {
            color: '#667eea',
            opacity: 0.8
          }
        },
        {
          type: 'line',
          data: [[0, 0], [100, 100]], // Ligne de référence parfaite
          lineStyle: {
            color: '#ef4444',
            type: 'dashed',
            width: 2
          },
          symbol: 'none',
          name: 'Prédiction parfaite'
        }
      ],
      title: {
        text: 'Valeurs Réelles vs Prédites',
        left: 'center'
      },
      tooltip: {
        trigger: 'item',
        formatter: 'Réel: {c}[0]<br/>Prédit: {c}[1]'
      },
      grid: {
        left: '15%',
        right: '10%',
        bottom: '15%',
        top: '15%'
      }
    };
  }

  getROCCurveOption(rocData: any): any {
    return {
      xAxis: {
        type: 'value',
        name: 'Taux de Faux Positifs',
        min: 0,
        max: 1
      },
      yAxis: {
        type: 'value',
        name: 'Taux de Vrais Positifs',
        min: 0,
        max: 1
      },
      series: [
        {
          type: 'line',
          data: rocData.points || [],
          smooth: true,
          lineStyle: {
            color: '#667eea',
            width: 3
          },
          areaStyle: {
            color: 'rgba(102, 126, 234, 0.2)'
          },
          name: `ROC (AUC = ${rocData.auc?.toFixed(3) || '0.000'})`
        },
        {
          type: 'line',
          data: [[0, 0], [1, 1]],
          lineStyle: {
            color: '#94a3b8',
            type: 'dashed',
            width: 2
          },
          symbol: 'none',
          name: 'Référence aléatoire'
        }
      ],
      title: {
        text: 'Courbe ROC',
        left: 'center'
      },
      legend: {
        bottom: 10
      },
      tooltip: {
        trigger: 'axis'
      },
      grid: {
        left: '15%',
        right: '10%',
        bottom: '20%',
        top: '15%'
      }
    };
  }

  getConfusionMatrixOption(confusionMatrix: number[][]): any {
    // Transformer la matrice en format heatmap
    const data = [];
    for (let i = 0; i < confusionMatrix.length; i++) {
      for (let j = 0; j < confusionMatrix[i].length; j++) {
        data.push([i, j, confusionMatrix[i][j]]);
      }
    }

    return {
      xAxis: {
        type: 'category',
        data: ['Prédite: Classe 0', 'Prédite: Classe 1'],
        splitArea: {
          show: true
        }
      },
      yAxis: {
        type: 'category',
        data: ['Vraie: Classe 1', 'Vraie: Classe 0'],
        splitArea: {
          show: true
        }
      },
      visualMap: {
        min: 0,
        max: Math.max(...confusionMatrix.flat()),
        calculable: true,
        orient: 'horizontal',
        left: 'center',
        bottom: '10%',
        inRange: {
          color: ['#f1f5f9', '#667eea']
        }
      },
      series: [{
        type: 'heatmap',
        data: data,
        label: {
          show: true,
          fontSize: 14,
          fontWeight: 'bold'
        },
        emphasis: {
          itemStyle: {
            shadowBlur: 10,
            shadowColor: 'rgba(0, 0, 0, 0.5)'
          }
        }
      }],
      title: {
        text: 'Matrice de Confusion',
        left: 'center'
      },
      tooltip: {
        position: 'top',
        formatter: function (params: any) {
          return `Valeur: <strong>${params.value[2]}</strong>`;
        }
      }
    };
  }

  getPredictionsDistributionOption(distributionData: any): any {
    return {
      xAxis: {
        type: 'category',
        data: distributionData.labels || ['0.0-0.2', '0.2-0.4', '0.4-0.6', '0.6-0.8', '0.8-1.0']
      },
      yAxis: {
        type: 'value',
        name: 'Fréquence'
      },
      series: [{
        type: 'bar',
        data: distributionData.values || [25, 45, 120, 180, 130],
        itemStyle: {
          color: new echarts.graphic.LinearGradient(0, 1, 0, 0, [
            { offset: 0, color: '#667eea' },
            { offset: 1, color: '#764ba2' }
          ]),
          borderRadius: [4, 4, 0, 0]
        },
        label: {
          show: true,
          position: 'top',
          fontSize: 12
        }
      }],
      title: {
        text: 'Distribution des Prédictions',
        left: 'center'
      },
      tooltip: {
        trigger: 'axis'
      },
      grid: {
        left: '10%',
        right: '10%',
        bottom: '15%',
        top: '15%'
      }
    };
  }

  /**
   * Formate les labels de métriques
   */
  private formatMetricLabel(key: string): string {
    const labels: { [key: string]: string } = {
      'r2': 'R²',
      'mae': 'MAE',
      'mse': 'MSE',
      'rmse': 'RMSE',
      'accuracy': 'Précision',
      'precision': 'Précision',
      'recall': 'Rappel',
      'f1_score': 'F1'
    };
    return labels[key] || key;
  }

  /**
   * Obtient les statistiques du service
   */
  getStats(): { activeCharts: number; memoryUsage: string } {
    return {
      activeCharts: this.activeCharts.size,
      memoryUsage: `~${this.activeCharts.size * 30}KB` // ECharts plus efficace que Chart.js
    };
  }
}

