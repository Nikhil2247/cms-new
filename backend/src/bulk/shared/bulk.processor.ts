import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { BulkUserService } from '../bulk-user/bulk-user.service';
import { BulkStudentService } from '../bulk-student/bulk-student.service';
import { BulkInstitutionService } from '../bulk-institution/bulk-institution.service';

@Processor('bulk-operations')
export class BulkProcessor extends WorkerHost {
  private readonly logger = new Logger(BulkProcessor.name);

  constructor(
    private readonly bulkUserService: BulkUserService,
    private readonly bulkStudentService: BulkStudentService,
    private readonly bulkInstitutionService: BulkInstitutionService,
  ) {
    super();
  }

  async process(job: Job<any, any, string>): Promise<any> {
    this.logger.log(`Processing bulk operation job: ${job.name} (ID: ${job.id})`);

    try {
      switch (job.name) {
        case 'bulk-upload-users':
          return await this.processBulkUserUpload(job);

        case 'bulk-upload-students':
          return await this.processBulkStudentUpload(job);

        case 'bulk-upload-institutions':
          return await this.processBulkInstitutionUpload(job);

        default:
          this.logger.warn(`Unknown job type: ${job.name}`);
          throw new Error(`Unknown job type: ${job.name}`);
      }
    } catch (error) {
      this.logger.error(`Error processing job ${job.id}: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Process bulk user upload job
   */
  private async processBulkUserUpload(job: Job) {
    const { users, institutionId, createdBy } = job.data;

    this.logger.log(`Processing bulk user upload: ${users.length} users for institution ${institutionId}`);

    // Update progress
    await job.updateProgress(10);

    const result = await this.bulkUserService.bulkUploadUsers(users, institutionId, createdBy);

    await job.updateProgress(100);

    this.logger.log(
      `Bulk user upload completed: ${result.success} success, ${result.failed} failed`,
    );

    return result;
  }

  /**
   * Process bulk student upload job
   */
  private async processBulkStudentUpload(job: Job) {
    const { students, institutionId, createdBy } = job.data;

    this.logger.log(`Processing bulk student upload: ${students.length} students for institution ${institutionId}`);

    // Update progress
    await job.updateProgress(10);

    const result = await this.bulkStudentService.bulkUploadStudents(students, institutionId, createdBy);

    await job.updateProgress(100);

    this.logger.log(
      `Bulk student upload completed: ${result.success} success, ${result.failed} failed`,
    );

    return result;
  }

  /**
   * Process bulk institution upload job
   */
  private async processBulkInstitutionUpload(job: Job) {
    const { institutions, createdBy } = job.data;

    this.logger.log(`Processing bulk institution upload: ${institutions.length} institutions`);

    // Update progress
    await job.updateProgress(10);

    const result = await this.bulkInstitutionService.bulkUploadInstitutions(institutions, createdBy);

    await job.updateProgress(100);

    this.logger.log(
      `Bulk institution upload completed: ${result.success} success, ${result.failed} failed`,
    );

    return result;
  }
}
