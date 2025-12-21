import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import * as handlebars from 'handlebars';
import * as fs from 'fs';
import * as path from 'path';

interface MailData {
  to: string;
  subject: string;
  template: string;
  context: any;
}

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private transporter: nodemailer.Transporter;

  constructor(
    @InjectQueue('mail') private mailQueue: Queue,
    private configService: ConfigService,
  ) {
    this.transporter = nodemailer.createTransport({
      host: this.configService.get('MAIL_HOST'),
      port: this.configService.get('MAIL_PORT'),
      secure: this.configService.get('MAIL_SECURE', false),
      auth: {
        user: this.configService.get('MAIL_USER'),
        pass: this.configService.get('MAIL_PASSWORD'),
      },
    });
  }

  /**
   * Send an email using a template
   */
  async sendMail(
    to: string,
    subject: string,
    template: string,
    context: any,
  ): Promise<void> {
    try {
      const templatePath = path.join(
        __dirname,
        'templates',
        `${template}.hbs`,
      );
      const templateContent = fs.readFileSync(templatePath, 'utf-8');
      const compiledTemplate = handlebars.compile(templateContent);
      const html = compiledTemplate(context);

      await this.transporter.sendMail({
        from: this.configService.get('MAIL_FROM'),
        to,
        subject,
        html,
      });

      this.logger.log(`Email sent to ${to} with subject: ${subject}`);
    } catch (error) {
      this.logger.error(`Failed to send email to ${to}`, error.stack);
      throw error;
    }
  }

  /**
   * Send welcome email to new user
   */
  async sendWelcomeEmail(user: any): Promise<void> {
    const context = {
      name: user.firstName || user.username,
      email: user.email,
      loginUrl: `${this.configService.get('APP_URL')}/login`,
    };

    await this.queueMail({
      to: user.email,
      subject: 'Welcome to Our Platform',
      template: 'welcome',
      context,
    });
  }

  /**
   * Send password reset email
   */
  async sendPasswordResetEmail(user: any, token: string): Promise<void> {
    const resetUrl = `${this.configService.get('APP_URL')}/reset-password?token=${token}`;
    const context = {
      name: user.firstName || user.username,
      resetUrl,
      expiryHours: 1,
    };

    await this.queueMail({
      to: user.email,
      subject: 'Password Reset Request',
      template: 'password-reset',
      context,
    });
  }

  /**
   * Send report reminder email
   */
  async sendReportReminder(user: any): Promise<void> {
    const context = {
      name: user.firstName || user.username,
      dashboardUrl: `${this.configService.get('APP_URL')}/dashboard`,
      reportUrl: `${this.configService.get('APP_URL')}/reports`,
    };

    await this.queueMail({
      to: user.email,
      subject: 'Report Submission Reminder',
      template: 'report-reminder',
      context,
    });
  }

  /**
   * Add email to BullMQ queue for async processing
   */
  async queueMail(mailData: MailData): Promise<void> {
    try {
      await this.mailQueue.add('send-email', mailData, {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
      });

      this.logger.log(`Email queued for ${mailData.to}`);
    } catch (error) {
      this.logger.error('Failed to queue email', error.stack);
      throw error;
    }
  }
}
