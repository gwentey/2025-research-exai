import { Routes } from '@angular/router';
import { DatasetListingComponent } from './dataset-listing.component';
import { DatasetDetailComponent } from './dataset-detail.component';

export const DatasetsRoutes: Routes = [
  {
    path: '',
    component: DatasetListingComponent,
    data: {
      title: 'Datasets',
      urls: [
        { title: 'Accueil', url: '/starter' },
        { title: 'Datasets' },
      ],
    },
  },
  {
    path: ':id',
    component: DatasetDetailComponent,
    data: {
      title: 'Détail Dataset',
      urls: [
        { title: 'Accueil', url: '/starter' },
        { title: 'Datasets', url: '/datasets' },
        { title: 'Détail' },
      ],
    },
  },
]; 