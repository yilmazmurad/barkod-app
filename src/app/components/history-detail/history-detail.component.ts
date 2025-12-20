import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { ApiService, HistoryDetail } from '../../services/api.service';
import { BarcodeService } from '../../services/barcode.service';

@Component({
    selector: 'app-history-detail',
    standalone: true,
    imports: [CommonModule],
    templateUrl: './history-detail.component.html',
    styleUrls: ['./history-detail.component.css']
})
export class HistoryDetailComponent implements OnInit {
    detail: HistoryDetail | null = null;
    isLoading = true;
    error: string | null = null;

    constructor(
        private route: ActivatedRoute,
        private router: Router,
        private apiService: ApiService,
        private barcodeService: BarcodeService
    ) { }

    ngOnInit(): void {
        const id = this.route.snapshot.paramMap.get('id');
        if (id) {
            this.loadDetail(parseInt(id, 10));
        } else {
            this.error = 'Geçersiz fiş ID';
            this.isLoading = false;
        }
    }

    loadDetail(id: number): void {
        this.isLoading = true;
        this.apiService.getHistoryDetail(id).subscribe({
            next: (data) => {
                this.detail = data;
                this.isLoading = false;
            },
            error: (err) => {
                console.error('Detay yüklenirken hata:', err);
                this.error = 'Fiş detayları yüklenemedi.';
                this.isLoading = false;
            }
        });
    }

    goBack(): void {
        this.router.navigate(['/history']);
    }

    editReceipt(): void {
        if (!this.detail) return;

        if (confirm('Bu fişi düzenlemek için yeni bir oturum başlatılacak. Onaylıyor musunuz?')) {
            // Yeni oturum başlat
            this.barcodeService.startNewSession(
                this.detail.fisno.toString(),
                this.detail.tarih.split('T')[0], // Tarih formatı YYYY-MM-DD olmalı
                {
                    cari_kodu: this.detail.cari_kodu,
                    cari_isim: this.detail.cari_isim
                }
            );

            // Ürünleri ekle
            this.detail.details.forEach(item => {
                this.barcodeService.addBarcode(item.barkod, item.miktar);
            });

            // Scan sayfasına git
            this.router.navigate(['/scan']);
        }
    }
}
