import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { PrismaService } from '../../../core/database/prisma.service';
import { ReportGeneratorService } from './report-generator.service';
import { ExcelService } from './export/excel.service';
import { PdfService } from './export/pdf.service';
import { CsvService } from './export/csv.service';
import {
  ReportJobData,
  ReportStatus,
  ExportFormat,
  ReportType,
  ExportConfig,
} from './interfaces/report.interface';
import { FileStorageService } from '../../../infrastructure/file-storage/file-storage.service';
import { WebSocketService } from '../../../infrastructure/websocket/websocket.service';

@Processor('report-generation')
@Injectable()
export class ReportProcessor extends WorkerHost {
  private readonly logger = new Logger(ReportProcessor.name);

  constructor(
    private prisma: PrismaService,
    private reportGenerator: ReportGeneratorService,
    private excelService: ExcelService,
    private pdfService: PdfService,
    private csvService: CsvService,
    private fileStorage: FileStorageService,
    private webSocketService: WebSocketService,
  ) {
    super();
  }

  async process(job: Job<ReportJobData>): Promise<any> {
    const { userId, reportType, config: jobConfig, reportId } = job.data;

    // Extract format from config or use default
    const formatStr = jobConfig?.format || job.data.format || 'excel';
    const filters = jobConfig?.filters || job.data.filters || {};
    const selectedColumns = jobConfig?.columns || [];

    // Convert string format to ExportFormat enum
    const formatMap: Record<string, ExportFormat> = {
      'excel': ExportFormat.EXCEL,
      'pdf': ExportFormat.PDF,
      'csv': ExportFormat.CSV,
      'json': ExportFormat.JSON,
    };
    const format = formatMap[formatStr] || ExportFormat.EXCEL;

    this.logger.log(
      `Processing report generation job ${job.id} for user ${userId}`,
    );
    this.logger.log(`Selected columns: ${selectedColumns.length > 0 ? selectedColumns.join(', ') : 'all'}`);

    try {
      // Update status to processing (with WebSocket notification)
      await this.updateReportStatus(reportId, ReportStatus.PROCESSING, null, null, userId, reportType);

      // Fetch data based on report type
      this.logger.log(`Fetching data for report type: ${reportType}`);
      const data = await this.reportGenerator.generateReport(
        reportType as ReportType,
        filters,
      );

      if (!data || data.length === 0) {
        throw new Error('No data found for the given filters');
      }

      // Get report configuration with selected columns
      const config = this.getExportConfig(reportType, data, filters, userId, format, selectedColumns);

      // Generate file based on format
      this.logger.log(`Generating ${format} file`);
      let fileBuffer: Buffer;
      let fileName: string;
      let mimeType: string;

      switch (format) {
        case ExportFormat.EXCEL:
          fileBuffer = await this.excelService.generateExcel(config);
          fileName = `${reportType}_${Date.now()}.xlsx`;
          mimeType =
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
          break;

        case ExportFormat.PDF:
          fileBuffer = await this.pdfService.generatePdf(config);
          fileName = `${reportType}_${Date.now()}.pdf`;
          mimeType = 'application/pdf';
          break;

        case ExportFormat.CSV:
          fileBuffer = await this.csvService.generateCsv(config);
          fileName = `${reportType}_${Date.now()}.csv`;
          mimeType = 'text/csv';
          break;

        case ExportFormat.JSON:
          // Generate JSON export with structured data
          const jsonData = {
            title: config.title,
            generatedAt: new Date().toISOString(),
            generatedBy: config.metadata?.generatedBy,
            filters: config.metadata?.filters,
            totalRecords: config.data.length,
            columns: config.columns.map(col => ({
              field: col.field,
              header: col.header,
              type: col.type,
            })),
            data: config.data,
          };
          fileBuffer = Buffer.from(JSON.stringify(jsonData, null, 2), 'utf-8');
          fileName = `${reportType}_${Date.now()}.json`;
          mimeType = 'application/json';
          break;

        default:
          throw new Error(`Unsupported format: ${format}`);
      }

      // Validate buffer before upload
      this.logger.log(`Generated file buffer size: ${fileBuffer?.length || 0} bytes`);

      if (!fileBuffer || fileBuffer.length === 0) {
        throw new Error('Generated file buffer is empty');
      }

      // Upload to MinIO
      this.logger.log('Uploading file to MinIO');
      const institutionId = filters?.institutionId as string;

      // Get institution name for folder structure
      let institutionName: string | undefined;
      if (institutionId) {
        const institution = await this.prisma.institution.findUnique({
          where: { id: institutionId },
          select: { name: true },
        });
        institutionName = institution?.name;
      }

      const formatExtMap: Record<ExportFormat, string> = {
        [ExportFormat.EXCEL]: 'xlsx',
        [ExportFormat.PDF]: 'pdf',
        [ExportFormat.CSV]: 'csv',
        [ExportFormat.JSON]: 'json',
      };
      const formatExt = formatExtMap[format] || 'xlsx';

      const uploadResult = await this.fileStorage.uploadReport(fileBuffer, {
        institutionName,
        reportType,
        format: formatExt,
      });

      this.logger.log(`Upload complete. File size: ${uploadResult.size} bytes, URL: ${uploadResult.url}`);

      // Update report status to completed (with WebSocket notification)
      await this.updateReportStatus(
        reportId,
        ReportStatus.COMPLETED,
        uploadResult.url,
        null,
        userId,
        reportType,
        data.length,
      );

      // Send notification to user (non-blocking)
      this.sendNotification(userId, reportType, uploadResult.url).catch((err) => {
        this.logger.warn(`Failed to send notification: ${err.message}`);
      });

      this.logger.log(`Report generation completed for job ${job.id}`);

      return {
        success: true,
        downloadUrl: uploadResult.url,
      };
    } catch (error) {
      this.logger.error(
        `Error processing report generation job ${job.id}:`,
        error,
      );

      // Update report status to failed (with WebSocket notification)
      await this.updateReportStatus(
        reportId,
        ReportStatus.FAILED,
        null,
        error.message,
        userId,
        reportType,
      );

      throw error;
    }
  }

  /**
   * Update report status in database and emit WebSocket event
   */
  private async updateReportStatus(
    reportId: string,
    status: ReportStatus,
    downloadUrl?: string,
    errorMessage?: string,
    userId?: string,
    reportType?: string,
    totalRecords?: number,
  ) {
    try {
      const updateData: Record<string, unknown> = {
        status: status,
      };

      if (status === ReportStatus.COMPLETED && downloadUrl) {
        updateData.fileUrl = downloadUrl;
        updateData.generatedAt = new Date();
      }

      if (status === ReportStatus.FAILED && errorMessage) {
        updateData.errorMessage = errorMessage;
      }

      const updatedReport = await this.prisma.generatedReport.update({
        where: { id: reportId },
        data: updateData,
      });

      this.logger.log(`Report ${reportId} status updated to ${status}`);

      // Emit WebSocket event for real-time updates
      if (userId) {
        this.webSocketService.sendReportStatus(userId, {
          reportId,
          status: status.toLowerCase() as 'pending' | 'processing' | 'completed' | 'failed',
          reportType,
          reportName: updatedReport.reportName,
          format: updatedReport.format,
          totalRecords,
          fileUrl: downloadUrl,
          errorMessage,
          generatedAt: updatedReport.generatedAt,
        });
      }
    } catch (err) {
      this.logger.error(`Failed to update report status: ${err.message}`);
    }
  }

  /**
   * Get export configuration
   */
  private getExportConfig(
    reportType: string,
    data: any[],
    filters: any,
    userId: string,
    format: ExportFormat,
    selectedColumns: string[] = [],
  ): ExportConfig {
    // Normalize report type for matching
    const normalizedType = reportType.toLowerCase().replace(/-/g, '_');

    // Title mapping - supports both enum values and string variants
    const reportTitles: Record<string, string> = {
      'student_progress': 'Student Progress Report',
      'student_directory': 'Student Directory Report',
      'internship': 'Internship Report',
      'internship_status': 'Internship Status Report',
      'faculty_visit': 'Faculty Visit Report',
      'mentor_list': 'Mentor List Report',
      'monthly': 'Monthly Report',
      'monthly_report_status': 'Monthly Report Status',
      'placement': 'Placement Report',
      'institution_performance': 'Institution Performance Report',
    };

    // Column mapping - matches actual data fields from generator
    const reportColumns: Record<string, any[]> = {
      // Student reports - matches generateStudentProgressReport output
      'student_progress': [
        { field: 'rollNumber', header: 'Roll Number', type: 'string' as const, width: 15 },
        { field: 'name', header: 'Student Name', type: 'string' as const, width: 20 },
        { field: 'email', header: 'Email', type: 'string' as const, width: 25 },
        { field: 'phoneNumber', header: 'Phone', type: 'string' as const, width: 15 },
        { field: 'branch', header: 'Branch', type: 'string' as const, width: 15 },
        { field: 'currentYear', header: 'Year', type: 'number' as const, width: 8 },
        { field: 'currentSemester', header: 'Semester', type: 'number' as const, width: 10 },
        { field: 'internshipsCount', header: 'Internships', type: 'number' as const, width: 12 },
        { field: 'placementsCount', header: 'Placements', type: 'number' as const, width: 12 },
        { field: 'status', header: 'Status', type: 'string' as const, width: 12 },
        { field: 'isActive', header: 'Active', type: 'boolean' as const, width: 8 },
      ],
      'student_directory': [
        { field: 'rollNumber', header: 'Roll Number', type: 'string' as const, width: 15 },
        { field: 'name', header: 'Student Name', type: 'string' as const, width: 20 },
        { field: 'email', header: 'Email', type: 'string' as const, width: 25 },
        { field: 'phoneNumber', header: 'Phone', type: 'string' as const, width: 15 },
        { field: 'branch', header: 'Branch', type: 'string' as const, width: 15 },
        { field: 'currentYear', header: 'Year', type: 'number' as const, width: 8 },
        { field: 'currentSemester', header: 'Semester', type: 'number' as const, width: 10 },
        { field: 'internshipsCount', header: 'Internships', type: 'number' as const, width: 12 },
        { field: 'placementsCount', header: 'Placements', type: 'number' as const, width: 12 },
        { field: 'status', header: 'Status', type: 'string' as const, width: 12 },
      ],
      // Internship reports - matches generateInternshipReport output
      'internship': [
        { field: 'studentName', header: 'Student Name', type: 'string' as const, width: 20 },
        { field: 'rollNumber', header: 'Roll Number', type: 'string' as const, width: 15 },
        { field: 'branch', header: 'Branch', type: 'string' as const, width: 15 },
        { field: 'companyName', header: 'Company', type: 'string' as const, width: 25 },
        { field: 'jobProfile', header: 'Job Profile', type: 'string' as const, width: 20 },
        { field: 'startDate', header: 'Start Date', type: 'date' as const, width: 12 },
        { field: 'endDate', header: 'End Date', type: 'date' as const, width: 12 },
        { field: 'duration', header: 'Duration', type: 'string' as const, width: 10 },
        { field: 'status', header: 'Status', type: 'string' as const, width: 12 },
        { field: 'mentorName', header: 'Mentor', type: 'string' as const, width: 18 },
        { field: 'reportsSubmitted', header: 'Reports', type: 'number' as const, width: 10 },
        { field: 'location', header: 'Location', type: 'string' as const, width: 15 },
      ],
      'internship_status': [
        { field: 'studentName', header: 'Student Name', type: 'string' as const, width: 20 },
        { field: 'rollNumber', header: 'Roll Number', type: 'string' as const, width: 15 },
        { field: 'companyName', header: 'Company', type: 'string' as const, width: 25 },
        { field: 'status', header: 'Status', type: 'string' as const, width: 12 },
        { field: 'mentorName', header: 'Mentor', type: 'string' as const, width: 18 },
        { field: 'reportsSubmitted', header: 'Reports', type: 'number' as const, width: 10 },
      ],
      // Faculty/Mentor reports - matches generateFacultyVisitReport output
      'faculty_visit': [
        { field: 'facultyName', header: 'Faculty Name', type: 'string' as const, width: 20 },
        { field: 'facultyDesignation', header: 'Designation', type: 'string' as const, width: 15 },
        { field: 'studentName', header: 'Student Name', type: 'string' as const, width: 20 },
        { field: 'rollNumber', header: 'Roll Number', type: 'string' as const, width: 15 },
        { field: 'companyName', header: 'Company', type: 'string' as const, width: 25 },
        { field: 'visitDate', header: 'Visit Date', type: 'date' as const, width: 12 },
        { field: 'visitType', header: 'Visit Type', type: 'string' as const, width: 12 },
        { field: 'visitLocation', header: 'Location', type: 'string' as const, width: 15 },
        { field: 'followUpRequired', header: 'Follow-up', type: 'boolean' as const, width: 10 },
        { field: 'nextVisitDate', header: 'Next Visit', type: 'date' as const, width: 12 },
      ],
      'mentor_list': [
        { field: 'facultyName', header: 'Faculty Name', type: 'string' as const, width: 20 },
        { field: 'facultyDesignation', header: 'Designation', type: 'string' as const, width: 15 },
        { field: 'studentName', header: 'Student Name', type: 'string' as const, width: 20 },
        { field: 'companyName', header: 'Company', type: 'string' as const, width: 25 },
      ],
      // Monthly reports - matches generateMonthlyReport output
      'monthly': [
        { field: 'studentName', header: 'Student Name', type: 'string' as const, width: 20 },
        { field: 'rollNumber', header: 'Roll Number', type: 'string' as const, width: 15 },
        { field: 'companyName', header: 'Company', type: 'string' as const, width: 25 },
        { field: 'month', header: 'Month', type: 'number' as const, width: 8 },
        { field: 'year', header: 'Year', type: 'number' as const, width: 8 },
        { field: 'status', header: 'Status', type: 'string' as const, width: 12 },
        { field: 'submittedAt', header: 'Submitted At', type: 'date' as const, width: 15 },
        { field: 'reportFileUrl', header: 'Report URL', type: 'string' as const, width: 30 },
      ],
      'monthly_report_status': [
        { field: 'studentName', header: 'Student Name', type: 'string' as const, width: 20 },
        { field: 'rollNumber', header: 'Roll Number', type: 'string' as const, width: 15 },
        { field: 'month', header: 'Month', type: 'number' as const, width: 8 },
        { field: 'year', header: 'Year', type: 'number' as const, width: 8 },
        { field: 'status', header: 'Status', type: 'string' as const, width: 12 },
      ],
      // Placement reports - matches generatePlacementReport output
      'placement': [
        { field: 'studentName', header: 'Student Name', type: 'string' as const, width: 20 },
        { field: 'rollNumber', header: 'Roll Number', type: 'string' as const, width: 15 },
        { field: 'email', header: 'Email', type: 'string' as const, width: 25 },
        { field: 'companyName', header: 'Company', type: 'string' as const, width: 25 },
        { field: 'jobRole', header: 'Job Role', type: 'string' as const, width: 20 },
        { field: 'salary', header: 'Salary (LPA)', type: 'number' as const, width: 12 },
        { field: 'offerDate', header: 'Offer Date', type: 'date' as const, width: 12 },
        { field: 'status', header: 'Status', type: 'string' as const, width: 12 },
      ],
      // Institution performance - matches generateInstitutionPerformanceReport output
      'institution_performance': [
        { field: 'metric', header: 'Metric', type: 'string' as const, width: 25 },
        { field: 'value', header: 'Value', type: 'number' as const, width: 15 },
        { field: 'category', header: 'Category', type: 'string' as const, width: 15 },
      ],
      // Compliance reports - matches generateStudentComplianceReport output
      'student_compliance': [
        { field: 'rollNumber', header: 'Roll Number', type: 'string' as const, width: 15 },
        { field: 'name', header: 'Student Name', type: 'string' as const, width: 20 },
        { field: 'branchName', header: 'Branch', type: 'string' as const, width: 15 },
        { field: 'mentorName', header: 'Mentor', type: 'string' as const, width: 18 },
        { field: 'joiningReportStatus', header: 'Joining Report', type: 'string' as const, width: 15 },
        { field: 'monthlyReportsSubmitted', header: 'Reports Submitted', type: 'number' as const, width: 15 },
        { field: 'monthlyReportsPending', header: 'Reports Pending', type: 'number' as const, width: 15 },
        { field: 'lastReportDate', header: 'Last Report Date', type: 'date' as const, width: 15 },
        { field: 'complianceScore', header: 'Compliance Score', type: 'number' as const, width: 15 },
        { field: 'complianceLevel', header: 'Compliance Level', type: 'string' as const, width: 15 },
      ],
      'compliance': [
        { field: 'rollNumber', header: 'Roll Number', type: 'string' as const, width: 15 },
        { field: 'name', header: 'Student Name', type: 'string' as const, width: 20 },
        { field: 'branchName', header: 'Branch', type: 'string' as const, width: 15 },
        { field: 'mentorName', header: 'Mentor', type: 'string' as const, width: 18 },
        { field: 'joiningReportStatus', header: 'Joining Report', type: 'string' as const, width: 15 },
        { field: 'monthlyReportsSubmitted', header: 'Reports Submitted', type: 'number' as const, width: 15 },
        { field: 'monthlyReportsPending', header: 'Reports Pending', type: 'number' as const, width: 15 },
        { field: 'lastReportDate', header: 'Last Report Date', type: 'date' as const, width: 15 },
        { field: 'complianceScore', header: 'Compliance Score', type: 'number' as const, width: 15 },
        { field: 'complianceLevel', header: 'Compliance Level', type: 'string' as const, width: 15 },
      ],
    };

    // Get columns for this report type
    let columns = reportColumns[normalizedType];

    // If no predefined columns, generate from data
    if (!columns || columns.length === 0) {
      this.logger.warn(`No predefined columns for report type: ${reportType}, generating from data`);
      if (data.length > 0) {
        const firstRow = data[0];
        columns = Object.keys(firstRow).map(key => ({
          field: key,
          header: key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase()),
          type: this.inferColumnType(firstRow[key]),
          width: 15,
        }));
      } else {
        columns = [];
      }
    }

    // Filter columns based on user selection (if provided)
    if (selectedColumns && selectedColumns.length > 0) {
      this.logger.log(`Filtering to selected columns: ${selectedColumns.join(', ')}`);

      // Filter to only include selected columns while preserving order
      const filteredColumns = selectedColumns
        .map(colId => columns.find(c => c.field === colId))
        .filter(Boolean);

      // Only use filtered columns if at least one matched
      if (filteredColumns.length > 0) {
        columns = filteredColumns;

        // Also filter the data to only include selected fields
        const selectedFields = new Set(selectedColumns);
        data = data.map(row => {
          const filteredRow: Record<string, unknown> = {};
          for (const field of selectedFields) {
            if (field in row) {
              filteredRow[field] = row[field];
            }
          }
          return filteredRow;
        });
      }
    }

    const title = reportTitles[normalizedType] ||
      reportType.replace(/[-_]/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) + ' Report';

    this.logger.log(`Export config: type=${reportType}, columns=${columns.length}, rows=${data.length}`);

    return {
      title,
      columns,
      data,
      format,
      metadata: {
        generatedAt: new Date(),
        generatedBy: userId,
        filters,
      },
    };
  }

  /**
   * Infer column type from value
   */
  private inferColumnType(value: any): 'string' | 'number' | 'date' | 'boolean' {
    if (value === null || value === undefined) return 'string';
    if (typeof value === 'number') return 'number';
    if (typeof value === 'boolean') return 'boolean';
    if (value instanceof Date) return 'date';
    if (typeof value === 'string') {
      // Check if it looks like a date
      if (/^\d{4}-\d{2}-\d{2}/.test(value)) return 'date';
    }
    return 'string';
  }


  /**
   * Send notification to user
   */
  private async sendNotification(
    userId: string,
    reportType: string,
    downloadUrl: string,
  ) {
    try {
      await this.prisma.notification.create({
        data: {
          userId,
          title: 'Report Generated',
          body: `Your ${reportType} report has been generated successfully.`,
          type: 'REPORT',
          data: {
            reportType,
            downloadUrl,
          },
        },
      });
    } catch (error) {
      this.logger.error('Error sending notification:', error);
      // Don't throw error, notification failure shouldn't fail the job
    }
  }
}
