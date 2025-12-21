import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { BarcodeService, BarcodeSession } from '../../services/barcode.service';
import { ExcelService } from '../../services/excel.service';
import { DialogService } from '../../services/dialog.service';

@Component({
    selector: 'app-pending-detail',
    standalone: true,
    imports: [CommonModule],
    templateUrl: './pending-detail.component.html',
    styleUrls: ['./pending-detail.component.css']
})
export class PendingDetailComponent implements OnInit {
    session: BarcodeSession | undefined;
    isSending = false;

    constructor(
        private route: ActivatedRoute,
        private router: Router,
        private barcodeService: BarcodeService,
        private excelService: ExcelService,
        private dialogService: DialogService
    ) { }

    ngOnInit(): void {
        this.route.params.subscribe(params => {
            const fisno = params['fisno'];
            if (fisno) {
                this.loadSessionDetail(fisno);
            }
        });
    }

    loadSessionDetail(fisno: string): void {
        this.session = this.barcodeService.getPendingSession(fisno);
    }

    getTotalQuantity(): number {
        if (!this.session) return 0;
        return this.session.details.reduce((sum, item) => sum + item.miktar, 0);
    }

    goBack(): void {
        this.router.navigate(['/pending']);
    }

    async loadSession(): Promise<void> {
        if (!this.session) return;

        const confirmed = await this.dialogService.confirm(
            'Düzenleme Onayı',
            'Bu kaydı düzenlemek için yüklemek istiyor musunuz?'
        );

        if (confirmed) {
            this.barcodeService.resumeSession(this.session);
            this.router.navigate(['/scan']);
        }
    }

    async deleteSession(): Promise<void> {
        if (!this.session) return;

        const confirmed = await this.dialogService.confirm(
            'Silme Onayı',
            'Bu kaydı silmek istediğinize emin misiniz?',
            'Sil',
            'İptal'
        );

        if (confirmed) {
            this.barcodeService.removePendingSession(this.session.fisno);
            this.router.navigate(['/pending']);
        }
    }

    async sendSession(): Promise<void> {
        if (!this.session || this.isSending) return;

        const confirmed = await this.dialogService.confirm(
            'Gönderim Onayı',
            'Bu fişi göndermek istediğinize emin misiniz?'
        );

        if (confirmed) {
            this.isSending = true;
            this.barcodeService.sendSession(this.session).subscribe({
                next: (response) => {
                    this.barcodeService.removePendingSession(this.session!.fisno);
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
                }
            });
        }
    }

    exportToExcel(): void {
        if (!this.session) return;

        const summary = [
            { label: 'Fiş No', value: this.session.fisno },
            { label: 'Tarih', value: new Date(this.session.tarih).toLocaleString() },
            { label: 'Cari Kodu', value: this.session.cari_kodu || '-' },
            { label: 'Cari Adı', value: this.session.cari_isim || '-' },
            { label: 'Kullanıcı', value: this.session.username || '-' },
            { label: 'Toplam Miktar', value: this.getTotalQuantity() }
        ];

        const columns = [
            { header: 'Barkod', field: 'barkod', type: 'text' as const },
            { header: 'Miktar', field: 'miktar' },
            { header: 'Zaman', field: 'timestamp', format: (row: any) => new Date(row.timestamp).toLocaleString() }
        ];

        this.excelService.exportToCsv(this.session.details, `bekleyen-fis-${this.session.fisno}`, columns, summary);
    }
}
