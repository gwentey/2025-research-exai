import { Component, ViewEncapsulation, OnInit, OnDestroy, inject } from '@angular/core';
import { MaterialModule } from 'src/app/material.module';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { TablerIconsModule } from 'angular-tabler-icons';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { DatasetService } from '../../services/dataset.service';
import { AuthService } from '../../services/auth.service';
import { Subscription } from 'rxjs';

// Interfaces pour les données du dashboard
export interface DashboardMetric {
  title: string;
  value: string | number;
  icon: string;
  color: string;
  change?: string;
  changeType?: 'positive' | 'negative' | 'neutral';
}

export interface RecentActivity {
  id: number;
  type: 'dataset' | 'pipeline' | 'explanation' | 'user';
  title: string;
  description: string;
  timestamp: string;
  icon: string;
  color: string;
}

export interface QuickAction {
  title: string;
  description: string;
  icon: string;
  route: string;
  color: string;
  disabled?: boolean;
}

export interface SystemStatus {
  name: string;
  value: string;
  status: 'online' | 'offline' | 'warning';
}

@Component({
  selector: 'app-starter',
  templateUrl: './starter.component.html',
  imports: [MaterialModule, CommonModule, RouterModule, TablerIconsModule, TranslateModule],
  styleUrls: ['./starter.component.scss'],
  encapsulation: ViewEncapsulation.None
})
export class StarterComponent implements OnInit, OnDestroy {
  
  private datasetService = inject(DatasetService);
  private authService = inject(AuthService);
  private translate = inject(TranslateService);
  private langChangeSubscription?: Subscription;
  
  // Valeurs de base pour les métriques
  private baseMetrics = {
    datasets: { value: 7, change: '+3' },
    pipelines: { value: 5, change: '2' },
    explanations: { value: 21, change: '+12' },
    users: { value: 1, change: 'today' }
  };

  // Propriétés publiques qui seront mises à jour
  dashboardMetrics: DashboardMetric[] = [];
  recentActivities: RecentActivity[] = [];
  quickActions: QuickAction[] = [];
  datasetStats: any = { total: 0, byDomain: [] };
  systemStatuses: SystemStatus[] = [];
  
  // Labels du dashboard
  dashboardTitle: string = '';
  dashboardSubtitle: string = '';
  refreshLabel: string = '';
  newProjectLabel: string = '';
  activityTitle: string = '';
  activitySubtitle: string = '';
  datasetsTitle: string = '';
  datasetsSubtitle: string = '';
  quickActionsTitle: string = '';
  quickActionsSubtitle: string = '';
  systemStatusTitle: string = '';
  systemStatusSubtitle: string = '';
  lastUpdateLabel: string = '';

  // Données de base pour les statistiques
  private baseDatasetStats = {
    total: 7,
    byDomain: [
      { nameKey: 'DASHBOARD.DATASETS.DOMAINS.EDUCATION', value: 4, color: '#1976d2' },
      { nameKey: 'DASHBOARD.DATASETS.DOMAINS.HEALTH', value: 2, color: '#388e3c' },
      { nameKey: 'DASHBOARD.DATASETS.DOMAINS.FINANCE', value: 1, color: '#f57c00' },
      { nameKey: 'DASHBOARD.DATASETS.DOMAINS.OTHER', value: 0, color: '#7b1fa2' }
    ]
  };

  private updateTranslations(): void {
    // Labels du dashboard
    this.dashboardTitle = this.translate.instant('DASHBOARD.TITLE');
    this.dashboardSubtitle = this.translate.instant('DASHBOARD.SUBTITLE');
    this.refreshLabel = this.translate.instant('DASHBOARD.REFRESH');
    this.newProjectLabel = this.translate.instant('DASHBOARD.NEW_PROJECT');
    this.activityTitle = this.translate.instant('DASHBOARD.ACTIVITY.TITLE');
    this.activitySubtitle = this.translate.instant('DASHBOARD.ACTIVITY.SUBTITLE');
    this.datasetsTitle = this.translate.instant('DASHBOARD.DATASETS.TITLE');
    this.datasetsSubtitle = this.translate.instant('DASHBOARD.DATASETS.SUBTITLE', { total: this.baseDatasetStats.total });
    this.quickActionsTitle = this.translate.instant('DASHBOARD.QUICK_ACTIONS.TITLE');
    this.quickActionsSubtitle = this.translate.instant('DASHBOARD.QUICK_ACTIONS.SUBTITLE');
    this.systemStatusTitle = this.translate.instant('DASHBOARD.SYSTEM_STATUS.TITLE');
    this.systemStatusSubtitle = this.translate.instant('DASHBOARD.SYSTEM_STATUS.SUBTITLE');
    this.lastUpdateLabel = this.translate.instant('DASHBOARD.SYSTEM_STATUS.LAST_UPDATE');

    // Métriques principales du dashboard
    this.dashboardMetrics = [
      {
        title: this.translate.instant('DASHBOARD.METRICS.DATASETS.TITLE'),
        value: this.baseMetrics.datasets.value,
        icon: 'database',
        color: 'primary',
        change: this.translate.instant('DASHBOARD.METRICS.DATASETS.CHANGE', { count: this.baseMetrics.datasets.change }),
        changeType: 'positive'
      },
      {
        title: this.translate.instant('DASHBOARD.METRICS.PIPELINES.TITLE'), 
        value: this.baseMetrics.pipelines.value,
        icon: 'chart-dots',
        color: 'warning',
        change: this.translate.instant('DASHBOARD.METRICS.PIPELINES.CHANGE', { count: this.baseMetrics.pipelines.change }),
        changeType: 'neutral'
      },
      {
        title: this.translate.instant('DASHBOARD.METRICS.EXPLANATIONS.TITLE'),
        value: this.baseMetrics.explanations.value,
        icon: 'bulb',
        color: 'success',
        change: this.translate.instant('DASHBOARD.METRICS.EXPLANATIONS.CHANGE', { count: this.baseMetrics.explanations.change }),
        changeType: 'positive'
      },
      {
        title: this.translate.instant('DASHBOARD.METRICS.USERS.TITLE'),
        value: this.baseMetrics.users.value,
        icon: 'users',
        color: 'accent',
        change: this.translate.instant('DASHBOARD.METRICS.USERS.CHANGE'),
        changeType: 'neutral'
      }
    ];

    // Activités récentes
    this.recentActivities = [
      {
        id: 1,
        type: 'dataset',
        title: this.translate.instant('DASHBOARD.ACTIVITY.ITEMS.DATASET_ADDED.TITLE'),
        description: this.translate.instant('DASHBOARD.ACTIVITY.ITEMS.DATASET_ADDED.DESCRIPTION'),
        timestamp: this.translate.instant('DASHBOARD.ACTIVITY.ITEMS.DATASET_ADDED.TIMESTAMP'),
        icon: 'database',
        color: 'primary'
      },
      {
        id: 2,
        type: 'pipeline',
        title: this.translate.instant('DASHBOARD.ACTIVITY.ITEMS.PIPELINE_COMPLETED.TITLE'),
        description: this.translate.instant('DASHBOARD.ACTIVITY.ITEMS.PIPELINE_COMPLETED.DESCRIPTION'),
        timestamp: this.translate.instant('DASHBOARD.ACTIVITY.ITEMS.PIPELINE_COMPLETED.TIMESTAMP'),
        icon: 'chart-line',
        color: 'success'
      },
      {
        id: 3,
        type: 'explanation',
        title: this.translate.instant('DASHBOARD.ACTIVITY.ITEMS.EXPLANATION_GENERATED.TITLE'),
        description: this.translate.instant('DASHBOARD.ACTIVITY.ITEMS.EXPLANATION_GENERATED.DESCRIPTION'),
        timestamp: this.translate.instant('DASHBOARD.ACTIVITY.ITEMS.EXPLANATION_GENERATED.TIMESTAMP'),
        icon: 'lightbulb',
        color: 'warning'
      },
      {
        id: 4,
        type: 'user',
        title: this.translate.instant('DASHBOARD.ACTIVITY.ITEMS.USER_LOGIN.TITLE'),
        description: this.translate.instant('DASHBOARD.ACTIVITY.ITEMS.USER_LOGIN.DESCRIPTION'),
        timestamp: this.translate.instant('DASHBOARD.ACTIVITY.ITEMS.USER_LOGIN.TIMESTAMP'),
        icon: 'user-check',
        color: 'accent'
      }
    ];

    // Actions rapides
    this.quickActions = [
      {
        title: this.translate.instant('DASHBOARD.QUICK_ACTIONS.ITEMS.EXPLORE_DATASETS.TITLE'),
        description: this.translate.instant('DASHBOARD.QUICK_ACTIONS.ITEMS.EXPLORE_DATASETS.DESCRIPTION'),
        icon: 'search',
        route: '/datasets',
        color: 'primary'
      },
      {
        title: this.translate.instant('DASHBOARD.QUICK_ACTIONS.ITEMS.CREATE_PIPELINE.TITLE'),
        description: this.translate.instant('DASHBOARD.QUICK_ACTIONS.ITEMS.CREATE_PIPELINE.DESCRIPTION'),
        icon: 'plus',
        route: '/ml-pipeline',
        color: 'warning',
        disabled: true
      },
      {
        title: this.translate.instant('DASHBOARD.QUICK_ACTIONS.ITEMS.GENERATE_EXPLANATIONS.TITLE'),
        description: this.translate.instant('DASHBOARD.QUICK_ACTIONS.ITEMS.GENERATE_EXPLANATIONS.DESCRIPTION'),
        icon: 'brain',
        route: '/xai-explanations',
        color: 'success',
        disabled: true
      },
      {
        title: this.translate.instant('DASHBOARD.QUICK_ACTIONS.ITEMS.VIEW_DOCUMENTATION.TITLE'),
        description: this.translate.instant('DASHBOARD.QUICK_ACTIONS.ITEMS.VIEW_DOCUMENTATION.DESCRIPTION'),
        icon: 'book',
        route: '/help',
        color: 'accent'
      }
    ];

    // Données pour les graphiques
    this.datasetStats = {
      total: this.baseDatasetStats.total,
      byDomain: this.baseDatasetStats.byDomain.map(item => ({
        name: this.translate.instant(item.nameKey),
        value: item.value,
        color: item.color
      }))
    };

    // Statuts système
    this.systemStatuses = [
      {
        name: this.translate.instant('DASHBOARD.SYSTEM_STATUS.API_GATEWAY'),
        value: this.translate.instant('DASHBOARD.SYSTEM_STATUS.ONLINE'),
        status: 'online'
      },
      {
        name: this.translate.instant('DASHBOARD.SYSTEM_STATUS.DATASET_SERVICE'),
        value: this.translate.instant('DASHBOARD.SYSTEM_STATUS.ONLINE'),
        status: 'online'
      },
      {
        name: this.translate.instant('DASHBOARD.SYSTEM_STATUS.ML_PIPELINE'),
        value: this.translate.instant('DASHBOARD.SYSTEM_STATUS.DEVELOPMENT'),
        status: 'offline'
      },
      {
        name: this.translate.instant('DASHBOARD.SYSTEM_STATUS.XAI_ENGINE'),
        value: this.translate.instant('DASHBOARD.SYSTEM_STATUS.DEVELOPMENT'),
        status: 'offline'
      }
    ];
  }

  constructor() {}

  ngOnInit(): void {
    // Initialiser les traductions
    this.updateTranslations();
    
    // S'abonner aux changements de langue
    this.langChangeSubscription = this.translate.onLangChange.subscribe(() => {
      this.updateTranslations();
    });
    
    // Charger les données du dashboard
    this.loadDashboardData();
  }

  ngOnDestroy(): void {
    // Nettoyer les abonnements
    if (this.langChangeSubscription) {
      this.langChangeSubscription.unsubscribe();
    }
  }

  /**
   * Charge les données du dashboard
   */
  loadDashboardData(): void {
    // Charger le nombre de datasets depuis l'API (optionnel)
    this.datasetService.getDatasets().subscribe({
      next: (response) => {
        // Mettre à jour seulement si on a des données réelles
        if (response.datasets && response.datasets.length > 0) {
          this.baseMetrics.datasets.value = response.datasets.length;
          this.baseDatasetStats.total = response.datasets.length;
          
          // Calculer les statistiques par domaine
          const domainCounts = response.datasets.reduce((acc: any, dataset) => {
            // Utiliser le premier domaine du tableau ou 'Autres'
            const domain = dataset.domain && dataset.domain.length > 0 
              ? dataset.domain[0] 
              : (dataset.domain && dataset.domain.includes('éducation')) 
                ? 'Éducation' 
                : 'Autres';
            acc[domain] = (acc[domain] || 0) + 1;
            return acc;
          }, {});

          // Mettre à jour les stats par domaine
          this.baseDatasetStats.byDomain.forEach(item => {
            const domainName = this.translate.instant(item.nameKey);
            item.value = domainCounts[domainName] || 0;
          });
        }
        
        // Mettre à jour les traductions avec les nouvelles données
        this.updateTranslations();
      },
      error: (error) => {
        console.error('Erreur lors du chargement des datasets:', error);
        // En cas d'erreur, utiliser des valeurs par défaut
        this.baseMetrics.datasets.value = 0;
        // Mettre à jour les traductions même en cas d'erreur
        this.updateTranslations();
      }
    });

    // Simuler d'autres métriques (à remplacer par de vraies données)
    this.baseMetrics.pipelines.value = Math.floor(Math.random() * 5) + 1; // Pipelines ML
    this.baseMetrics.explanations.value = Math.floor(Math.random() * 20) + 5; // Explications XAI
  }

  /**
   * Formate les changements pour l'affichage
   */
  getChangeClass(changeType?: string): string {
    switch (changeType) {
      case 'positive': return 'text-success';
      case 'negative': return 'text-error';
      default: return 'text-muted';
    }
  }

  /**
   * Navigue vers une route
   */
  navigateTo(route: string): void {
    // TODO: Implémenter la navigation
    console.log('Navigate to:', route);
  }
}
