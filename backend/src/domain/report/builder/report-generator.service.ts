import { Injectable } from '@nestjs/common';
import { InternshipStatus, MonthlyReportStatus, Role } from '@prisma/client';
import { PrismaService } from '../../../core/database/prisma.service';
import { ReportType } from './interfaces/report.interface';

@Injectable()
export class ReportGeneratorService {
  constructor(private prisma: PrismaService) {}

  /**
   * Generate Student Progress Report
   */
  async generateStudentProgressReport(filters: any): Promise<any[]> {
    const where: Record<string, unknown> = {};

    if (filters?.institutionId) {
      where.institutionId = filters.institutionId;
    }

    // The schema uses Branch (not Department) for academic grouping.
    if (filters?.branchId) {
      where.branchId = filters.branchId;
    } else if (filters?.departmentId) {
      where.branchId = filters.departmentId;
    }

    if (filters?.year) {
      where.currentYear = Number(filters.year);
    } else if (filters?.academicYear) {
      where.currentYear = Number(filters.academicYear);
    }

    if (filters?.semester) {
      where.currentSemester = Number(filters.semester);
    }

    const students = await this.prisma.student.findMany({
      where,
      include: {
        user: { select: { name: true, email: true, phoneNo: true } },
        branch: { select: { name: true } },
        internshipApplications: { select: { id: true } },
        placements: { select: { id: true } },
      },
    });

    return students.map((student) => ({
      rollNumber: student.rollNumber,
      name: student.name,
      email: student.email ?? student.user.email,
      phoneNumber: student.contact ?? student.user.phoneNo,
      branch: student.branch?.name ?? student.branchName,
      currentYear: student.currentYear,
      currentSemester: student.currentSemester,
      internshipsCount: student.internshipApplications.length,
      placementsCount: student.placements.length,
      status: student.clearanceStatus,
      isActive: student.isActive,
    }));
  }

  /**
   * Generate Internship Report
   */
  async generateInternshipReport(filters: any): Promise<any[]> {
    const where: Record<string, unknown> = {};

    if (filters?.institutionId) {
      where.student = { institutionId: filters.institutionId };
    }

    if (filters?.status) {
      where.status = filters.status;
    }

    if (filters?.startDate && filters?.endDate) {
      where.internship = {
        startDate: {
          gte: new Date(filters.startDate),
          lte: new Date(filters.endDate),
        },
      };
    }

    const applications = await this.prisma.internshipApplication.findMany({
      where,
      include: {
        student: {
          select: {
            id: true,
            name: true,
            rollNumber: true,
            branchName: true,
          },
        },
        internship: {
          include: {
            industry: {
              select: {
                id: true,
                companyName: true,
                city: true,
              },
            },
          },
        },
        mentor: { select: { id: true, name: true } },
        _count: { select: { monthlyReports: true } },
      },
    });

    return applications.map((application) => ({
      studentName: application.student.name,
      rollNumber: application.student.rollNumber,
      branch: application.student.branchName,
      companyName:
        application.internship?.industry.companyName ?? application.companyName,
      jobProfile: application.jobProfile,
      startDate: application.internship?.startDate ?? application.startDate,
      endDate: application.internship?.endDate ?? application.endDate,
      duration: application.internship?.duration ?? application.internshipDuration,
      status: application.status,
      mentorName: application.mentor?.name ?? 'N/A',
      reportsSubmitted: application._count.monthlyReports,
      location: application.internship?.workLocation ?? application.companyAddress,
      isSelfIdentified: application.isSelfIdentified,
    }));
  }

  /**
   * Generate Faculty Visit Report
   */
  async generateFacultyVisitReport(filters: any): Promise<any[]> {
    const where: Record<string, unknown> = {};

    if (filters?.institutionId) {
      where.application = { student: { institutionId: filters.institutionId } };
    }

    if (filters?.facultyId) {
      where.facultyId = filters.facultyId;
    }

    if (filters?.startDate && filters?.endDate) {
      where.visitDate = {
        gte: new Date(filters.startDate),
        lte: new Date(filters.endDate),
      };
    }

    const visits = await this.prisma.facultyVisitLog.findMany({
      where,
      include: {
        faculty: { select: { id: true, name: true, designation: true } },
        application: {
          include: {
            student: { select: { id: true, name: true, rollNumber: true } },
            internship: {
              include: {
                industry: { select: { id: true, companyName: true } },
              },
            },
          },
        },
      },
      orderBy: { visitDate: 'desc' },
    });

    return visits.map((visit) => ({
      facultyName: visit.faculty.name,
      facultyDesignation: visit.faculty.designation,
      studentName: visit.application.student.name,
      rollNumber: visit.application.student.rollNumber,
      companyName: visit.application.internship?.industry.companyName,
      visitDate: visit.visitDate,
      visitType: visit.visitType,
      visitLocation: visit.visitLocation,
      followUpRequired: visit.followUpRequired,
      nextVisitDate: visit.nextVisitDate,
      meetingMinutes: visit.meetingMinutes,
    }));
  }

  /**
   * Generate Monthly Report
   */
  async generateMonthlyReport(filters: any): Promise<any[]> {
    const where: Record<string, unknown> = {};

    if (filters?.studentId) {
      where.studentId = filters.studentId;
    }

    if (filters?.institutionId) {
      where.student = { institutionId: filters.institutionId };
    }

    if (filters?.month && filters?.year) {
      where.reportMonth = Number(filters.month);
      where.reportYear = Number(filters.year);
    }

    const reports = await this.prisma.monthlyReport.findMany({
      where,
      include: {
        student: { select: { id: true, name: true, rollNumber: true } },
        application: {
          include: {
            internship: {
              include: {
                industry: { select: { companyName: true } },
              },
            },
          },
        },
      },
      orderBy: [{ reportYear: 'desc' }, { reportMonth: 'desc' }],
    });

    return reports.map((report) => ({
      studentName: report.student.name,
      rollNumber: report.student.rollNumber,
      companyName: report.application.internship?.industry.companyName,
      month: report.reportMonth,
      year: report.reportYear,
      status: report.status,
      submittedAt: report.submittedAt,
      reportFileUrl: report.reportFileUrl,
    }));
  }

  /**
   * Generate Placement Report
   */
  async generatePlacementReport(filters: any): Promise<any[]> {
    const where: Record<string, unknown> = {};

    if (filters?.institutionId) {
      where.OR = [
        { institutionId: filters.institutionId },
        { student: { institutionId: filters.institutionId } },
      ];
    }

    if (filters?.minSalary || filters?.maxSalary) {
      where.salary = {};
      if (filters.minSalary) {
        (where.salary as Record<string, unknown>).gte = Number(filters.minSalary);
      }
      if (filters.maxSalary) {
        (where.salary as Record<string, unknown>).lte = Number(filters.maxSalary);
      }
    }

    const placements = await this.prisma.placement.findMany({
      where,
      include: {
        student: { select: { id: true, name: true, rollNumber: true, email: true } },
      },
      orderBy: { offerDate: 'desc' },
    });

    return placements.map((placement) => ({
      studentName: placement.student.name,
      rollNumber: placement.student.rollNumber,
      email: placement.student.email,
      companyName: placement.companyName,
      jobRole: placement.jobRole,
      salary: placement.salary,
      offerDate: placement.offerDate,
      status: placement.status,
    }));
  }

  /**
   * Generate Institution Performance Report
   */
  async generateInstitutionPerformanceReport(filters: any): Promise<any[]> {
    const institutionId = filters.institutionId;

    if (!institutionId) {
      throw new Error('Institution ID is required');
    }

    const [
      totalStudents,
      totalFaculty,
      activeInternships,
      completedInternships,
      totalPlacements,
      totalApplications,
      branches,
      avgPlacementSalary,
    ] = await Promise.all([
      this.prisma.student.count({ where: { institutionId } }),
      this.prisma.user.count({
        where: {
          institutionId,
          role: { in: [Role.TEACHER, Role.FACULTY_SUPERVISOR] },
        },
      }),
      this.prisma.internship.count({
        where: {
          institutionId,
          status: InternshipStatus.ACTIVE,
          isActive: true,
        },
      }),
      this.prisma.internship.count({
        where: {
          institutionId,
          status: InternshipStatus.COMPLETED,
        },
      }),
      this.prisma.placement.count({
        where: { OR: [{ institutionId }, { student: { institutionId } }] },
      }),
      this.prisma.internshipApplication.count({
        where: { student: { institutionId } },
      }),
      this.prisma.branch.findMany({
        where: { institutionId },
        include: { _count: { select: { students: true } } },
      }),
      this.prisma.placement.aggregate({
        where: { OR: [{ institutionId }, { student: { institutionId } }] },
        _avg: { salary: true },
      }),
    ]);

    return [
      {
        metric: 'Total Students',
        value: totalStudents,
        category: 'Students',
      },
      {
        metric: 'Total Faculty',
        value: totalFaculty,
        category: 'Faculty',
      },
      {
        metric: 'Active Internships',
        value: activeInternships,
        category: 'Internships',
      },
      {
        metric: 'Completed Internships',
        value: completedInternships,
        category: 'Internships',
      },
      {
        metric: 'Total Applications',
        value: totalApplications,
        category: 'Internships',
      },
      {
        metric: 'Total Placements',
        value: totalPlacements,
        category: 'Placements',
      },
      {
        metric: 'Average Placement Salary',
        value: avgPlacementSalary._avg.salary || 0,
        category: 'Placements',
      },
      {
        metric: 'Total Branches',
        value: branches.length,
        category: 'Academic',
      },
      ...branches.map((branch) => ({
        metric: `${branch.name} - Students`,
        value: branch._count.students,
        category: 'Branch',
      })),
    ];
  }

  /**
   * Generate report based on type
   */
  async generateReport(type: ReportType, filters: any): Promise<any[]> {
    switch (type) {
      case ReportType.STUDENT_PROGRESS:
        return this.generateStudentProgressReport(filters);
      case ReportType.INTERNSHIP:
        return this.generateInternshipReport(filters);
      case ReportType.FACULTY_VISIT:
        return this.generateFacultyVisitReport(filters);
      case ReportType.MONTHLY:
        return this.generateMonthlyReport(filters);
      case ReportType.PLACEMENT:
        return this.generatePlacementReport(filters);
      case ReportType.INSTITUTION_PERFORMANCE:
        return this.generateInstitutionPerformanceReport(filters);
      default:
        throw new Error(`Unknown report type: ${type}`);
    }
  }
}
