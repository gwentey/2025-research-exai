import { Routes } from '@angular/router';
import { StarterComponent } from './starter/starter.component';

export const PagesRoutes: Routes = [
  {
    path: '',
    component: StarterComponent,
    data: {
      title: 'Dashboard EXAI',
      urls: [
        { title: 'Accueil', url: '/' },
        { title: 'Dashboard EXAI' },
      ],
    },
  },
];
