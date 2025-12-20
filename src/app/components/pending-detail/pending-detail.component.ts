import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { BarcodeService, BarcodeSession } from '../../services/barcode.service';

@Component({
    selector: 'app-pending-detail',
    standalone: true,
    imports: [CommonModule],
    templateUrl: './pending-detail.component.html',
    styleUrls: ['./pending-detail.component.css']
})
export class PendingDetailComponent implements OnInit {
    session: BarcodeSession | undefined;

    constructor(
        private route: ActivatedRoute,
        private router: Router,
        private barcodeService: BarcodeService
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

    loadSession(): void {
        if (!this.session) return;

        if (confirm('Bu kaydı düzenlemek için yüklemek istiyor musunuz?')) {
            this.barcodeService.resumeSession(this.session);
            this.router.navigate(['/scan']);
        }
    }

    deleteSession(): void {
        if (!this.session) return;

        if (confirm('Bu kaydı silmek istediğinize emin misiniz?')) {
            this.barcodeService.removePendingSession(this.session.fisno);
            this.router.navigate(['/pending']);
        }
    }
}
