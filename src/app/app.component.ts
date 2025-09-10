import { Component, HostBinding, Inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent {
  @HostBinding('class.dark-theme') isDarkTheme = false;

  constructor(@Inject(PLATFORM_ID) private platformId: any) {}

  toggleTheme(event: Event): void {
    event.preventDefault();
    this.isDarkTheme = !this.isDarkTheme;
    
    if (isPlatformBrowser(this.platformId)) {
      localStorage.setItem('darkTheme', this.isDarkTheme.toString());
      // Comunica il cambio di tema al Web Component
      this.dispatchThemeChange();
    }
  }

  ngOnInit(): void {
    if (isPlatformBrowser(this.platformId)) {
      const savedTheme = localStorage.getItem('darkTheme');
      if (savedTheme) {
        this.isDarkTheme = savedTheme === 'true';
        this.dispatchThemeChange();
      }
    }
  }

  private dispatchThemeChange(): void {
    // Invia un evento personalizzato al Web Component
    const event = new CustomEvent('theme-change', {
      detail: { isDark: this.isDarkTheme }
    });
    window.dispatchEvent(event);
  }
}