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
    showSearch: boolean = false;
    isSending = false;

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

    async sendSession(session: BarcodeSession): Promise<void> {
        if (this.isSending) return;

        const confirmed = await this.dialogService.confirm(
            'Gönderim Onayı',
            'Bu fişi göndermek istediğinize emin misiniz?'
        );

        if (confirmed && session) {
            // Eksiksiz ve doğru payload için detayları hazırla
            const detailsWithAll = session.details.map((item, idx) => ({
                ...item,
                sirano: Number(item.sirano ?? (idx + 1)),
                okumadetay_id: Number(item.okumadetay_id ?? 0),
                okuma_id: Number(item.okuma_id ?? session.okuma_id ?? 0),
                miktar: Number(item.miktar),
                fiyat: Number(item.fiyat ?? 0),
                tutar: Number(item.tutar ?? 0),
                is_bulundu: !!item.is_bulundu,
                is_aktarildi: !!item.is_aktarildi,
                is_new: !!item.is_new,
                is_deleted: !!item.is_deleted,
                stok_kodu: item.stok_kodu ?? '',
                stok_adi: item.stok_adi ?? ''
            }));
            const sessionPayload = {
                ...session,
                fisno: session.fisno,
                toplam_adet: detailsWithAll.reduce((sum, item) => sum + item.miktar, 0),
                toplam_tutar: detailsWithAll.reduce((sum, item) => sum + (item.tutar ?? 0), 0),
                is_aktarildi: session.is_aktarildi ?? 'H',
                is_new: !!session.is_new,
                mikro_fisno: Number(session.mikro_fisno ?? 0),
                mikro_fisseri: session.mikro_fisseri ?? '',
                okuma_id: Number(session.okuma_id ?? 0),
                details: detailsWithAll
            };
            this.isSending = true;
            this.barcodeService.sendSession(sessionPayload).subscribe({
                next: (response) => {
                    this.barcodeService.removePendingSession(session.fisno);
                    if (response && response.okuma_id) {
                        this.router.navigate(['/history', response.okuma_id]);
                    } else {
                        this.router.navigate(['/history']);
                    }
                },
                error: (err) => {
                    console.error('Error sending session:', err);
                    this.dialogService.alert('Hata', 'Fiş gönderilirken bir hata oluştu.', 'error');
                    this.isSending = false;
                },
                complete: () => {
                    this.isSending = false;
                }
            });
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

    toggleSearch(): void {
        this.showSearch = !this.showSearch;
    }

    logout(): void {
        this.authService.logout();
    }
}
