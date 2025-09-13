import { Component, ElementRef, ViewChild, AfterViewInit, HostListener, ChangeDetectorRef, OnDestroy, Input } from '@angular/core';
import { TerminalService } from '../services/terminal.service';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser'; // Aggiungi questa importazione

@Component({
  selector: 'app-terminal',
  templateUrl: './terminal.component.html',
  styleUrls: ['./terminal.component.scss']
})
export class TerminalComponent implements AfterViewInit, OnDestroy {
  @ViewChild('terminalInput') terminalInput!: ElementRef;
  @ViewChild('terminalContent') terminalContent!: ElementRef;
  @Input() isDarkTheme = false;

  currentInput = '';
  commandHistory: string[] = [];
  showPrompt = true;
  isLoading = false;
  private historySubscription: any;
  private themeSubscription: any;

  constructor(
    public terminalService: TerminalService,
    private cdRef: ChangeDetectorRef,
    private elementRef: ElementRef,
    private sanitizer: DomSanitizer // Aggiungi DomSanitizer
  ) { }

  ngAfterViewInit() {
    // Esponi la funzione globalmente per i bottoni "utilizza"
    (window as any).terminalUseEntity = (entity: string) => this.useEntity(entity);

    this.focusInput();
    this.scrollToBottom();

    // Sottoscrizione alla history del service
    this.historySubscription = this.terminalService.history$.subscribe(history => {
      this.commandHistory = history;
      this.cdRef.detectChanges();
      this.scrollToBottom();

      // Forza il re-rendering per assicurarsi che i bottoni vengano interpretati
      setTimeout(() => {
        this.cdRef.detectChanges();
      }, 0);
    });

    // Applica il tema iniziale
    this.applyThemeClass();

    // Ascolta il cambio tema
    this.setupThemeListener();

    // Assicurati che l'input sia focalizzato dopo il rendering iniziale
    setTimeout(() => {
      this.focusInput();
    }, 100);
  }

  ngOnChanges() {
    // Reagisce ai cambiamenti dell'input isDarkTheme
    this.applyThemeClass();
  }

  ngOnDestroy() {
    if (this.historySubscription) {
      this.historySubscription.unsubscribe();
    }
    if (this.themeSubscription) {
      window.removeEventListener('theme-change', this.themeSubscription);
    }

    // Rimuovi la funzione globale per pulizia
    (window as any).terminalUseEntity = null;
  }

  private setupThemeListener(): void {
    this.themeSubscription = (event: CustomEvent) => {
      this.isDarkTheme = event.detail.isDark;
      this.applyThemeClass();
      this.cdRef.detectChanges();
    };

    window.addEventListener('theme-change', this.themeSubscription as EventListener);
  }

  private applyThemeClass(): void {
    const hostElement = this.elementRef.nativeElement;
    if (this.isDarkTheme) {
      hostElement.classList.add('dark-theme');
    } else {
      hostElement.classList.remove('dark-theme');
    }
  }

  @HostListener('document:click')
  focusInput() {
    if (this.terminalInput?.nativeElement) {
      this.terminalInput.nativeElement.focus();
    }
  }

  executeCommand(event?: Event) {
    if (event) event.preventDefault();

    if (!this.currentInput.trim()) return;

    this.isLoading = true;

    this.terminalService.executeCommand(this.currentInput).subscribe({
      next: (output) => {
        this.currentInput = '';
        this.isLoading = false;
        this.cdRef.detectChanges();
      },
      error: (error) => {
        this.currentInput = '';
        this.isLoading = false;
        this.cdRef.detectChanges();
      }
    });
  }

  handleKeyDown(event: KeyboardEvent) {
    if (event.key === 'Enter') {
      this.executeCommand();
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      this.navigateHistory('up');
    } else if (event.key === 'ArrowDown') {
      event.preventDefault();
      this.navigateHistory('down');
    } else if (event.key === 'Tab') {
      event.preventDefault();
      this.autoComplete();
    } else if (event.key === 'l' && event.ctrlKey) {
      event.preventDefault();
      this.clearTerminal();
    } else if (event.key === 'c' && event.ctrlKey) {
      event.preventDefault();
      this.cancelCommand();
    } else if (event.key === 'F2') {
      event.preventDefault();
      //this.terminalService.addToHistory("funzione non ancora implementata");
    } else if (event.key === 'Escape') {
      event.preventDefault();
      this.clearTerminal();
    }
  }

  private navigateHistory(direction: 'up' | 'down') {
    const command = this.terminalService.getCommandFromHistory(direction);
    this.currentInput = command;
    this.cdRef.detectChanges();
  }

  private autoComplete() {
    // TODO: Implementare autocompletamento
    console.log('Autocompletamento');
  }

  private clearTerminal() {
    // Utilizza il servizio per eseguire il comando clear
    this.terminalService.executeCommand('clear').subscribe();
  }

  private cancelCommand() {
    this.currentInput = '';
    this.terminalService.executeCommand('^C').subscribe();
  }

  private scrollToBottom() {
    setTimeout(() => {
      if (this.terminalContent) {
        this.terminalContent.nativeElement.scrollTop =
          this.terminalContent.nativeElement.scrollHeight;
      }
    }, 0);
  }

  getPrompt(): string {
    return this.terminalService.getPrompt();
  }

  formatOutput(output: string): SafeHtml { // Cambia il tipo di ritorno a SafeHtml
    //console.log('Input RAW:', output);

    // Prima gestisci i codici ANSI
    let formatted = output
      // Sostituisci i codici ANSI per i colori
      .replace(/\x1B\[1;32m(.*?)\x1B\[0m/g, '<span class="ansi-green">$1</span>')
      .replace(/\x1B\[2;37m(.*?)\x1B\[0m/g, '<span class="ansi-gray">$1</span>')
      .replace(/\x1B\[1;31m(.*?)\x1B\[0m/g, '<span class="ansi-red">$1</span>')
      .replace(/\x1B\[1;34m(.*?)\x1B\[0m/g, '<span class="ansi-blue">$1</span>')
      // Gestione alternativa per codici ANSI malformati
      .replace(/\[1;32m(.*?)\[0m/g, '<span class="ansi-green">$1</span>')
      .replace(/\[1;34m(.*?)\[0m/g, '<span class="ansi-blue">$1</span>');

    // Poi gestisci i bottoni utilizza
    formatted = formatted.replace(
      /\[utilizza:(.*?)\]/g,
      (match, entityName) => {
        return `<button class="utilizza-btn" onclick="window.terminalUseEntity('${entityName}')">utilizza</button>`;
      }
    );

    //console.log('Output FORMATTED:', formatted);
    
    // Contrassegna l'HTML come sicuro
    return this.sanitizer.bypassSecurityTrustHtml(formatted);
  }

  useEntity(entity: string): void {
    console.log('Utilizzo entità:', entity);
    // Inserisci il comando nel terminale
    this.currentInput = `use ${entity}`;
    this.executeCommand();

    // Focus sull'input dopo un breve delay
    setTimeout(() => {
      this.focusInput();
    }, 100);
  }

}