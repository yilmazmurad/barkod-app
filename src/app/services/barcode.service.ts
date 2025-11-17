import { Injectable, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { BehaviorSubject, Observable } from 'rxjs';

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
}

@Injectable({
    providedIn: 'root'
})
export class BarcodeService {
    private currentSessionSubject = new BehaviorSubject<BarcodeSession | null>(null);
    public currentSession$ = this.currentSessionSubject.asObservable();

    private pendingSessionsSubject = new BehaviorSubject<BarcodeSession[]>([]);
    public pendingSessions$ = this.pendingSessionsSubject.asObservable();

    private platformId = inject(PLATFORM_ID);
    private isBrowser: boolean;

    constructor() {
        this.isBrowser = isPlatformBrowser(this.platformId);
        this.loadPendingSessions();
    }

    startNewSession(fiscNumber: string, date: Date): void {
        const session: BarcodeSession = {
            fiscNumber,
            date,
            items: []
        };
        this.currentSessionSubject.next(session);
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
    }

    updateBarcodeQuantity(barcode: string, quantity: number): void {
        const session = this.currentSessionSubject.value;
        if (!session) return;

        const item = session.items.find(i => i.barcode === barcode);
        if (item) {
            item.quantity = quantity;
            item.isEdited = true;
            this.currentSessionSubject.next({ ...session });
        }
    }

    removeBarcode(barcode: string): void {
        const session = this.currentSessionSubject.value;
        if (!session) return;

        session.items = session.items.filter(item => item.barcode !== barcode);
        this.currentSessionSubject.next({ ...session });
    }

    clearSession(): void {
        this.currentSessionSubject.next(null);
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
}
