import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class TokenService {
  constructor(
    private jwtService: JwtService,
    private configService: ConfigService,
  ) {}

  /**
   * Generate access token
   */
  generateAccessToken(payload: any, expiresIn?: string): string {
    const exp = (expiresIn || this.configService.get<string>('JWT_EXPIRATION', '15m')) as any;
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
   */
  async refreshTokens(refreshToken: string) {
    const payload = this.validateRefreshToken(refreshToken);

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

    return {
      access_token: newAccessToken,
      refresh_token: newRefreshToken,
    };
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
