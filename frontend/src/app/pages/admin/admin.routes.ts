import { Routes } from '@angular/router';
import { AdminDashboardComponent } from './admin-dashboard.component';
import { DatasetManagementComponent } from './dataset-management.component';
import { UserManagementComponent } from './user-management.component';
import { EthicalTemplatesComponent } from './ethical-templates.component';
import { adminGuard } from '../../guards/role.guard';

export const AdminRoutes: Routes = [
  {
    path: '',
    component: AdminDashboardComponent,
    canActivate: [adminGuard],
    data: {
      title: 'Administration',
      urls: [
        { title: 'Accueil', url: '/starter' },
        { title: 'Administration' },
      ],
    },
  },
  {
    path: 'datasets',
    component: DatasetManagementComponent,
    canActivate: [adminGuard],
    data: {
      title: 'Gestion des Datasets',
      urls: [
        { title: 'Accueil', url: '/starter' },
        { title: 'Administration', url: '/admin' },
        { title: 'Gestion des Datasets' },
      ],
    },
  },
  {
    path: 'users',
    component: UserManagementComponent,
    canActivate: [adminGuard],
    data: {
      title: 'Gestion des Utilisateurs',
      urls: [
        { title: 'Accueil', url: '/starter' },
        { title: 'Administration', url: '/admin' },
        { title: 'Gestion des Utilisateurs' },
      ],
    },
  },
  {
    path: 'ethical-templates',
    component: EthicalTemplatesComponent,
    canActivate: [adminGuard],
    data: {
      title: 'Templates Éthiques',
      urls: [
        { title: 'Accueil', url: '/starter' },
        { title: 'Administration', url: '/admin' },
        { title: 'Templates Éthiques' },
      ],
    },
  },
];