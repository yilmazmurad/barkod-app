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
    pendingSessions: BarcodeSession[] = [];

    constructor(
        public barcodeService: BarcodeService,
        public authService: AuthService,
        private router: Router
    ) { }

    ngOnInit(): void {
        this.barcodeService.pendingSessions$.subscribe(sessions => {
            this.pendingSessions = sessions;
        });
    }

    getTotalQuantity(session: BarcodeSession): number {
        return session.items.reduce((sum, item) => sum + item.quantity, 0);
    }

    loadSession(session: BarcodeSession): void {
        if (confirm('Bu kaydı düzenlemek için yüklemek istiyor musunuz?')) {
            this.barcodeService.startNewSession(session.fiscNumber, session.date);
            session.items.forEach(item => {
                this.barcodeService.addBarcode(item.barcode, item.quantity);
            });
            this.barcodeService.removePendingSession(session.fiscNumber);
            this.router.navigate(['/scan']);
        }
    }

    deleteSession(fiscNumber: string): void {
        if (confirm('Bu kaydı silmek istediğinize emin misiniz?')) {
            this.barcodeService.removePendingSession(fiscNumber);
        }
    }

    clearAllSessions(): void {
        if (confirm('Tüm kayıtları silmek istediğinize emin misiniz?')) {
            this.barcodeService.clearPendingSessions();
        }
    }

    backToScan(): void {
        this.router.navigate(['/scan']);
    }

    logout(): void {
        this.authService.logout();
    }
}
