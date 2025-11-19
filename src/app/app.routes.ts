import { Routes } from '@angular/router';
import { authGuard } from './guards/auth.guard';

export const routes: Routes = [
    {
        path: 'login',
        loadComponent: () => import('./components/login/login.component').then(m => m.LoginComponent)
    },
    {
        path: 'scan',
        loadComponent: () => import('./components/barcode-scan/barcode-scan.component').then(m => m.BarcodeScanComponent),
        canActivate: [authGuard]
    },
    {
        path: 'history',
        loadComponent: () => import('./components/history/history.component').then(m => m.HistoryComponent),
        canActivate: [authGuard]
    },
    {
        path: 'pending',
        loadComponent: () => import('./components/pending/pending.component').then(m => m.PendingComponent),
        canActivate: [authGuard]
    },
    {
        path: '',
        redirectTo: '/scan',
        pathMatch: 'full'
    },
    {
        path: '**',
        redirectTo: '/scan'
    }
];
