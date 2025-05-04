import { Routes } from '@angular/router';

import { AppErrorComponent } from './error/error.component';
import { AppSideLoginComponent } from './side-login/side-login.component';
import { AppSideRegisterComponent } from './side-register/side-register.component';
import { OAuthCallbackComponent } from './oauth-callback/oauth-callback.component';
import { nonAuthGuard } from '../../guards/non-auth.guard';

export const AuthenticationRoutes: Routes = [
  {
    path: '',
    children: [
      {
        path: 'error',
        component: AppErrorComponent,
      },

      {
        path: 'login',
        component: AppSideLoginComponent,
        canActivate: [nonAuthGuard],
      },
      {
        path: 'register',
        component: AppSideRegisterComponent,
        canActivate: [nonAuthGuard],
      },
      {
        path: 'callback',
        component: OAuthCallbackComponent,
      },
    ],
  },
];
