import { LoggerService } from '@nestjs/common';
import * as winston from 'winston';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Detect Vercel serverless environment
 */
const isVercel =
  process.env.VERCEL === '1' || process.env.VERCEL_ENV !== undefined;

export class AppLogger implements LoggerService {
  private readonly logger: winston.Logger;
  private isLogging = false;

  constructor(private readonly context = 'App') {
    const logFormat = winston.format.combine(
      winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
      winston.format.errors({ stack: true }),
      winston.format.printf(({ timestamp, level, message, stack }) => {
        return `${timestamp} [${level.toUpperCase()}] [${this.context}] ${message}${
          stack ? '\n' + stack : ''
        }`;
      }),
    );

    /**
     * 🔥 VERCEL: CONSOLE ONLY
     */
    if (isVercel) {
      this.logger = winston.createLogger({
        level: 'debug',
        format: logFormat,
        transports: [new winston.transports.Console()],
      });
      return;
    }

    /**
     * 🟢 LOCAL / RENDER: FILE + CONSOLE
     */

    const logDir = path.join(process.cwd(), 'logs');
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }

    this.logger = winston.createLogger({
      level: 'debug',
      format: logFormat,
      transports: [
        new winston.transports.Console(),
        new winston.transports.File({
          filename: path.join(logDir, 'error.log'),
          level: 'error',
        }),
        new winston.transports.File({
          filename: path.join(logDir, 'combined.log'),
        }),
      ],
      exceptionHandlers: [
        new winston.transports.File({
          filename: path.join(logDir, 'exceptions.log'),
        }),
      ],
      rejectionHandlers: [
        new winston.transports.File({
          filename: path.join(logDir, 'rejections.log'),
        }),
      ],
    });
  }

  log(message: any, ...optionalParams: any[]) {
    this.safe(() =>
      this.logger.info(this.formatMessage(message, optionalParams)),
    );
  }

  error(message: any, ...optionalParams: any[]) {
    if (this.isLogging) {
      console.error(`[${this.context}]`, message, ...optionalParams);
      return;
    }

    this.isLogging = true;
    try {
      const formattedMessage = this.formatMessage(message, optionalParams);
      const trace = optionalParams.find(
        (p) =>
          typeof p === 'string' && (p.includes('at ') || p.includes('Error')),
      );

      trace
        ? this.logger.error(formattedMessage, { stack: trace })
        : this.logger.error(formattedMessage);
    } finally {
      this.isLogging = false;
    }
  }

  warn(message: any, ...optionalParams: any[]) {
    this.safe(() =>
      this.logger.warn(this.formatMessage(message, optionalParams)),
    );
  }

  debug(message: any, ...optionalParams: any[]) {
    this.safe(() =>
      this.logger.debug(this.formatMessage(message, optionalParams)),
    );
  }

  verbose(message: any, ...optionalParams: any[]) {
    this.safe(() =>
      this.logger.verbose(this.formatMessage(message, optionalParams)),
    );
  }

  private safe(fn: () => void) {
    try {
      fn();
    } catch {
      console.log(`[${this.context}]`, 'Logger fallback');
    }
  }

  private formatMessage(message: any, optionalParams: any[]): string {
    if (typeof message === 'string') {
      return optionalParams.length
        ? `${message} ${optionalParams
            .map((p) => (typeof p === 'object' ? JSON.stringify(p) : String(p)))
            .join(' ')}`
        : message;
    }
    return JSON.stringify(message);
  }
}

/**
 * Global logger instance
 */
export const appLogger = new AppLogger();
