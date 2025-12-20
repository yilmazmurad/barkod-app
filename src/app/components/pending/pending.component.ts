import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { BarcodeService, BarcodeSession } from '../../services/barcode.service';
import { AuthService } from '../../services/auth.service';

@Component({
    selector: 'app-pending',
    standalone: true,
    imports: [CommonModule, FormsModule],
    templateUrl: './pending.component.html',
    styleUrls: ['./pending.component.css']
})
export class PendingComponent implements OnInit {
    pendingSessions: BarcodeSession[] = [];
    filteredSessions: BarcodeSession[] = [];
    searchText: string = '';

    filters = {
        fisno: '',
        tarih: ''
    };

    constructor(
        public barcodeService: BarcodeService,
        public authService: AuthService,
        private router: Router
    ) { }

    ngOnInit(): void {
        this.barcodeService.pendingSessions$.subscribe(sessions => {
            this.pendingSessions = sessions;
            this.filterSessions();
        });
    }

    filterSessions(): void {
        let filtered = this.pendingSessions;

        // Genel Arama
        if (this.searchText.trim()) {
            const searchLower = this.searchText.toLowerCase();
            filtered = filtered.filter(session =>
                session.fisno.toLowerCase().includes(searchLower) ||
                (session.cari_isim && session.cari_isim.toLowerCase().includes(searchLower)) ||
                (session.cari_kodu && session.cari_kodu.toLowerCase().includes(searchLower))
            );
        }

        // Kolon Bazlı Filtreler
        if (this.filters.fisno) {
            const filterLower = this.filters.fisno.toLowerCase();
            filtered = filtered.filter(session =>
                session.fisno.toLowerCase().includes(filterLower) ||
                (session.cari_isim && session.cari_isim.toLowerCase().includes(filterLower)) ||
                (session.cari_kodu && session.cari_kodu.toLowerCase().includes(filterLower))
            );
        }

        if (this.filters.tarih) {
            filtered = filtered.filter(session => session.tarih.includes(this.filters.tarih));
        }

        this.filteredSessions = filtered;
    }

    getTotalQuantity(session: BarcodeSession): number {
        return session.details.reduce((sum, item) => sum + item.miktar, 0);
    }

    loadSession(session: BarcodeSession): void {
        if (confirm('Bu kaydı düzenlemek için yüklemek istiyor musunuz?')) {
            this.barcodeService.startNewSession(session.fisno, session.tarih);
            session.details.forEach(item => {
                this.barcodeService.addBarcode(item.barkod, item.miktar);
            });
            this.barcodeService.removePendingSession(session.fisno);
            this.router.navigate(['/scan']);
        }
    }

    deleteSession(fisno: string): void {
        if (confirm('Bu kaydı silmek istediğinize emin misiniz?')) {
            this.barcodeService.removePendingSession(fisno);
        }
    }

    viewDetail(session: BarcodeSession): void {
        this.router.navigate(['/pending', session.fisno]);
    }

    clearAllSessions(): void {
        if (confirm('Tüm kayıtları silmek istediğinize emin misiniz?')) {
            this.barcodeService.clearPendingSessions();
        }
    }

    navigateToScan(): void {
        this.router.navigate(['/scan']);
    }

    navigateToHistory(): void {
        this.router.navigate(['/history']);
    }

    logout(): void {
        this.authService.logout();
    }
}
