import { Routes } from '@angular/router';
import { ProjectListComponent } from './project-list.component';
import { ProjectFormComponent } from './project-form.component';
import { ProjectDetailComponent } from './project-detail.component';

export const ProjectsRoutes: Routes = [
  {
    path: '',
    component: ProjectListComponent,
    data: {
      title: 'Projets',
      urls: [
        { title: 'Accueil', url: '/starter' },
        { title: 'Projets' },
      ],
    },
  },
  {
    path: 'new',
    component: ProjectFormComponent,
    data: {
      title: 'Nouveau Projet',
      urls: [
        { title: 'Accueil', url: '/starter' },
        { title: 'Projets', url: '/projects' },
        { title: 'Nouveau' },
      ],
    },
  },
  {
    path: ':id',
    component: ProjectDetailComponent,
    data: {
      title: 'Détail du Projet',
      urls: [
        { title: 'Accueil', url: '/starter' },
        { title: 'Projets', url: '/projects' },
        { title: 'Détail' },
      ],
    },
  },
  {
    path: ':id/edit',
    component: ProjectFormComponent,
    data: {
      title: 'Modifier le Projet',
      urls: [
        { title: 'Accueil', url: '/starter' },
        { title: 'Projets', url: '/projects' },
        { title: 'Modifier' },
      ],
    },
  },
];

export const PROJECTS_ROUTES = ProjectsRoutes; 
