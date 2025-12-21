import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { PrismaService } from '../../../core/database/prisma.service';
import {
  ReportType,
  ReportConfig,
  ReportCatalogItem,
  ReportJobData,
  ReportStatus,
} from './interfaces/report.interface';

@Injectable()
export class ReportBuilderService {
  constructor(
    @InjectQueue('report-generation') private reportQueue: Queue,
    private prisma: PrismaService,
  ) {}

  /**
   * Get report catalog based on user role
   */
  getReportCatalog(role: string): ReportCatalogItem[] {
    const allReports: ReportCatalogItem[] = [
      {
        type: ReportType.STUDENT_PROGRESS,
        name: 'Student Progress Report',
        description: 'Track student academic progress and internship status',
        icon: 'users',
        category: 'Academic',
      },
      {
        type: ReportType.INTERNSHIP,
        name: 'Internship Report',
        description: 'Overview of all internships and their status',
        icon: 'briefcase',
        category: 'Internship',
      },
      {
        type: ReportType.FACULTY_VISIT,
        name: 'Faculty Visit Report',
        description: 'Track faculty visits to internship locations',
        icon: 'map-pin',
        category: 'Internship',
      },
      {
        type: ReportType.MONTHLY,
        name: 'Monthly Report',
        description: 'Student monthly progress reports',
        icon: 'calendar',
        category: 'Academic',
      },
      {
        type: ReportType.PLACEMENT,
        name: 'Placement Report',
        description: 'Student placement statistics and details',
        icon: 'award',
        category: 'Placement',
      },
      {
        type: ReportType.INSTITUTION_PERFORMANCE,
        name: 'Institution Performance Report',
        description: 'Overall institution performance metrics',
        icon: 'trending-up',
        category: 'Analytics',
      },
    ];

    // Filter reports based on role
    switch (role) {
      case 'SYSTEM_ADMIN':
      case 'STATE_DIRECTORATE':
        return allReports;
      case 'PRINCIPAL':
        return allReports.filter(
          (r) => r.type !== ReportType.INSTITUTION_PERFORMANCE,
        );
      case 'FACULTY':
        return allReports.filter(
          (r) =>
            r.type === ReportType.STUDENT_PROGRESS ||
            r.type === ReportType.INTERNSHIP ||
            r.type === ReportType.FACULTY_VISIT,
        );
      case 'STUDENT':
        return allReports.filter(
          (r) =>
            r.type === ReportType.STUDENT_PROGRESS ||
            r.type === ReportType.MONTHLY,
        );
      default:
        return [];
    }
  }

  /**
   * Get report configuration
   */
  getReportConfig(type: string): ReportConfig {
    const reportConfigs: Record<string, ReportConfig> = {
      [ReportType.STUDENT_PROGRESS]: {
        type: ReportType.STUDENT_PROGRESS,
        name: 'Student Progress Report',
        description: 'Track student academic progress and internship status',
        availableFor: ['SYSTEM_ADMIN', 'PRINCIPAL', 'FACULTY', 'STUDENT'],
        filters: [
          {
            name: 'academicYear',
            label: 'Academic Year',
            type: 'select',
            required: false,
            options: this.getAcademicYearOptions(),
          },
          {
            name: 'semester',
            label: 'Semester',
            type: 'select',
            required: false,
            options: [
              { label: '1st', value: 1 },
              { label: '2nd', value: 2 },
              { label: '3rd', value: 3 },
              { label: '4th', value: 4 },
              { label: '5th', value: 5 },
              { label: '6th', value: 6 },
              { label: '7th', value: 7 },
              { label: '8th', value: 8 },
            ],
          },
          {
            name: 'departmentId',
            label: 'Department',
            type: 'select',
            required: false,
          },
        ],
        columns: [
          { field: 'enrollmentNumber', header: 'Enrollment Number', type: 'string' },
          { field: 'name', header: 'Student Name', type: 'string' },
          { field: 'email', header: 'Email', type: 'string' },
          { field: 'department', header: 'Department', type: 'string' },
          { field: 'academicYear', header: 'Academic Year', type: 'string' },
          { field: 'semester', header: 'Semester', type: 'number' },
          { field: 'cgpa', header: 'CGPA', type: 'number' },
          { field: 'internshipsCount', header: 'Internships', type: 'number' },
          { field: 'placementsCount', header: 'Placements', type: 'number' },
          { field: 'status', header: 'Status', type: 'string' },
        ],
      },
      [ReportType.INTERNSHIP]: {
        type: ReportType.INTERNSHIP,
        name: 'Internship Report',
        description: 'Overview of all internships and their status',
        availableFor: ['SYSTEM_ADMIN', 'PRINCIPAL', 'FACULTY'],
        filters: [
          {
            name: 'status',
            label: 'Status',
            type: 'select',
            required: false,
            options: [
              { label: 'Active', value: 'active' },
              { label: 'Completed', value: 'completed' },
              { label: 'Pending', value: 'pending' },
            ],
          },
          {
            name: 'dateRange',
            label: 'Date Range',
            type: 'dateRange',
            required: false,
          },
        ],
        columns: [
          { field: 'studentName', header: 'Student Name', type: 'string' },
          { field: 'enrollmentNumber', header: 'Enrollment Number', type: 'string' },
          { field: 'department', header: 'Department', type: 'string' },
          { field: 'companyName', header: 'Company', type: 'string' },
          { field: 'designation', header: 'Designation', type: 'string' },
          { field: 'startDate', header: 'Start Date', type: 'date' },
          { field: 'endDate', header: 'End Date', type: 'date' },
          { field: 'duration', header: 'Duration (months)', type: 'number' },
          { field: 'status', header: 'Status', type: 'string' },
          { field: 'mentorName', header: 'Mentor', type: 'string' },
          { field: 'reportsSubmitted', header: 'Reports Submitted', type: 'number' },
        ],
      },
      [ReportType.PLACEMENT]: {
        type: ReportType.PLACEMENT,
        name: 'Placement Report',
        description: 'Student placement statistics and details',
        availableFor: ['SYSTEM_ADMIN', 'PRINCIPAL'],
        filters: [
          {
            name: 'academicYear',
            label: 'Academic Year',
            type: 'select',
            required: false,
            options: this.getAcademicYearOptions(),
          },
          {
            name: 'minPackage',
            label: 'Minimum Package (LPA)',
            type: 'text',
            required: false,
          },
          {
            name: 'maxPackage',
            label: 'Maximum Package (LPA)',
            type: 'text',
            required: false,
          },
        ],
        columns: [
          { field: 'studentName', header: 'Student Name', type: 'string' },
          { field: 'enrollmentNumber', header: 'Enrollment Number', type: 'string' },
          { field: 'department', header: 'Department', type: 'string' },
          { field: 'cgpa', header: 'CGPA', type: 'number' },
          { field: 'companyName', header: 'Company', type: 'string' },
          { field: 'designation', header: 'Designation', type: 'string' },
          { field: 'package', header: 'Package (LPA)', type: 'number' },
          { field: 'placementDate', header: 'Placement Date', type: 'date' },
          { field: 'joiningDate', header: 'Joining Date', type: 'date' },
          { field: 'location', header: 'Location', type: 'string' },
          { field: 'employmentType', header: 'Employment Type', type: 'string' },
        ],
      },
    };

    return reportConfigs[type] || null;
  }

  /**
   * Queue report generation
   */
  async queueReportGeneration(
    userId: string,
    type: string,
    filters: any,
    format: string,
  ): Promise<{ jobId: string; reportId: string }> {
    const reportConfig = this.getReportConfig(type);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    // Create report record in database
    const report = await this.prisma.generatedReport.create({
      data: {
        reportType: type,
        reportName: reportConfig?.name,
        configuration: {
          filters: filters || {},
        },
        format,
        status: ReportStatus.PENDING,
        errorMessage: null,
        generatedBy: userId,
        institutionId: filters?.institutionId || null,
        expiresAt,
      },
      select: {
        id: true,
      },
    });

    // Add job to queue
    const job = await this.reportQueue.add('generate-report', {
      userId,
      reportType: type,
      filters,
      format,
      reportId: report.id,
    } as ReportJobData);

    return {
      jobId: job.id as string,
      reportId: report.id,
    };
  }

  /**
   * Get report status
   */
  async getReportStatus(reportId: string) {
    const report = await this.prisma.generatedReport.findUnique({
      where: { id: reportId },
      select: {
        id: true,
        status: true,
        format: true,
        errorMessage: true,
        createdAt: true,
        generatedAt: true,
        reportType: true,
        fileUrl: true,
      },
    });

    if (!report) return null;

    return {
      id: report.id,
      type: report.reportType,
      status: report.status,
      format: report.format,
      downloadUrl: report.fileUrl,
      errorMessage: report.errorMessage,
      createdAt: report.createdAt,
      completedAt: report.generatedAt,
    };
  }

  /**
   * Get report history for user
   */
  async getReportHistory(userId: string, pagination: { page: number; limit: number }) {
    const skip = (pagination.page - 1) * pagination.limit;

    const [reports, total] = await Promise.all([
      this.prisma.generatedReport.findMany({
        where: { generatedBy: userId },
        orderBy: { createdAt: 'desc' },
        skip,
        take: pagination.limit,
        select: {
          id: true,
          reportType: true,
          status: true,
          format: true,
          fileUrl: true,
          createdAt: true,
          generatedAt: true,
        },
      }),
      this.prisma.generatedReport.count({ where: { generatedBy: userId } }),
    ]);

    const normalizedReports = reports.map((report) => ({
      id: report.id,
      type: report.reportType,
      status: report.status,
      format: report.format,
      downloadUrl: report.fileUrl,
      createdAt: report.createdAt,
      completedAt: report.generatedAt,
    }));

    return {
      data: normalizedReports,
      total,
      page: pagination.page,
      limit: pagination.limit,
      totalPages: Math.ceil(total / pagination.limit),
    };
  }

  /**
   * Get academic year options
   */
  private getAcademicYearOptions() {
    const currentYear = new Date().getFullYear();
    const years = [];

    for (let i = 0; i < 5; i++) {
      const startYear = currentYear - i;
      const endYear = startYear + 1;
      years.push({
        label: `${startYear}-${endYear}`,
        value: `${startYear}-${endYear}`,
      });
    }

    return years;
  }
}
