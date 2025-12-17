import { Injectable, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { BehaviorSubject, Observable, of } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { ApiService } from './api.service';

export interface BarcodeItem {
    barcode: string;
    quantity: number;
    timestamp: Date;
    isEdited?: boolean;
}

export interface BarcodeSession {
    fiscNumber: string;
    date: Date;
    items: BarcodeItem[];
    isPending?: boolean;
    cari?: {
        cari_kodu: string;
        cari_isim: string;
    };
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

    getInitialReceiptDetails(): Observable<{ fiscNumber: string, date: string }> {
        // 1. Aktif bir oturum var mı?
        const currentSession = this.currentSessionSubject.value;
        if (currentSession) {
            // Varsa onu döndür
            return of({
                fiscNumber: currentSession.fiscNumber,
                date: new Date(currentSession.date).toISOString().split('T')[0]
            });
        }

        // 2. Yoksa API'den son fiş numarasını al
        return this.apiService.getLastFiscNo().pipe(
            map(response => {
                // Tarih formatını DD.MM.YYYY -> YYYY-MM-DD çevir
                const [day, month, year] = response.tarih.split('.');
                const formattedDate = `${year}-${month}-${day}`;
                return {
                    fiscNumber: response.fisno,
                    date: formattedDate
                };
            }),
            catchError(error => {
                console.error('Fiş no alınamadı:', error);
                // Hata durumunda boş/bugün döndür
                return of({
                    fiscNumber: '',
                    date: new Date().toISOString().split('T')[0]
                });
            })
        );
    }

    private loadCurrentSession(): void {
        if (!this.isBrowser) return;
        const stored = localStorage.getItem('currentSession');
        if (stored) {
            try {
                const session = JSON.parse(stored);
                this.currentSessionSubject.next(session);
            } catch (error) {
                console.error('Error loading current session:', error);
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

    startNewSession(fiscNumber: string, date: Date, cari?: { cari_kodu: string, cari_isim: string }): void {
        const session: BarcodeSession = {
            fiscNumber,
            date,
            items: [],
            cari
        };
        this.currentSessionSubject.next(session);
        this.saveCurrentSession();
    }

    updateSessionCari(cari: { cari_kodu: string, cari_isim: string }): void {
        const session = this.currentSessionSubject.value;
        if (session) {
            session.cari = cari;
            this.currentSessionSubject.next({ ...session });
            this.saveCurrentSession();
        }
    }

    addBarcode(barcode: string, quantity: number = 1): void {
        const session = this.currentSessionSubject.value;
        if (!session) {
            console.warn('No active session');
            return;
        }

        const existingItem = session.items.find(item => item.barcode === barcode);

        if (existingItem) {
            existingItem.quantity += quantity;
            existingItem.timestamp = new Date();
        } else {
            session.items.push({
                barcode,
                quantity,
                timestamp: new Date()
            });
        }

        this.currentSessionSubject.next({ ...session });
        this.saveCurrentSession();
    }

    updateBarcodeQuantity(barcode: string, quantity: number): void {
        const session = this.currentSessionSubject.value;
        if (!session) return;

        const item = session.items.find(i => i.barcode === barcode);
        if (item) {
            item.quantity = quantity;
            item.isEdited = true;
            this.currentSessionSubject.next({ ...session });
            this.saveCurrentSession();
        }
    }

    removeBarcode(barcode: string): void {
        const session = this.currentSessionSubject.value;
        if (!session) return;

        session.items = session.items.filter(item => item.barcode !== barcode);
        this.currentSessionSubject.next({ ...session });
        this.saveCurrentSession();
    }

    clearSession(): void {
        this.currentSessionSubject.next(null);
        this.saveCurrentSession();
    }

    saveToPending(): void {
        const session = this.currentSessionSubject.value;
        if (!session || session.items.length === 0) return;

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
                const sessions = JSON.parse(stored);
                this.pendingSessionsSubject.next(sessions);
            } catch (error) {
                console.error('Error loading pending sessions:', error);
            }
        }
    }

    getPendingSession(fiscNumber: string): BarcodeSession | undefined {
        return this.pendingSessionsSubject.value.find(s => s.fiscNumber === fiscNumber);
    }

    resumeSession(session: BarcodeSession): void {
        this.removePendingSession(session.fiscNumber);
        this.currentSessionSubject.next({ ...session, isPending: false });
        this.saveCurrentSession();
    }

    removePendingSession(fiscNumber: string): void {
        const pending = this.pendingSessionsSubject.value.filter(
            s => s.fiscNumber !== fiscNumber
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
                const sessions = JSON.parse(stored);
                this.sentSessionsSubject.next(sessions);
            } catch (error) {
                console.error('Error loading sent sessions:', error);
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
