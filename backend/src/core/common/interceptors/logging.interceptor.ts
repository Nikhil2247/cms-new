import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';
import { Request, Response } from 'express';

/**
 * Logging Interceptor
 * - Logs all HTTP requests and responses
 * - Tracks request duration
 * - Logs user information for authenticated requests
 * - Logs errors with context
 */
@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse<Response>();

    const { method, url, ip, headers } = request;
    const userAgent = headers['user-agent'] || 'unknown';
    const user = (request as any).user;

    // Get client IP (handle proxies)
    const clientIp = this.getClientIp(request);

    // Start timer
    const startTime = Date.now();

    // Log request
    this.logger.log(
      `Incoming Request: ${method} ${url} - IP: ${clientIp} - User: ${user?.id || 'anonymous'}`,
    );

    return next.handle().pipe(
      tap(() => {
        // Calculate duration
        const duration = Date.now() - startTime;
        const statusCode = response.statusCode;

        // Log successful response
        this.logger.log(
          `${method} ${url} ${statusCode} ${duration}ms - IP: ${clientIp} - User: ${user?.id || 'anonymous'} - Agent: ${this.truncate(userAgent, 50)}`,
        );

        // Log slow requests (> 1 second)
        if (duration > 1000) {
          this.logger.warn(
            `Slow Request Detected: ${method} ${url} took ${duration}ms`,
          );
        }
      }),
      catchError((error) => {
        // Calculate duration
        const duration = Date.now() - startTime;
        const statusCode = error.status || 500;

        // Log error
        this.logger.error(
          `${method} ${url} ${statusCode} ${duration}ms - IP: ${clientIp} - User: ${user?.id || 'anonymous'} - Error: ${error.message}`,
          error.stack,
        );

        // Re-throw error to be handled by exception filter
        throw error;
      }),
    );
  }

  /**
   * Get client IP address (handle proxies and load balancers)
   */
  private getClientIp(request: Request): string {
    // Check X-Forwarded-For header (added by proxies)
    const forwarded = request.headers['x-forwarded-for'];
    if (typeof forwarded === 'string') {
      return forwarded.split(',')[0].trim();
    }

    // Check X-Real-IP header
    const realIp = request.headers['x-real-ip'];
    if (realIp) {
      return realIp as string;
    }

    // Fall back to direct connection IP
    return request.ip || request.socket?.remoteAddress || 'unknown';
  }

  /**
   * Truncate string to specified length
   */
  private truncate(str: string, maxLength: number): string {
    if (!str || str.length <= maxLength) {
      return str;
    }
    return str.substring(0, maxLength) + '...';
  }
}
