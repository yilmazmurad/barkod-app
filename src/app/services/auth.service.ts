import { Injectable, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Router } from '@angular/router';
import { BehaviorSubject, Observable } from 'rxjs';
import { HttpClient } from '@angular/common/http';
import { map } from 'rxjs/operators';
import { ConfigService } from './config.service';

export interface User {
    username: string;
    token: string;
    userid: number;
}

@Injectable({
    providedIn: 'root'
})
export class AuthService {
    private currentUserSubject: BehaviorSubject<User | null>;
    public currentUser: Observable<User | null>;
    private platformId = inject(PLATFORM_ID);
    private isBrowser: boolean;

    constructor(
        private router: Router,
        private http: HttpClient,
        private configService: ConfigService
    ) {
        this.isBrowser = isPlatformBrowser(this.platformId);
        let storedUser: string | null = null;

        if (this.isBrowser) {
            storedUser = localStorage.getItem('currentUser');

            this.checkAutoLogout();
        }

        this.currentUserSubject = new BehaviorSubject<User | null>(
            storedUser ? JSON.parse(storedUser) : null
        );
        this.currentUser = this.currentUserSubject.asObservable();

        // Her sayfa yüklemesinde veya servis başlatıldığında aktiviteyi güncelle
        if (this.isBrowser) {
            window.addEventListener('click', () => this.updateLastActivity());
            window.addEventListener('keydown', () => this.updateLastActivity());
        }
    }
    // Son aktiviteyi kaydet
    private updateLastActivity() {
        if (this.isBrowser && this.isAuthenticated()) {
            localStorage.setItem('lastActivity', Date.now().toString());
        }
    }

    // Otomatik logout kontrolü (1 saat)
    private checkAutoLogout() {
        if (!this.isBrowser) return;
        const lastActivity = localStorage.getItem('lastActivity');
        if (lastActivity) {
            const diff = Date.now() - parseInt(lastActivity, 10);
            const oneHour = 60 * 60 * 1000;
            if (diff > oneHour) {
                this.logout();
            }
        }
    }

    public get currentUserValue(): User | null {
        return this.currentUserSubject.value;
    }

    public get token(): string | null {
        return this.currentUserValue?.token || null;
    }

    login(username: string, password: string): Observable<User> {
        return this.http.post<any>(`${this.configService.getApiUrl()}/auth/login`, { username, password })
            .pipe(map(response => {
                if (response.success) {
                    const user: User = {
                        username: response.adisoyadi,
                        token: response.token,
                        userid: response.userid
                    };

                    if (this.isBrowser) {
                        localStorage.setItem('currentUser', JSON.stringify(user));
                        localStorage.setItem('lastActivity', Date.now().toString());
                    }
                    this.currentUserSubject.next(user);
                    return user;
                } else {
                    throw new Error(response.message || 'Giriş başarısız');
                }
            }));
    }

    logout(): void {
        if (this.isBrowser) {
            localStorage.removeItem('currentUser');
            localStorage.removeItem('lastActivity');
        }
        this.currentUserSubject.next(null);
        this.router.navigate(['/login']);
    }

    isAuthenticated(): boolean {
        return !!this.currentUserValue;
    }
}
