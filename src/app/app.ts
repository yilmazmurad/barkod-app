import { Component, signal, OnInit } from '@angular/core';
import { RouterOutlet, Router, NavigationEnd } from '@angular/router';
import { NavbarComponent } from './components/navbar/navbar.component';
import { DialogComponent } from './components/dialog/dialog.component';
import { AuthService } from './services/auth.service';
import { CommonModule } from '@angular/common';
import { filter } from 'rxjs/operators';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, NavbarComponent, DialogComponent, CommonModule],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App implements OnInit {
  protected readonly title = signal('barkod-app');
  isLoading = true;

  constructor(public authService: AuthService, private router: Router) { }

  ngOnInit() {
    // İlk navigation tamamlandığında loading'i durdur
    this.router.events
      .pipe(filter(event => event instanceof NavigationEnd))
      .subscribe(() => {
        // Kısa bir gecikme ile loading'i durdur (görsel akıcılık için)
        setTimeout(() => {
          this.isLoading = false;
        }, 500);
      });
  }
}
