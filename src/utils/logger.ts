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
}

class Logger {
  private level: LogLevel;
  private name: string;
  private prefix: string;

  constructor(config: LoggerConfig = {}) {
    this.name = config.name || 'DEFAULT';
    this.prefix = config.prefix || '';

    // 환경변수에서 로그 레벨 결정
    this.level = this.determineLogLevel(config.level);

    // 브라우저에서 런타임 제어 기능 초기화
    if (typeof window !== 'undefined') {
      this.initBrowserControls();
    }
  }

  private determineLogLevel(configLevel?: LogLevel): LogLevel {
    // 1. 설정에서 명시적으로 지정된 레벨
    if (configLevel !== undefined) {
      return configLevel;
    }

    // 2. 브라우저에서 localStorage 확인
    if (typeof window !== 'undefined') {
      const savedLevel = localStorage.getItem(`debug_log_level_${this.name}`);
      if (savedLevel && LogLevel[savedLevel as keyof typeof LogLevel] !== undefined) {
        return LogLevel[savedLevel as keyof typeof LogLevel];
      }

      // URL 파라미터 확인
      const urlParams = new URLSearchParams(window.location.search);
      if (urlParams.has('debug')) {
        return LogLevel.DEBUG;
      }
    }

    // 3. 환경변수 확인
    const envLevel = process.env.NEXT_PUBLIC_LOG_LEVEL || 
                     process.env[`NEXT_PUBLIC_${this.name}_LOG_LEVEL`];
    
    if (envLevel && LogLevel[envLevel as keyof typeof LogLevel] !== undefined) {
      return LogLevel[envLevel as keyof typeof LogLevel];
    }

    // 4. 기본값: 프로덕션에서는 ERROR, 개발환경에서는 DEBUG
    return process.env.NODE_ENV === 'production' ? LogLevel.ERROR : LogLevel.DEBUG;
  }

  private initBrowserControls() {
    // 글로벌 객체에 로그 제어 함수들 추가
    (window as any).loggerControls = {
      ...(window as any).loggerControls,
      [`set${this.name}LogLevel`]: (level: string) => {
        if (LogLevel[level as keyof typeof LogLevel] !== undefined) {
          localStorage.setItem(`debug_log_level_${this.name}`, level);
          this.level = LogLevel[level as keyof typeof LogLevel];
          console.log(`🔧 ${this.name} 로그 레벨이 ${level}로 변경되었습니다.`);
        } else {
          console.error(`❌ 유효하지 않은 로그 레벨: ${level}. 사용 가능: ERROR, WARN, INFO, DEBUG`);
        }
      },
      [`get${this.name}LogLevel`]: () => {
        const currentLevel = LogLevel[this.level];
        console.log(`ℹ️ ${this.name} 현재 로그 레벨: ${currentLevel}`);
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

  private formatMessage(level: string, emoji: string, ...args: any[]): any[] {
    const timestamp = new Date().toISOString().substr(11, 12);
    const prefix = this.prefix ? `${this.prefix} ` : '';
    return [`${emoji} [${timestamp}] ${prefix}${this.name}:`, ...args];
  }

  error(...args: any[]) {
    if (this.level >= LogLevel.ERROR) {
      console.error(...this.formatMessage('ERROR', '🚨', ...args));
    }
  }

  warn(...args: any[]) {
    if (this.level >= LogLevel.WARN) {
      console.warn(...this.formatMessage('WARN', '⚠️', ...args));
    }
  }

  info(...args: any[]) {
    if (this.level >= LogLevel.INFO) {
      console.log(...this.formatMessage('INFO', 'ℹ️', ...args));
    }
  }

  debug(...args: any[]) {
    if (this.level >= LogLevel.DEBUG) {
      console.log(...this.formatMessage('DEBUG', '🐛', ...args));
    }
  }

  // 항상 출력되는 강제 로그 (긴급 디버깅용)
  force(...args: any[]) {
    console.log(...this.formatMessage('FORCE', '🔧', ...args));
  }

  // 그룹 로깅
  group(name: string, collapsed: boolean = false) {
    if (this.level >= LogLevel.DEBUG) {
      if (collapsed) {
        console.groupCollapsed(...this.formatMessage('GROUP', '📁', name));
      } else {
        console.group(...this.formatMessage('GROUP', '📂', name));
      }
    }
  }

  groupEnd() {
    if (this.level >= LogLevel.DEBUG) {
      console.groupEnd();
    }
  }

  // 성능 측정
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

// 기본 로거
export const logger = new Logger({ name: 'GLOBAL' });

// 카테고리별 로거들
export const loggers = {
  socket: new Logger({ name: 'SOCKET', prefix: '🔌' }),
  chat: new Logger({ name: 'CHAT', prefix: '💬' }),
  api: new Logger({ name: 'API', prefix: '🌐' }),
  npc: new Logger({ name: 'NPC', prefix: '🤖' }),
  auth: new Logger({ name: 'AUTH', prefix: '🔐' }),
  db: new Logger({ name: 'DB', prefix: '💾' }),
  ui: new Logger({ name: 'UI', prefix: '🎨' }),
  rag: new Logger({ name: 'RAG', prefix: '🔍' })
};

// 기존 console.log 호환성을 위한 래퍼
export const createCompatLogger = (originalConsole = console) => ({
  log: (...args: any[]) => logger.debug(...args),
  warn: (...args: any[]) => logger.warn(...args),
  error: (...args: any[]) => logger.error(...args),
  info: (...args: any[]) => logger.info(...args),
  debug: (...args: any[]) => logger.debug(...args),
  group: (name: string) => logger.group(name),
  groupCollapsed: (name: string) => logger.group(name, true),
  groupEnd: () => logger.groupEnd(),
  time: (label: string) => logger.time(label),
  timeEnd: (label: string) => logger.timeEnd(label)
});

// 개발자 도구용 헬퍼
if (typeof window !== 'undefined') {
  (window as any).AgoraLoggers = {
    setGlobalLevel: (level: string) => {
      Object.values(loggers).forEach(logger => {
        if (LogLevel[level as keyof typeof LogLevel] !== undefined) {
          logger.setLevel(LogLevel[level as keyof typeof LogLevel]);
        }
      });
      console.log(`🔧 모든 로거의 레벨이 ${level}로 변경되었습니다.`);
    },
    showHelp: () => {
      console.log(`
🔧 AgoraMind 로거 제어 명령어:

전체 제어:
  AgoraLoggers.setGlobalLevel('DEBUG')  // 모든 로그 활성화
  AgoraLoggers.setGlobalLevel('ERROR')  // 에러만 표시

개별 제어:
  loggerControls.setSOCKETLogLevel('DEBUG')
  loggerControls.setCHATLogLevel('INFO')
  loggerControls.setAPILogLevel('WARN')
  
로그 레벨: ERROR < WARN < INFO < DEBUG

현재 상태 확인:
  loggerControls.getSOCKETLogLevel()
      `);
    }
  };

  // 초기 도움말 표시 (개발환경에서만)
  if (process.env.NODE_ENV === 'development') {
    setTimeout(() => {
      console.log('🔧 로거 도움말을 보려면 AgoraLoggers.showHelp() 를 입력하세요');
    }, 1000);
  }
} 