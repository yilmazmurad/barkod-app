import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { BarcodeService, BarcodeSession } from '../../services/barcode.service';
import { AuthService } from '../../services/auth.service';
import { ExcelService } from '../../services/excel.service';
import { DialogService } from '../../services/dialog.service';

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
        tarih: '',
        username: ''
    };

    constructor(
        public barcodeService: BarcodeService,
        public authService: AuthService,
        private excelService: ExcelService,
        private dialogService: DialogService,
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
                (session.cari_kodu && session.cari_kodu.toLowerCase().includes(searchLower)) ||
                (session.username && session.username.toLowerCase().includes(searchLower))
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

        if (this.filters.username) {
            const filterLower = this.filters.username.toLowerCase();
            filtered = filtered.filter(session =>
                session.username && session.username.toLowerCase().includes(filterLower)
            );
        }

        this.filteredSessions = filtered;
    }

    getTotalQuantity(session: BarcodeSession): number {
        return session.details.reduce((sum, item) => sum + item.miktar, 0);
    }

    async loadSession(session: BarcodeSession): Promise<void> {
        const confirmed = await this.dialogService.confirm(
            'Düzenleme Onayı',
            'Bu kaydı düzenlemek için yüklemek istiyor musunuz?'
        );

        if (confirmed) {
            // resumeSession kullanarak tüm verileri eksiksiz aktar
            this.barcodeService.resumeSession(session);
            this.router.navigate(['/scan']);
        }
    }

    async deleteSession(fisno: string): Promise<void> {
        const confirmed = await this.dialogService.confirm(
            'Silme Onayı',
            'Bu kaydı silmek istediğinize emin misiniz?',
            'Sil',
            'İptal'
        );

        if (confirmed) {
            this.barcodeService.removePendingSession(fisno);
        }
    }

    viewDetail(session: BarcodeSession): void {
        this.router.navigate(['/pending', session.fisno]);
    }

    exportToExcel(): void {
        const columns = [
            { header: 'Fiş No', field: 'fisno' },
            { header: 'Tarih', field: 'tarih' },
            { header: 'Cari Kodu', field: 'cari_kodu' },
            { header: 'Cari Adı', field: 'cari_isim' },
            { header: 'Kullanıcı', field: 'username' },
            { header: 'Ürün Sayısı', field: 'details', format: (row: any) => row.details.length },
            { header: 'Toplam Miktar', field: 'details', format: (row: any) => this.getTotalQuantity(row) }
        ];

        this.excelService.exportToExcel(this.filteredSessions, 'bekleyen-fisler', columns, undefined, 'xlsx');
    }

    async clearAllSessions(): Promise<void> {
        const confirmed = await this.dialogService.confirm(
            'Toplu Silme Onayı',
            'Tüm kayıtları silmek istediğinize emin misiniz?',
            'Tümünü Sil',
            'İptal'
        );

        if (confirmed) {
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
