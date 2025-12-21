import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

/**
 * Security Interceptor for XSS prevention and data sanitization
 * - Sanitizes request body to prevent XSS attacks
 * - Removes sensitive fields from responses
 * - Adds security headers to responses
 */
@Injectable()
export class SecurityInterceptor implements NestInterceptor {
  private readonly sensitiveFields = [
    'password',
    'passwordHash',
    'refreshToken',
    'resetToken',
    'verificationToken',
    'secret',
    'privateKey',
    'apiKey',
    'accessToken',
  ];

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const response = context.switchToHttp().getResponse();

    // Sanitize request body
    if (request.body && typeof request.body === 'object') {
      request.body = this.sanitizeObject(request.body);
    }

    // Add security headers
    this.addSecurityHeaders(response);

    // Process response and remove sensitive fields
    return next.handle().pipe(
      map((data) => {
        if (data && typeof data === 'object') {
          return this.removeSensitiveFields(data);
        }
        return data;
      }),
    );
  }

  /**
   * Sanitize object to prevent XSS attacks
   */
  private sanitizeObject(obj: any): any {
    if (typeof obj !== 'object' || obj === null) {
      return this.sanitizeValue(obj);
    }

    if (Array.isArray(obj)) {
      return obj.map((item) => this.sanitizeObject(item));
    }

    const sanitized: any = {};
    for (const [key, value] of Object.entries(obj)) {
      if (typeof value === 'object' && value !== null) {
        sanitized[key] = this.sanitizeObject(value);
      } else {
        sanitized[key] = this.sanitizeValue(value);
      }
    }
    return sanitized;
  }

  /**
   * Sanitize individual value
   */
  private sanitizeValue(value: any): any {
    if (typeof value !== 'string') {
      return value;
    }

    // Remove potential XSS vectors
    return value
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
      .replace(/on\w+\s*=/gi, '') // Remove event handlers like onclick=
      .replace(/javascript:/gi, '')
      .replace(/data:text\/html/gi, '');
  }

  /**
   * Remove sensitive fields from response data
   */
  private removeSensitiveFields(data: any, visited = new WeakSet<any>()): any {
    if (typeof data !== 'object' || data === null) {
      return data;
    }

    // Handle circular references
    if (visited.has(data)) {
      return;
    }
    visited.add(data);

    if (data instanceof Date) return data;
    if (data instanceof RegExp) return data;
    if (typeof Buffer !== 'undefined' && Buffer.isBuffer(data)) return data;
    
    // Skip streams and response objects
    if (
      (data.pipe && typeof data.pipe === 'function') ||
      (data.headersSent !== undefined && data.send && typeof data.send === 'function')
    ) {
      return data;
    }

    if (Array.isArray(data)) {
      return data.map((item) => this.removeSensitiveFields(item, visited));
    }

    const cleaned: any = {};
    for (const [key, value] of Object.entries(data)) {
      // Skip sensitive fields
      if (this.sensitiveFields.includes(key)) {
        continue;
      }

      if (typeof value === 'object' && value !== null) {
        cleaned[key] = this.removeSensitiveFields(value, visited);
      } else {
        cleaned[key] = value;
      }
    }
    return cleaned;
  }

  /**
   * Add security headers to response
   */
  private addSecurityHeaders(response: any): void {
    // Prevent MIME type sniffing
    response.setHeader('X-Content-Type-Options', 'nosniff');

    // Enable XSS protection
    response.setHeader('X-XSS-Protection', '1; mode=block');

    // Prevent clickjacking
    response.setHeader('X-Frame-Options', 'DENY');

    // Disable caching for sensitive data
    response.setHeader(
      'Cache-Control',
      'no-store, no-cache, must-revalidate, proxy-revalidate',
    );
    response.setHeader('Pragma', 'no-cache');
    response.setHeader('Expires', '0');

    // Strict Transport Security (HSTS)
    response.setHeader(
      'Strict-Transport-Security',
      'max-age=31536000; includeSubDomains',
    );
  }
}
