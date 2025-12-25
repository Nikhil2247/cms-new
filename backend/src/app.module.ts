import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD, APP_FILTER, APP_INTERCEPTOR } from '@nestjs/core';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';

// Core modules
import { PrismaModule } from './core/database/prisma.module';
import { AuthModule } from './core/auth/auth.module';
import { CacheModule } from './core/cache/cache.module';
import { QueueModule } from './core/queue/queue.module';

// Security
import { AllExceptionsFilter } from './core/common/filters/all-exceptions.filter';
import { LoggingInterceptor } from './core/common/interceptors/logging.interceptor';
import { SecurityInterceptor } from './core/common/interceptors/security.interceptor';
import { CustomThrottleGuard } from './core/common/guards/throttle.guard';

// API modules
import { StateModule } from './api/state/state.module';
import { PrincipalModule } from './api/principal/principal.module';
import { FacultyModule } from './api/faculty/faculty.module';
import { StudentPortalModule } from './api/student-portal/student-portal.module';
import { IndustryPortalModule } from './api/industry-portal/industry.module';
import { SharedModule } from './api/shared/shared.module';
import { SystemAdminModule } from './api/system-admin/system-admin.module';

// Infrastructure modules
import { MailModule } from './infrastructure/mail/mail.module';
import { WebSocketModule } from './infrastructure/websocket/websocket.module';
import { NotificationModule } from './infrastructure/notification/notification.module';
import { FileStorageModule } from './infrastructure/file-storage/file-storage.module';
import { CloudinaryModule } from './infrastructure/cloudinary/cloudinary.module';
import { AuditModule } from './infrastructure/audit/audit.module';
import { HealthModule } from './infrastructure/health/health.module';

// Domain modules
import { InternshipModule } from './domain/internship/internship.module';
import { ReportModule } from './domain/report/report.module';
import { FeedbackModule } from './domain/feedback/feedback.module';
import { AcademicModule } from './domain/academic/academic.module';
import { FinanceModule } from './domain/finance/finance.module';
import { SupportModule } from './domain/support/support.module';
import { MentorModule } from './domain/mentor/mentor.module';
import { PlacementModule } from './domain/placement/placement.module';

// Bulk Operations
import { BulkModule } from './bulk/bulk.module';

@Module({
  imports: [
    // ===== GLOBAL CONFIGURATION =====
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
      cache: true,
    }),

    // ===== RATE LIMITING (THROTTLING) =====
    ThrottlerModule.forRoot([
      {
        ttl: parseInt(process.env.THROTTLE_TTL || '60000', 10), // 1 minute
        limit: parseInt(process.env.THROTTLE_LIMIT || '100', 10), // 100 requests per minute
      },
    ]),

    // ===== CORE MODULES =====
    PrismaModule,
    AuthModule,
    CacheModule,
    QueueModule,

    // ===== INFRASTRUCTURE MODULES =====
    WebSocketModule,
    MailModule,
    NotificationModule,
    FileStorageModule,
    CloudinaryModule,
    AuditModule,
    HealthModule,

    // ===== API MODULES (Role-based) =====
    StateModule,
    PrincipalModule,
    FacultyModule,
    StudentPortalModule,
    IndustryPortalModule,
    SharedModule,
    SystemAdminModule,

    // ===== DOMAIN MODULES =====
    InternshipModule,
    ReportModule,
    FeedbackModule,
    AcademicModule,
    FinanceModule,
    SupportModule,
    MentorModule,
    PlacementModule,

    // ===== BULK OPERATIONS =====
    BulkModule,
  ],
  controllers: [],
  providers: [
    // ===== GLOBAL GUARDS =====
    {
      provide: APP_GUARD,
      useClass: CustomThrottleGuard,
    },

    // ===== GLOBAL FILTERS =====
    {
      provide: APP_FILTER,
      useClass: AllExceptionsFilter,
    },

    // ===== GLOBAL INTERCEPTORS =====
    {
      provide: APP_INTERCEPTOR,
      useClass: LoggingInterceptor,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: SecurityInterceptor,
    },
  ],
})
export class AppModule {}
