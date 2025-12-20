import { Injectable, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { BehaviorSubject, Observable, of } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { ApiService } from './api.service';

export interface BarcodeItem {
    barkod: string;
    miktar: number;
    timestamp: Date;
    isEdited?: boolean;
}

export interface BarcodeSession {
    fisno: string;
    tarih: string;
    cari_kodu: string;
    cari_isim: string;
    details: BarcodeItem[];
    isPending?: boolean;
}

@Injectable({
    providedIn: 'root'
})
export class BarcodeService {
    private currentSessionSubject = new BehaviorSubject<BarcodeSession | null>(null);
    public currentSession$ = this.currentSessionSubject.asObservable();

    private pendingSessionsSubject = new BehaviorSubject<BarcodeSession[]>([]);
    public pendingSessions$ = this.pendingSessionsSubject.asObservable();

    private sentSessionsSubject = new BehaviorSubject<BarcodeSession[]>([]);
    public sentSessions$ = this.sentSessionsSubject.asObservable();

    private platformId = inject(PLATFORM_ID);
    private isBrowser: boolean;

    constructor(private apiService: ApiService) {
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
        const session: BarcodeSession = {
            fisno,
            tarih,
            details: [],
            cari_kodu: cari?.cari_kodu || '',
            cari_isim: cari?.cari_isim || ''
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
        this.currentSessionSubject.next({ ...session, isPending: false });
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
}
