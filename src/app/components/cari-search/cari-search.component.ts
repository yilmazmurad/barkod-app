import { Component, EventEmitter, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../services/api.service';

@Component({
    selector: 'app-cari-search',
    standalone: true,
    imports: [CommonModule, FormsModule],
    templateUrl: './cari-search.component.html',
    styleUrls: ['./cari-search.component.css']
})
export class CariSearchComponent {
    @Output() cariSelected = new EventEmitter<{ cari_kodu: string, cari_isim: string }>();
    @Output() close = new EventEmitter<void>();

    searchField: 'cari_isim' | 'cari_kod' = 'cari_isim';
    searchString: string = '';
    results: any[] = [];
    displayedResults: any[] = [];
    isLoading: boolean = false;
    hasSearched: boolean = false;
    readonly MAX_RESULTS = 100;

    constructor(private apiService: ApiService) { }

    search() {
        if (!this.searchString.trim()) return;

        this.isLoading = true;
        this.hasSearched = true;
        this.results = [];
        this.displayedResults = [];

        this.apiService.searchCari(this.searchField, this.searchString).subscribe({
            next: (data) => {
                this.results = data;
                this.displayedResults = data.slice(0, this.MAX_RESULTS);
                this.isLoading = false;
            },
            error: (err) => {
                console.error('Cari arama hatası:', err);
                this.isLoading = false;
            }
        });
    }

    selectCari(cari: any) {
        this.cariSelected.emit(cari);
    }

    closeModal() {
        this.close.emit();
    }
}
