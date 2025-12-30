import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { ApiService, HistoryDetail } from '../../services/api.service';
import { BarcodeService } from '../../services/barcode.service';
import { ExcelService } from '../../services/excel.service';
import { DialogService } from '../../services/dialog.service';
import { Console } from 'console';

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

    get canTransfer(): boolean {
        return this.detail ? this.detail.is_aktarildi === 'H' : false;
    }

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
        console.log('User confirmed editReceipt:', this.detail);
        if (confirmed) {
            // Tüm fiş bilgilerini session'a aktar
            const session = {
                fisno: this.detail.fisno.toString(),
                tarih: this.detail.tarih.split('T')[0],
                cari_kodu: this.detail.cari_kodu,
                cari_isim: this.detail.cari_isim,
                username: this.detail.username,
                user_id: this.detail.user_id,
                is_aktarildi: this.detail.is_aktarildi,
                toplam_adet: this.detail.toplam_adet,
                toplam_tutar: this.detail.toplam_tutar,
                is_new: this.detail.is_new,
                mikro_fisno: this.detail.mikro_fisno,
                mikro_fisseri: this.detail.mikro_fisseri,
                okuma_id: this.detail.okuma_id,
                details: this.detail.details.map(item => ({
                    barkod: item.barkod,
                    miktar: item.miktar,
                    timestamp: new Date(),
                    sirano: item.sirano,
                    okumadetay_id: item.okumadetay_id,
                    okuma_id: item.okuma_id,
                    stok_kodu: item.stok_kodu,
                    stok_adi: item.stok_adi,
                    fiyat: item.fiyat,
                    tutar: item.tutar,
                    is_bulundu: item.is_bulundu,
                    is_aktarildi: item.is_aktarildi,
                    is_new: item.is_new,
                    is_deleted: item.is_deleted
                }))
            };
            this.barcodeService.setSession(session);
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
        this.excelService.exportToExcel(this.detail.details, fileName, columns, summary, 'xlsx');
    }

    async transferReceipt(): Promise<void> {
        if (!this.detail || this.detail.is_aktarildi !== 'H') return;

        // Ürün eksikliği kontrolü: Tüm detaylarda is_bulundu true olmalı
        const allProductsFound = this.detail.details.every(item => item.is_bulundu === true);
        const productsMissing = !allProductsFound;

        // Cari kodu kontrolü
        const cariMissing = !this.detail.cari_kodu || this.detail.cari_kodu.trim() === '';

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
            `Fiş No: ${this.detail.fisno} - Aktarmak istediğinizden emin misiniz?`
        );

        if (confirmed) {
            this.apiService.transferReceipt(this.detail.okuma_id).subscribe({
                next: (response) => {
                    if (response.mikro_fisno > 0) {
                        this.dialogService.alert('Başarılı', 'Fiş başarıyla aktarıldı.');
                        // Detayı yenile
                        this.loadDetail(this.detail!.okuma_id);
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
}
