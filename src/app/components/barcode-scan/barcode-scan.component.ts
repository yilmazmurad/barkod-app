import { Component, HostListener, OnDestroy, OnInit, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { BarcodeService, BarcodeItem } from '../../services/barcode.service';
import { AuthService } from '../../services/auth.service';
import { CariSearchComponent } from '../cari-search/cari-search.component';
import { StokSearchComponent } from '../stok-search/stok-search.component';
import { DialogService } from '../../services/dialog.service';
import { ApiService } from '../../services/api.service';
import { Subject, debounceTime } from 'rxjs';

@Component({
    selector: 'app-barcode-scan',
    standalone: true,
    imports: [CommonModule, FormsModule, CariSearchComponent, StokSearchComponent],
    templateUrl: './barcode-scan.component.html',
    styleUrls: ['./barcode-scan.component.css']
})
export class BarcodeScanComponent implements OnInit, OnDestroy {
    isSending = false;
    @ViewChild('barcodeInput') barcodeInput!: ElementRef<HTMLInputElement>;

    isDetailsOpen = false; // Mobil için varsayılan gizli

    fisno = '';
    date = new Date().toISOString().split('T')[0];
    details: BarcodeItem[] = [];
    currentSession: any = null;

    get activeDetails(): BarcodeItem[] {
        return this.details.filter(item => !(item.is_deleted ?? false));
    }

    // Cari Seçimi
    showCariModal = false;
    selectedCari: { cari_kodu: string, cari_isim: string } | null = null;
    manualCariIsim: string = '';

    // Stok Arama
    showStockModal = false;

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
        private router: Router,
        private dialogService: DialogService,
        private apiService: ApiService
    ) {
        // Debounce ile barkod okumayı optimize et
        this.barcodeSubject.pipe(
            debounceTime(50)
        ).subscribe(barcode => {
            this.handleScannedBarcode(barcode);
        });
    }

    ngOnInit(): void {
        // PC'de detaylar her zaman açık, mobilde session yoksa açık
        const isDesktop = window.innerWidth >= 768;
        this.isDetailsOpen = isDesktop || !this.currentSession;

        // 1. Mevcut session değişikliklerini izle
        this.barcodeService.currentSession$.subscribe(session => {
            this.currentSession = session;
            const isDesktop = window.innerWidth >= 768;
            this.isDetailsOpen = isDesktop || !session;
            if (session) {
                this.fisno = session.fisno;
                this.date = session.tarih;
                if (session.cari_kodu) {
                    this.selectedCari = { cari_kodu: session.cari_kodu, cari_isim: session.cari_isim };
                    this.manualCariIsim = '';
                } else if (session.cari_isim) {
                    this.selectedCari = null;
                    this.manualCariIsim = session.cari_isim;
                } else {
                    this.selectedCari = null;
                    this.manualCariIsim = '';
                }
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
                this.dialogService.alert('Uyarı', 'Lütfen fiş numarası girin!', 'warning');
                return;
            }
            this.barcodeService.startNewSession(this.fisno, this.date, this.selectedCari || undefined);
        }

        this.barcodeService.addBarcode(barcode, 1);
    }

    async startSession(): Promise<void> {
        if (!this.fisno.trim()) {
            this.dialogService.alert('Uyarı', 'Lütfen fiş numarası girin!', 'warning');
            return;
        }

        // Cari zorunlu: Seçili cari yoksa ve manuel isim de boşsa uyarı ver
        if (!this.selectedCari && !this.manualCariIsim.trim()) {
            this.dialogService.alert('Uyarı', 'Lütfen cari seçin veya isim girin!', 'warning');
            return;
        }

        // Bekleyenlerde var mı kontrol et
        const pendingSession = this.barcodeService.getPendingSession(this.fisno);
        if (pendingSession) {
            const confirmed = await this.dialogService.confirm(
                'Devam Et',
                'Bu fiş numarası bekleyenler listesinde bulundu. Kaldığınız yerden devam etmek ister misiniz?'
            );
            if (confirmed) {
                this.barcodeService.resumeSession(pendingSession);
                setTimeout(() => this.focusBarcodeInput(), 100);
                return;
            }
        }

        // Cari rehberden seçildiyse onu kullan, yoksa manuel girilen ismi kullan
        let cari = this.selectedCari
            ? { cari_kodu: this.selectedCari.cari_kodu, cari_isim: this.selectedCari.cari_isim }
            : { cari_kodu: '', cari_isim: this.manualCariIsim.trim() };

        this.barcodeService.startNewSession(this.fisno, this.date, cari);
        setTimeout(() => this.focusBarcodeInput(), 100);
    }

    addManualBarcode(): void {
        if (!this.manualBarcode.trim()) {
            this.dialogService.alert('Uyarı', 'Lütfen barkod girin!', 'warning');
            this.focusBarcodeInput();
            return;
        }

        if (this.manualQuantity < 1) {
            this.dialogService.alert('Uyarı', 'Miktar en az 1 olmalıdır!', 'warning');
            this.focusBarcodeInput();
            return;
        }

        // Session yoksa oluştur
        if (!this.currentSession) {
            if (!this.fisno.trim()) {
                this.dialogService.alert('Uyarı', 'Lütfen önce fiş numarası girin!', 'warning');
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

    // Stok Arama Metodları
    openStockModal() {
        this.showStockModal = true;
    }

    closeStockModal() {
        this.showStockModal = false;
        setTimeout(() => this.focusBarcodeInput(), 100);
    }

    onStockSelected(stock: { stok_kodu: string, stok_adi: string, barkodu: string }) {
        if (stock.barkodu) {
            this.barcodeService.addBarcode(stock.barkodu, 1);
        } else {
            // Barkodu yoksa stok kodunu barkod olarak kullanabiliriz veya uyarı verebiliriz
            // Şimdilik stok kodunu kullanıyoruz
            this.barcodeService.addBarcode(stock.stok_kodu, 1);
        }
        this.closeStockModal();
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

    async removeItem(barcode: string): Promise<void> {
        const confirmed = await this.dialogService.confirm(
            'Silme Onayı',
            'Bu barkodu silmek istediğinize emin misiniz?',
            'Sil',
            'İptal'
        );
        if (confirmed) {
            this.barcodeService.removeBarcode(barcode);
            const item = this.details.find(i => i.barkod?.trim() === barcode?.trim());
            if (item) {
                item.is_deleted = true;
            }
            setTimeout(() => this.focusBarcodeInput(), 100);
        }
    }

    async clearAll(): Promise<void> {
        const confirmed = await this.dialogService.confirm(
            'Temizleme Onayı',
            'Tüm listeyi temizlemek istediğinize emin misiniz?',
            'Temizle',
            'İptal'
        );
        if (confirmed) {
            this.barcodeService.clearSession();
            this.selectedCari = null;
            this.manualCariIsim = '';
            this.loadNewReceiptDetails();
        }
    }

    saveToPending(): void {
        if (this.activeDetails.length === 0) {
            this.dialogService.alert('Uyarı', 'Liste boş!', 'warning');
            return;
        }
        this.barcodeService.saveToPending();
        this.dialogService.alert('Başarılı', 'Fiş bekleyenler listesine kaydedildi. Yeni fiş girişi yapabilirsiniz.', 'success');
        this.loadNewReceiptDetails();
    }

    sendToApi(): void {
        if (this.activeDetails.length === 0) {
            this.dialogService.alert('Uyarı', 'Liste boş!', 'warning');
            return;
        }




        const detailsWithSirano = this.details.map((item, idx) => ({
            ...item,
            sirano: item.sirano ?? (idx + 1),
            okumadetay_id: item.okumadetay_id ?? 0,
            okuma_id: item.okuma_id ?? 0,
            stok_kodu: item.stok_kodu ?? '',
            stok_adi: item.stok_adi ?? '',
            fiyat: item.fiyat ?? 0,
            tutar: item.tutar ?? 0,
            is_bulundu: item.is_bulundu ?? false,
            is_aktarildi: item.is_aktarildi ?? false,
            is_new: item.is_new ?? true,
            is_deleted: item.is_deleted ?? false
        }));

        // Cari isim önceliği: seçili cari varsa onu, yoksa manuel girileni kullan
        const session: any = {
            fisno: Number(this.fisno),
            tarih: this.date,
            details: detailsWithSirano,
            username: this.authService.currentUserValue?.username || '',
            user_id: this.authService.currentUserValue?.userid || null,
            cari_kodu: this.selectedCari?.cari_kodu || '',
            cari_isim: this.selectedCari?.cari_isim || this.manualCariIsim || '',
            toplam_adet: this.activeDetails.reduce((sum, item) => sum + item.miktar, 0),
            toplam_tutar: this.activeDetails.reduce((sum, item) => sum + (item.tutar ?? 0), 0),
            is_aktarildi: this.currentSession?.is_aktarildi ?? "H",
            is_new: this.currentSession?.is_new ?? true,
            mikro_fisno: 0,
            mikro_fisseri: '',
            okuma_id: this.currentSession?.okuma_id ?? 0
        };

        this.isSending = true;
        this.apiService.saveReceipt(session).subscribe({
            next: () => {
                this.isSending = false;
                this.dialogService.alert('Başarılı', 'Başarıyla gönderildi ve geçmişe kaydedildi!', 'success');
                this.barcodeService.clearSession();
                this.selectedCari = null;
                this.manualCariIsim = '';
                this.loadNewReceiptDetails();
            },
            error: (err) => {
                this.isSending = false;
                this.dialogService.alert('Hata', 'API\'ye gönderilemedi: ' + (err?.message || 'Bilinmeyen hata'), 'error');
            }
        });
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
        this.manualCariIsim = '';
        this.barcodeService.updateSessionCari(cari);
        this.closeCariModal();
    }

    toggleDetails() {
        this.isDetailsOpen = !this.isDetailsOpen;
    }
}
