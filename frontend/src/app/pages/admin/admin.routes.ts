import { Routes } from '@angular/router';
import { EthicalTemplatesComponent } from './ethical-templates.component';

export const AdminRoutes: Routes = [
  {
    path: 'ethical-templates',
    component: EthicalTemplatesComponent,
    data: {
      title: 'Templates Éthiques',
      urls: [
        { title: 'Accueil', url: '/starter' },
        { title: 'Administration', url: '/admin' },
        { title: 'Templates Éthiques' },
      ],
    },
  },
  {
    path: '',
    redirectTo: 'ethical-templates',
    pathMatch: 'full'
  }
];