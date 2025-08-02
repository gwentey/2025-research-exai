import { Routes } from '@angular/router';

export const PROFILE_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => 
      import('./profile.component').then(c => c.ProfileComponent),
  },
  {
    path: 'credits-refill',
    loadComponent: () => 
      import('./credits-refill/credits-refill.component').then(c => c.CreditsRefillComponent),
  },
]; 
