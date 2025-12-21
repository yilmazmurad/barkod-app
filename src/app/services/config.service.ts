import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';
import { firstValueFrom } from 'rxjs';

@Injectable({
    providedIn: 'root'
})
export class ConfigService {
    private config: any = null;
    private http = inject(HttpClient);

    constructor() { }

    async loadConfig(): Promise<void> {
        try {
            // Cache busting to ensure we always get the latest config
            this.config = await firstValueFrom(this.http.get('/config.json?v=' + new Date().getTime()));
        } catch (error) {
            console.warn('Could not load config.json, using environment defaults', error);
            this.config = null;
        }
    }

    getApiUrl(): string {
        let url = this.config?.apiUrl || environment.apiUrl;
        // Ensure no trailing slash for consistency
        if (url.endsWith('/')) {
            url = url.slice(0, -1);
        }
        return url;
    }
}
