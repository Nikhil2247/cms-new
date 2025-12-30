import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { Role, AuditAction, AuditCategory, AuditSeverity } from '../../generated/prisma/client';
import { PrismaService } from '../../core/database/prisma.service';
import { CacheService } from '../../core/cache/cache.service';
import { AuditService } from '../../infrastructure/audit/audit.service';
import * as bcrypt from 'bcryptjs';

export interface CreateStudentData {
  name: string;
  email: string;
  phoneNo?: string;
  rollNumber?: string;
  admissionNumber?: string;
  batchId: string;
  branchId?: string;
  branchName?: string;
  semesterId?: string;
  dateOfBirth?: string;
  gender?: string;
  address?: string;
  parentName?: string;
  parentContact?: string;
  tenthPercentage?: number;
  twelfthPercentage?: number;
  currentSemester?: number;
}

export interface CreateStaffData {
  name: string;
  email: string;
  phoneNo?: string;
  designation?: string;
  role: Role;
  departmentId?: string;
}

export interface CreateUserResult {
  user: any;
  student?: any;
  temporaryPassword: string;
}

@Injectable()
export class UserService {
  private readonly logger = new Logger(UserService.name);
  private readonly CACHE_TTL = 300;

  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
    private readonly auditService: AuditService,
  ) {}

  /**
   * Generate a temporary password for new users
   * Format: first 4 chars of name + last 4 chars of identifier + @123
   */
  generateTemporaryPassword(name: string, identifier: string): string {
    const namePart = name.replace(/\s/g, '').substring(0, 4).toLowerCase();
    const idPart = identifier.slice(-4);
    return `${namePart}${idPart}@123`;
  }

  /**
   * Generate a secure random password
   */
  generateSecurePassword(): string {
    const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const lowercase = 'abcdefghijklmnopqrstuvwxyz';
    const numbers = '0123456789';
    const special = '@#$%';
    const all = uppercase + lowercase + numbers + special;

    let password = '';
    password += uppercase[Math.floor(Math.random() * uppercase.length)];
    password += lowercase[Math.floor(Math.random() * lowercase.length)];
    password += numbers[Math.floor(Math.random() * numbers.length)];
    password += special[Math.floor(Math.random() * special.length)];

    for (let i = 4; i < 10; i++) {
      password += all[Math.floor(Math.random() * all.length)];
    }

    return password
      .split('')
      .sort(() => Math.random() - 0.5)
      .join('');
  }

  /**
   * Check if email already exists
   */
  async emailExists(email: string): Promise<boolean> {
    const user = await this.prisma.user.findUnique({
      where: { email: email.toLowerCase() },
      select: { id: true },
    });
    return !!user;
  }

  /**
   * Check if enrollment/admission number already exists
   */
  async enrollmentExists(enrollmentNumber: string): Promise<boolean> {
    const student = await this.prisma.student.findFirst({
      where: { admissionNumber: enrollmentNumber },
      select: { id: true },
    });
    return !!student;
  }

  /**
   * Validate batch belongs to institution
   */
  async validateBatch(
    batchId: string,
    institutionId: string,
  ): Promise<boolean> {
    const batch = await this.prisma.batch.findFirst({
      where: { id: batchId, institutionId },
      select: { id: true },
    });
    return !!batch;
  }

  /**
   * Create a student with associated user account
   * This is the shared business logic used by both principal.service and bulk-student.service
   */
  async createStudent(
    institutionId: string,
    data: CreateStudentData,
    options?: { password?: string; skipValidation?: boolean },
  ): Promise<CreateUserResult> {
    this.logger.log(`Creating student: ${data.email} for institution: ${institutionId}`);

    // Validation (unless skipped for bulk operations with pre-validation)
    if (!options?.skipValidation) {
      // Check email uniqueness
      if (await this.emailExists(data.email)) {
        throw new BadRequestException(`User with email ${data.email} already exists`);
      }

      // Check admission number uniqueness (if provided)
      if (data.admissionNumber && await this.enrollmentExists(data.admissionNumber)) {
        throw new BadRequestException(
          `Student with admission number ${data.admissionNumber} already exists`,
        );
      }

      // Validate batch
      if (!(await this.validateBatch(data.batchId, institutionId))) {
        throw new BadRequestException('Invalid batch for this institution');
      }
    }

    // Generate password
    const temporaryPassword =
      options?.password ||
      this.generateTemporaryPassword(data.name, data.admissionNumber || data.rollNumber || data.email);
    const hashedPassword = await bcrypt.hash(temporaryPassword, 10);

    // Create user and student in transaction
    const result = await this.prisma.$transaction(async (tx) => {
      // Create user account
      const user = await tx.user.create({
        data: {
          name: data.name,
          email: data.email.toLowerCase(),
          password: hashedPassword,
          role: Role.STUDENT,
          phoneNo: data.phoneNo,
          dob: data.dateOfBirth,
          rollNumber: data.rollNumber,
          institutionId,
          active: true,
          hasChangedDefaultPassword: false,
        },
      });

      // Create student profile
      const student = await tx.student.create({
        data: {
          userId: user.id,
          name: data.name,
          email: data.email.toLowerCase(),
          admissionNumber: data.admissionNumber,
          rollNumber: data.rollNumber,
          contact: data.phoneNo,
          address: data.address,
          dob: data.dateOfBirth,
          gender: data.gender,
          parentName: data.parentName,
          parentContact: data.parentContact,
          tenthper: data.tenthPercentage,
          twelthper: data.twelfthPercentage,
          currentSemester: data.currentSemester,
          batchId: data.batchId,
          branchId: data.branchId,
          branchName: data.branchName,
          institutionId,
          isActive: true,
        },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              name: true,
              role: true,
            },
          },
          batch: true,
          branch: true,
        },
      });

      return { user, student };
    });

    // Invalidate cache
    await this.cache.del(`students:${institutionId}`);

    this.logger.log(`Student created successfully: ${result.student.id}`);

    // Audit: Student created
    this.auditService.log({
      action: AuditAction.USER_REGISTRATION,
      entityType: 'Student',
      entityId: result.student.id,
      userId: result.user.id,
      category: AuditCategory.ADMINISTRATIVE,
      severity: AuditSeverity.MEDIUM,
      institutionId,
      description: `Student created: ${data.name} (${data.admissionNumber || data.rollNumber})`,
      newValues: {
        name: data.name,
        email: data.email,
        admissionNumber: data.admissionNumber,
        rollNumber: data.rollNumber,
        batchId: data.batchId,
      },
    }).catch(() => {});

    return {
      user: result.user,
      student: result.student,
      temporaryPassword,
    };
  }

  /**
   * Create a staff member (teacher, faculty supervisor, etc.)
   */
  async createStaff(
    institutionId: string,
    data: CreateStaffData,
  ): Promise<CreateUserResult> {
    this.logger.log(`Creating staff: ${data.email} for institution: ${institutionId}`);

    // Check email uniqueness
    if (await this.emailExists(data.email)) {
      throw new BadRequestException(`User with email ${data.email} already exists`);
    }

    // Generate password
    const temporaryPassword = this.generateSecurePassword();
    const hashedPassword = await bcrypt.hash(temporaryPassword, 10);

    const user = await this.prisma.user.create({
      data: {
        name: data.name,
        email: data.email.toLowerCase(),
        password: hashedPassword,
        role: data.role,
        phoneNo: data.phoneNo,
        designation: data.designation,
        institutionId,
        active: true,
        hasChangedDefaultPassword: false,
      },
    });

    // Invalidate cache
    await this.cache.del(`staff:${institutionId}`);

    this.logger.log(`Staff created successfully: ${user.id}`);

    // Audit: Staff created
    this.auditService.log({
      action: AuditAction.USER_REGISTRATION,
      entityType: 'Staff',
      entityId: user.id,
      userId: user.id,
      category: AuditCategory.ADMINISTRATIVE,
      severity: AuditSeverity.MEDIUM,
      institutionId,
      description: `Staff created: ${data.name} (${data.role})`,
      newValues: {
        name: data.name,
        email: data.email,
        role: data.role,
        designation: data.designation,
      },
    }).catch(() => {});

    return {
      user,
      temporaryPassword,
    };
  }

  /**
   * Bulk check for existing emails
   * Returns set of emails that already exist
   */
  async findExistingEmails(emails: string[]): Promise<Set<string>> {
    const normalizedEmails = emails.map((e) => e.toLowerCase());
    const existing = await this.prisma.user.findMany({
      where: { email: { in: normalizedEmails } },
      select: { email: true },
    });
    return new Set(existing.map((u) => u.email.toLowerCase()));
  }

  /**
   * Bulk check for existing enrollment numbers
   * Returns set of enrollment numbers that already exist
   */
  async findExistingEnrollments(enrollments: string[]): Promise<Set<string>> {
    const existing = await this.prisma.student.findMany({
      where: { admissionNumber: { in: enrollments } },
      select: { admissionNumber: true },
    });
    return new Set(existing.map((s) => s.admissionNumber).filter(Boolean) as string[]);
  }

  /**
   * Get batch map for an institution
   */
  async getBatchMap(institutionId: string): Promise<Map<string, string>> {
    const batches = await this.prisma.batch.findMany({
      where: { institutionId },
      select: { id: true, name: true },
    });
    return new Map(batches.map((b) => [b.name.toLowerCase(), b.id]));
  }

  /**
   * Get branch map
   */
  async getBranchMap(): Promise<Map<string, string>> {
    const branches = await this.prisma.branch.findMany({
      select: { id: true, name: true },
    });
    return new Map(branches.map((b) => [b.name.toLowerCase(), b.id]));
  }

  /**
   * Update student
   */
  async updateStudent(
    studentId: string,
    institutionId: string,
    data: Partial<CreateStudentData>,
  ) {
    const student = await this.prisma.student.findFirst({
      where: { id: studentId, institutionId },
    });

    if (!student) {
      throw new NotFoundException('Student not found');
    }

    const updated = await this.prisma.student.update({
      where: { id: studentId },
      data: {
        name: data.name,
        contact: data.phoneNo,
        address: data.address,
        gender: data.gender,
        rollNumber: data.rollNumber,
        currentSemester: data.currentSemester,
      },
      include: {
        user: true,
        batch: true,
        branch: true,
      },
    });

    // Update user record if name changed
    if (data.name && student.userId) {
      await this.prisma.user.update({
        where: { id: student.userId },
        data: { name: data.name },
      });
    }

    await this.cache.del(`student:${studentId}`);
    await this.cache.del(`students:${institutionId}`);

    // Audit: Student updated
    this.auditService.log({
      action: AuditAction.USER_PROFILE_UPDATE,
      entityType: 'Student',
      entityId: studentId,
      category: AuditCategory.PROFILE_MANAGEMENT,
      severity: AuditSeverity.LOW,
      institutionId,
      description: `Student updated: ${updated.name}`,
      changedFields: Object.keys(data).filter(k => data[k] !== undefined),
      newValues: data,
    }).catch(() => {});

    return updated;
  }

  /**
   * Soft delete student
   */
  async deleteStudent(studentId: string, institutionId: string) {
    const student = await this.prisma.student.findFirst({
      where: { id: studentId, institutionId },
    });

    if (!student) {
      throw new NotFoundException('Student not found');
    }

    await this.prisma.$transaction([
      this.prisma.student.update({
        where: { id: studentId },
        data: { isActive: false },
      }),
      this.prisma.user.update({
        where: { id: student.userId },
        data: { active: false },
      }),
    ]);

    await this.cache.del(`student:${studentId}`);
    await this.cache.del(`students:${institutionId}`);

    // Audit: Student deleted
    this.auditService.log({
      action: AuditAction.USER_DEACTIVATION,
      entityType: 'Student',
      entityId: studentId,
      category: AuditCategory.ADMINISTRATIVE,
      severity: AuditSeverity.HIGH,
      institutionId,
      description: `Student deactivated: ${student.name || studentId}`,
      oldValues: { isActive: true },
      newValues: { isActive: false },
    }).catch(() => {});

    return { success: true, message: 'Student deleted successfully' };
  }
}
