import { Component, HostListener, OnDestroy, OnInit, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { BarcodeService, BarcodeItem } from '../../services/barcode.service';
import { AuthService } from '../../services/auth.service';
import { CariSearchComponent } from '../cari-search/cari-search.component';
import { Subject, debounceTime } from 'rxjs';

@Component({
    selector: 'app-barcode-scan',
    standalone: true,
    imports: [CommonModule, FormsModule, CariSearchComponent],
    templateUrl: './barcode-scan.component.html',
    styleUrls: ['./barcode-scan.component.css']
})
export class BarcodeScanComponent implements OnInit, OnDestroy {
    @ViewChild('barcodeInput') barcodeInput!: ElementRef<HTMLInputElement>;

    fisno = '';
    date = new Date().toISOString().split('T')[0];
    details: BarcodeItem[] = [];
    currentSession: any = null;

    // Cari Seçimi
    showCariModal = false;
    selectedCari: { cari_kodu: string, cari_isim: string } | null = null;

    // Barkod okuma için
    private barcodeBuffer = '';
    private barcodeSubject = new Subject<string>();
    private lastKeyTime = 0;
    private readonly KEY_TIMEOUT = 500; // ms (Test için artırıldı: Elle yazmaya izin verir)

    editingBarcode: string | null = null;
    editingQuantity = 1;
    editingBarcodeValue = '';

    // Manuel barkod girişi için
    manualBarcode = '';
    manualQuantity = 1;

    constructor(
        public barcodeService: BarcodeService,
        public authService: AuthService,
        private router: Router
    ) {
        // Debounce ile barkod okumayı optimize et
        this.barcodeSubject.pipe(
            debounceTime(50)
        ).subscribe(barcode => {
            this.handleScannedBarcode(barcode);
        });
    }

    ngOnInit(): void {
        // 1. Mevcut session değişikliklerini izle
        this.barcodeService.currentSession$.subscribe(session => {
            this.currentSession = session;
            if (session) {
                this.fisno = session.fisno;
                this.date = session.tarih;
                this.selectedCari = session.cari_kodu ? { cari_kodu: session.cari_kodu, cari_isim: session.cari_isim } : null;
                // Son eklenen en üstte olacak şekilde sırala (Tarihe göre azalan)
                this.details = [...session.details].sort((a, b) => {
                    return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
                });
            } else {
                this.details = [];
            }
        });

        // 2. İlk açılışta fiş no ve tarih bilgisini al
        this.loadNewReceiptDetails();
    }

    private loadNewReceiptDetails(): void {
        this.barcodeService.getInitialReceiptDetails().subscribe(details => {
            // Eğer aktif session yoksa, API'den gelen değerleri kullan
            if (!this.currentSession) {
                this.fisno = details.fisno;
                this.date = details.tarih;
            }
        });
    }

    ngOnDestroy(): void {
        this.barcodeSubject.complete();
    }

    @HostListener('document:keypress', ['$event'])
    handleKeypress(event: KeyboardEvent): void {
        const currentTime = Date.now();

        // Enter tuşu - barkod tamamlandı
        if (event.key === 'Enter') {
            if (this.barcodeBuffer.length > 0) {
                this.barcodeSubject.next(this.barcodeBuffer);
                this.barcodeBuffer = '';
            }
            this.lastKeyTime = 0;
            return;
        }

        // Input alanlarına yazı yazılıyorsa barkod okumayı atla
        const target = event.target as HTMLElement;
        if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
            return;
        }

        // Barkod okuyucu hızlı tuşlara basıyor (< 100ms)
        if (currentTime - this.lastKeyTime > this.KEY_TIMEOUT) {
            this.barcodeBuffer = '';
        }

        this.barcodeBuffer += event.key;
        this.lastKeyTime = currentTime;
    }

    handleScannedBarcode(barcode: string): void {
        if (!barcode || barcode.length < 3) return;

        // Session yoksa oluştur
        if (!this.currentSession) {
            if (!this.fisno) {
                alert('Lütfen fiş numarası girin!');
                return;
            }
            this.barcodeService.startNewSession(this.fisno, this.date, this.selectedCari || undefined);
        }

        this.barcodeService.addBarcode(barcode, 1);
    }

    startSession(): void {
        if (!this.fisno.trim()) {
            alert('Lütfen fiş numarası girin!');
            return;
        }

        // Bekleyenlerde var mı kontrol et
        const pendingSession = this.barcodeService.getPendingSession(this.fisno);
        if (pendingSession) {
            if (confirm('Bu fiş numarası bekleyenler listesinde bulundu. Kaldığınız yerden devam etmek ister misiniz?')) {
                this.barcodeService.resumeSession(pendingSession);
                setTimeout(() => this.focusBarcodeInput(), 100);
                return;
            }
        }

        this.barcodeService.startNewSession(this.fisno, this.date, this.selectedCari || undefined);
        setTimeout(() => this.focusBarcodeInput(), 100);
    }

    addManualBarcode(): void {
        if (!this.manualBarcode.trim()) {
            alert('Lütfen barkod girin!');
            this.focusBarcodeInput();
            return;
        }

        if (this.manualQuantity < 1) {
            alert('Miktar en az 1 olmalıdır!');
            this.focusBarcodeInput();
            return;
        }

        // Session yoksa oluştur
        if (!this.currentSession) {
            if (!this.fisno.trim()) {
                alert('Lütfen önce fiş numarası girin!');
                return;
            }
            this.barcodeService.startNewSession(this.fisno, this.date, this.selectedCari || undefined);
        }

        this.barcodeService.addBarcode(this.manualBarcode.trim(), this.manualQuantity);

        // Form'u temizle
        this.manualBarcode = '';
        this.manualQuantity = 1;
        this.focusBarcodeInput();
    }

    private focusBarcodeInput(): void {
        if (this.barcodeInput) {
            this.barcodeInput.nativeElement.focus();
        }
    }

    editQuantity(item: BarcodeItem): void {
        this.editingBarcode = item.barkod;
        this.editingQuantity = item.miktar;
        this.editingBarcodeValue = item.barkod;
    }

    saveQuantity(oldBarcode: string): void {
        if (this.editingQuantity > 0 && this.editingBarcodeValue.trim()) {
            // Eğer barkod değiştiyse, eski kaydı sil ve yeni ekle
            if (oldBarcode !== this.editingBarcodeValue.trim()) {
                this.barcodeService.removeBarcode(oldBarcode);
                this.barcodeService.addBarcode(this.editingBarcodeValue.trim(), this.editingQuantity);
            } else {
                this.barcodeService.updateBarcodeQuantity(oldBarcode, this.editingQuantity);
            }
        }
        this.cancelEdit();
    }

    cancelEdit(): void {
        this.editingBarcode = null;
        this.editingQuantity = 1;
        this.editingBarcodeValue = '';
        setTimeout(() => this.focusBarcodeInput(), 100);
    }

    increaseQuantity(barcode: string): void {
        const item = this.details.find(i => i.barkod === barcode);
        if (item) {
            this.barcodeService.updateBarcodeQuantity(barcode, item.miktar + 1);
        }
    }

    decreaseQuantity(barcode: string): void {
        const item = this.details.find(i => i.barkod === barcode);
        if (item && item.miktar > 1) {
            this.barcodeService.updateBarcodeQuantity(barcode, item.miktar - 1);
        }
    }

    removeItem(barcode: string): void {
        if (confirm('Bu barkodu silmek istediğinize emin misiniz?')) {
            this.barcodeService.removeBarcode(barcode);
            setTimeout(() => this.focusBarcodeInput(), 100);
        }
    }

    clearAll(): void {
        if (confirm('Tüm listeyi temizlemek istediğinize emin misiniz?')) {
            this.barcodeService.clearSession();
            this.loadNewReceiptDetails();
        }
    }

    saveToPending(): void {
        if (this.details.length === 0) {
            alert('Liste boş!');
            return;
        }
        this.barcodeService.saveToPending();
        alert('Fiş bekleyenler listesine kaydedildi. Yeni fiş girişi yapabilirsiniz.');
        this.loadNewReceiptDetails();
    }

    sendToApi(): void {
        if (this.details.length === 0) {
            alert('Liste boş!');
            return;
        }

        // Session'ı oluştur
        const session: any = {
            fisno: this.fisno,
            tarih: this.date,
            details: this.details
        };

        // Sent listesine kaydet
        this.barcodeService.saveToSent(session);

        // TODO: API'ye gönder
        console.log('API\'ye gönderilecek:', session);

        alert('Başarıyla gönderildi ve geçmişe kaydedildi!');
        this.barcodeService.clearSession();
        this.loadNewReceiptDetails();
    }

    logout(): void {
        this.authService.logout();
    }

    navigateToHistory(): void {
        this.router.navigate(['/history']);
    }

    navigateToPending(): void {
        this.router.navigate(['/pending']);
    }

    openCariModal() {
        this.showCariModal = true;
    }

    closeCariModal() {
        this.showCariModal = false;
    }

    onCariSelected(cari: { cari_kodu: string, cari_isim: string }) {
        this.selectedCari = cari;
        this.barcodeService.updateSessionCari(cari);
        this.closeCariModal();
    }
}
