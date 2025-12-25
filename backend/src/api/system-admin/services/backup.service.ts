import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
  InternalServerErrorException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../../core/database/prisma.service';
import { FileStorageService } from '../../../infrastructure/file-storage/file-storage.service';
import { AuditService } from '../../../infrastructure/audit/audit.service';
import { AuditAction, AuditCategory, AuditSeverity, BackupStatus, Role } from '@prisma/client';
import { CreateBackupDto, StorageType } from '../dto/backup.dto';
import { spawn } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class BackupService {
  private readonly logger = new Logger(BackupService.name);
  private readonly backupDir: string;
  private readonly localBackupDir: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly fileStorageService: FileStorageService,
    private readonly auditService: AuditService,
  ) {
    this.backupDir = '/tmp/backups';
    this.localBackupDir = '/app/backups';
    this.ensureDirectories();
  }

  private ensureDirectories() {
    try {
      if (!fs.existsSync(this.backupDir)) {
        fs.mkdirSync(this.backupDir, { recursive: true });
      }
      if (!fs.existsSync(this.localBackupDir)) {
        fs.mkdirSync(this.localBackupDir, { recursive: true });
      }
    } catch (error) {
      this.logger.warn('Could not create backup directories', error);
    }
  }

  async createBackup(
    dto: CreateBackupDto,
    userId: string,
    userRole: Role,
  ) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `backup_${timestamp}.gz`;
    const tempPath = path.join(this.backupDir, filename);

    // Create backup record with IN_PROGRESS status
    const backupRecord = await this.prisma.backupRecord.create({
      data: {
        filename,
        description: dto.description,
        size: 0,
        storageLocations: [],
        status: BackupStatus.IN_PROGRESS,
        createdById: userId,
      },
    });

    try {
      // Execute mongodump
      const dbUrl = this.configService.get<string>('DATABASE_URL');
      await this.executeMongoDump(dbUrl, tempPath);

      // Get file size
      const stats = fs.statSync(tempPath);
      const size = stats.size;

      const storageLocations: string[] = [];
      let minioKey: string | undefined;
      let localPath: string | undefined;

      // Upload to MinIO
      if (dto.storageType === StorageType.MINIO || dto.storageType === StorageType.BOTH) {
        try {
          const buffer = fs.readFileSync(tempPath);
          const uploadResult = await this.fileStorageService.uploadBuffer(
            buffer,
            filename,
            { folder: 'backups', contentType: 'application/gzip' },
          );
          minioKey = uploadResult.key;
          storageLocations.push('minio');
          this.logger.log(`Backup uploaded to MinIO: ${minioKey}`);
        } catch (error) {
          this.logger.error('Failed to upload backup to MinIO', error);
          if (dto.storageType === StorageType.MINIO) {
            throw error;
          }
        }
      }

      // Store locally
      if (dto.storageType === StorageType.LOCAL || dto.storageType === StorageType.BOTH) {
        try {
          localPath = path.join(this.localBackupDir, filename);
          fs.copyFileSync(tempPath, localPath);
          storageLocations.push('local');
          this.logger.log(`Backup stored locally: ${localPath}`);
        } catch (error) {
          this.logger.error('Failed to store backup locally', error);
          if (dto.storageType === StorageType.LOCAL) {
            throw error;
          }
        }
      }

      // Update backup record
      const updatedRecord = await this.prisma.backupRecord.update({
        where: { id: backupRecord.id },
        data: {
          size,
          storageLocations,
          minioKey,
          localPath,
          status: BackupStatus.COMPLETED,
        },
      });

      // Cleanup temp file
      fs.unlinkSync(tempPath);

      // Audit log
      await this.auditService.log({
        action: AuditAction.SYSTEM_BACKUP,
        entityType: 'Backup',
        entityId: updatedRecord.id,
        userId,
        userRole,
        category: AuditCategory.SYSTEM,
        severity: AuditSeverity.HIGH,
        description: `Database backup created: ${filename} (${this.formatBytes(size)})`,
      });

      return {
        success: true,
        backup: updatedRecord,
        message: `Backup created successfully. Size: ${this.formatBytes(size)}`,
      };
    } catch (error) {
      // Update record to failed status
      await this.prisma.backupRecord.update({
        where: { id: backupRecord.id },
        data: { status: BackupStatus.FAILED },
      });

      // Cleanup temp file if exists
      if (fs.existsSync(tempPath)) {
        fs.unlinkSync(tempPath);
      }

      this.logger.error('Backup creation failed', error);
      throw new InternalServerErrorException(`Backup failed: ${error.message}`);
    }
  }

  async listBackups(page: number = 1, limit: number = 20, status?: BackupStatus) {
    const where = status ? { status } : {};

    const [backups, total] = await Promise.all([
      this.prisma.backupRecord.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.backupRecord.count({ where }),
    ]);

    return {
      backups,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async getBackupDownloadUrl(backupId: string) {
    const backup = await this.prisma.backupRecord.findUnique({
      where: { id: backupId },
    });

    if (!backup) {
      throw new NotFoundException('Backup not found');
    }

    // Try MinIO first
    if (backup.minioKey && backup.storageLocations.includes('minio')) {
      try {
        const url = await this.fileStorageService.getSignedUrl(backup.minioKey, 3600);
        return {
          url,
          filename: backup.filename,
          expiresIn: 3600,
          source: 'minio',
        };
      } catch (error) {
        this.logger.warn('Failed to get MinIO signed URL', error);
      }
    }

    // Fallback to local
    if (backup.localPath && backup.storageLocations.includes('local')) {
      if (fs.existsSync(backup.localPath)) {
        return {
          localPath: backup.localPath,
          filename: backup.filename,
          source: 'local',
        };
      }
    }

    throw new NotFoundException('Backup file not available');
  }

  async restoreBackup(
    backupId: string,
    userId: string,
    userRole: Role,
  ) {
    const backup = await this.prisma.backupRecord.findUnique({
      where: { id: backupId },
    });

    if (!backup) {
      throw new NotFoundException('Backup not found');
    }

    if (backup.status !== BackupStatus.COMPLETED) {
      throw new BadRequestException('Cannot restore from incomplete backup');
    }

    const tempPath = path.join(this.backupDir, `restore_${backup.filename}`);

    try {
      // Download backup file
      if (backup.minioKey && backup.storageLocations.includes('minio')) {
        const buffer = await this.fileStorageService.getFile(backup.minioKey);
        fs.writeFileSync(tempPath, buffer);
      } else if (backup.localPath && backup.storageLocations.includes('local')) {
        fs.copyFileSync(backup.localPath, tempPath);
      } else {
        throw new NotFoundException('Backup file not available');
      }

      // Execute mongorestore
      const dbUrl = this.configService.get<string>('DATABASE_URL');
      await this.executeMongoRestore(dbUrl, tempPath);

      // Update backup record
      await this.prisma.backupRecord.update({
        where: { id: backupId },
        data: {
          restoredAt: new Date(),
          restoredById: userId,
          status: BackupStatus.RESTORED,
        },
      });

      // Cleanup
      fs.unlinkSync(tempPath);

      // Audit log
      await this.auditService.log({
        action: AuditAction.SYSTEM_RESTORE,
        entityType: 'Backup',
        entityId: backupId,
        userId,
        userRole,
        category: AuditCategory.SYSTEM,
        severity: AuditSeverity.CRITICAL,
        description: `Database restored from backup: ${backup.filename}`,
      });

      return {
        success: true,
        message: `Database restored successfully from ${backup.filename}`,
        restoredAt: new Date(),
      };
    } catch (error) {
      // Cleanup temp file if exists
      if (fs.existsSync(tempPath)) {
        fs.unlinkSync(tempPath);
      }

      this.logger.error('Restore failed', error);
      throw new InternalServerErrorException(`Restore failed: ${error.message}`);
    }
  }

  async uploadBackup(
    file: Express.Multer.File,
    userId: string,
    userRole: Role,
  ) {
    if (!file) {
      throw new BadRequestException('No file provided');
    }

    const filename = `uploaded_${Date.now()}_${file.originalname}`;
    const storageLocations: string[] = [];

    try {
      // Upload to MinIO
      const uploadResult = await this.fileStorageService.uploadBuffer(
        file.buffer,
        filename,
        { folder: 'backups', contentType: file.mimetype },
      );
      storageLocations.push('minio');

      // Also store locally
      const localPath = path.join(this.localBackupDir, filename);
      fs.writeFileSync(localPath, file.buffer);
      storageLocations.push('local');

      // Create backup record
      const backupRecord = await this.prisma.backupRecord.create({
        data: {
          filename,
          description: `Uploaded backup: ${file.originalname}`,
          size: file.size,
          storageLocations,
          minioKey: uploadResult.key,
          localPath,
          status: BackupStatus.COMPLETED,
          createdById: userId,
        },
      });

      // Audit log
      await this.auditService.log({
        action: AuditAction.SYSTEM_BACKUP,
        entityType: 'Backup',
        entityId: backupRecord.id,
        userId,
        userRole,
        category: AuditCategory.SYSTEM,
        severity: AuditSeverity.HIGH,
        description: `Backup file uploaded: ${filename}`,
      });

      return {
        success: true,
        backup: backupRecord,
        message: 'Backup uploaded successfully',
      };
    } catch (error) {
      this.logger.error('Failed to upload backup', error);
      throw new InternalServerErrorException(`Upload failed: ${error.message}`);
    }
  }

  async deleteBackup(backupId: string, userId: string, userRole: Role) {
    const backup = await this.prisma.backupRecord.findUnique({
      where: { id: backupId },
    });

    if (!backup) {
      throw new NotFoundException('Backup not found');
    }

    const deletedFrom: string[] = [];

    // Delete from MinIO
    if (backup.minioKey) {
      try {
        await this.fileStorageService.deleteFile(backup.minioKey);
        deletedFrom.push('minio');
      } catch (error) {
        this.logger.warn(`Failed to delete backup from MinIO: ${error.message}`);
      }
    }

    // Delete from local
    if (backup.localPath && fs.existsSync(backup.localPath)) {
      try {
        fs.unlinkSync(backup.localPath);
        deletedFrom.push('local');
      } catch (error) {
        this.logger.warn(`Failed to delete local backup: ${error.message}`);
      }
    }

    // Delete record
    await this.prisma.backupRecord.delete({
      where: { id: backupId },
    });

    // Audit log
    await this.auditService.log({
      action: AuditAction.SYSTEM_BACKUP,
      entityType: 'Backup',
      entityId: backupId,
      userId,
      userRole,
      category: AuditCategory.SYSTEM,
      severity: AuditSeverity.MEDIUM,
      description: `Backup deleted: ${backup.filename}`,
    });

    return {
      success: true,
      deletedFrom,
      message: `Backup deleted successfully`,
    };
  }

  private getMongoToolPath(tool: 'mongodump' | 'mongorestore'): string {
    // On Windows, use full path if not in PATH
    if (process.platform === 'win32') {
      const windowsPath = `C:\\Program Files\\MongoDB\\Tools\\100\\bin\\${tool}.exe`;
      if (fs.existsSync(windowsPath)) {
        return windowsPath;
      }
    }
    // Fallback to PATH-based lookup
    return tool;
  }

  private executeMongoDump(dbUrl: string, outputPath: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const mongodumpPath = this.getMongoToolPath('mongodump');
      const child = spawn(mongodumpPath, [
        `--uri=${dbUrl}`,
        `--archive=${outputPath}`,
        '--gzip',
      ]);

      let stderr = '';

      child.stderr.on('data', (data) => {
        stderr += data.toString();
        this.logger.debug(`mongodump: ${data}`);
      });

      child.on('close', (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`mongodump exited with code ${code}: ${stderr}`));
        }
      });

      child.on('error', (error) => {
        reject(new Error(`Failed to start mongodump: ${error.message}`));
      });
    });
  }

  private executeMongoRestore(dbUrl: string, archivePath: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const mongorestorePath = this.getMongoToolPath('mongorestore');
      const child = spawn(mongorestorePath, [
        `--uri=${dbUrl}`,
        `--archive=${archivePath}`,
        '--gzip',
        '--drop', // Drop existing collections before restore
      ]);

      let stderr = '';

      child.stderr.on('data', (data) => {
        stderr += data.toString();
        this.logger.debug(`mongorestore: ${data}`);
      });

      child.on('close', (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`mongorestore exited with code ${code}: ${stderr}`));
        }
      });

      child.on('error', (error) => {
        reject(new Error(`Failed to start mongorestore: ${error.message}`));
      });
    });
  }

  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }
}
