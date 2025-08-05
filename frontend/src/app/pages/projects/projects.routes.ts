import { Routes } from '@angular/router';
import { ProjectListComponent } from './project-list.component';
import { ProjectFormComponent } from './project-form.component';
import { ProjectDetailComponent } from './project-detail.component';

export const ProjectsRoutes: Routes = [
  {
    path: '',
    component: ProjectListComponent,
    data: {
      title: 'PROJECTS',
      urls: [
        { title: 'BREADCRUMB.HOME', url: '/starter' },
        { title: 'BREADCRUMB.PROJECTS' },
      ],
    },
  },
  {
    path: 'new',
    component: ProjectFormComponent,
    data: {
      title: 'PROJECTS',
      urls: [
        { title: 'BREADCRUMB.HOME', url: '/starter' },
        { title: 'BREADCRUMB.PROJECTS', url: '/projects' },
        { title: 'BREADCRUMB.PROJECT_NEW' },
      ],
    },
  },
  {
    path: ':id',
    component: ProjectDetailComponent,
    data: {
      title: 'PROJECT_DETAIL',
      urls: [
        { title: 'BREADCRUMB.HOME', url: '/starter' },
        { title: 'BREADCRUMB.PROJECTS', url: '/projects' },
        { title: 'BREADCRUMB.PROJECT_DETAIL' },
      ],
    },
  },
  {
    path: ':id/edit',
    component: ProjectFormComponent,
    data: {
      title: 'PROJECTS',
      urls: [
        { title: 'BREADCRUMB.HOME', url: '/starter' },
        { title: 'BREADCRUMB.PROJECTS', url: '/projects' },
        { title: 'BREADCRUMB.PROJECT_EDIT' },
      ],
    },
  },
];

export const PROJECTS_ROUTES = ProjectsRoutes; 
