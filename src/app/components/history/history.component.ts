import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { BarcodeService, BarcodeSession } from '../../services/barcode.service';
import { AuthService } from '../../services/auth.service';

@Component({
    selector: 'app-history',
    standalone: true,
    imports: [CommonModule],
    templateUrl: './history.component.html',
    styleUrls: ['./history.component.css']
})
export class HistoryComponent implements OnInit {
    sentSessions: BarcodeSession[] = [];

    constructor(
        public barcodeService: BarcodeService,
        public authService: AuthService,
        private router: Router
    ) { }

    ngOnInit(): void {
        this.barcodeService.sentSessions$.subscribe(sessions => {
            this.sentSessions = sessions;
        });
    }

    getTotalQuantity(session: BarcodeSession): number {
        return session.items.reduce((sum, item) => sum + item.quantity, 0);
    }

    // Geçmiş kayıtlar sadece görüntülenebilir, düzenlenemez (şimdilik)
    viewSession(session: BarcodeSession): void {
        // Detay görüntüleme eklenebilir
        console.log('View session:', session);
    }

    clearAllHistory(): void {
        if (confirm('Tüm geçmiş kayıtları silmek istediğinize emin misiniz?')) {
            this.barcodeService.clearSentSessions();
        }
    }

    navigateToScan(): void {
        this.router.navigate(['/scan']);
    }

    navigateToPending(): void {
        this.router.navigate(['/pending']);
    }

    logout(): void {
        this.authService.logout();
    }
}
