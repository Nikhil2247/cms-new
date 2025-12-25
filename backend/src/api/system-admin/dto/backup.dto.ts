import { IsString, IsOptional, IsEnum, IsBoolean } from 'class-validator';

export enum StorageType {
  MINIO = 'minio',
  LOCAL = 'local',
  BOTH = 'both',
}

export class CreateBackupDto {
  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsEnum(StorageType)
  storageType?: StorageType = StorageType.BOTH;
}

export class RestoreBackupDto {
  @IsBoolean()
  confirmRestore: boolean;
}

export class BackupResponseDto {
  id: string;
  filename: string;
  description?: string;
  size: number;
  storageLocations: string[];
  status: string;
  createdAt: Date;
  createdById: string;
}

export class BackupListResponseDto {
  backups: BackupResponseDto[];
  total: number;
  page: number;
  limit: number;
}
