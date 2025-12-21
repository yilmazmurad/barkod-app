import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { ApiService, HistoryDetail } from '../../services/api.service';
import { BarcodeService } from '../../services/barcode.service';
import { ExcelService } from '../../services/excel.service';
import { DialogService } from '../../services/dialog.service';

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
        private barcodeService: BarcodeService,
        private excelService: ExcelService,
        private dialogService: DialogService
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

    async editReceipt(): Promise<void> {
        if (!this.detail) return;

        const confirmed = await this.dialogService.confirm(
            'Düzenleme Onayı',
            'Bu fişi düzenlemek için yeni bir oturum başlatılacak. Onaylıyor musunuz?'
        );

        if (confirmed) {
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

    exportToExcel(): void {
        if (!this.detail || !this.detail.details) return;

        const summary = [
            { label: 'Fiş No', value: this.detail.fisno },
            { label: 'Tarih', value: new Date(this.detail.tarih).toLocaleString() },
            { label: 'Cari Kodu', value: this.detail.cari_kodu || '-' },
            { label: 'Cari Adı', value: this.detail.cari_isim || '-' },
            { label: 'Kullanıcı', value: this.detail.username || '-' },
            { label: 'Toplam Adet', value: this.detail.toplam_adet },
            { label: 'Toplam Tutar', value: this.detail.toplam_tutar }
        ];

        const columns = [
            { header: 'Barkod', field: 'barkod', type: 'text' as const },
            { header: 'Ürün Adı', field: 'stok_adi', format: (row: any) => row.stok_adi || '-' },
            { header: 'Miktar', field: 'miktar' },
            { header: 'Birim Fiyat', field: 'fiyat' },
            { header: 'Tutar', field: 'tutar' }
        ];

        const fileName = `Fis_Detay_${this.detail.fisno}_${new Date().toISOString().split('T')[0]}`;
        this.excelService.exportToCsv(this.detail.details, fileName, columns, summary);
    }
}
