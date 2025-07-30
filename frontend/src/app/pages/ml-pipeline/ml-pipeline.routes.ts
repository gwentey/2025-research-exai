import { Routes } from '@angular/router';
import { MlPipelineWizardComponent } from './wizard/ml-pipeline-wizard.component';
import { MlPipelineDashboardComponent } from './ml-pipeline-dashboard/ml-pipeline-dashboard.component';
import { MlStudioComponent } from './ml-studio/ml-studio.component';

export const ML_PIPELINE_ROUTES: Routes = [
  {
    path: '',
    component: MlPipelineDashboardComponent,
    data: {
      title: 'ML Pipeline',
      breadcrumb: [
        {
          label: 'Projets',
          url: '/projects'
        },
        {
          label: 'ML Pipeline',
          url: ''
        }
      ]
    }
  },
  {
    path: 'ml-studio',
    component: MlStudioComponent,
    data: {
      title: 'ML Studio',
      breadcrumb: [
        {
          label: 'Projets',
          url: '/projects'
        },
        {
          label: 'ML Pipeline',
          url: '../'
        },
        {
          label: 'ML Studio',
          url: ''
        }
      ]
    }
  },
  {
    path: 'wizard',
    component: MlPipelineWizardComponent,
    data: {
      title: 'ML Pipeline Wizard (Legacy)',
      breadcrumb: [
        {
          label: 'Projets',
          url: '/projects'
        },
        {
          label: 'ML Pipeline',
          url: '../'
        },
        {
          label: 'Wizard',
          url: ''
        }
      ]
    }
  },
  {
    path: 'experiment/:id',
    loadComponent: () => import('./experiment-results/experiment-results.component').then(m => m.ExperimentResultsComponent),
    data: {
      title: 'Résultats d\'Expérience',
      breadcrumb: [
        {
          label: 'Projets',
          url: '/projects'
        },
        {
          label: 'ML Pipeline',
          url: '../'
        },
        {
          label: 'Résultats',
          url: ''
        }
      ]
    }
  },
  {
    path: 'experiments',
    loadComponent: () => import('./experiments-list/experiments-list.component').then(m => m.ExperimentsListComponent),
    data: {
      title: 'Toutes les Expériences',
      breadcrumb: [
        {
          label: 'Projets',
          url: '/projects'
        },
        {
          label: 'ML Pipeline',
          url: '../'
        },
        {
          label: 'Expériences',
          url: ''
        }
      ]
    }
  }
];