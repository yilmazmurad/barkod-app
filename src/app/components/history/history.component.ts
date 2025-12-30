import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Subject } from 'rxjs';
import { debounceTime } from 'rxjs/operators';
import { ApiService } from '../../services/api.service';
import { AuthService } from '../../services/auth.service';
import { ExcelService } from '../../services/excel.service';
import { DialogService } from '../../services/dialog.service';

export interface HistoryItem {
    okuma_id: number;
    fisno: number;
    tarih: string;
    cari_kodu: string;
    cari_isim: string;
    user_id: number;
    username: string;
    is_aktarildi: string;
    toplam_adet: number;
    toplam_tutar: number;
    mikro_fisno: number;
    mikro_fisseri: string;
    is_urundurum?: boolean;
}

@Component({
    selector: 'app-history',
    standalone: true,
    imports: [CommonModule, FormsModule],
    templateUrl: './history.component.html',
    styleUrls: ['./history.component.css']
})
export class HistoryComponent implements OnInit {
    historyItems: HistoryItem[] = [];
    filteredHistoryItems: HistoryItem[] = [];
    isLoading = false;
    currentPage = 1;
    pageSize = 20;
    hasMore = true;
    showSearch: boolean = false;

    filters = {
        fisno: '',
        tarih: '',
        cari_kodu: '',
        cari_isim: '',
        username: '',
        genel_arama: ''
    };

    private searchSubject = new Subject<void>();

    constructor(
        private apiService: ApiService,
        public authService: AuthService,
        private excelService: ExcelService,
        private router: Router,
        private dialogService: DialogService
    ) {
        this.searchSubject.pipe(
            debounceTime(300)
        ).subscribe(() => {
            this.applyFilters();
        });
    }

    ngOnInit(): void {
        this.loadHistory();
    }

    onFilterChange(): void {
        this.searchSubject.next();
    }

    loadHistory(): void {
        if (this.isLoading) return;

        this.isLoading = true;

        // Server-side filtreleme şimdilik kapalı, tüm veriyi çekip client-side filtreliyoruz
        this.apiService.getHistory(this.currentPage, this.pageSize).subscribe({
            next: (data) => {
                const raw = data || [];
                const items = raw.map((i: any) => ({
                    ...i,
                    is_urundurum: i.is_urundurum === undefined ? true : !!i.is_urundurum
                })) as HistoryItem[];

                if (this.currentPage === 1) {
                    this.historyItems = items;
                } else {
                    this.historyItems = [...this.historyItems, ...items];
                }

                this.applyFilters();
                this.hasMore = items.length === this.pageSize;
                this.isLoading = false;
            },
            error: (err) => {
                console.error('Geçmiş yüklenirken hata:', err);
                this.isLoading = false;
            }
        });
    }

    applyFilters(): void {
        let filtered = [...this.historyItems];

        // Genel Arama
        if (this.filters.genel_arama) {
            const searchLower = this.filters.genel_arama.toLowerCase();
            filtered = filtered.filter(item =>
                item.fisno.toString().includes(searchLower) ||
                (item.cari_isim && item.cari_isim.toLowerCase().includes(searchLower)) ||
                (item.cari_kodu && item.cari_kodu.toLowerCase().includes(searchLower)) ||
                (item.username && item.username.toLowerCase().includes(searchLower))
            );
        }

        // Kolon Bazlı Filtreler
        if (this.filters.fisno) {
            filtered = filtered.filter(item => item.fisno.toString().includes(this.filters.fisno));
        }

        if (this.filters.tarih) {
            filtered = filtered.filter(item => item.tarih.startsWith(this.filters.tarih));
        }

        if (this.filters.cari_isim) {
            const searchLower = this.filters.cari_isim.toLowerCase();
            filtered = filtered.filter(item =>
                item.cari_isim && item.cari_isim.toLowerCase().includes(searchLower)
            );
        }

        if (this.filters.cari_kodu) {
            const searchLower = this.filters.cari_kodu.toLowerCase();
            filtered = filtered.filter(item =>
                item.cari_kodu && item.cari_kodu.toLowerCase().includes(searchLower)
            );
        }

        if (this.filters.username) {
            const searchLower = this.filters.username.toLowerCase();
            filtered = filtered.filter(item =>
                item.username && item.username.toLowerCase().includes(searchLower)
            );
        }

        this.filteredHistoryItems = filtered;
    }

    loadMore(): void {
        if (this.hasMore && !this.isLoading) {
            this.currentPage++;
            this.loadHistory();
        }
    }

    viewDetail(item: HistoryItem): void {
        this.router.navigate(['/history', item.okuma_id]);
    }

    exportToExcel(): void {
        const columns = [
            { header: 'Fiş No', field: 'fisno' },
            { header: 'Tarih', field: 'tarih' },
            { header: 'Cari Kodu', field: 'cari_kodu' },
            { header: 'Cari Adı', field: 'cari_isim' },
            { header: 'Kullanıcı', field: 'username' },
            { header: 'Toplam Adet', field: 'toplam_adet' },
            { header: 'Toplam Tutar', field: 'toplam_tutar' },
            { header: 'Aktarıldı', field: 'is_aktarildi', format: (row: any) => row.is_aktarildi === 'E' ? 'Evet' : 'Hayır' }
        ];

        this.excelService.exportToExcel(this.filteredHistoryItems, 'gecmis-fisler', columns, undefined, 'xlsx');
    }

    navigateToScan(): void {
        this.router.navigate(['/scan']);
    }

    navigateToPending(): void {
        this.router.navigate(['/pending']);
    }

    toggleSearch(): void {
        this.showSearch = !this.showSearch;
    }

    async transferReceipt(item: HistoryItem): Promise<void> {
        if (item.is_aktarildi !== 'H') {
            return;
        }

        // Ürün eksikliği kontrolü
        const productsMissing = item.is_urundurum !== true;
        // Cari kodu kontrolü
        const cariMissing = !item.cari_kodu || item.cari_kodu.trim() === '';

        // Hata mesajını oluştur
        let errorMessage = '';
        if (productsMissing && cariMissing) {
            errorMessage = 'Ürünler eksik ve cari kodu bulunmuyor. Aktarım yapılamaz.';
        } else if (productsMissing) {
            errorMessage = 'Ürünler eksik. Aktarım yapılamaz.';
        } else if (cariMissing) {
            errorMessage = 'Cari kodu bulunmuyor. Aktarım yapılamaz.';
        }

        if (errorMessage) {
            this.dialogService.alert('Uyarı', errorMessage);
            return;
        }

        const confirmed = await this.dialogService.confirm(
            'Fiş Aktarımı',
            `Fiş No: ${item.fisno} - Aktarmak istediğinizden emin misiniz?`
        );

        if (confirmed) {
            this.apiService.transferReceipt(item.okuma_id).subscribe({
                next: (response) => {
                    if (response.mikro_fisno > 0) {
                        this.dialogService.alert('Başarılı', 'Fiş başarıyla aktarıldı.');
                        // Listeyi yenile
                        this.currentPage = 1;
                        this.loadHistory();
                    } else {
                        this.dialogService.alert('Hata', 'Fiş aktarımı başarısız oldu.');
                    }
                },
                error: (err) => {
                    console.error('Aktarım hatası:', err);
                    this.dialogService.alert('Hata', 'Fiş aktarımı sırasında bir hata oluştu.');
                }
            });
        }
    }

    logout(): void {
        this.authService.logout();
    }
}
