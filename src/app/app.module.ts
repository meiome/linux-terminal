import { BrowserModule } from '@angular/platform-browser';
import { NgModule, Injector, DoBootstrap, ApplicationRef } from '@angular/core';
import { createCustomElement } from '@angular/elements';
import { HttpClientModule } from '@angular/common/http';
import { FormsModule } from '@angular/forms';

import { AppComponent } from './app.component';
import { TerminalComponent } from './terminal/terminal.component';

@NgModule({
  declarations: [
    AppComponent,
    TerminalComponent
  ],
  imports: [
    BrowserModule,
    HttpClientModule,
    FormsModule
  ],
  providers: [],
  bootstrap: [] // Lascia vuoto qui
})
export class AppModule implements DoBootstrap {
  constructor(private injector: Injector) {}

  ngDoBootstrap(appRef: ApplicationRef) {
    // Controlla se siamo in modalità sviluppo
    const isDev = !(window as any).ngRef || 
                 document.querySelector('app-root') !== null;
    
    this.registerWebComponent();
    
    if (isDev) {
      // Bootstrap dell'app Angular solo in sviluppo
      appRef.bootstrap(AppComponent);
      console.log('🚀 Angular app avviata in modalità sviluppo');
    }
  }

  private registerWebComponent(): void {
    const elementName = 'linux-terminal';
    
    if (customElements.get(elementName)) {
      console.warn(`⚠️ ${elementName} già registrato, skipping...`);
      return;
    }

    try {
      const terminalElement = createCustomElement(TerminalComponent, { 
        injector: this.injector 
      });
      
      customElements.define(elementName, terminalElement);
      console.log('✅ Linux Terminal Web Component registrato!');
    } catch (error) {
      console.error('❌ Errore registrazione Web Component:', error);
    }
  }
}