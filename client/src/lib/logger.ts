// ========== 日誌級別 ==========
export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
}

// ========== 日誌配置 ==========
interface LogConfig {
  level: LogLevel;
  enableConsole: boolean;
  enableStorage: boolean;
  maxStorageSize: number; // localStorage 最大大小（字節）
  environment: 'development' | 'production';
}

// ========== 日誌條目 ==========
interface LogEntry {
  level: LogLevel;
  timestamp: string;
  category: string;
  message: string;
  data?: any;
  stackTrace?: string;
  requestId?: string;
}

// ========== 日誌類 ==========
class Logger {
  private config: LogConfig;
  private logs: LogEntry[] = [];
  private readonly STORAGE_KEY = 'fitbuddy_logs';

  constructor(config: Partial<LogConfig> = {}) {
    this.config = {
      level: LogLevel.INFO,
      enableConsole: true,
      enableStorage: true,
      maxStorageSize: 5 * 1024 * 1024, // 5MB
      environment: (import.meta.env.MODE === 'development' ? 'development' : 'production'),
      ...config,
    };

    // 在應用啟動時加載日誌
    this.loadLogs();
  }

  private formatTimestamp(): string {
    return new Date().toISOString();
  }

  private getLevelName(level: LogLevel): string {
    const names = ['DEBUG', 'INFO', 'WARN', 'ERROR'];
    return names[level];
  }

  private shouldLog(level: LogLevel): boolean {
    return level >= this.config.level;
  }

  private formatLog(entry: LogEntry): string {
    const { timestamp, level, category, message } = entry;
    return `[${timestamp}] [${this.getLevelName(level)}] [${category}] ${message}`;
  }

  private saveLogs(): void {
    if (!this.config.enableStorage) return;

    try {
      const serialized = JSON.stringify(this.logs);
      const size = new Blob([serialized]).size;

      if (size > this.config.maxStorageSize) {
        // 刪除最舊的日誌
        this.logs = this.logs.slice(-Math.floor(this.logs.length / 2));
      }

      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.logs));
    } catch (error) {
      console.error('Failed to save logs:', error);
    }
  }

  private loadLogs(): void {
    if (!this.config.enableStorage) return;

    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (stored) {
        this.logs = JSON.parse(stored);
      }
    } catch (error) {
      console.error('Failed to load logs:', error);
    }
  }

  private log(level: LogLevel, category: string, message: string, data?: any): void {
    if (!this.shouldLog(level)) return;

    const entry: LogEntry = {
      level,
      timestamp: this.formatTimestamp(),
      category,
      message,
      data,
      requestId: data?.requestId,
    };

    // 如果是錯誤，捕獲堆棧跟踪
    if (level === LogLevel.ERROR && data instanceof Error) {
      entry.stackTrace = data.stack;
    }

    this.logs.push(entry);

    if (this.config.enableConsole) {
      const formatted = this.formatLog(entry);
      const consoleMethod = level === LogLevel.ERROR ? 'error' : level === LogLevel.WARN ? 'warn' : 'log';
      console[consoleMethod](formatted, data);
    }

    this.saveLogs();
  }

  // 公開方法
  debug(category: string, message: string, data?: any): void {
    this.log(LogLevel.DEBUG, category, message, data);
  }

  info(category: string, message: string, data?: any): void {
    this.log(LogLevel.INFO, category, message, data);
  }

  warn(category: string, message: string, data?: any): void {
    this.log(LogLevel.WARN, category, message, data);
  }

  error(category: string, message: string, data?: any): void {
    this.log(LogLevel.ERROR, category, message, data);
  }

  // 獲取日誌
  getLogs(filter?: { level?: LogLevel; category?: string }): LogEntry[] {
    if (!filter) return this.logs;

    return this.logs.filter((log) => {
      if (filter.level !== undefined && log.level !== filter.level) return false;
      if (filter.category && log.category !== filter.category) return false;
      return true;
    });
  }

  // 清除日誌
  clearLogs(): void {
    this.logs = [];
    if (typeof window !== 'undefined') {
      localStorage.removeItem(this.STORAGE_KEY);
    }
  }

  // 導出日誌（用於調試）
  exportLogs(): string {
    return JSON.stringify(this.logs, null, 2);
  }

  // 發送日誌到後端（用於遠程監控）
  async sendLogsToServer(endpoint: string): Promise<void> {
    try {
      await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          logs: this.logs,
          userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown',
          timestamp: new Date().toISOString(),
        }),
      });
    } catch (error) {
      console.error('Failed to send logs to server:', error);
    }
  }
}

// ========== 導出單例 ==========
export const logger = new Logger({
  level: import.meta.env.DEV ? LogLevel.DEBUG : LogLevel.INFO,
  enableConsole: true,
  enableStorage: true,
});

export default logger;

