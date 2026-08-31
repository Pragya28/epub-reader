export const LogLevel = {
  TRACE: "TRACE",
  DEBUG: "DEBUG",
  INFO: "INFO",
  WARN: "WARN",
  ERROR: "ERROR",
} as const;

export type LogLevel = (typeof LogLevel)[keyof typeof LogLevel];

import { recordError } from "./error-log";

type Metadata = Record<string, unknown>;

const LEVEL_ORDER: Record<LogLevel, number> = {
  [LogLevel.TRACE]: 0,
  [LogLevel.DEBUG]: 1,
  [LogLevel.INFO]: 2,
  [LogLevel.WARN]: 3,
  [LogLevel.ERROR]: 4,
};

export class Logger {
  private readonly enabled: boolean;
  private readonly minLevel: LogLevel;
  private readonly scope?: string;
  private readonly startTime: number;

  constructor(options?: {
    enabled?: boolean;
    minLevel?: LogLevel;
    scope?: string;
  }) {
    this.enabled = options?.enabled ?? import.meta.env.DEV;
    this.minLevel = options?.minLevel ?? LogLevel.TRACE;
    this.scope = options?.scope;
    this.startTime = performance.now();
  }

  /** Returns a logger that prefixes every line with `scope`, inheriting
   * this logger's enabled/minLevel settings unless overridden. Useful for
   * isolating log output per-module (e.g. `logger.child("reader-engine")`)
   * when several systems log during the same event tick.
   */
  child(scope: string, options?: { minLevel?: LogLevel }): Logger {
    return new Logger({
      enabled: this.enabled,
      minLevel: options?.minLevel ?? this.minLevel,
      scope: this.scope ? `${this.scope}:${scope}` : scope,
    });
  }

  trace(message: string, metadata?: Metadata): void {
    this.log(LogLevel.TRACE, message, metadata);
  }

  debug(message: string, metadata?: Metadata): void {
    this.log(LogLevel.DEBUG, message, metadata);
  }

  info(message: string, metadata?: Metadata): void {
    this.log(LogLevel.INFO, message, metadata);
  }

  warn(message: string, metadata?: Metadata): void {
    this.log(LogLevel.WARN, message, metadata);
  }

  error(message: string, error?: unknown): void {
    this.log(LogLevel.ERROR, message, { error });
    recordError({ scope: this.scope, message, error });
  }

  private log(level: LogLevel, message: string, metadata?: Metadata): void {
    if (level !== LogLevel.ERROR) {
      if (!this.enabled) return;
      if (LEVEL_ORDER[level] < LEVEL_ORDER[this.minLevel]) return;
    }

    const elapsedMs = (performance.now() - this.startTime).toFixed(1);
    const prefix = this.scope
      ? `[${level}] [+${elapsedMs}ms] [${this.scope}]`
      : `[${level}] [+${elapsedMs}ms]`;

    const args =
      metadata !== undefined ? [prefix, message, metadata] : [prefix, message];

    switch (level) {
      case LogLevel.TRACE:
      case LogLevel.DEBUG:
        console.debug(...args);
        break;
      case LogLevel.INFO:
        console.info(...args);
        break;
      case LogLevel.WARN:
        console.warn(...args);
        break;
      case LogLevel.ERROR:
        console.error(...args);
        break;
    }
  }
}

export const logger = new Logger();
