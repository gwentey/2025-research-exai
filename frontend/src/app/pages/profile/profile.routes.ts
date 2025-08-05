import { Routes } from '@angular/router';

export const PROFILE_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => 
      import('./profile.component').then(c => c.ProfileComponent),
    data: {
      title: 'PROFILE'
    }
  },
  {
    path: 'credits-refill',
    loadComponent: () => 
      import('./credits-refill/credits-refill.component').then(c => c.CreditsRefillComponent),
    data: {
      title: 'CREDITS_REFILL'
    }
  },
]; 
