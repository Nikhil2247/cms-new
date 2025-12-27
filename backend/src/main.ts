import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { Logger, ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { IoAdapter } from '@nestjs/platform-socket.io';
import helmet from 'helmet';
import { json, urlencoded } from 'express';
import compression from 'compression';
import { AllExceptionsFilter } from './core/common/filters/all-exceptions.filter';

// Prefer BACKEND_PORT so generic PORT (often set by other tools) doesn't hijack backend.
const port = process.env.BACKEND_PORT || process.env.PORT || 8000;

async function bootstrap() {
  const logger = new Logger('Bootstrap');

  // Define allowed origins
  const allowedOrigins = process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(',').map((origin) => origin.trim())
    : [
        'http://localhost:5173',
        'http://localhost:3000',
        'http://localhost:3001',
        'http://localhost:8000',
        'https://placeintern.com',
        'https://www.placeintern.com',
        'https://api.placeintern.com',
      ];

  logger.log(`Allowed CORS origins: ${allowedOrigins.join(', ')}`);

  logger.log('Creating NestJS application...');
  const app = await NestFactory.create(AppModule, {
    logger: ['error', 'warn', 'log'],
    bufferLogs: true,
  });

  // Configure WebSocket adapter for Socket.io
  app.useWebSocketAdapter(new IoAdapter(app));
  logger.log('WebSocket adapter (Socket.io) configured');

  // Trust proxy - required to get real client IP behind reverse proxy (nginx, cloudflare, etc.)
  // This allows Express to read X-Forwarded-For and X-Real-IP headers correctly
  const expressApp = app.getHttpAdapter().getInstance();
  expressApp.set('trust proxy', true);
  logger.log('Trust proxy enabled for correct client IP detection');

  // Enable CORS with specific allowed origins
  app.enableCors({
    origin: process.env.NODE_ENV === 'production' ? allowedOrigins : true,
    credentials: true,
    methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-Requested-With',
      'Accept',
      'Origin',
      'x-institution-id',
    ],
    preflightContinue: false,
    optionsSuccessStatus: 204,
  });
  logger.log(`CORS enabled (${process.env.NODE_ENV === 'production' ? 'restricted' : 'permissive'} mode)`);

  // ===== SECURITY CONFIGURATION =====

  // Security headers with Helmet (after CORS)
  app.use(
    helmet({
      contentSecurityPolicy: process.env.NODE_ENV === 'production',
      crossOriginEmbedderPolicy: false,
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    }),
  );
  logger.log('Security headers configured (Helmet)');

  // Body parser limits (protect against large payload attacks)
  app.use(json({ limit: '10mb' }));
  app.use(urlencoded({ extended: true, limit: '10mb' }));
  logger.log('Body parser configured with 10MB limit');

  // Compression
  app.use(compression());
  logger.log('Response compression enabled');

  // ===== GLOBAL CONFIGURATION =====

  // Set global prefix for all routes
  app.setGlobalPrefix('api', {
    exclude: ['health', 'health/(.*)'], // Exclude health endpoints
  });
  logger.log('Global API prefix set to /api');

  // Global validation pipe
  logger.log('Setting up global pipes...');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );
  logger.log('Global validation pipes configured');

  // Global exception filter
  app.useGlobalFilters(new AllExceptionsFilter());
  logger.log('Global exception filter configured');

  // ===== SWAGGER DOCUMENTATION =====

  // Only enable Swagger in non-production environments
  if (process.env.NODE_ENV !== 'production') {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('CMS API')
      .setDescription('College Management System API Documentation')
      .setVersion('2.0')
      .addBearerAuth()
      .addTag('Authentication', 'User authentication and authorization')
      .addTag('Students', 'Student management endpoints')
      .addTag('Faculty', 'Faculty management endpoints')
      .addTag('Internships', 'Internship management endpoints')
      .build();

    const swaggerDocument = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup('api/docs', app, swaggerDocument);
    logger.log('Swagger documentation enabled at /api/docs');
  } else {
    logger.log('Swagger documentation disabled in production');
  }

  // ===== GRACEFUL SHUTDOWN =====

  // Enable graceful shutdown hooks
  app.enableShutdownHooks();
  logger.log('Graceful shutdown hooks enabled');

  // ===== START SERVER =====

  logger.log(`Starting server on port ${port}...`);
  await app.listen(port, '0.0.0.0');

  // Signal PM2 (when using wait_ready: true) that the app is ready to accept connections.
  // This prevents PM2 from considering the process still launching and reporting it unhealthy.
  if (typeof process !== 'undefined' && typeof process.send === 'function') {
    process.send('ready');
    logger.log('PM2 readiness signal sent');
  }

  logger.log(`Application is running on: http://localhost:${port}`);
  logger.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  logger.log(`Server is ready to accept connections`);
}

bootstrap().catch((error) => {
  const logger = new Logger('Bootstrap');
  // Ensure the real stack is visible even if Nest logs are buffered
  if (error?.code === 'EADDRINUSE') {
    logger.error(
      `Failed to start application: port ${port} is already in use. ` +
        `Set BACKEND_PORT to a free port or stop the process using ${port}.`,
    );
  } else {
    logger.error('Failed to start application', error?.stack ?? String(error));
  }
  // eslint-disable-next-line no-console
  console.error(error);
  process.exit(1);
});
