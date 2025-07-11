import { Routes } from '@angular/router';
import { OnboardingWizardComponent } from './onboarding-wizard.component';
import { authGuard } from '../../../guards/auth.guard';

export const OnboardingRoutes: Routes = [
  {
    path: '',
    component: OnboardingWizardComponent,
    canActivate: [authGuard],
  },
]; 