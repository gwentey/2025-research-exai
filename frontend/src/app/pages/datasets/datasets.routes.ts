import { Routes } from '@angular/router';
import { DatasetListingComponent } from './dataset-listing.component';
import { DatasetDetailComponent } from './dataset-detail.component';
import { DatasetMetadataCompletionComponent } from './dataset-metadata-completion.component';

export const DatasetsRoutes: Routes = [
  {
    path: '',
    component: DatasetListingComponent,
    data: {
      title: 'DATASETS',
      urls: [
        { title: 'BREADCRUMB.HOME', url: '/starter' },
        { title: 'BREADCRUMB.DATASETS' },
      ],
    },
  },
  {
    path: ':id',
    component: DatasetDetailComponent,
    data: {
      title: 'DATASET_DETAIL',
      urls: [
        { title: 'BREADCRUMB.HOME', url: '/starter' },
        { title: 'BREADCRUMB.DATASETS', url: '/datasets' },
        { title: 'BREADCRUMB.DATASET_DETAIL' },
      ],
    },
  },
  {
    path: ':id/complete-metadata',
    component: DatasetMetadataCompletionComponent,
    data: {
      title: 'DATASET_METADATA',
      urls: [
        { title: 'BREADCRUMB.HOME', url: '/starter' },
        { title: 'BREADCRUMB.DATASETS', url: '/datasets' },
        { title: 'BREADCRUMB.DATASET_DETAIL', url: '/datasets/:id' },
        { title: 'BREADCRUMB.DATASET_METADATA' },
      ],
    },
  },
]; 
