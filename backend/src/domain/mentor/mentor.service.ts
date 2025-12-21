import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { ApplicationStatus, MonthlyReportStatus, Role } from '@prisma/client';
import { PrismaService } from '../../core/database/prisma.service';
import { CacheService } from '../../core/cache/cache.service';

export interface AssignMentorDto {
  assignedDate?: Date;
  remarks?: string;
}

export interface UpdateAssignmentDto {
  mentorId?: string;
  assignedDate?: Date;
  remarks?: string;
  isActive?: boolean;
}

@Injectable()
export class MentorService {
  private readonly logger = new Logger(MentorService.name);
  private readonly CACHE_TTL = 600; // 10 minutes

  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
  ) {}

  private getCurrentAcademicYear(): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    // Assume academic year starts around July (month 6)
    const startYear = month >= 6 ? year : year - 1;
    return `${startYear}-${startYear + 1}`;
  }

  async assignMentor(studentId: string, mentorId: string, data?: AssignMentorDto) {
    try {
      this.logger.log(`Assigning mentor ${mentorId} to student ${studentId}`);

      const [student, mentor] = await Promise.all([
        this.prisma.student.findUnique({ where: { id: studentId } }),
        this.prisma.user.findUnique({ where: { id: mentorId } }),
      ]);

      if (!student) {
        throw new NotFoundException('Student not found');
      }

      if (!mentor) {
        throw new NotFoundException('Mentor not found');
      }

      if (mentor.role !== Role.FACULTY_SUPERVISOR) {
        throw new BadRequestException('Mentor must be a faculty supervisor');
      }

      // Check if mentor and student belong to same institution
      if (student.institutionId !== mentor.institutionId) {
        throw new BadRequestException('Mentor and student must belong to the same institution');
      }

      // Deactivate existing assignment(s)
      await this.prisma.mentorAssignment.updateMany({
        where: { studentId, isActive: true },
        data: {
          isActive: false,
          deactivatedAt: new Date(),
          deactivatedBy: mentorId,
          deactivationReason: 'Reassigned',
        },
      });

      // Create mentor assignment record
      const assignment = await this.prisma.mentorAssignment.create({
        data: {
          studentId,
          mentorId,
          assignedBy: mentorId,
          academicYear: this.getCurrentAcademicYear(),
          semester: null,
          assignmentDate: data?.assignedDate || new Date(),
          assignmentReason: data?.remarks,
          isActive: true,
        },
        include: {
          student: {
            include: {
              user: true,
            },
          },
          mentor: true,
        },
      });

      // Invalidate cache (parallel)
      await Promise.all([
        this.cache.del(`mentor:assignments:${mentorId}`),
        this.cache.del(`mentor:student:${studentId}`),
      ]);

      return {
        student,
        assignment,
      };
    } catch (error) {
      this.logger.error(`Failed to assign mentor: ${error.message}`, error.stack);
      throw error;
    }
  }

  async getMentorAssignments(mentorId: string) {
    try {
      const cacheKey = `mentor:assignments:${mentorId}`;

      return await this.cache.getOrSet(
        cacheKey,
        async () => {
          const assignments = await this.prisma.mentorAssignment.findMany({
            where: {
              mentorId,
              isActive: true,
            },
            include: {
              student: {
                include: {
                  user: true,
                  batch: true,
                  branch: true,
                  Institution: true,
                },
              },
            },
            orderBy: { assignmentDate: 'desc' },
          });

          const students = assignments.map((a) => a.student);

          return {
            students,
            assignments,
            totalStudents: students.length,
          };
        },
        this.CACHE_TTL,
      );
    } catch (error) {
      this.logger.error(`Failed to get mentor assignments: ${error.message}`, error.stack);
      throw error;
    }
  }

  async getStudentMentor(studentId: string) {
    try {
      const cacheKey = `mentor:student:${studentId}`;

      return await this.cache.getOrSet(
        cacheKey,
        async () => {
          const student = await this.prisma.student.findUnique({
            where: { id: studentId },
            select: { id: true },
          });

          if (!student) {
            throw new NotFoundException('Student not found');
          }

          const assignments = await this.prisma.mentorAssignment.findMany({
            where: { studentId },
            include: {
              mentor: true,
            },
            orderBy: { assignmentDate: 'desc' },
          });

          const current = assignments.find((a) => a.isActive) || null;

          return {
            currentMentor: current?.mentor || null,
            assignmentHistory: assignments,
          };
        },
        this.CACHE_TTL,
      );
    } catch (error) {
      this.logger.error(`Failed to get student mentor: ${error.message}`, error.stack);
      throw error;
    }
  }

  async updateAssignment(id: string, data: UpdateAssignmentDto) {
    try {
      this.logger.log(`Updating mentor assignment ${id}`);

      const assignment = await this.prisma.mentorAssignment.findUnique({
        where: { id },
      });

      if (!assignment) {
        throw new NotFoundException('Mentor assignment not found');
      }

      // If changing mentor, update student record
      if (data.mentorId && data.mentorId !== assignment.mentorId) {
        const mentor = await this.prisma.user.findUnique({
          where: { id: data.mentorId },
        });

        if (!mentor) {
          throw new NotFoundException('New mentor not found');
        }

        // Deactivate old assignment
        await this.prisma.mentorAssignment.update({
          where: { id },
          data: {
            isActive: false,
            deactivatedAt: new Date(),
            deactivatedBy: mentor.id,
          },
        });

        // Create new assignment
        const newAssignment = await this.prisma.mentorAssignment.create({
          data: {
            studentId: assignment.studentId,
            mentorId: data.mentorId,
            assignedBy: assignment.assignedBy,
            academicYear: assignment.academicYear,
            semester: assignment.semester,
            assignmentDate: data.assignedDate || new Date(),
            assignmentReason: data.remarks,
            isActive: true,
          },
          include: {
            student: {
              include: {
                user: true,
              },
            },
            mentor: true,
          },
        });

        // Invalidate cache (parallel)
        await Promise.all([
          this.cache.del(`mentor:assignments:${assignment.mentorId}`),
          this.cache.del(`mentor:assignments:${data.mentorId}`),
          this.cache.del(`mentor:student:${assignment.studentId}`),
        ]);

        return newAssignment;
      }

      const updated = await this.prisma.mentorAssignment.update({
        where: { id },
        data: {
          isActive: data.isActive ?? assignment.isActive,
          assignmentDate: data.assignedDate ?? assignment.assignmentDate,
          specialInstructions: data.remarks ?? assignment.specialInstructions,
        },
        include: {
          student: {
            include: {
              user: true,
            },
          },
          mentor: true,
        },
      });

      // Invalidate cache (parallel)
      await Promise.all([
        this.cache.del(`mentor:assignments:${assignment.mentorId}`),
        this.cache.del(`mentor:student:${assignment.studentId}`),
      ]);

      return updated;
    } catch (error) {
      this.logger.error(`Failed to update mentor assignment: ${error.message}`, error.stack);
      throw error;
    }
  }

  async getMentorStatistics(mentorId: string) {
    try {
      const cacheKey = `mentor:statistics:${mentorId}`;

      return await this.cache.getOrSet(
        cacheKey,
        async () => {
          // All counts in single Promise.all for better performance
          const [
            totalStudents,
            activeInternships,
            monthlyReports,
            facultyVisits,
            pendingReports,
            approvedReports,
          ] = await Promise.all([
            this.prisma.mentorAssignment.count({ where: { mentorId, isActive: true } }),
            this.prisma.internshipApplication.count({
              where: {
                mentorId,
                status: { in: [ApplicationStatus.SELECTED, ApplicationStatus.JOINED, ApplicationStatus.APPROVED] },
              },
            }),
            this.prisma.monthlyReport.count({
              where: {
                application: { mentorId },
              },
            }),
            this.prisma.facultyVisitLog.count({
              where: { facultyId: mentorId },
            }),
            this.prisma.monthlyReport.count({
              where: {
                application: { mentorId },
                status: { in: [MonthlyReportStatus.SUBMITTED, MonthlyReportStatus.UNDER_REVIEW, MonthlyReportStatus.REVISION_REQUIRED] },
              },
            }),
            this.prisma.monthlyReport.count({
              where: {
                application: { mentorId },
                status: MonthlyReportStatus.APPROVED,
              },
            }),
          ]);

          return {
            totalStudents,
            activeInternships,
            totalReports: monthlyReports,
            pendingReports,
            approvedReports,
            facultyVisits,
            averageReportsPerStudent: totalStudents > 0 ? monthlyReports / totalStudents : 0,
          };
        },
        this.CACHE_TTL,
      );
    } catch (error) {
      this.logger.error(`Failed to get mentor statistics: ${error.message}`, error.stack);
      throw error;
    }
  }

  async removeMentorAssignment(studentId: string) {
    try {
      this.logger.log(`Removing mentor assignment for student ${studentId}`);

      const student = await this.prisma.student.findUnique({
        where: { id: studentId },
      });

      if (!student) {
        throw new NotFoundException('Student not found');
      }

      const activeAssignment = await this.prisma.mentorAssignment.findFirst({
        where: { studentId, isActive: true },
        select: { id: true, mentorId: true, assignedBy: true },
      });

      if (!activeAssignment) {
        throw new BadRequestException('Student does not have a mentor assigned');
      }

      // Deactivate all active assignments
      await this.prisma.mentorAssignment.updateMany({
        where: {
          studentId,
          isActive: true,
        },
        data: {
          isActive: false,
          deactivatedAt: new Date(),
          deactivatedBy: activeAssignment.assignedBy,
        },
      });

      // Invalidate cache (parallel)
      await Promise.all([
        this.cache.del(`mentor:assignments:${activeAssignment.mentorId}`),
        this.cache.del(`mentor:student:${studentId}`),
      ]);

      return { success: true, message: 'Mentor assignment removed successfully' };
    } catch (error) {
      this.logger.error(`Failed to remove mentor assignment: ${error.message}`, error.stack);
      throw error;
    }
  }
}
