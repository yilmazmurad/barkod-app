import { Injectable, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { environment } from '../../environments/environment';

@Injectable({
    providedIn: 'root'
})
export class ConfigService {
    private readonly STORAGE_KEY = 'app_api_url';
    private currentApiUrl: string;
    private platformId = inject(PLATFORM_ID);

    constructor() {
        this.currentApiUrl = environment.apiUrl;

        if (isPlatformBrowser(this.platformId)) {
            // Load from storage or use default from environment
            const storedUrl = localStorage.getItem(this.STORAGE_KEY);
            if (storedUrl) {
                this.currentApiUrl = storedUrl;
            }
        }

        // Ensure no trailing slash for consistency
        if (this.currentApiUrl.endsWith('/')) {
            this.currentApiUrl = this.currentApiUrl.slice(0, -1);
        }
    }

    getApiUrl(): string {
        return this.currentApiUrl;
    }

    setApiUrl(url: string): void {
        let cleanUrl = url.trim();
        if (cleanUrl.endsWith('/')) {
            cleanUrl = cleanUrl.slice(0, -1);
        }

        this.currentApiUrl = cleanUrl;

        if (isPlatformBrowser(this.platformId)) {
            localStorage.setItem(this.STORAGE_KEY, cleanUrl);
        }
    }

    resetToDefault(): void {
        this.currentApiUrl = environment.apiUrl;
        if (isPlatformBrowser(this.platformId)) {
            localStorage.removeItem(this.STORAGE_KEY);
        }
    }
}
