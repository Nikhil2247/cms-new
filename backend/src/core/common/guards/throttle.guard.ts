import { Injectable, ExecutionContext } from '@nestjs/common';
import { ThrottlerGuard, ThrottlerLimitDetail } from '@nestjs/throttler';

/**
 * Custom Throttle Guard for rate limiting
 * Tracks requests by IP address or user ID for authenticated requests
 */
@Injectable()
export class CustomThrottleGuard extends ThrottlerGuard {
  /**
   * Skip throttling for OPTIONS requests (CORS preflight)
   */
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    if (request.method === 'OPTIONS') {
      return true;
    }
    return super.canActivate(context);
  }

  /**
   * Get the tracker key for rate limiting
   * Uses user ID for authenticated requests, falls back to IP address
   */
  protected async getTracker(req: Record<string, any>): Promise<string> {
    // If user is authenticated, use user ID for more accurate rate limiting
    if (req.user && req.user.userId) {
      return `user-${req.user.userId}`;
    }

    // Fall back to IP address for unauthenticated requests
    // Handle various proxy scenarios
    const ip =
      req.ip ||
      req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
      req.headers['x-real-ip'] ||
      req.connection?.remoteAddress ||
      'unknown';

    return `ip-${ip}`;
  }

  /**
   * Override to provide custom error message
   */
  protected async getErrorMessage(
    context: ExecutionContext,
    throttlerLimitDetail: ThrottlerLimitDetail,
  ): Promise<string> {
    return 'Too many requests. Please try again later.';
  }
}
