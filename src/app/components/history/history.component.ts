import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Subject } from 'rxjs';
import { debounceTime } from 'rxjs/operators';
import { ApiService } from '../../services/api.service';
import { AuthService } from '../../services/auth.service';

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

    filters = {
        fisno: '',
        tarih: '',
        cari_kodu: '',
        cari_isim: '',
        genel_arama: ''
    };

    private searchSubject = new Subject<void>();

    constructor(
        private apiService: ApiService,
        public authService: AuthService,
        private router: Router
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
                const items = data || [];
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
                (item.cari_kodu && item.cari_kodu.toLowerCase().includes(searchLower))
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
