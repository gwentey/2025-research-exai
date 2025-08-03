import { Routes } from '@angular/router';
import { BlankComponent } from './layouts/blank/blank.component';
import { FullComponent } from './layouts/full/full.component';
import { authGuard } from './guards/auth.guard';
import { onboardingGuard } from './guards/onboarding.guard';

export const routes: Routes = [
  // ML Pipeline Wizard en plein écran
  {
    path: 'ml-pipeline-wizard',
    component: BlankComponent,
    canActivate: [authGuard, onboardingGuard],
    children: [
      {
        path: '',
        loadComponent: () =>
          import('./pages/ml-pipeline/wizard/ml-pipeline-wizard.component').then((m) => m.MlPipelineWizardComponent),
      }
    ]
  },
  {
    path: '',
    component: FullComponent,
    canActivate: [authGuard, onboardingGuard],
    children: [
      {
        path: '',
        redirectTo: '/starter',
        pathMatch: 'full',
      },
      {
        path: 'starter',
        loadChildren: () =>
          import('./pages/pages.routes').then((m) => m.PagesRoutes),
      },
      {
        path: 'sample-page',
        loadChildren: () =>
          import('./pages/pages.routes').then((m) => m.PagesRoutes),
      },
      {
        path: 'datasets',
        loadChildren: () =>
          import('./pages/datasets/datasets.routes').then((m) => m.DatasetsRoutes),
      },
      {
        path: 'projects',
        loadChildren: () =>
          import('./pages/projects/projects.routes').then((m) => m.PROJECTS_ROUTES),
      },
      {
        path: 'projects/:id/ml-pipeline',
        loadChildren: () =>
          import('./pages/ml-pipeline/ml-pipeline.routes').then((m) => m.ML_PIPELINE_ROUTES),
      },
      {
        path: 'ml-pipeline',
        loadChildren: () =>
          import('./pages/ml-pipeline/ml-pipeline.routes').then((m) => m.ML_PIPELINE_ROUTES),
      },
      {
        path: 'profile',
        loadChildren: () =>
          import('./pages/profile/profile.routes').then((m) => m.PROFILE_ROUTES),
      },
      {
        path: 'admin',
        loadChildren: () =>
          import('./pages/admin/admin.routes').then((m) => m.AdminRoutes),
      },
    ],
  },
  {
    path: '',
    component: BlankComponent,
    children: [
      {
        path: 'authentication',
        loadChildren: () =>
          import('./pages/authentication/authentication.routes').then(
            (m) => m.AuthenticationRoutes
          ),
      },
      {
        path: 'onboarding',
        canActivate: [authGuard],
        loadChildren: () =>
          import('./pages/authentication/onboarding/onboarding.routes').then(
            (m) => m.OnboardingRoutes
          ),
      },
    ],
  },
  {
    path: '**',
    redirectTo: 'authentication/error',
  },
];
