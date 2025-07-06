import { Routes } from '@angular/router';
import { DatasetListingComponent } from './dataset-listing.component';

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
]; 