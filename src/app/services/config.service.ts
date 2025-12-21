import { Injectable } from '@angular/core';
import { environment } from '../../environments/environment';

@Injectable({
    providedIn: 'root'
})
export class ConfigService {

    constructor() { }

    getApiUrl(): string {
        let url = environment.apiUrl;
        // Ensure no trailing slash for consistency
        if (url.endsWith('/')) {
            url = url.slice(0, -1);
        }
        return url;
    }
}
