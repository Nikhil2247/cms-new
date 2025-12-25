import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../../database/prisma.service';
import { TokenService } from './token.service';
import { TokenBlacklistService } from './token-blacklist.service';
import { User } from '@prisma/client';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private prisma: PrismaService,
    private tokenService: TokenService,
    private tokenBlacklistService: TokenBlacklistService,
  ) {}

  /**
   * Validate user credentials
   */
  async validateUser(email: string, password: string): Promise<any> {
    const user = await this.prisma.user.findUnique({
      where: { email },
      include: {
        Institution: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
      },
    });

    if (!user) {
      this.logger.warn(`User not found with email: ${email}`);
      throw new UnauthorizedException('Invalid credentials');
    }

    if (!user.active) {
      this.logger.warn(`Inactive account attempted login: ${email}`);
      throw new UnauthorizedException('Account is inactive');
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      this.logger.warn(`Invalid password for user: ${email}`);
      throw new UnauthorizedException('Invalid credentials');
    }

    // Update login tracking (non-blocking - don't fail login if this fails)
    this.updateLoginTracking(user.id).catch((err) => {
      this.logger.warn(`Failed to update login tracking for user ${user.id}: ${err.message}`);
    });

    // Flatten institution data for easier frontend access
    const { password: _, Institution, ...result } = user;
    return {
      ...result,
      institutionName: Institution?.name || null,
      institutionCode: Institution?.code || null,
    };
  }

  /**
   * Login user and return tokens
   */
  async login(user: any) {
    const payload = {
      sub: user.id,
      email: user.email,
      roles: user.role ? [user.role] : [],
    };

    const accessToken = this.tokenService.generateAccessToken(payload);
    const refreshToken = this.tokenService.generateRefreshToken(payload);

    return {
      access_token: accessToken,
      refresh_token: refreshToken,
      user,
    };
  }

  /**
   * Register new user
   */
  async register(userData: {
    email: string;
    password: string;
    name: string;
    phoneNo?: string;
    role?: any;
  }) {
    const existingUser = await this.prisma.user.findUnique({
      where: { email: userData.email },
    });

    if (existingUser) {
      throw new BadRequestException('User with this email already exists');
    }

    const hashedPassword = await bcrypt.hash(userData.password, 10);

    const user = await this.prisma.user.create({
      data: {
        email: userData.email,
        password: hashedPassword,
        name: userData.name,
        phoneNo: userData.phoneNo,
        role: userData.role || 'STUDENT',
        active: true,
        loginCount: 0,
        hasChangedDefaultPassword: true,
      },
    });

    const { password: _, ...result } = user;
    return this.login(result);
  }

  /**
   * Refresh access token using refresh token
   */
  async refreshToken(refreshToken: string) {
    try {
      const payload = this.tokenService.verifyToken(refreshToken, true);

      const user = await this.prisma.user.findUnique({
        where: { id: payload.sub },
      });

      if (!user) {
        throw new UnauthorizedException('User not found');
      }

      if (!user.active) {
        throw new UnauthorizedException('Account is inactive');
      }

      const { password: _, ...userWithoutPassword } = user;
      return this.login(userWithoutPassword);
    } catch (error) {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  /**
   * Send password reset email (generates reset token)
   */
  async forgotPassword(email: string) {
    const user = await this.prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      // Security: Don't reveal if user exists
      return {
        message: 'If the email exists, a password reset link has been sent',
      };
    }

    // Generate reset token (valid for 1 hour)
    const resetToken = this.tokenService.generateAccessToken(
      { email, sub: user.id, type: 'reset' },
      '1h',
    );

    // Store reset token and expiry in database
    const expiryDate = new Date();
    expiryDate.setHours(expiryDate.getHours() + 1);

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        resetPasswordToken: resetToken,
        resetPasswordExpiry: expiryDate,
      },
    });

    // TODO: Send email with reset token
    // await this.emailService.sendPasswordResetEmail(email, resetToken);

    return {
      message: 'If the email exists, a password reset link has been sent',
      // For development only - remove in production
      resetToken: process.env.NODE_ENV === 'development' ? resetToken : undefined,
    };
  }

  /**
   * Reset password using reset token
   */
  async resetPassword(token: string, newPassword: string) {
    // Verify the token
    let payload: any;
    try {
      payload = this.tokenService.verifyToken(token);
    } catch (error) {
      throw new UnauthorizedException('Invalid or expired reset token');
    }

    if (payload.type !== 'reset') {
      throw new UnauthorizedException('Invalid token type');
    }

    // Find user with matching reset token
    const user = await this.prisma.user.findFirst({
      where: {
        id: payload.sub,
        resetPasswordToken: token,
      },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid reset token');
    }

    // Check if token has expired
    if (!user.resetPasswordExpiry || user.resetPasswordExpiry < new Date()) {
      throw new UnauthorizedException('Reset token has expired');
    }

    // Hash new password and update user
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        password: hashedPassword,
        resetPasswordToken: null,
        resetPasswordExpiry: null,
        passwordChangedAt: new Date(),
        hasChangedDefaultPassword: true,
      },
    });

    return { message: 'Password reset successfully' };
  }

  /**
   * Change password for authenticated user
   */
  async changePassword(
    userId: string,
    oldPassword: string,
    newPassword: string,
  ) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Verify old password
    const isOldPasswordValid = await bcrypt.compare(oldPassword, user.password);

    if (!isOldPasswordValid) {
      throw new BadRequestException('Current password is incorrect');
    }

    // Check if new password is same as old
    const isSamePassword = await bcrypt.compare(newPassword, user.password);
    if (isSamePassword) {
      throw new BadRequestException(
        'New password must be different from current password',
      );
    }

    // Hash new password and update
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        password: hashedPassword,
        passwordChangedAt: new Date(),
        hasChangedDefaultPassword: true,
      },
    });

    return { message: 'Password changed successfully' };
  }

  /**
   * Get user profile by ID
   */
  async getUserProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        phoneNo: true,
        rollNumber: true,
        dob: true,
        branchName: true,
        designation: true,
        role: true,
        active: true,
        lastLoginAt: true,
        loginCount: true,
        hasChangedDefaultPassword: true,
        createdAt: true,
        institutionId: true,
        consent: true,
        consentAt: true,
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }

  /**
   * Update login tracking information
   */
  private async updateLoginTracking(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { lastLoginAt: true, loginCount: true },
    });

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        previousLoginAt: user?.lastLoginAt || null,
        lastLoginAt: new Date(),
        loginCount: (user?.loginCount || 0) + 1,
      },
    });
  }

  /**
   * Validate user by ID (used by JWT strategy)
   */
  async validateUserById(userId: string): Promise<User | null> {
    return this.prisma.user.findUnique({
      where: { id: userId, active: true },
    });
  }

  /**
   * Logout user - blacklist the current token
   */
  async logout(token: string, userId: string): Promise<void> {
    try {
      // Decode token to get expiration
      const decoded = this.tokenService.decodeToken(token);
      if (!decoded || !decoded.exp) {
        throw new BadRequestException('Invalid token');
      }

      const expiresAt = new Date(decoded.exp * 1000);

      // Blacklist the token
      await this.tokenBlacklistService.blacklistToken(token, expiresAt);

      this.logger.log(`User ${userId} logged out successfully`);
    } catch (error) {
      this.logger.error(`Failed to logout user ${userId}`, error);
      throw error;
    }
  }

  /**
   * Logout from all devices - invalidate all tokens for the user
   */
  async logoutAllDevices(userId: string): Promise<void> {
    try {
      await this.tokenBlacklistService.invalidateUserTokens(userId);
      this.logger.log(`All sessions invalidated for user ${userId}`);
    } catch (error) {
      this.logger.error(`Failed to logout all devices for user ${userId}`, error);
      throw error;
    }
  }

  /**
   * Force logout a user (admin action)
   */
  async forceLogout(targetUserId: string, adminUserId: string): Promise<void> {
    try {
      // Verify target user exists
      const user = await this.prisma.user.findUnique({
        where: { id: targetUserId },
      });

      if (!user) {
        throw new NotFoundException('User not found');
      }

      // Invalidate all tokens for the target user
      await this.tokenBlacklistService.invalidateUserTokens(targetUserId);

      this.logger.log(
        `Admin ${adminUserId} forced logout for user ${targetUserId}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to force logout user ${targetUserId} by admin ${adminUserId}`,
        error,
      );
      throw error;
    }
  }

  /**
   * Admin reset password - Generate random password and update user
   */
  async adminResetPassword(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        active: true,
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (!user.active) {
      throw new BadRequestException('Cannot reset password for inactive user');
    }

    // Generate random password (8 characters: letters + numbers)
    const newPassword = this.generateRandomPassword();

    // Hash the new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Update user with new password
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        password: hashedPassword,
        passwordChangedAt: new Date(),
        hasChangedDefaultPassword: false, // User must change on next login
        // Force logout from all devices
        resetPasswordToken: null,
        resetPasswordExpiry: null,
      },
    });

    // Invalidate all existing tokens for this user
    await this.tokenBlacklistService.invalidateUserTokens(userId);

    this.logger.log(`Admin reset password for user ${userId}`);

    // TODO: Send email with new password
    // await this.emailService.sendPasswordResetNotification(user.email, newPassword);

    return {
      success: true,
      userId: user.id,
      email: user.email,
      name: user.name,
      // Return password only in development mode
      newPassword: process.env.NODE_ENV === 'development' ? newPassword : undefined,
      message: 'Password reset successfully. User will be notified via email.',
    };
  }

  /**
   * Bulk reset passwords for multiple users
   */
  async bulkResetPasswords(userIds: string[]) {
    if (!userIds || userIds.length === 0) {
      throw new BadRequestException('No user IDs provided');
    }

    if (userIds.length > 100) {
      throw new BadRequestException('Cannot reset passwords for more than 100 users at once');
    }

    const results = [];
    const errors = [];

    for (const userId of userIds) {
      try {
        const result = await this.adminResetPassword(userId);
        results.push({
          userId,
          success: true,
          email: result.email,
          name: result.name,
          newPassword: result.newPassword,
        });
      } catch (error) {
        this.logger.error(`Failed to reset password for user ${userId}`, error);
        errors.push({
          userId,
          success: false,
          error: error.message || 'Failed to reset password',
        });
      }
    }

    return {
      total: userIds.length,
      successful: results.length,
      failed: errors.length,
      results,
      errors,
    };
  }

  /**
   * Generate random password
   * Format: 8 characters (uppercase, lowercase, numbers)
   */
  private generateRandomPassword(): string {
    const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const lowercase = 'abcdefghijklmnopqrstuvwxyz';
    const numbers = '0123456789';
    const all = uppercase + lowercase + numbers;

    let password = '';

    // Ensure at least one of each type
    password += uppercase[Math.floor(Math.random() * uppercase.length)];
    password += lowercase[Math.floor(Math.random() * lowercase.length)];
    password += numbers[Math.floor(Math.random() * numbers.length)];

    // Fill remaining characters
    for (let i = 3; i < 8; i++) {
      password += all[Math.floor(Math.random() * all.length)];
    }

    // Shuffle the password
    return password.split('').sort(() => Math.random() - 0.5).join('');
  }
}
