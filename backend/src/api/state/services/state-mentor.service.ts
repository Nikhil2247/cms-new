import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../../../core/database/prisma.service';
import { LruCacheService } from '../../../core/cache/lru-cache.service';
import { AuditService } from '../../../infrastructure/audit/audit.service';
import { Role, AuditAction, AuditCategory, AuditSeverity } from '@prisma/client';

@Injectable()
export class StateMentorService {
  private readonly logger = new Logger(StateMentorService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: LruCacheService,
    private readonly auditService: AuditService,
  ) {}

  /**
   * Get faculty/mentors from an institution
   */
  async getInstitutionMentors(institutionId: string) {
    const [mentors, allAssignments] = await Promise.all([
      this.prisma.user.findMany({
        where: {
          institutionId,
          role: { in: [Role.FACULTY_SUPERVISOR, Role.TEACHER] },
          active: true,
        },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
        },
        orderBy: { name: 'asc' },
      }),
      // Get all active assignments to count unique students per mentor
      this.prisma.mentorAssignment.findMany({
        where: {
          mentor: { institutionId },
          isActive: true,
        },
        select: { mentorId: true, studentId: true },
      }),
    ]);

    // Build unique students per mentor map
    const mentorStudentMap = new Map<string, Set<string>>();
    for (const { mentorId, studentId } of allAssignments) {
      if (!mentorStudentMap.has(mentorId)) {
        mentorStudentMap.set(mentorId, new Set());
      }
      mentorStudentMap.get(mentorId)!.add(studentId);
    }

    return mentors.map(mentor => ({
      id: mentor.id,
      name: mentor.name,
      email: mentor.email,
      role: mentor.role,
      activeAssignments: mentorStudentMap.get(mentor.id)?.size || 0,
    }));
  }

  /**
   * Assign mentor to student (State Directorate override)
   */
  async assignMentorToStudent(studentId: string, mentorId: string, assignedBy: string) {
    // Validate student exists
    const student = await this.prisma.student.findUnique({
      where: { id: studentId },
      select: { id: true, institutionId: true, name: true },
    });

    if (!student) {
      throw new NotFoundException('Student not found');
    }

    // Validate mentor exists and belongs to same institution
    const mentor = await this.prisma.user.findUnique({
      where: { id: mentorId },
      select: { id: true, name: true, institutionId: true, role: true },
    });

    if (!mentor) {
      throw new NotFoundException('Mentor not found');
    }

    // Note: Cross-institution mentoring is allowed - state admin can assign faculty from one institution
    // to mentor students from another institution (this happens physically in the field)

    if (mentor.role !== Role.FACULTY_SUPERVISOR && mentor.role !== Role.TEACHER) {
      throw new BadRequestException('Selected user is not a valid mentor');
    }

    // Deactivate existing assignments
    await this.prisma.mentorAssignment.updateMany({
      where: { studentId, isActive: true },
      data: {
        isActive: false,
        deactivatedAt: new Date(),
        deactivatedBy: assignedBy,
        deactivationReason: 'Reassigned by State Directorate',
      },
    });

    // Create new assignment
    const assignment = await this.prisma.mentorAssignment.create({
      data: {
        studentId,
        mentorId,
        assignedBy,
        academicYear: this.getCurrentAcademicYear(),
        assignmentDate: new Date(),
        assignmentReason: 'Assigned by State Directorate',
        isActive: true,
      },
      include: {
        mentor: { select: { id: true, name: true, email: true } },
      },
    });

    // Audit mentor assignment
    this.auditService.log({
      action: AuditAction.MENTOR_ASSIGN,
      entityType: 'MentorAssignment',
      entityId: assignment.id,
      userId: assignedBy,
      userRole: Role.STATE_DIRECTORATE,
      description: `Mentor ${mentor.name} assigned to student ${student.name} by State Directorate`,
      category: AuditCategory.INTERNSHIP_WORKFLOW,
      severity: AuditSeverity.MEDIUM,
      institutionId: student.institutionId || undefined,
      newValues: {
        assignmentId: assignment.id,
        studentId,
        studentName: student.name,
        mentorId,
        mentorName: mentor.name,
        assignedBy,
      },
    }).catch(() => {});

    // Invalidate cache
    await Promise.all([
      this.cache.mdel(`mentor:assignments:${mentorId}`),
      this.cache.mdel(`mentor:student:${studentId}`),
      this.cache.mdel(`state:institute:${student.institutionId}:students`),
    ]);

    return {
      success: true,
      message: `Mentor ${mentor.name} assigned to student ${student.name}`,
      assignment,
    };
  }

  /**
   * Remove mentor from student (State Directorate)
   */
  async removeMentorFromStudent(studentId: string, removedBy: string) {
    const student = await this.prisma.student.findUnique({
      where: { id: studentId },
      select: { id: true, institutionId: true, name: true },
    });

    if (!student) {
      throw new NotFoundException('Student not found');
    }

    const result = await this.prisma.mentorAssignment.updateMany({
      where: { studentId, isActive: true },
      data: {
        isActive: false,
        deactivatedAt: new Date(),
        deactivatedBy: removedBy,
        deactivationReason: 'Removed by State Directorate',
      },
    });

    // Invalidate cache
    await this.cache.mdel(`mentor:student:${studentId}`);
    await this.cache.mdel(`state:institute:${student.institutionId}:students`);

    return {
      success: true,
      message: result.count > 0 ? 'Mentor removed successfully' : 'No active mentor assignment found',
      removed: result.count,
    };
  }

  /**
   * Delete student and all associated data (State Directorate)
   */
  async deleteStudent(studentId: string, deletedBy: string) {
    const student = await this.prisma.student.findUnique({
      where: { id: studentId },
      select: {
        id: true,
        institutionId: true,
        name: true,
        email: true,
        user: { select: { id: true } },
      },
    });

    if (!student) {
      throw new NotFoundException('Student not found');
    }

    // Use transaction to delete all related data
    await this.prisma.$transaction(async (tx) => {
      // Delete mentor assignments
      await tx.mentorAssignment.deleteMany({
        where: { studentId },
      });

      // Delete internship applications (FacultyVisitLog will cascade delete)
      await tx.internshipApplication.deleteMany({
        where: { studentId },
      });

      // Delete monthly reports
      await tx.monthlyReport.deleteMany({
        where: { studentId },
      });

      // Delete documents related to the student
      await tx.document.deleteMany({
        where: { studentId },
      });

      // Delete the student record
      await tx.student.delete({
        where: { id: studentId },
      });

      // Delete the associated user account if exists
      if (student.user?.id) {
        await tx.user.delete({
          where: { id: student.user.id },
        });
      }
    });

    // Audit student deletion
    this.auditService.log({
      action: AuditAction.USER_DEACTIVATION,
      entityType: 'Student',
      entityId: studentId,
      userId: deletedBy,
      userRole: Role.STATE_DIRECTORATE,
      description: `Student ${student.name} (${student.email}) deleted by State Directorate`,
      category: AuditCategory.USER_MANAGEMENT,
      severity: AuditSeverity.HIGH,
      institutionId: student.institutionId || undefined,
      oldValues: {
        studentId,
        studentName: student.name,
        studentEmail: student.email,
        institutionId: student.institutionId,
      },
    }).catch(() => {});

    // Invalidate cache
    await Promise.all([
      this.cache.mdel(`student:${studentId}`),
      this.cache.mdel(`state:institute:${student.institutionId}:students`),
      this.cache.mdel(`state:institute:${student.institutionId}:overview`),
    ]);

    return {
      success: true,
      message: `Student ${student.name} has been deleted successfully`,
    };
  }

  private getCurrentAcademicYear(): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    const startYear = month >= 6 ? year : year - 1;
    return `${startYear}-${startYear + 1}`;
  }
}
