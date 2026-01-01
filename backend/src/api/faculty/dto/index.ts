import {
  IsString,
  IsOptional,
  IsEnum,
  IsDateString,
  IsNumber,
  IsBoolean,
  IsArray,
  IsUUID,
  Min,
  Max,
  MinLength,
  MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

// Enum for visit types (should match your schema)
export enum VisitType {
  PHYSICAL = 'PHYSICAL',
  VIRTUAL = 'VIRTUAL',
  PHONE = 'PHONE',
}

export enum VisitStatus {
  SCHEDULED = 'SCHEDULED',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
}

export enum ReportStatus {
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
}

export enum ApprovalStatus {
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
}

// ==================== Visit Log DTOs ====================

export class CreateVisitLogDto {
  @ApiPropertyOptional({ description: 'Application ID (either applicationId or studentId is required)' })
  @IsOptional()
  @IsUUID()
  applicationId?: string;

  @ApiPropertyOptional({ description: 'Student ID (either applicationId or studentId is required)' })
  @IsOptional()
  @IsUUID()
  studentId?: string;

  @ApiProperty({ description: 'Type of visit', enum: VisitType })
  @IsEnum(VisitType)
  visitType: VisitType;

  @ApiProperty({ description: 'Location of the visit' })
  @IsString()
  @MinLength(2)
  @MaxLength(255)
  visitLocation: string;

  @ApiPropertyOptional({ description: 'Date of the visit (defaults to now)' })
  @IsOptional()
  @IsDateString()
  visitDate?: string;

  @ApiPropertyOptional({ description: 'Status of the visit (defaults to COMPLETED)', enum: VisitStatus })
  @IsOptional()
  @IsEnum(VisitStatus)
  status?: VisitStatus;

  @ApiPropertyOptional({ description: 'Notes about the visit' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;

  @ApiPropertyOptional({ description: 'Observations made during visit' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  observations?: string;

  @ApiPropertyOptional({ description: 'Recommendations for the student' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  recommendations?: string;

  @ApiPropertyOptional({ description: 'URL to photo documentation' })
  @IsOptional()
  @IsString()
  photoUrl?: string;

  @ApiPropertyOptional({ description: 'URL to signed document' })
  @IsOptional()
  @IsString()
  signedDocumentUrl?: string;
}

export class UpdateVisitLogDto {
  @ApiPropertyOptional({ description: 'Type of visit', enum: VisitType })
  @IsOptional()
  @IsEnum(VisitType)
  visitType?: VisitType;

  @ApiPropertyOptional({ description: 'Location of the visit' })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(255)
  visitLocation?: string;

  @ApiPropertyOptional({ description: 'Date of the visit' })
  @IsOptional()
  @IsDateString()
  visitDate?: string;

  @ApiPropertyOptional({ description: 'Status of the visit', enum: VisitStatus })
  @IsOptional()
  @IsEnum(VisitStatus)
  status?: VisitStatus;

  @ApiPropertyOptional({ description: 'Notes about the visit' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;

  @ApiPropertyOptional({ description: 'Observations made during visit' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  observations?: string;

  @ApiPropertyOptional({ description: 'Recommendations for the student' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  recommendations?: string;

  @ApiPropertyOptional({ description: 'URL to photo documentation' })
  @IsOptional()
  @IsString()
  photoUrl?: string;

  @ApiPropertyOptional({ description: 'URL to signed document' })
  @IsOptional()
  @IsString()
  signedDocumentUrl?: string;
}

// ==================== Monthly Report DTOs ====================

export class ReviewMonthlyReportDto {
  @ApiProperty({ description: 'Review status', enum: ReportStatus })
  @IsEnum(ReportStatus)
  status: ReportStatus;

  @ApiPropertyOptional({ description: 'Reviewer remarks' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  remarks?: string;

  @ApiPropertyOptional({ description: 'Reason for rejection (required if status is REJECTED)' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  reason?: string;
}

export class ApproveMonthlyReportDto {
  @ApiPropertyOptional({ description: 'Approval remarks' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  remarks?: string;
}

export class RejectMonthlyReportDto {
  @ApiProperty({ description: 'Reason for rejection' })
  @IsString()
  @MinLength(10, { message: 'Rejection reason must be at least 10 characters' })
  @MaxLength(2000)
  reason: string;
}

// ==================== Approval DTOs ====================

export class UpdateSelfIdentifiedApprovalDto {
  @ApiProperty({ description: 'Approval status', enum: ApprovalStatus })
  @IsEnum(ApprovalStatus)
  status: ApprovalStatus;

  @ApiPropertyOptional({ description: 'Approval remarks' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  remarks?: string;

  @ApiPropertyOptional({ description: 'Reason for rejection (required if status is REJECTED)' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  reason?: string;
}

// ==================== Feedback DTOs ====================

export class SubmitMonthlyFeedbackDto {
  @ApiProperty({ description: 'Student ID' })
  @IsUUID()
  studentId: string;

  @ApiProperty({ description: 'Month for the feedback (1-12)' })
  @IsNumber()
  @Min(1)
  @Max(12)
  @Type(() => Number)
  month: number;

  @ApiProperty({ description: 'Year for the feedback' })
  @IsNumber()
  @Min(2020)
  @Max(2100)
  @Type(() => Number)
  year: number;

  @ApiProperty({ description: 'Performance rating (1-5)' })
  @IsNumber()
  @Min(1)
  @Max(5)
  @Type(() => Number)
  performanceRating: number;

  @ApiPropertyOptional({ description: 'Attendance rating (1-5)' })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(5)
  @Type(() => Number)
  attendanceRating?: number;

  @ApiPropertyOptional({ description: 'Communication rating (1-5)' })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(5)
  @Type(() => Number)
  communicationRating?: number;

  @ApiProperty({ description: 'Detailed feedback comments' })
  @IsString()
  @MinLength(20, { message: 'Feedback must be at least 20 characters' })
  @MaxLength(5000)
  feedback: string;

  @ApiPropertyOptional({ description: 'Areas for improvement' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  areasForImprovement?: string;

  @ApiPropertyOptional({ description: 'Strengths observed' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  strengths?: string;
}

// ==================== Internship DTOs ====================

export class UpdateInternshipDto {
  @ApiPropertyOptional({ description: 'Company name' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  companyName?: string;

  @ApiPropertyOptional({ description: 'Internship title/position' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  title?: string;

  @ApiPropertyOptional({ description: 'Start date' })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({ description: 'End date' })
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiPropertyOptional({ description: 'Faculty remarks' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  facultyRemarks?: string;

  @ApiPropertyOptional({ description: 'Is active' })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

// ==================== Joining Letter DTOs ====================

export class VerifyJoiningLetterDto {
  @ApiPropertyOptional({ description: 'Verification remarks' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  remarks?: string;
}

export class RejectJoiningLetterDto {
  @ApiProperty({ description: 'Reason for rejection' })
  @IsString()
  @MinLength(10, { message: 'Rejection reason must be at least 10 characters' })
  @MaxLength(2000)
  reason: string;
}

// ==================== File Upload DTOs ====================

export class UploadVisitDocumentDto {
  @ApiProperty({ description: 'Type of document (e.g., visit-photo, signed-document)' })
  @IsString()
  @MinLength(2)
  @MaxLength(50)
  documentType: string;
}
