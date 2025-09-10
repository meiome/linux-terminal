import { Component, ElementRef, ViewChild, AfterViewInit, HostListener, ChangeDetectorRef } from '@angular/core';
import { TerminalService } from '../services/terminal.service';

@Component({
  selector: 'app-terminal',
  templateUrl: './terminal.component.html',
  styleUrls: ['./terminal.component.scss']
})
export class TerminalComponent implements AfterViewInit {
  @ViewChild('terminalInput') terminalInput!: ElementRef;
  @ViewChild('terminalContent') terminalContent!: ElementRef;

  currentInput = '';
  commandHistory: string[] = [];
  showPrompt = true;
  isLoading = false;
  private historySubscription: any;

  constructor(
    public terminalService: TerminalService,
    private cdRef: ChangeDetectorRef
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
  }

  ngOnDestroy() {
    if (this.historySubscription) {
      this.historySubscription.unsubscribe();
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
    // TODO: Implementare navigazione cronologia comandi
    console.log('Navigazione history:', direction);
  }

  private autoComplete() {
    // TODO: Implementare autocompletamento
    console.log('Autocompletamento');
  }

  private clearTerminal() {
    this.terminalService.executeCommand('clear').subscribe(() => {
      this.commandHistory = this.terminalService.getHistory();
    });
  }

  private cancelCommand() {
    this.currentInput = '';
    this.commandHistory.push('^C');
    this.scrollToBottom();
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
      .replace(/\x1B\[1;31m(.*?)\x1B\[0m/g, '<span class="ansi-red">$1</span>');
  }
}