import {
  Injectable,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { TokenBlacklistService } from '../services/token-blacklist.service';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(
    private reflector: Reflector,
    private tokenBlacklistService: TokenBlacklistService,
  ) {
    super();
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Check if route is marked as public
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    // Extract token from request
    const request = context.switchToHttp().getRequest();
    const token = this.extractTokenFromHeader(request);

    if (!token) {
      throw new UnauthorizedException('No token provided');
    }

    // Validate token with passport strategy and check blacklist in parallel
    const [canActivate, isBlacklisted] = await Promise.all([
      super.canActivate(context) as Promise<boolean>,
      this.tokenBlacklistService.isBlacklisted(token),
    ]);

    if (!canActivate) {
      throw new UnauthorizedException('Invalid token');
    }

    if (isBlacklisted) {
      throw new UnauthorizedException('Token has been revoked');
    }

    // Check if user's tokens have been invalidated
    const user = request.user;
    if (user && user.iat) {
      const isInvalidated =
        await this.tokenBlacklistService.isTokenInvalidatedForUser(
          user.sub,
          user.iat,
        );

      if (isInvalidated) {
        throw new UnauthorizedException('Session has been invalidated');
      }
    }

    return true;
  }

  /**
   * Extract JWT token from Authorization header
   */
  private extractTokenFromHeader(request: any): string | null {
    const authHeader = request.headers?.authorization;
    if (!authHeader) {
      return null;
    }

    const [type, token] = authHeader.split(' ');
    return type === 'Bearer' ? token : null;
  }

  /**
   * Handle request to add user to request object
   */
  handleRequest(err: any, user: any, info: any) {
    if (err || !user) {
      throw err || new UnauthorizedException('Authentication failed');
    }
    return user;
  }
}
