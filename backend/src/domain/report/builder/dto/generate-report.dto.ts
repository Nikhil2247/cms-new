import { IsEnum, IsNotEmpty, IsObject, IsOptional } from 'class-validator';
import { ReportType, ExportFormat } from '../interfaces/report.interface';

export class GenerateReportDto {
  @IsEnum(ReportType)
  @IsNotEmpty()
  type: ReportType;

  @IsEnum(ExportFormat)
  @IsNotEmpty()
  format: ExportFormat;

  @IsObject()
  @IsOptional()
  filters?: any;
}
