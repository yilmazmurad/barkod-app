import { Injectable, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Router } from '@angular/router';
import { BehaviorSubject, Observable } from 'rxjs';
import { HttpClient } from '@angular/common/http';
import { map } from 'rxjs/operators';
import { environment } from '../../environments/environment.development';

export interface User {
    username: string;
    token: string;
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
        private http: HttpClient
    ) {
        this.isBrowser = isPlatformBrowser(this.platformId);
        let storedUser: string | null = null;

        if (this.isBrowser) {
            storedUser = localStorage.getItem('currentUser');
        }

        this.currentUserSubject = new BehaviorSubject<User | null>(
            storedUser ? JSON.parse(storedUser) : null
        );
        this.currentUser = this.currentUserSubject.asObservable();
    }

    public get currentUserValue(): User | null {
        return this.currentUserSubject.value;
    }

    public get token(): string | null {
        return this.currentUserValue?.token || null;
    }

    login(username: string, password: string): Observable<User> {
        return this.http.post<any>(`${environment.apiUrl}/auth/login`, { username, password })
            .pipe(map(response => {
                if (response.success) {
                    const user: User = {
                        username: response.adisoyadi,
                        token: response.token
                    };

                    if (this.isBrowser) {
                        localStorage.setItem('currentUser', JSON.stringify(user));
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
        }
        this.currentUserSubject.next(null);
        this.router.navigate(['/login']);
    }

    isAuthenticated(): boolean {
        return !!this.currentUserValue;
    }
}
