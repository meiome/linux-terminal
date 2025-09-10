import { Component, ElementRef, ViewChild, AfterViewInit, HostListener, ChangeDetectorRef, OnDestroy, Input } from '@angular/core';
import { TerminalService } from '../services/terminal.service';

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
    private elementRef: ElementRef
  ) { }

  ngAfterViewInit() {
    this.focusInput();
    this.scrollToBottom();

    // Sottoscrizione alla history del service
    this.historySubscription = this.terminalService.history$.subscribe(history => {
      this.commandHistory = history;
      this.cdRef.detectChanges();
      this.scrollToBottom();
    });

    // Applica il tema iniziale
    this.applyThemeClass();
    
    // Ascolta il cambio tema
    this.setupThemeListener();
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

  // Metodo per formattare l'output con colori ANSI
  formatOutput(output: string): string {
    // Sostituisce i codici ANSI con span per i colori
    return output
      .replace(/\x1B\[1;32m(.*?)\x1B\[0m/g, '<span class="ansi-green">$1</span>')
      .replace(/\x1B\[2;37m(.*?)\x1B\[0m/g, '<span class="ansi-gray">$1</span>')
      .replace(/\x1B\[1;31m(.*?)\x1B\[0m/g, '<span class="ansi-red">$1</span>')
      .replace(/\x1B\[1;34m(.*?)\x1B\[0m/g, '<span class="ansi-blue">$1</span>');
  }
}