import { Injectable, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Router } from '@angular/router';
import { BehaviorSubject, Observable } from 'rxjs';

export interface User {
    id: string;
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

    constructor(private router: Router) {
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
        // TODO: API çağrısı ile değiştirilecek
        return new Observable(observer => {
            // Mock login - gerçek API ile değiştirilecek
            setTimeout(() => {
                const user: User = {
                    id: '1',
                    username: username,
                    token: 'mock-jwt-token-' + Date.now()
                };

                if (this.isBrowser) {
                    localStorage.setItem('currentUser', JSON.stringify(user));
                }
                this.currentUserSubject.next(user);
                observer.next(user);
                observer.complete();
            }, 1000);
        });
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
