import { Injectable, UnauthorizedException, Inject, forwardRef } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { TokenBlacklistService } from './token-blacklist.service';
import { LruCacheService } from '../../cache/lru-cache.service';

// Lock key prefix for distributed token refresh locking
const REFRESH_LOCK_PREFIX = 'token:refresh:lock:';
const REFRESH_LOCK_TTL = 10000; // 10 seconds

@Injectable()
export class TokenService {
  constructor(
    private jwtService: JwtService,
    private configService: ConfigService,
    @Inject(forwardRef(() => TokenBlacklistService))
    private tokenBlacklistService: TokenBlacklistService,
    private cache: LruCacheService,
  ) {}

  /**
   * Generate access token
   */
  generateAccessToken(payload: any, expiresIn?: string): string {
    const exp = (expiresIn || this.configService.get<string>('JWT_EXPIRATION', '30m')) as any;
    return this.jwtService.sign(payload as any, {
      secret: this.configService.get<string>('JWT_SECRET'),
      expiresIn: exp,
    });
  }

  /**
   * Generate refresh token
   */
  generateRefreshToken(payload: any): string {
    const exp = this.configService.get<string>('JWT_REFRESH_EXPIRATION', '7d') as any;
    return this.jwtService.sign(payload as any, {
      secret: this.configService.get<string>('JWT_REFRESH_SECRET') ||
             this.configService.get<string>('JWT_SECRET'),
      expiresIn: exp,
    });
  }

  /**
   * Verify token (supports both access and refresh tokens)
   */
  verifyToken(token: string, isRefreshToken: boolean = false): any {
    try {
      const secret = isRefreshToken
        ? this.configService.get<string>('JWT_REFRESH_SECRET') ||
          this.configService.get<string>('JWT_SECRET')
        : this.configService.get<string>('JWT_SECRET');

      return this.jwtService.verify(token, {
        secret,
      });
    } catch (error) {
      if (error.name === 'TokenExpiredError') {
        throw new UnauthorizedException('Token has expired');
      } else if (error.name === 'JsonWebTokenError') {
        throw new UnauthorizedException('Invalid token');
      } else {
        throw new UnauthorizedException('Token verification failed');
      }
    }
  }

  /**
   * Decode token without verification
   */
  decodeToken(token: string): any {
    try {
      return this.jwtService.decode(token);
    } catch (error) {
      throw new UnauthorizedException('Failed to decode token');
    }
  }

  /**
   * Validate access token
   */
  validateAccessToken(token: string): any {
    return this.verifyToken(token, false);
  }

  /**
   * Validate refresh token
   */
  validateRefreshToken(token: string): any {
    return this.verifyToken(token, true);
  }

  /**
   * Refresh tokens - generate new access and refresh tokens
   * Implements atomic refresh with blacklist check and distributed locking
   */
  async refreshTokens(refreshToken: string) {
    // 1. Validate the refresh token first
    const payload = this.validateRefreshToken(refreshToken);
    const userId = payload.sub;

    // 2. Check if token is already blacklisted (prevents reuse)
    const isBlacklisted = await this.tokenBlacklistService.isBlacklisted(refreshToken);
    if (isBlacklisted) {
      throw new UnauthorizedException('Refresh token has been revoked');
    }

    // 3. Check if user's tokens have been invalidated
    if (payload.iat) {
      const isInvalidated = await this.tokenBlacklistService.isTokenInvalidatedForUser(
        userId,
        payload.iat,
      );
      if (isInvalidated) {
        throw new UnauthorizedException('Session has been invalidated');
      }
    }

    // 4. Acquire distributed lock to prevent concurrent refresh with same token
    const lockKey = `${REFRESH_LOCK_PREFIX}${this.hashToken(refreshToken)}`;
    const lockAcquired = await this.acquireLock(lockKey, REFRESH_LOCK_TTL);

    if (!lockAcquired) {
      throw new UnauthorizedException('Token refresh in progress, please retry');
    }

    try {
      // 5. Double-check blacklist after acquiring lock (in case of race)
      const isBlacklistedAfterLock = await this.tokenBlacklistService.isBlacklisted(refreshToken);
      if (isBlacklistedAfterLock) {
        throw new UnauthorizedException('Refresh token has been revoked');
      }

      // 6. Generate new tokens
      const newAccessToken = this.generateAccessToken({
        sub: payload.sub,
        email: payload.email,
        roles: payload.roles,
      });

      const newRefreshToken = this.generateRefreshToken({
        sub: payload.sub,
        email: payload.email,
        roles: payload.roles,
      });

      // 7. Blacklist the old refresh token BEFORE returning new tokens
      const oldTokenExpiry = payload.exp ? new Date(payload.exp * 1000) : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      await this.tokenBlacklistService.blacklistToken(refreshToken, oldTokenExpiry);

      return {
        access_token: newAccessToken,
        refresh_token: newRefreshToken,
      };
    } finally {
      // 8. Release the lock
      await this.releaseLock(lockKey);
    }
  }

  /**
   * Acquire a distributed lock using cache
   */
  private async acquireLock(key: string, ttlMs: number): Promise<boolean> {
    try {
      const existing = await this.cache.get<string>(key);
      if (existing) {
        return false; // Lock already held
      }
      await this.cache.set(key, 'locked', { ttl: ttlMs });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Release a distributed lock
   */
  private async releaseLock(key: string): Promise<void> {
    try {
      await this.cache.delete(key);
    } catch {
      // Ignore errors on lock release
    }
  }

  /**
   * Hash a token for lock key (avoid storing full token)
   */
  private hashToken(token: string): string {
    // Simple hash for lock key - just use last 16 chars of token
    return token.slice(-16);
  }

  /**
   * Get token expiration time
   */
  getTokenExpiration(token: string): Date | null {
    try {
      const decoded = this.decodeToken(token);
      if (decoded && decoded.exp) {
        return new Date(decoded.exp * 1000);
      }
      return null;
    } catch (error) {
      return null;
    }
  }

  /**
   * Check if token is expired
   */
  isTokenExpired(token: string): boolean {
    try {
      const expiration = this.getTokenExpiration(token);
      if (!expiration) return true;
      return expiration < new Date();
    } catch (error) {
      return true;
    }
  }

  /**
   * Extract user ID from token
   */
  getUserIdFromToken(token: string): string | null {
    try {
      const decoded = this.decodeToken(token);
      return decoded?.sub || null;
    } catch (error) {
      return null;
    }
  }
}
