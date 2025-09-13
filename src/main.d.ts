// src/main.d.ts
export * from './app/app.module';
export * from './app/app.component';
export * from './app/terminal/terminal.component';
export * from './app/services/terminal.service';

// Dichiarazione globale per il Web Component
declare global {
  interface HTMLElementTagNameMap {
    'linux-terminal': HTMLElement;
  }
  
  interface Window {
    terminalUseEntity?: (entity: string) => void;
  }
}