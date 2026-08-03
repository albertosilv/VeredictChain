import { Routes } from '@angular/router';
import { emissorGuard } from './core/guards/emissor.guard';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./features/public/dropzone/dropzone.component').then(
        m => m.DropzoneComponent,
      ),
  },
  {
    path: 'emissor/login',
    loadComponent: () =>
      import('./features/emissor/login/login.component').then(
        m => m.LoginComponent,
      ),
  },
  {
    path: 'emissor',
    canActivate: [emissorGuard],
    loadComponent: () =>
      import('./features/emissor/emissor-shell.component').then(
        m => m.EmissorShellComponent,
      ),
    children: [
      { path: '', redirectTo: 'registrar', pathMatch: 'full' },
      {
        path: 'registrar',
        loadComponent: () =>
          import('./features/emissor/registrar/registrar.component').then(
            m => m.RegistrarComponent,
          ),
      },
      {
        path: 'consultar',
        loadComponent: () =>
          import('./features/emissor/consultar/consultar.component').then(
            m => m.ConsultarComponent,
          ),
      },
      {
        path: 'retificar/:documentHash',
        loadComponent: () =>
          import('./features/emissor/retificar/retificar.component').then(
            m => m.RetificarComponent,
          ),
      },
    ],
  },
];
