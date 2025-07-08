import { Component, ViewEncapsulation, OnInit, inject } from '@angular/core';
import { MaterialModule } from 'src/app/material.module';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { TablerIconsModule } from 'angular-tabler-icons';
import { DatasetService } from '../../services/dataset.service';
import { AuthService } from '../../services/auth.service';

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

@Component({
  selector: 'app-starter',
  templateUrl: './starter.component.html',
  imports: [MaterialModule, CommonModule, RouterModule, TablerIconsModule],
  styleUrls: ['./starter.component.scss'],
  encapsulation: ViewEncapsulation.None
})
export class StarterComponent implements OnInit {
  
  private datasetService = inject(DatasetService);
  private authService = inject(AuthService);
  
  // Métriques principales du dashboard
  dashboardMetrics: DashboardMetric[] = [
    {
      title: 'DATASETS DISPONIBLES',
      value: 7,
      icon: 'database',
      color: 'primary',
      change: '+3 cette semaine',
      changeType: 'positive'
    },
    {
      title: 'PIPELINES ML ACTIFS', 
      value: 5,
      icon: 'chart-dots',
      color: 'warning',
      change: '2 en cours',
      changeType: 'neutral'
    },
    {
      title: 'EXPLICATIONS XAI',
      value: 21,
      icon: 'bulb',
      color: 'success',
      change: '+12 ce mois',
      changeType: 'positive'
    },
    {
      title: 'UTILISATEURS ACTIFS',
      value: 1,
      icon: 'users',
      color: 'accent',
      change: 'Aujourd\'hui',
      changeType: 'neutral'
    }
  ];

  // Activités récentes
  recentActivities: RecentActivity[] = [
    {
      id: 1,
      type: 'dataset',
      title: 'Dataset EdNet ajouté',
      description: 'Nouveau dataset éducationnel avec 5 fichiers',
      timestamp: 'Il y a 2 heures',
      icon: 'database',
      color: 'primary'
    },
    {
      id: 2,
      type: 'pipeline',
      title: 'Pipeline ML terminé',
      description: 'Classification des étudiants - Accuracy: 94.2%',
      timestamp: 'Il y a 5 heures',
      icon: 'chart-line',
      color: 'success'
    },
    {
      id: 3,
      type: 'explanation',
      title: 'Explication SHAP générée',
      description: 'Analyse des features importantes pour la prédiction',
      timestamp: 'Hier',
      icon: 'lightbulb',
      color: 'warning'
    },
    {
      id: 4,
      type: 'user',
      title: 'Connexion utilisateur',
      description: 'Nouvel utilisateur connecté via OAuth',
      timestamp: 'Il y a 1 jour',
      icon: 'user-check',
      color: 'accent'
    }
  ];

  // Actions rapides
  quickActions: QuickAction[] = [
    {
      title: 'Explorer les Datasets',
      description: 'Parcourir et sélectionner vos données',
      icon: 'search',
      route: '/datasets',
      color: 'primary'
    },
    {
      title: 'Créer un Pipeline ML',
      description: 'Entraîner un nouveau modèle',
      icon: 'plus',
      route: '/ml-pipeline',
      color: 'warning',
      disabled: true
    },
    {
      title: 'Générer des Explications',
      description: 'Comprendre vos modèles avec XAI',
      icon: 'brain',
      route: '/xai-explanations',
      color: 'success',
      disabled: true
    },
    {
      title: 'Voir la Documentation',
      description: 'Guides et tutoriels EXAI',
      icon: 'book',
      route: '/help',
      color: 'accent'
    }
  ];

  // Données pour les graphiques (simulation)
  datasetStats = {
    total: 7,
    byDomain: [
      { name: 'Éducation', value: 4, color: '#1976d2' },
      { name: 'Santé', value: 2, color: '#388e3c' },
      { name: 'Finance', value: 1, color: '#f57c00' },
      { name: 'Autres', value: 0, color: '#7b1fa2' }
    ]
  };

  constructor() {}

  ngOnInit(): void {
    this.loadDashboardData();
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
          this.dashboardMetrics[0].value = response.datasets.length;
          this.datasetStats.total = response.datasets.length;
          
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
          this.datasetStats.byDomain.forEach(item => {
            item.value = domainCounts[item.name] || 0;
          });
        }
      },
      error: (error) => {
        console.error('Erreur lors du chargement des datasets:', error);
        // En cas d'erreur, utiliser des valeurs par défaut
        this.dashboardMetrics[0].value = 0;
      }
    });

    // Simuler d'autres métriques (à remplacer par de vraies données)
    this.dashboardMetrics[1].value = Math.floor(Math.random() * 5) + 1; // Pipelines ML
    this.dashboardMetrics[2].value = Math.floor(Math.random() * 20) + 5; // Explications XAI
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
