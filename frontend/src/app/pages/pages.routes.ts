import { Routes } from '@angular/router';
import { StarterComponent } from './starter/starter.component';

export const PagesRoutes: Routes = [
  {
    path: '',
    component: StarterComponent,
    data: {
      title: 'Dashboard IBIS-X',
      urls: [
        { title: 'Accueil', url: '/' },
        { title: 'Dashboard IBIS-X' },
      ],
    },
  },
];
