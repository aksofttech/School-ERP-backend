import {
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaService.name);

  constructor(private configService: ConfigService) {
    const isLoggingEnabled =
      configService.get<string>('PRISMA_LOGGING') === 'true';

    super({
      log: isLoggingEnabled
        ? [
            { emit: 'event', level: 'query' },
            { emit: 'stdout', level: 'info' },
            { emit: 'stdout', level: 'warn' },
            { emit: 'stdout', level: 'error' },
          ]
        : ['error', 'warn'],
    });

    if (isLoggingEnabled) {
      (this as any).$on('query', (e: any) => {
        this.logger.debug(`Query: ${e.query}`);
        this.logger.debug(`Params: ${e.params}`);
        this.logger.debug(`Duration: ${e.duration}ms`);
      });
    }

    // Middleware: auto-reconnect on stale Neon connections (kind: Closed)
    // Neon's serverless Postgres idles out after ~5 min of inactivity.
    // This middleware detects the closed-connection error and retries once.
    (this as any).$use(async (params: any, next: any) => {
      try {
        return await next(params);
      } catch (error: any) {
        const isClosedConnection =
          error?.message?.includes('kind: Closed') ||
          error?.message?.includes('Error { kind: Closed') ||
          error?.code === 'P1001' ||  // Connection refused
          error?.code === 'P1017';    // Server closed the connection

        if (isClosedConnection) {
          this.logger.warn(
            '[Prisma] Detected closed/stale connection. Reconnecting...',
          );
          try {
            await this.$disconnect();
            await this.$connect();
            this.logger.log('[Prisma] Reconnected successfully. Retrying query...');
            return await next(params);
          } catch (reconnectError: any) {
            this.logger.error(
              `[Prisma] Reconnection failed: ${reconnectError.message}`,
            );
            throw reconnectError;
          }
        }
        throw error;
      }
    });
  }

  async onModuleInit() {
    const maxRetries = this.configService.get<number>('DB_RETRY_ATTEMPTS') || 5;
    const retryDelay = this.configService.get<number>('DB_RETRY_DELAY') || 2000;

    let currentAttempt = 0;
    let connected = false;

    while (currentAttempt < maxRetries && !connected) {
      try {
        currentAttempt++;
        await this.$connect();
        this.logger.log('Successfully connected to the database');
        connected = true;
      } catch (error) {
        this.logger.error(
          `Failed to connect to the database (Attempt ${currentAttempt}/${maxRetries}). Error: ${error.message}`,
        );

        if (currentAttempt < maxRetries) {
          this.logger.log(`Retrying in ${retryDelay}ms...`);
          await new Promise((resolve) => setTimeout(resolve, retryDelay));
        } else {
          this.logger.error(
            'Max database connection retries reached. Exiting...',
          );
          throw error;
        }
      }
    }
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
