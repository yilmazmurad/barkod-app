import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { BarcodeService } from '../../services/barcode.service';

@Component({
    selector: 'app-navbar',
    standalone: true,
    imports: [CommonModule, RouterModule],
    templateUrl: './navbar.component.html',
    styleUrls: ['./navbar.component.css']
})
export class NavbarComponent {
    isDropdownOpen = false;

    constructor(
        public authService: AuthService,
        public barcodeService: BarcodeService,
        private router: Router
    ) { }

    toggleDropdown() {
        this.isDropdownOpen = !this.isDropdownOpen;
    }

    logout() {
        this.authService.logout();
        this.router.navigate(['/login']);
    }

    isActive(route: string): boolean {
        return this.router.url === route;
    }

    navigateToScan() {
        this.router.navigate(['/scan']);
    }

    navigateToPending() {
        this.router.navigate(['/pending']);
    }

    navigateToHistory() {
        this.router.navigate(['/history']);
    }
}
