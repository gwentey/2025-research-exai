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
      title: 'ADMIN_DASHBOARD',
      urls: [
        { title: 'BREADCRUMB.HOME', url: '/starter' },
        { title: 'BREADCRUMB.ADMIN' },
      ],
    },
  },
  {
    path: 'datasets',
    component: DatasetManagementComponent,
    canActivate: [adminGuard],
    data: {
      title: 'ADMIN_DATASETS',
      urls: [
        { title: 'BREADCRUMB.HOME', url: '/starter' },
        { title: 'BREADCRUMB.ADMIN', url: '/admin' },
        { title: 'BREADCRUMB.ADMIN_DATASETS' },
      ],
    },
  },
  {
    path: 'users',
    component: UserManagementComponent,
    canActivate: [adminGuard],
    data: {
      title: 'ADMIN_USERS',
      urls: [
        { title: 'BREADCRUMB.HOME', url: '/starter' },
        { title: 'BREADCRUMB.ADMIN', url: '/admin' },
        { title: 'BREADCRUMB.ADMIN_USERS' },
      ],
    },
  },
  {
    path: 'ethical-templates',
    component: EthicalTemplatesComponent,
    canActivate: [adminGuard],
    data: {
      title: 'ADMIN_ETHICAL_TEMPLATES',
      urls: [
        { title: 'BREADCRUMB.HOME', url: '/starter' },
        { title: 'BREADCRUMB.ADMIN', url: '/admin' },
        { title: 'BREADCRUMB.ADMIN_ETHICAL_TEMPLATES' },
      ],
    },
  },
];