import { Component, EventEmitter, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../services/api.service';

@Component({
    selector: 'app-stok-search',
    standalone: true,
    imports: [CommonModule, FormsModule],
    templateUrl: './stok-search.component.html',
    styleUrls: ['./stok-search.component.css']
})
export class StokSearchComponent {
    @Output() stockSelected = new EventEmitter<{ stok_kodu: string, stok_adi: string, barkodu: string }>();
    @Output() close = new EventEmitter<void>();

    searchField: 'stok_adi' | 'stok_kodu' | 'barkodu' = 'stok_adi';
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

        this.apiService.searchStock(this.searchField, this.searchString).subscribe({
            next: (data) => {
                this.results = data;
                this.displayedResults = data.slice(0, this.MAX_RESULTS);
                this.isLoading = false;
            },
            error: (err) => {
                console.error('Stok arama hatası:', err);
                this.isLoading = false;
            }
        });
    }

    selectStock(stock: any) {
        this.stockSelected.emit(stock);
    }

    closeModal() {
        this.close.emit();
    }
}
