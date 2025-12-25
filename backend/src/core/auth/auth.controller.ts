import {
  Controller,
  Post,
  Body,
  UseGuards,
  Get,
  Req,
  HttpCode,
  HttpStatus,
  Headers,
} from '@nestjs/common';
import { Request } from 'express';
import { AuthService } from './services/auth.service';
import { TokenService } from './services/token.service';
import { Public } from './decorators/public.decorator';
import { CurrentUser } from './decorators/current-user.decorator';
import { AuthGuard } from '@nestjs/passport';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RolesGuard } from './guards/roles.guard';
import { Roles } from './decorators/roles.decorator';
import { Role } from '@prisma/client';
import {
  LoginDto,
  RegisterDto,
  RefreshTokenDto,
  ForgotPasswordDto,
  ResetPasswordDto,
  ChangePasswordDto,
} from './dto';

@Controller('auth')
export class AuthController {
  constructor(
    private authService: AuthService,
    private tokenService: TokenService,
  ) {}

  /**
   * Login endpoint
   */
  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() loginDto: LoginDto,
    @Req() req: Request,
  ) {
    const ipAddress = req.ip || req.headers['x-forwarded-for'] as string;
    const userAgent = req.headers['user-agent'];
    const user = await this.authService.validateUser(
      loginDto.email,
      loginDto.password,
      ipAddress,
      userAgent,
    );
    return this.authService.login(user, ipAddress, userAgent);
  }

  /**
   * Register endpoint
   */
  @Public()
  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  async register(
    @Body() registerDto: RegisterDto,
    @Req() req: Request,
  ) {
    const ipAddress = req.ip || req.headers['x-forwarded-for'] as string;
    const userAgent = req.headers['user-agent'];
    return this.authService.register(registerDto, ipAddress, userAgent);
  }

  /**
   * Refresh token endpoint
   */
  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(@Body() refreshTokenDto: RefreshTokenDto) {
    return this.tokenService.refreshTokens(refreshTokenDto.refresh_token);
  }

  /**
   * Forgot password endpoint
   */
  @Public()
  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  async forgotPassword(@Body() forgotPasswordDto: ForgotPasswordDto) {
    return this.authService.forgotPassword(forgotPasswordDto.email);
  }

  /**
   * Reset password endpoint
   */
  @Public()
  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  async resetPassword(@Body() resetPasswordDto: ResetPasswordDto) {
    return this.authService.resetPassword(
      resetPasswordDto.token,
      resetPasswordDto.password,
    );
  }

  /**
   * Change password endpoint (requires authentication)
   */
  @Post('change-password')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async changePassword(
    @CurrentUser() user: any,
    @Body() changePasswordDto: ChangePasswordDto,
    @Req() req: Request,
  ) {
    const ipAddress = req.ip || req.headers['x-forwarded-for'] as string;
    const userAgent = req.headers['user-agent'];
    return this.authService.changePassword(
      user.userId,
      changePasswordDto.oldPassword,
      changePasswordDto.newPassword,
      ipAddress,
      userAgent,
    );
  }

  /**
   * Get current user profile
   */
  @Get('me')
  @UseGuards(JwtAuthGuard)
  async getCurrentUser(@CurrentUser() user: any) {
    return this.authService.getUserProfile(user.userId);
  }

  /**
   * Logout endpoint
   */
  @Post('logout')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async logout(
    @CurrentUser() user: any,
    @Req() req: Request,
    @Headers('authorization') authorization: string,
  ) {
    const ipAddress = req.ip || req.headers['x-forwarded-for'] as string;
    const userAgent = req.headers['user-agent'];
    const token = authorization?.replace('Bearer ', '');

    if (token) {
      await this.authService.logout(token, user.userId, ipAddress, userAgent);
    }

    return { message: 'Logged out successfully' };
  }

  /**
   * Google OAuth login
   */
  @Public()
  @Get('google')
  @UseGuards(AuthGuard('google'))
  async googleAuth(@Req() req) {
    // Initiates the Google OAuth2 login flow
  }

  /**
   * Google OAuth callback
   */
  @Public()
  @Get('google/callback')
  @UseGuards(AuthGuard('google'))
  async googleAuthRedirect(@Req() req) {
    return this.authService.login(req.user);
  }

  /**
   * Admin reset user password
   */
  @Post('admin/reset-password')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.STATE_DIRECTORATE, Role.SYSTEM_ADMIN, Role.PRINCIPAL)
  @HttpCode(HttpStatus.OK)
  async adminResetPassword(
    @Body() body: { userId: string },
    @CurrentUser() user: any,
    @Req() req: Request,
  ) {
    const ipAddress = req.ip || req.headers['x-forwarded-for'] as string;
    const userAgent = req.headers['user-agent'];
    return this.authService.adminResetPassword(body.userId, user.userId, ipAddress, userAgent);
  }

  /**
   * Admin bulk reset passwords
   */
  @Post('admin/bulk-reset')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.STATE_DIRECTORATE, Role.SYSTEM_ADMIN)
  @HttpCode(HttpStatus.OK)
  async bulkResetPasswords(
    @Body() body: { userIds: string[] },
    @CurrentUser() user: any,
    @Req() req: Request,
  ) {
    const ipAddress = req.ip || req.headers['x-forwarded-for'] as string;
    const userAgent = req.headers['user-agent'];
    return this.authService.bulkResetPasswords(body.userIds, user.userId, ipAddress, userAgent);
  }
}
