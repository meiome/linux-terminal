import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of, throwError, from, BehaviorSubject } from 'rxjs';
import { catchError, map, tap, finalize, concatMap, reduce } from 'rxjs/operators';

export interface Command {
  name: string;
  description: string;
  usage?: string;
  execute: (args: string[]) => Observable<string>;
}

export interface SystemInfo {
  os: string;
  hostname: string;
  kernel: string;
  uptime: string;
  memory: string;
}

@Injectable({
  providedIn: 'root'
})
export class TerminalService {
  private history: string[] = [];
  private historySubject = new BehaviorSubject<string[]>([]);
  public history$ = this.historySubject.asObservable();
  private currentDirectory = '~';
  private user = 'user';
  private hostname = 'linux-box';
  private apiBaseUrl = '/api';
  private entitiesUrl = '/terminal/listamaschere'; // Nuovo endpoint per le entità
  private commandHistory: string[] = [];
  private historyIndex = -1;

  // Getter pubblico per accedere alla directory corrente
  get currentDirectoryPath(): string {
    return this.currentDirectory;
  }

  // Getter pubblico per l'utente
  get currentUser(): string {
    return this.user;
  }

  // Getter pubblico per l'hostname
  get currentHostname(): string {
    return this.hostname;
  }

  constructor(private http: HttpClient) {
    this.initializeCommands();
  }

  // Lista dei comandi supportati
  private commands: Command[] = [];

  private initializeCommands(): void {
    this.commands = [
      {
        name: 'help',
        description: 'Mostra tutti i comandi disponibili',
        execute: () => this.helpCommand()
      },
      {
        name: 'clear',
        description: 'Pulisce lo schermo del terminale',
        execute: () => this.clearCommand()
      },
      {
        name: 'ls',
        description: 'Lista i file e le directory',
        usage: 'ls [opzioni] [directory]',
        execute: (args: string[]) => this.lsCommand(args)
      },
      {
        name: 'pwd',
        description: 'Mostra la directory corrente',
        execute: () => this.pwdCommand()
      },
      {
        name: 'cd',
        description: 'Cambia directory',
        usage: 'cd [directory]',
        execute: (args: string[]) => this.cdCommand(args)
      },
      {
        name: 'whoami',
        description: 'Mostra il nome utente corrente',
        execute: () => this.whoamiCommand()
      },
      {
        name: 'echo',
        description: 'Visualizza il testo passato come argomento',
        usage: 'echo [testo]',
        execute: (args: string[]) => this.echoCommand(args)
      },
      {
        name: 'date',
        description: 'Mostra la data e ora corrente',
        execute: () => this.dateCommand()
      },
      {
        name: 'ping',
        description: 'Verifica la connettività di rete',
        usage: 'ping [host]',
        execute: (args: string[]) => this.pingCommand(args)
      },
      {
        name: 'system-info',
        description: 'Mostra informazioni sul sistema',
        execute: () => this.systemInfoCommand()
      },
      {
        name: 'api-test',
        description: 'Testa la connessione alle API',
        execute: () => this.apiTestCommand()
      },
      {
        name: 'mkdir',
        description: 'Crea una nuova directory',
        usage: 'mkdir [nome]',
        execute: (args: string[]) => this.mkdirCommand(args)
      },
      {
        name: 'touch',
        description: 'Crea un nuovo file',
        usage: 'touch [nome]',
        execute: (args: string[]) => this.touchCommand(args)
      },
      {
        name: 'grep',
        description: 'Cerca pattern nel testo',
        usage: 'grep [pattern]',
        execute: (args: string[]) => of(this.grepCommand(args, ''))
      },
      {
        name: 'wc',
        description: 'Conta linee, parole e caratteri',
        usage: 'wc',
        execute: (args: string[]) => of(this.wcCommand(args, ''))
      },
      {
        name: 'head',
        description: 'Mostra prime n linee',
        usage: 'head [-n]',
        execute: (args: string[]) => of(this.headCommand(args, ''))
      },
      {
        name: 'tail',
        description: 'Mostra ultime n linee',
        usage: 'tail [-n]',
        execute: (args: string[]) => of(this.tailCommand(args, ''))
      },
      {
        name: 'history',
        description: 'Mostra la cronologia dei comandi',
        execute: () => this.historyCommand()
      },
      {
        name: 'lista',
        description: 'Mostra tutte le entità disponibili dal backend',
        execute: () => this.listaCommand()
      }
    ];
  }

  // Esegue un comando con gestione avanzata degli errori e supporto per pipe
  executeCommand(input: string): Observable<string> {
    const trimmedInput = input.trim();
    if (!trimmedInput) return of('');

    // Gestione speciale per il comando clear
    if (trimmedInput === 'clear') {
      return this.clearCommand();
    }

    // Salva nella cronologia comandi
    this.addToCommandHistory(trimmedInput);

    // Aggiungi il comando alla history prima dell'esecuzione
    this.addToHistory(`${this.getPrompt()} ${trimmedInput}`);

    // Gestione comandi in pipe (es: "ls -la | grep file")
    if (trimmedInput.includes('|')) {
      return this.executePipedCommands(trimmedInput);
    }

    // Gestione comandi multipli (es: "ls -la; pwd")
    if (trimmedInput.includes(';')) {
      return this.executeMultipleCommands(trimmedInput);
    }

    const [commandName, ...args] = trimmedInput.split(' ');
    const command = this.commands.find(cmd => cmd.name === commandName);

    if (!command) {
      const errorMsg = `${commandName}: comando non trovato. Digita 'help' per la lista dei comandi`;
      this.addToHistory(errorMsg);
      return of(errorMsg);
    }

    return command.execute(args).pipe(
      map(response => {
        if (response && response.trim()) {
          this.addToHistory(response);
        }
        return response || '';
      }),
      catchError(error => {
        let errorMsg: string;

        if (error.status === 0) {
          errorMsg = `${commandName}: errore di connessione - Backend non raggiungibile`;
        } else if (error.status === 404) {
          errorMsg = `${commandName}: endpoint non trovato`;
        } else if (error.status >= 500) {
          errorMsg = `${commandName}: errore interno del server`;
        } else {
          errorMsg = `${commandName}: errore - ${error.message || 'Errore sconosciuto'}`;
        }

        this.addToHistory(errorMsg);
        return of(errorMsg);
      }),
      finalize(() => {
        // Reset history index dopo l'esecuzione
        this.historyIndex = -1;
      })
    );
  }

  // Supporto per comandi in pipe (es: "ls -la | grep file")
  private executePipedCommands(input: string): Observable<string> {
    const commands = input.split('|').map(cmd => cmd.trim());
    let previousOutput = '';

    return from(commands).pipe(
      concatMap((command, index) => {
        const [cmdName, ...args] = command.split(' ');

        if (index === 0) {
          // Primo comando nella pipe
          return this.executeSimpleCommand(cmdName, args);
        } else {
          // Comandi successivi - usano l'output del precedente
          return this.executePipeCommand(cmdName, args, previousOutput);
        }
      }),
      tap(output => {
        previousOutput = output;
      }),
      reduce((acc, output) => output, ''),
      catchError(error => {
        const errorMsg = `Pipe error: ${error.message}`;
        this.addToHistory(errorMsg);
        return of(errorMsg);
      })
    );
  }

  // Supporto per comandi multipli (es: "ls -la; pwd")
  private executeMultipleCommands(input: string): Observable<string> {
    const commands = input.split(';').map(cmd => cmd.trim()).filter(cmd => cmd);
    let results: string[] = [];

    return from(commands).pipe(
      concatMap(command => {
        return this.executeCommand(command).pipe(
          catchError(error => of(`Error in "${command}": ${error.message}`))
        );
      }),
      reduce((acc, result) => {
        results.push(result);
        return results.join('\n');
      }, ''),
      map(finalOutput => {
        if (results.length > 1) {
          this.addToHistory(finalOutput);
        }
        return finalOutput;
      })
    );
  }

  // Esegue un comando semplice senza pipe
  private executeSimpleCommand(commandName: string, args: string[]): Observable<string> {
    const command = this.commands.find(cmd => cmd.name === commandName);

    if (!command) {
      return of(`${commandName}: comando non trovato`);
    }

    return command.execute(args).pipe(
      catchError(error => of(`${commandName}: errore - ${error.message}`))
    );
  }

  // Esegue un comando che riceve input da pipe precedente
  private executePipeCommand(commandName: string, args: string[], input: string): Observable<string> {
    const command = this.commands.find(cmd => cmd.name === commandName);

    if (!command) {
      return of(`${commandName}: comando non trovato`);
    }

    // Comandi che supportano pipe input
    if (commandName === 'grep') {
      return of(this.grepCommand(args, input));
    } else if (commandName === 'wc') {
      return of(this.wcCommand(args, input));
    } else if (commandName === 'head') {
      return of(this.headCommand(args, input));
    } else if (commandName === 'tail') {
      return of(this.tailCommand(args, input));
    } else {
      return of(`${commandName}: comando non supporta pipe`);
    }
  }

  // Restituisce la cronologia dei comandi
  getHistory(): string[] {
    return [...this.history];
  }

  // Restituisce il prompt formattato
  getPrompt(): string {
    return `${this.user}@${this.hostname}:${this.currentDirectory}$`;
  }

  // Pulisce la cronologia
  clearHistory(): void {
    this.history = [];
    this.historySubject.next([]);
  }

  // Navigazione nella cronologia comandi
  getCommandFromHistory(direction: 'up' | 'down'): string {
    if (this.commandHistory.length === 0) return '';

    if (direction === 'up') {
      this.historyIndex = Math.min(this.historyIndex + 1, this.commandHistory.length - 1);
    } else {
      this.historyIndex = Math.max(this.historyIndex - 1, -1);
    }

    return this.historyIndex >= 0 ? this.commandHistory[this.historyIndex] : '';
  }

  // Aggiunge alla cronologia
  private addToHistory(line: string): void {
    this.history.push(line);
    // Mantieni una history ragionevole
    if (this.history.length > 1000) {
      this.history = this.history.slice(-500);
    }
    this.historySubject.next([...this.history]);
  }

  // Aggiunge alla cronologia comandi
  private addToCommandHistory(command: string): void {
    // Non aggiungere comandi duplicati consecutivi
    if (this.commandHistory[this.commandHistory.length - 1] !== command) {
      this.commandHistory.push(command);
      // Mantieni una history ragionevole
      if (this.commandHistory.length > 100) {
        this.commandHistory = this.commandHistory.slice(-50);
      }
    }
    this.historyIndex = -1;
  }

  // === IMPLEMENTAZIONE COMANDI LOCALI ===

  private helpCommand(): Observable<string> {
    const helpText = this.commands
      .map(cmd => {
        let line = `\x1B[1;32m${cmd.name.padEnd(12)}\x1B[0m - ${cmd.description}`;
        if (cmd.usage) {
          line += `\n    \x1B[2;37mUsage: ${cmd.usage}\x1B[0m`;
        }
        return line;
      })
      .join('\n');

    return of(helpText);
  }

  private clearCommand(): Observable<string> {
    this.clearHistory();
    return of('');
  }

  private historyCommand(): Observable<string> {
    return of(this.commandHistory
      .map((cmd, index) => ` ${index + 1}  ${cmd}`)
      .join('\n')
    );
  }

  private lsCommand(args: string[]): Observable<string> {
    const showAll = args.includes('-a') || args.includes('--all');
    const longFormat = args.includes('-l') || args.includes('--long');
    const humanReadable = args.includes('-h') || args.includes('--human-readable');

    const items = [
      { name: 'documenti', type: 'directory', size: '4.0K', modified: 'Dec 10 14:30' },
      { name: 'downloads', type: 'directory', size: '8.0K', modified: 'Dec 9 10:15' },
      { name: 'musica', type: 'directory', size: '4.0K', modified: 'Dec 8 16:45' },
      { name: 'immagini', type: 'directory', size: '12K', modified: 'Dec 11 09:20' },
      { name: '.config', type: 'directory', size: '4.0K', modified: 'Dec 5 11:30', hidden: true },
      { name: 'file1.txt', type: 'file', size: '1.2K', modified: 'Dec 10 14:30' },
      { name: 'file2.pdf', type: 'file', size: '2.4M', modified: 'Dec 9 10:15' },
      { name: 'foto.jpg', type: 'file', size: '4.8M', modified: 'Dec 8 16:45' },
      { name: '.log', type: 'file', size: '4.8K', modified: 'Dec 7 08:20', hidden: true }
    ];

    const visibleItems = showAll ? items : items.filter(item => !item.hidden);

    if (longFormat) {
      const output = visibleItems.map(item => {
        const permissions = item.type === 'directory' ? 'drwxr-xr-x' : '-rw-r--r--';
        const size = humanReadable ? this.formatFileSize(item.size) : item.size.padStart(6);
        return `${permissions} 1 ${this.user} ${this.user} ${size} ${item.modified} ${item.name}`;
      }).join('\n');

      return of(output);
    }

    return of(visibleItems.map(item => item.name).join('  '));
  }

  private pwdCommand(): Observable<string> {
    return of(this.currentDirectory);
  }

  private cdCommand(args: string[]): Observable<string> {
    if (args.length === 0) {
      this.currentDirectory = '~';
      return of('');
    }

    const targetDir = args[0];

    // Simulazione di validazione directory
    const validDirectories = ['~', 'documenti', 'downloads', 'musica', 'immagini', '..'];

    if (!validDirectories.includes(targetDir) && !targetDir.startsWith('/')) {
      return of(`cd: ${targetDir}: No such file or directory`);
    }

    if (targetDir === '..') {
      this.currentDirectory = this.currentDirectory.split('/').slice(0, -1).join('/') || '~';
      return of('');
    } else if (targetDir === '~' || targetDir.startsWith('/')) {
      this.currentDirectory = targetDir;
      return of('');
    } else {
      this.currentDirectory = this.currentDirectory === '~' ?
        targetDir : `${this.currentDirectory}/${targetDir}`;
      return of('');
    }
  }

  private whoamiCommand(): Observable<string> {
    return of(this.user);
  }

  private echoCommand(args: string[]): Observable<string> {
    return of(args.join(' '));
  }

  private dateCommand(): Observable<string> {
    return of(new Date().toLocaleString('it-IT'));
  }

  private mkdirCommand(args: string[]): Observable<string> {
    if (args.length === 0) {
      return of('mkdir: missing operand');
    }

    return of(`Directory '${args[0]}' created successfully`);
  }

  private touchCommand(args: string[]): Observable<string> {
    if (args.length === 0) {
      return of('touch: missing file operand');
    }

    return of(`File '${args[0]}' created successfully`);
  }

  // === COMANDI CON CHIAMATE API ===

  private pingCommand(args: string[]): Observable<string> {
    const host = args[0] || 'google.com';

    return this.http.get<{ success: boolean; message: string }>(`${this.apiBaseUrl}/ping?host=${host}`).pipe(
      map(response => response.message),
      catchError(() => of(this.generatePingOutput(host)))
    );
  }

  private systemInfoCommand(): Observable<string> {
    return this.http.get<SystemInfo>(`${this.apiBaseUrl}/system-info`).pipe(
      map(info => {
        return `Sistema Operativo: ${info.os}
Hostname: ${info.hostname}
Kernel: ${info.kernel}
Uptime: ${info.uptime}
Memoria: ${info.memory}`;
      }),
      catchError(() => of(this.generateSystemInfo()))
    );
  }

  private apiTestCommand(): Observable<string> {
    return this.http.get<{ status: string; message: string; timestamp: string }>(`${this.apiBaseUrl}/health`).pipe(
      map(response => `✅ API Connection: ${response.message}\nTimestamp: ${response.timestamp}`),
      catchError(error => of(`❌ API Error: ${error.message}\nAssicurati che il backend sia in esecuzione`))
    );
  }

  private listaCommand(): Observable<string> {
    return this.http.get<{ code: number, success: boolean, data: string[] }>(this.entitiesUrl).pipe(
      map(response => {
        if (response.success && response.data) {
          return this.formatEntitiesList(response.data);
        } else {
          return '❌ Errore nel recupero delle entità dal backend\n' + this.getFallbackEntitiesList();
        }
      }),
      catchError(error => {
        console.error('Errore lista command:', error);
        return of(this.getFallbackEntitiesList());
      })
    );
  }

  private formatEntitiesList(entities: string[]): string {
    if (entities.length === 0) {
      return '📭 Nessuna entità disponibile';
    }

    const sortedEntities = entities.sort();
    let output = '📋 Entità disponibili:\n\n';

    // Formattazione semplificata senza codici ANSI complessi
    sortedEntities.forEach(entity => {
      output += `   ${entity} [utilizza:${entity}]\n`;
    });

    output += `\n📊 Totale: ${sortedEntities.length} entità`;
    return output;
  }

  private getFallbackEntitiesList(): string {
    const fallbackEntities = [
      'articoli', 'cataloghi', 'cataloghidettagli', 'presenze',
      'utenti', 'actor', 'politicaprezzi', 'sales',
      'keycassa', 'categorie', 'articolisoloimmagini', 'movimenticassa', 'baseoraria'
    ];

    const errorMessage =
      '❌ ERRORE: Impossibile connettersi al backend\n' +
      '📡 Motivo: Timeout o server non raggiungibile\n' +
      '💡 Soluzione: Verifica che il backend sia in esecuzione\n\n' +
      '📋 Mostro entità locali di fallback:\n\n';

    return errorMessage + this.formatEntitiesList(fallbackEntities);
  }

  // === IMPLEMENTAZIONE COMANDI PIPE ===

  private grepCommand(args: string[], input: string): string {
    const pattern = args[0];
    if (!pattern) {
      return 'grep: pattern mancante';
    }

    const lines = input.split('\n');
    const matchedLines = lines.filter(line => line.includes(pattern));

    return matchedLines.join('\n');
  }

  private wcCommand(args: string[], input: string): string {
    const lines = input.split('\n').filter(line => line.trim());
    const words = input.split(/\s+/).filter(word => word);
    const characters = input.length;

    return `${lines.length}   ${words.length}   ${characters}`;
  }

  private headCommand(args: string[], input: string): string {
    const lines = input.split('\n');
    const n = args[0] ? parseInt(args[0]) : 10;
    const result = lines.slice(0, n).join('\n');

    return result;
  }

  private tailCommand(args: string[], input: string): string {
    const lines = input.split('\n');
    const n = args[0] ? parseInt(args[0]) : 10;
    const result = lines.slice(-n).join('\n');

    return result;
  }

  // === METODI DI SUPPORTO ===

  private generatePingOutput(host: string): string {
    return `PING ${host} (142.250.184.206) 56(84) bytes of data.
64 bytes from ${host}: icmp_seq=1 ttl=117 time=15.4 ms
64 bytes from ${host}: icmp_seq=2 ttl=117 time=14.8 ms
64 bytes from ${host}: icmp_seq=3 ttl=117 time=15.2 ms

--- ${host} ping statistics ---
3 packets transmitted, 3 received, 0% packet loss, time 2002ms
rtt min/avg/max/mdev = 14.897/15.198/15.498/0.312 ms`;
  }

  private generateSystemInfo(): string {
    return `Sistema Operativo: Linux Ubuntu 22.04 LTS
Hostname: ${this.hostname}
Kernel: 5.15.0-86-generic
Uptime: 2 giorni, 4 ore, 32 minuti
Memoria: 3.2G / 7.8G (41%)`;
  }

  private formatFileSize(size: string): string {
    return size;
  }

  // Metodo per comandi personalizzati che chiamano API esterne
  executeCustomApiCommand(endpoint: string, data?: any): Observable<any> {
    return this.http.post(`${this.apiBaseUrl}/${endpoint}`, data).pipe(
      catchError(error => throwError(() => new Error(error.message)))
    );
  }

  // Metodo per ottenere informazioni per l'header
  getTerminalHeader(): string {
    return `${this.user}@${this.hostname}: ${this.currentDirectory}`;
  }
}