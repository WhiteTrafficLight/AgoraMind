export enum LogLevel {
  ERROR = 0,
  WARN = 1,
  INFO = 2,
  DEBUG = 3
}

interface LoggerConfig {
  name?: string;
  level?: LogLevel;
  prefix?: string;
  useEmojis?: boolean; // allow disabling emojis per logger instance
}

class Logger {
  private level: LogLevel;
  private name: string;
  private prefix: string;
  private useEmojis: boolean;

  constructor(config: LoggerConfig = {}) {
    this.name = config.name || 'DEFAULT';
    this.prefix = config.prefix || '';
    // Disable emojis in production by default, allow opt-in via config
    const isProd = process.env.NODE_ENV === 'production';
    this.useEmojis = config.useEmojis !== undefined ? config.useEmojis : !isProd;

    this.level = this.determineLogLevel(config.level);

    if (typeof window !== 'undefined') {
      this.initBrowserControls();
    }
  }

  private determineLogLevel(configLevel?: LogLevel): LogLevel {
    if (configLevel !== undefined) {
      return configLevel;
    }

    // 2. localStorage
    if (typeof window !== 'undefined') {
      const savedLevel = localStorage.getItem(`debug_log_level_${this.name}`);
      if (savedLevel && LogLevel[savedLevel as keyof typeof LogLevel] !== undefined) {
        return LogLevel[savedLevel as keyof typeof LogLevel];
      }

      const urlParams = new URLSearchParams(window.location.search);
      if (urlParams.has('debug')) {
        return LogLevel.DEBUG;
      }
    }

    const envLevel = process.env.NEXT_PUBLIC_LOG_LEVEL || 
                     process.env[`NEXT_PUBLIC_${this.name}_LOG_LEVEL`];
    
    if (envLevel && LogLevel[envLevel as keyof typeof LogLevel] !== undefined) {
      return LogLevel[envLevel as keyof typeof LogLevel];
    }

    // 4. : ERROR, DEBUG
    return process.env.NODE_ENV === 'production' ? LogLevel.ERROR : LogLevel.DEBUG;
  }

  private initBrowserControls() {
    const w = window as unknown as { loggerControls?: Record<string, unknown> };
    w.loggerControls = {
      ...w.loggerControls,
      [`set${this.name}LogLevel`]: (level: string) => {
        if (LogLevel[level as keyof typeof LogLevel] !== undefined) {
          localStorage.setItem(`debug_log_level_${this.name}`, level);
          this.level = LogLevel[level as keyof typeof LogLevel];
          console.log(`${this.name} log level changed to ${level}`);
        } else {
          console.error(`Invalid log level: ${level}. Allowed: ERROR, WARN, INFO, DEBUG`);
        }
      },
      [`get${this.name}LogLevel`]: () => {
        const currentLevel = LogLevel[this.level];
        console.log(`${this.name} current log level: ${currentLevel}`);
        return currentLevel;
      }
    };
  }

  setLevel(level: LogLevel) {
    this.level = level;
    if (typeof window !== 'undefined') {
      localStorage.setItem(`debug_log_level_${this.name}`, LogLevel[level]);
    }
  }

  private formatMessage(level: string, emoji: string, ...args: unknown[]): unknown[] {
    const timestamp = new Date().toISOString().substr(11, 12);
    const prefix = this.prefix ? `${this.prefix} ` : '';
    const emojiPart = this.useEmojis && emoji ? `${emoji} ` : '';
    return [`${emojiPart}[${timestamp}] ${prefix}${this.name}:`, ...args];
  }

  error(...args: unknown[]) {
    if (this.level >= LogLevel.ERROR) {
      console.error(...this.formatMessage('ERROR', this.useEmojis ? '🚨' : '', ...args));
    }
  }

  warn(...args: unknown[]) {
    if (this.level >= LogLevel.WARN) {
      console.warn(...this.formatMessage('WARN', this.useEmojis ? '⚠️' : '', ...args));
    }
  }

  info(...args: unknown[]) {
    if (this.level >= LogLevel.INFO) {
      console.log(...this.formatMessage('INFO', this.useEmojis ? 'ℹ️' : '', ...args));
    }
  }

  debug(...args: unknown[]) {
    if (this.level >= LogLevel.DEBUG) {
      console.log(...this.formatMessage('DEBUG', this.useEmojis ? '🐛' : '', ...args));
    }
  }

  force(...args: unknown[]) {
    console.log(...this.formatMessage('FORCE', this.useEmojis ? '🔧' : '', ...args));
  }

  group(name: string, collapsed: boolean = false) {
    if (this.level >= LogLevel.DEBUG) {
      if (collapsed) {
        console.groupCollapsed(...this.formatMessage('GROUP', this.useEmojis ? '📁' : '', name));
      } else {
        console.group(...this.formatMessage('GROUP', this.useEmojis ? '📂' : '', name));
      }
    }
  }

  groupEnd() {
    if (this.level >= LogLevel.DEBUG) {
      console.groupEnd();
    }
  }

  time(label: string) {
    if (this.level >= LogLevel.DEBUG) {
      console.time(`${this.name}: ${label}`);
    }
  }

  timeEnd(label: string) {
    if (this.level >= LogLevel.DEBUG) {
      console.timeEnd(`${this.name}: ${label}`);
    }
  }
}

export const logger = new Logger({ name: 'GLOBAL' });

export const loggers = {
  socket: new Logger({ name: 'SOCKET' }),
  chat: new Logger({ name: 'CHAT' }),
  api: new Logger({ name: 'API' }),
  npc: new Logger({ name: 'NPC' }),
  auth: new Logger({ name: 'AUTH' }),
  db: new Logger({ name: 'DB' }),
  ui: new Logger({ name: 'UI' }),
  rag: new Logger({ name: 'RAG' })
};

// Factory for creating custom loggers externally without exposing class
export const createLogger = (config: LoggerConfig = {}) => new Logger(config);

// console.log
export const createCompatLogger = () => ({
  log: (...args: unknown[]) => logger.debug(...args),
  warn: (...args: unknown[]) => logger.warn(...args),
  error: (...args: unknown[]) => logger.error(...args),
  info: (...args: unknown[]) => logger.info(...args),
  debug: (...args: unknown[]) => logger.debug(...args),
  group: (name: string) => logger.group(name),
  groupCollapsed: (name: string) => logger.group(name, true),
  groupEnd: () => logger.groupEnd(),
  time: (label: string) => logger.time(label),
  timeEnd: (label: string) => logger.timeEnd(label)
});

if (typeof window !== 'undefined') {
  (window as unknown as { AgoraLoggers: Record<string, unknown> }).AgoraLoggers = {
    setGlobalLevel: (level: string) => {
      Object.values(loggers).forEach(logger => {
        if (LogLevel[level as keyof typeof LogLevel] !== undefined) {
          logger.setLevel(LogLevel[level as keyof typeof LogLevel]);
        }
      });
      console.log(`All loggers' levels set to ${level}`);
    },
    showHelp: () => {
      console.log(`AgoraMind Logger Controls:\n\nGlobal:\n  AgoraLoggers.setGlobalLevel('DEBUG')\n  AgoraLoggers.setGlobalLevel('ERROR')\n\nPer logger:\n  loggerControls.setSOCKETLogLevel('DEBUG')\n  loggerControls.setCHATLogLevel('INFO')\n  loggerControls.setAPILogLevel('WARN')\n\nLevels: ERROR < WARN < INFO < DEBUG\n\nCurrent:\n  loggerControls.getSOCKETLogLevel()`);
    }
  };

  if (process.env.NODE_ENV === 'development') {
    setTimeout(() => {
      console.log('Type AgoraLoggers.showHelp() for logger help');
    }, 1000);
  }
} 