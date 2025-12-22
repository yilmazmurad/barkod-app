import { Injectable, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { BehaviorSubject, Observable, of } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { ApiService } from './api.service';
import { AuthService } from './auth.service';

export interface BarcodeItem {
    barkod: string;
    miktar: number;
    timestamp: Date;
    isEdited?: boolean;
    sirano?: number;
    // API detay alanları
    okumadetay_id?: number;
    okuma_id?: number;
    stok_kodu?: string;
    stok_adi?: string;
    fiyat?: number;
    tutar?: number;
    is_bulundu?: boolean;
    is_aktarildi?: boolean;
    is_new?: boolean;
    is_deleted?: boolean;
}

export interface BarcodeSession {
    fisno: string;
    tarih: string;
    cari_kodu: string;
    cari_isim: string;
    username?: string;
    details: BarcodeItem[];
    isPending?: boolean;
    // API ana alanlar
    okuma_id?: number;
    user_id?: number;
    is_aktarildi?: string;
    toplam_adet?: number;
    toplam_tutar?: number;
    is_new?: boolean;
    mikro_fisno?: number;
    mikro_fisseri?: string;
}

@Injectable({
    providedIn: 'root'
})
export class BarcodeService {
    /**
     * Dışarıdan session set etmek için public fonksiyon
     */
    public setSession(session: BarcodeSession): void {
        this.currentSessionSubject.next(session);
        this.saveCurrentSession();
    }
    private currentSessionSubject = new BehaviorSubject<BarcodeSession | null>(null);
    public currentSession$ = this.currentSessionSubject.asObservable();

    private pendingSessionsSubject = new BehaviorSubject<BarcodeSession[]>([]);
    public pendingSessions$ = this.pendingSessionsSubject.asObservable();

    private sentSessionsSubject = new BehaviorSubject<BarcodeSession[]>([]);
    public sentSessions$ = this.sentSessionsSubject.asObservable();

    private platformId = inject(PLATFORM_ID);
    private isBrowser: boolean;

    constructor(
        private apiService: ApiService,
        private authService: AuthService
    ) {
        this.isBrowser = isPlatformBrowser(this.platformId);
        this.loadPendingSessions();
        this.loadSentSessions();
        this.loadCurrentSession();
    }

    getInitialReceiptDetails(): Observable<{ fisno: string, tarih: string }> {
        // 1. Aktif bir oturum var mı?
        const currentSession = this.currentSessionSubject.value;
        if (currentSession) {
            // Varsa onu döndür
            return of({
                fisno: currentSession.fisno,
                tarih: currentSession.tarih
            });
        }

        // 2. Yoksa API'den son fiş numarasını al
        return this.apiService.getLastFiscNo().pipe(
            map(response => {
                // Tarih formatını DD.MM.YYYY -> YYYY-MM-DD çevir
                const [day, month, year] = response.tarih.split('.');
                const formattedDate = `${year}-${month}-${day}`;

                // Fiş numarası hesaplama: API'den gelen ile bekleyenlerdeki en büyük numarayı karşılaştır
                let nextFisNo = parseInt(response.fisno) || 0;

                const pendingSessions = this.pendingSessionsSubject.value;
                if (pendingSessions.length > 0) {
                    const maxPendingFisNo = Math.max(...pendingSessions.map(s => parseInt(s.fisno) || 0));
                    if (maxPendingFisNo >= nextFisNo) {
                        nextFisNo = maxPendingFisNo + 1;
                    }
                }

                return {
                    fisno: nextFisNo.toString(),
                    tarih: formattedDate
                };
            }),
            catchError(error => {
                console.error('Fiş no alınamadı:', error);
                // Hata durumunda boş/bugün döndür
                return of({
                    fisno: '',
                    tarih: new Date().toISOString().split('T')[0]
                });
            })
        );
    }

    private loadCurrentSession(): void {
        if (!this.isBrowser) return;
        const stored = localStorage.getItem('currentSession');
        if (stored) {
            try {
                let session = JSON.parse(stored);

                // Migration
                if (session.items && !session.details) {
                    session = {
                        fisno: session.fiscNumber || session.fisno,
                        tarih: session.date || session.tarih,
                        cari_kodu: session.cari_kodu || '',
                        cari_isim: session.cari_isim || '',
                        details: session.items.map((i: any) => ({
                            barkod: i.barcode || i.barkod,
                            miktar: i.quantity || i.miktar,
                            timestamp: i.timestamp,
                            isEdited: i.isEdited
                        })),
                        isPending: session.isPending
                    };
                }

                if (!session.username) {
                    session.username = this.authService.currentUserValue?.username || '';
                }

                this.currentSessionSubject.next(session);
            } catch (error) {
                console.error('Error loading current session:', error);
                localStorage.removeItem('currentSession');
            }
        }
    }

    private saveCurrentSession(): void {
        if (!this.isBrowser) return;
        const session = this.currentSessionSubject.value;
        if (session) {
            localStorage.setItem('currentSession', JSON.stringify(session));
        } else {
            localStorage.removeItem('currentSession');
        }
    }

    startNewSession(fisno: string, tarih: string, cari?: { cari_kodu: string, cari_isim: string }): void {
        const user = this.authService.currentUserValue;
        const session: BarcodeSession = {
            fisno,
            tarih,
            details: [],
            cari_kodu: cari?.cari_kodu || '',
            cari_isim: cari?.cari_isim || '',
            username: user?.username || ''
        };
        this.currentSessionSubject.next(session);
        this.saveCurrentSession();
    }

    updateSessionCari(cari: { cari_kodu: string, cari_isim: string }): void {
        const session = this.currentSessionSubject.value;
        if (session) {
            session.cari_kodu = cari.cari_kodu;
            session.cari_isim = cari.cari_isim;
            this.currentSessionSubject.next({ ...session });
            this.saveCurrentSession();
        }
    }

    addBarcode(barkod: string, miktar: number = 1): void {
        const session = this.currentSessionSubject.value;
        if (!session) {
            console.warn('No active session');
            return;
        }

        const existingItem = session.details.find(item => item.barkod === barkod);

        if (existingItem) {
            existingItem.miktar += miktar;
            existingItem.timestamp = new Date();
        } else {
            session.details.push({
                barkod,
                miktar,
                timestamp: new Date()
            });
        }

        this.currentSessionSubject.next({ ...session });
        this.saveCurrentSession();
    }

    updateBarcodeQuantity(barkod: string, miktar: number): void {
        const session = this.currentSessionSubject.value;
        if (!session) return;

        const item = session.details.find(i => i.barkod === barkod);
        if (item) {
            item.miktar = miktar;
            item.isEdited = true;
            this.currentSessionSubject.next({ ...session });
            this.saveCurrentSession();
        }
    }

    removeBarcode(barkod: string): void {
        const session = this.currentSessionSubject.value;
        if (!session) return;

        session.details = session.details.filter(item => item.barkod !== barkod);
        this.currentSessionSubject.next({ ...session });
        this.saveCurrentSession();
    }

    clearSession(): void {
        this.currentSessionSubject.next(null);
        this.saveCurrentSession();
    }

    saveToPending(): void {
        const session = this.currentSessionSubject.value;
        if (!session || session.details.length === 0) return;

        if (!session.username) {
            session.username = this.authService.currentUserValue?.username || '';
        }

        session.isPending = true;
        const pending = this.pendingSessionsSubject.value;
        pending.push({ ...session });
        this.pendingSessionsSubject.next(pending);

        // Local storage'a kaydet
        if (this.isBrowser) {
            localStorage.setItem('pendingSessions', JSON.stringify(pending));
        }

        this.clearSession();
    }

    private loadPendingSessions(): void {
        if (!this.isBrowser) return;

        const stored = localStorage.getItem('pendingSessions');
        if (stored) {
            try {
                let sessions = JSON.parse(stored);

                // Migration: Old format to New format
                sessions = sessions.map((s: any) => {
                    if (s.items && !s.details) {
                        return {
                            fisno: s.fiscNumber || s.fisno,
                            tarih: s.date || s.tarih,
                            cari_kodu: s.cari_kodu || '',
                            cari_isim: s.cari_isim || '',
                            username: s.username || this.authService.currentUserValue?.username || '',
                            user_id: s.user_id || this.authService.currentUserValue?.userid,
                            is_aktarildi: s.is_aktarildi || 'H',
                            toplam_adet: s.toplam_adet || (s.items ? s.items.reduce((sum: number, i: any) => sum + (i.quantity || i.miktar || 0), 0) : 0),
                            toplam_tutar: s.toplam_tutar || 0,
                            is_new: s.is_new !== undefined ? s.is_new : true,
                            mikro_fisno: s.mikro_fisno || 0,
                            mikro_fisseri: s.mikro_fisseri || '',
                            okuma_id: s.okuma_id || 0,
                            details: s.items.map((i: any) => ({
                                barkod: i.barcode || i.barkod,
                                miktar: i.quantity || i.miktar,
                                timestamp: i.timestamp,
                                sirano: i.sirano || 0,
                                okumadetay_id: i.okumadetay_id || 0,
                                okuma_id: i.okuma_id || s.okuma_id || 0,
                                stok_kodu: i.stok_kodu || '',
                                stok_adi: i.stok_adi || '',
                                fiyat: i.fiyat || 0,
                                tutar: i.tutar || 0,
                                is_bulundu: i.is_bulundu !== undefined ? i.is_bulundu : false,
                                is_aktarildi: i.is_aktarildi !== undefined ? i.is_aktarildi : false,
                                is_new: i.is_new !== undefined ? i.is_new : true,
                                is_deleted: i.is_deleted !== undefined ? i.is_deleted : false,
                                isEdited: i.isEdited
                            })),
                            isPending: s.isPending
                        };
                    }

                    // Mevcut format için eksik alanları doldur
                    if (!s.username) {
                        s.username = this.authService.currentUserValue?.username || '';
                    }
                    if (!s.user_id) {
                        s.user_id = this.authService.currentUserValue?.userid;
                    }
                    if (!s.is_aktarildi) {
                        s.is_aktarildi = 'H';
                    }
                    if (!s.toplam_adet) {
                        s.toplam_adet = s.details ? s.details.reduce((sum: number, item: any) => sum + item.miktar, 0) : 0;
                    }
                    if (!s.toplam_tutar) {
                        s.toplam_tutar = 0;
                    }
                    if (s.is_new === undefined) {
                        s.is_new = true;
                    }
                    if (!s.mikro_fisno) {
                        s.mikro_fisno = 0;
                    }
                    if (!s.mikro_fisseri) {
                        s.mikro_fisseri = '';
                    }
                    if (!s.okuma_id) {
                        s.okuma_id = 0;
                    }

                    // Details içindeki eksik alanları doldur
                    if (s.details) {
                        s.details = s.details.map((item: any) => ({
                            barkod: item.barkod,
                            miktar: item.miktar,
                            timestamp: item.timestamp,
                            sirano: item.sirano || 0,
                            okumadetay_id: item.okumadetay_id || 0,
                            okuma_id: item.okuma_id || s.okuma_id || 0,
                            stok_kodu: item.stok_kodu || '',
                            stok_adi: item.stok_adi || '',
                            fiyat: item.fiyat || 0,
                            tutar: item.tutar || 0,
                            is_bulundu: item.is_bulundu !== undefined ? item.is_bulundu : false,
                            is_aktarildi: item.is_aktarildi !== undefined ? item.is_aktarildi : false,
                            is_new: item.is_new !== undefined ? item.is_new : true,
                            is_deleted: item.is_deleted !== undefined ? item.is_deleted : false,
                            isEdited: item.isEdited
                        }));
                    }

                    return s;
                });

                this.pendingSessionsSubject.next(sessions);
            } catch (error) {
                console.error('Error loading pending sessions:', error);
                // Hata durumunda local storage'ı temizle ki uygulama çökmesin
                localStorage.removeItem('pendingSessions');
                this.pendingSessionsSubject.next([]);
            }
        }
    }

    getPendingSession(fisno: string): BarcodeSession | undefined {
        return this.pendingSessionsSubject.value.find(s => s.fisno === fisno);
    }

    resumeSession(session: BarcodeSession): void {
        this.removePendingSession(session.fisno);

        // Eksik alanları doldur (geçmişten düzenleme gibi)
        const completeSession: BarcodeSession = {
            fisno: session.fisno,
            tarih: session.tarih,
            cari_kodu: session.cari_kodu || '',
            cari_isim: session.cari_isim || '',
            username: session.username || this.authService.currentUserValue?.username || '',
            user_id: session.user_id || this.authService.currentUserValue?.userid,
            is_aktarildi: session.is_aktarildi || 'H',
            toplam_adet: session.toplam_adet || session.details.reduce((sum, item) => sum + item.miktar, 0),
            toplam_tutar: session.toplam_tutar || 0,
            is_new: session.is_new !== undefined ? session.is_new : true,
            mikro_fisno: session.mikro_fisno || 0,
            mikro_fisseri: session.mikro_fisseri || '',
            okuma_id: session.okuma_id || 0,
            details: session.details.map(item => ({
                barkod: item.barkod,
                miktar: item.miktar,
                timestamp: item.timestamp,
                sirano: item.sirano || 0,
                okumadetay_id: item.okumadetay_id || 0,
                okuma_id: item.okuma_id || session.okuma_id || 0,
                stok_kodu: item.stok_kodu || '',
                stok_adi: item.stok_adi || '',
                fiyat: item.fiyat || 0,
                tutar: item.tutar || 0,
                is_bulundu: item.is_bulundu !== undefined ? item.is_bulundu : false,
                is_aktarildi: item.is_aktarildi !== undefined ? item.is_aktarildi : false,
                is_new: item.is_new !== undefined ? item.is_new : true,
                is_deleted: item.is_deleted !== undefined ? item.is_deleted : false,
                isEdited: item.isEdited
            })),
            isPending: false
        };

        this.currentSessionSubject.next(completeSession);
        this.saveCurrentSession();
    }

    removePendingSession(fisno: string): void {
        const pending = this.pendingSessionsSubject.value.filter(
            s => s.fisno !== fisno
        );
        this.pendingSessionsSubject.next(pending);
        if (this.isBrowser) {
            localStorage.setItem('pendingSessions', JSON.stringify(pending));
        }
    }

    clearPendingSessions(): void {
        this.pendingSessionsSubject.next([]);
        if (this.isBrowser) {
            localStorage.removeItem('pendingSessions');
        }
    }

    saveToSent(session: BarcodeSession): void {
        const sent = this.sentSessionsSubject.value;
        session.isPending = false;
        sent.push({ ...session });
        this.sentSessionsSubject.next(sent);

        if (this.isBrowser) {
            localStorage.setItem('sentSessions', JSON.stringify(sent));
        }
    }

    private loadSentSessions(): void {
        if (!this.isBrowser) return;

        const stored = localStorage.getItem('sentSessions');
        if (stored) {
            try {
                let sessions = JSON.parse(stored);

                // Migration
                sessions = sessions.map((s: any) => {
                    if (s.items && !s.details) {
                        return {
                            fisno: s.fiscNumber || s.fisno,
                            tarih: s.date || s.tarih,
                            cari_kodu: s.cari_kodu || '',
                            cari_isim: s.cari_isim || '',
                            details: s.items.map((i: any) => ({
                                barkod: i.barcode || i.barkod,
                                miktar: i.quantity || i.miktar,
                                timestamp: i.timestamp,
                                isEdited: i.isEdited
                            })),
                            isPending: s.isPending
                        };
                    }
                    return s;
                });

                this.sentSessionsSubject.next(sessions);
            } catch (error) {
                console.error('Error loading sent sessions:', error);
                localStorage.removeItem('sentSessions');
            }
        }
    }

    clearSentSessions(): void {
        this.sentSessionsSubject.next([]);
        if (this.isBrowser) {
            localStorage.removeItem('sentSessions');
        }
    }

    sendSession(session: BarcodeSession): Observable<any> {
        const user = this.authService.currentUserValue;

        // Düzenleme mi, yeni mi?
        const isEdit = !!session.okuma_id || !!session.mikro_fisno || !!session.mikro_fisseri;

        const requestData = {
            okuma_id: isEdit ? session.okuma_id ?? 0 : 0,
            fisno: Number(session.fisno) || 0,
            tarih: session.tarih.includes('T') ? session.tarih : `${session.tarih}T00:00:00`,
            cari_kodu: session.cari_kodu || "",
            cari_isim: session.cari_isim || "",
            user_id: session.user_id ?? 1,
            username: user?.username || session.username || "",
            is_aktarildi: session.is_aktarildi ?? "H",
            toplam_adet: session.details.reduce((sum, item) => sum + item.miktar, 0),
            toplam_tutar: session.toplam_tutar ?? 0,
            is_new: !isEdit,
            mikro_fisno: session.mikro_fisno ?? 0,
            mikro_fisseri: session.mikro_fisseri ?? "",
            details: session.details.map((item, index) => ({
                okumadetay_id: item.okumadetay_id ?? 0,
                okuma_id: item.okuma_id ?? (isEdit ? session.okuma_id ?? 0 : 0),
                sirano: item.sirano ?? (index + 1),
                barkod: item.barkod,
                stok_kodu: item.stok_kodu ?? "",
                stok_adi: item.stok_adi ?? "",
                miktar: item.miktar,
                fiyat: item.fiyat ?? 0,
                tutar: item.tutar ?? 0,
                is_bulundu: item.is_bulundu ?? false,
                is_aktarildi: item.is_aktarildi ?? false,
                is_new: item.is_new ?? !isEdit,
                is_deleted: item.is_deleted ?? false
            }))
        };
        console.log('Sending session data:', requestData);
        return this.apiService.saveReceipt(requestData);
    }
}
