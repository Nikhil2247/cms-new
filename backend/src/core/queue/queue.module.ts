import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { QueueService } from './queue.service';
import { RedlockService } from './redlock.service';

// Default job options for all queues
const defaultJobOptions = {
  attempts: 3,
  backoff: { type: 'exponential' as const, delay: 2000 },
  removeOnComplete: true,
  removeOnFail: false,
};

@Module({
  imports: [
    ConfigModule,
    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: async (configService: ConfigService) => ({
        connection: {
          host: configService.get<string>('REDIS_HOST', 'localhost'),
          port: configService.get<number>('REDIS_PORT', 6379),
          password: configService.get<string>('REDIS_PASSWORD'),
          // Disable offline queue to prevent memory issues
          enableOfflineQueue: false,
          // Required for BullMQ compatibility
          maxRetriesPerRequest: null,
        },
        // Simple prefix for DragonflyDB compatibility
        // DragonflyDB requires --cluster_mode= (empty) or --default_lua_flags=allow-undeclared-keys
        prefix: 'bull',
      }),
    }),
    // Queue registration with simple names for DragonflyDB compatibility
    BullModule.registerQueue(
      {
        name: 'email',
        defaultJobOptions,
      },
      {
        name: 'notifications',
        defaultJobOptions: {
          ...defaultJobOptions,
          removeOnComplete: 50, // Keep fewer completed jobs for notifications
        },
      },
      {
        name: 'file-processing',
        defaultJobOptions,
      },
      {
        name: 'data-sync',
        defaultJobOptions,
      },
      {
        name: 'bulk-operations',
        defaultJobOptions,
      },
      {
        name: 'report-generation',
        defaultJobOptions,
      },
      {
        name: 'dead-letter',
        defaultJobOptions: {
          attempts: 1,
          removeOnComplete: false,
          removeOnFail: false,
        },
      },
      {
        name: 'mail',
        defaultJobOptions,
      },
    ),
  ],
  providers: [QueueService, RedlockService],
  exports: [QueueService, RedlockService, BullModule],
})
export class QueueModule {}
