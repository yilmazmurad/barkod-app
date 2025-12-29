import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { AuthService } from '../../services/auth.service';

@Component({
    selector: 'app-login',
    standalone: true,
    imports: [CommonModule, FormsModule],
    templateUrl: './login.component.html',
    styleUrls: ['./login.component.css']
})
export class LoginComponent {
    username = '';
    password = '';
    loading = false;
    error = '';

    constructor(
        private authService: AuthService,
        private router: Router,
        private route: ActivatedRoute
    ) {
        // Zaten giriş yapmışsa yönlendir
        if (this.authService.isAuthenticated()) {
            const returnUrl = this.route.snapshot.queryParams['returnUrl'] || '/scan';
            this.router.navigateByUrl(returnUrl);
        }
    }

    onSubmit(): void {
        if (!this.username || !this.password) {
            this.error = 'Kullanıcı adı ve şifre gereklidir';
            return;
        }

        this.loading = true;
        this.error = '';

        this.authService.login(this.username, this.password).subscribe({
            next: () => {
                this.loading = false;
                const returnUrl = this.route.snapshot.queryParams['returnUrl'] || '/scan';
                this.router.navigate([returnUrl]);
            },
            error: (err) => {
                this.error = 'Giriş başarısız. Lütfen bilgilerinizi kontrol edin.';
                this.loading = false;
            }
        });
    }
}
