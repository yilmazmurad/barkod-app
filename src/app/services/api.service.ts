import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { AuthService } from './auth.service';
import { ConfigService } from './config.service';

export interface HistoryDetailItem {
    okumadetay_id: number;
    okuma_id: number;
    sirano: number;
    barkod: string;
    stok_kodu: string;
    stok_adi: string;
    miktar: number;
    fiyat: number;
    tutar: number;
    is_bulundu: boolean;
    is_aktarildi: boolean;
    is_new: boolean;
    is_deleted: boolean;
}

export interface HistoryDetail {
    okuma_id: number;
    fisno: number;
    tarih: string;
    cari_kodu: string;
    cari_isim: string;
    user_id: number;
    username: string;
    is_aktarildi: string;
    toplam_adet: number;
    toplam_tutar: number;
    is_new: boolean;
    mikro_fisno: number;
    mikro_fisseri: string;
    details: HistoryDetailItem[];
}

@Injectable({
    providedIn: 'root'
})
export class ApiService {

    constructor(
        private http: HttpClient,
        private authService: AuthService,
        private configService: ConfigService
    ) { }

    private get apiUrl(): string {
        return this.configService.getApiUrl();
    }

    private getHeaders(): HttpHeaders {
        const token = this.authService.token;
        return new HttpHeaders({
            'Content-Type': 'application/json',
            ...(token && { 'Authorization': `Bearer ${token}` })
        });
    }

    getLastFiscNo(): Observable<{ fisno: string, tarih: string }> {
        return this.get<{ fisno: string, tarih: string }>('stok/sonfisno');
    }

    searchCari(searchField: 'cari_isim' | 'cari_kod', searchString: string): Observable<any[]> {
        return this.post<any[]>('stok/carisearch', {
            search_field: searchField,
            search_string: searchString
        });
    }

    searchStock(searchField: 'stok_adi' | 'stok_kodu' | 'barkodu', searchString: string): Observable<any[]> {
        return this.post<any[]>('stok/stoksearch', {
            search_field: searchField,
            search_string: searchString
        });
    }

    getHistory(page: number, pageSize: number, filters: any = {}): Observable<any[]> {
        return this.post<any[]>('stok/okumafisiliste', {
            sayfano: page,
            satirsayi: pageSize,
            ...filters
        });
    }

    getHistoryDetail(okumaId: number): Observable<HistoryDetail> {
        return this.post<HistoryDetail>('stok/okumafisigetir', {
            okuma_id: okumaId
        });
    }

    transferReceipt(okumaId: number): Observable<{ mikro_fisno: number }> {
        return this.post<{ mikro_fisno: number }>('stok/mikroyagonder', {
            okuma_id: okumaId
        });
    }

    saveReceipt(data: any): Observable<HistoryDetail> {
        return this.post<HistoryDetail>('stok/okumafisikaydet', data);
    }

    get<T>(endpoint: string): Observable<T> {
        return this.http.get<T>(`${this.apiUrl}/${endpoint}`, {
            headers: this.getHeaders()
        }).pipe(
            catchError(this.handleError)
        );
    }

    post<T>(endpoint: string, data: any): Observable<T> {
        return this.http.post<T>(`${this.apiUrl}/${endpoint}`, data, {
            headers: this.getHeaders()
        }).pipe(
            catchError(this.handleError)
        );
    }

    put<T>(endpoint: string, data: any): Observable<T> {
        return this.http.put<T>(`${this.apiUrl}/${endpoint}`, data, {
            headers: this.getHeaders()
        }).pipe(
            catchError(this.handleError)
        );
    }

    delete<T>(endpoint: string): Observable<T> {
        return this.http.delete<T>(`${this.apiUrl}/${endpoint}`, {
            headers: this.getHeaders()
        }).pipe(
            catchError(this.handleError)
        );
    }

    private handleError(error: any) {
        console.error('API Error:', error);
        return throwError(() => error);
    }
}
