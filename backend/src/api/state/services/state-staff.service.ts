import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../../../core/database/prisma.service';
import { LruCacheService } from '../../../core/cache/lru-cache.service';
import { AuditService } from '../../../infrastructure/audit/audit.service';
import { Prisma, Role } from '../../../generated/prisma/client';
import * as bcrypt from 'bcrypt';
import { BCRYPT_SALT_ROUNDS } from '../../../core/auth/services/auth.service';

/**
 * StateStaffService
 * Handles staff management operations for the state directorate
 * Extracted from StateService for better separation of concerns
 */
@Injectable()
export class StateStaffService {
  private readonly logger = new Logger(StateStaffService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: LruCacheService,
    private readonly auditService: AuditService,
  ) {}

  /**
   * Get all staff across institutions with filtering
   */
  async getStaff(params: {
    institutionId?: string;
    role?: string;
    branchName?: string;
    search?: string;
    active?: boolean;
    page?: number;
    limit?: number;
  }) {
    const { institutionId, role, branchName, search, active, page = 1, limit = 10 } = params;
    const skip = (page - 1) * limit;

    // Staff roles - TEACHER, FACULTY_SUPERVISOR, PLACEMENT_OFFICER, etc. (excluding PRINCIPAL, STUDENT, STATE_DIRECTORATE, INDUSTRY roles)
    const staffRoles: Role[] = [
      Role.TEACHER,
      Role.FACULTY_SUPERVISOR,
      Role.PLACEMENT_OFFICER,
      Role.ACCOUNTANT,
      Role.ADMISSION_OFFICER,
      Role.EXAMINATION_OFFICER,
      Role.PMS_OFFICER,
      Role.EXTRACURRICULAR_HEAD,
    ];

    const where: Prisma.UserWhereInput = {
      role: role ? (role as Role) : { in: staffRoles },
    };

    if (institutionId) {
      where.institutionId = institutionId;
    }

    if (branchName) {
      where.branchName = { contains: branchName, mode: 'insensitive' };
    }

    if (active !== undefined) {
      where.active = active;
    }

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { designation: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [staff, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        skip,
        take: limit,
        select: {
          id: true,
          name: true,
          email: true,
          phoneNo: true,
          role: true,
          branchName: true,
          designation: true,
          active: true,
          createdAt: true,
          lastLoginAt: true,
          Institution: {
            select: { id: true, name: true, code: true },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.user.count({ where }),
    ]);

    return {
      data: staff,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Create a new staff member
   */
  async createStaff(data: {
    name: string;
    email: string;
    password: string;
    institutionId: string;
    role: string;
    phoneNo?: string;
    branchName?: string;
    designation?: string;
  }) {
    const institution = await this.prisma.institution.findUnique({
      where: { id: data.institutionId },
    });

    if (!institution) {
      throw new NotFoundException(`Institution with ID ${data.institutionId} not found`);
    }

    const existingUser = await this.prisma.user.findUnique({
      where: { email: data.email },
    });

    if (existingUser) {
      throw new BadRequestException(`User with email ${data.email} already exists`);
    }

    // Hash the password before storing
    const hashedPassword = await bcrypt.hash(data.password, BCRYPT_SALT_ROUNDS);

    const staff = await this.prisma.user.create({
      data: {
        name: data.name,
        email: data.email,
        password: hashedPassword,
        role: data.role as Role,
        institutionId: data.institutionId,
        phoneNo: data.phoneNo,
        branchName: data.branchName,
        designation: data.designation,
        active: true,
        hasChangedDefaultPassword: false,
      },
      include: { Institution: true },
    });

    // Remove password from response
    const { password: _, ...staffWithoutPassword } = staff;

    await this.cache.invalidateByTags(['state', 'staff']);
    return staffWithoutPassword;
  }

  /**
   * Get staff member by ID
   */
  async getStaffById(id: string) {
    const staffRoles: Role[] = [
      Role.TEACHER,
      Role.FACULTY_SUPERVISOR,
      Role.PLACEMENT_OFFICER,
      Role.ACCOUNTANT,
      Role.ADMISSION_OFFICER,
      Role.EXAMINATION_OFFICER,
      Role.PMS_OFFICER,
      Role.EXTRACURRICULAR_HEAD,
    ];

    const staff = await this.prisma.user.findUnique({
      where: { id, role: { in: staffRoles } },
      select: {
        id: true,
        name: true,
        email: true,
        phoneNo: true,
        role: true,
        branchName: true,
        designation: true,
        active: true,
        createdAt: true,
        lastLoginAt: true,
        institutionId: true,
        Institution: {
          select: { id: true, name: true, code: true, city: true },
        },
      },
    });

    if (!staff) {
      throw new NotFoundException(`Staff member with ID ${id} not found`);
    }

    return staff;
  }

  /**
   * Update staff member by ID
   */
  async updateStaff(id: string, data: {
    name?: string;
    email?: string;
    institutionId?: string;
    role?: string;
    phoneNo?: string;
    branchName?: string;
    designation?: string;
    isActive?: boolean;
    active?: boolean;
  }) {
    const staffRoles: Role[] = [
      Role.TEACHER,
      Role.FACULTY_SUPERVISOR,
      Role.PLACEMENT_OFFICER,
      Role.ACCOUNTANT,
      Role.ADMISSION_OFFICER,
      Role.EXAMINATION_OFFICER,
      Role.PMS_OFFICER,
      Role.EXTRACURRICULAR_HEAD,
    ];

    const existingStaff = await this.prisma.user.findUnique({
      where: { id, role: { in: staffRoles } },
    });

    if (!existingStaff) {
      throw new NotFoundException(`Staff member with ID ${id} not found`);
    }

    if (data.institutionId) {
      const institution = await this.prisma.institution.findUnique({
        where: { id: data.institutionId },
      });

      if (!institution) {
        throw new NotFoundException(`Institution with ID ${data.institutionId} not found`);
      }
    }

    // Check if email is being changed and if it's already in use
    if (data.email && data.email !== existingStaff.email) {
      const emailExists = await this.prisma.user.findUnique({
        where: { email: data.email },
      });

      if (emailExists) {
        throw new BadRequestException(`Email ${data.email} is already in use`);
      }
    }

    const updateData: Prisma.UserUpdateInput = {};
    if (data.name !== undefined) updateData.name = data.name;
    if (data.email !== undefined) updateData.email = data.email;
    if (data.institutionId !== undefined) updateData.Institution = { connect: { id: data.institutionId } };
    if (data.role !== undefined) updateData.role = data.role as Role;
    if (data.phoneNo !== undefined) updateData.phoneNo = data.phoneNo;
    if (data.branchName !== undefined) updateData.branchName = data.branchName;
    if (data.designation !== undefined) updateData.designation = data.designation;
    if (data.isActive !== undefined) updateData.active = data.isActive;
    if (data.active !== undefined) updateData.active = data.active;

    const staff = await this.prisma.user.update({
      where: { id },
      data: updateData,
      include: { Institution: true },
    });

    // Remove password from response
    const { password: _, ...staffWithoutPassword } = staff;

    await this.cache.invalidateByTags(['state', 'staff']);
    return staffWithoutPassword;
  }

  /**
   * Delete staff member by ID
   */
  async deleteStaff(id: string) {
    const staffRoles: Role[] = [
      Role.TEACHER,
      Role.FACULTY_SUPERVISOR,
      Role.PLACEMENT_OFFICER,
      Role.ACCOUNTANT,
      Role.ADMISSION_OFFICER,
      Role.EXAMINATION_OFFICER,
      Role.PMS_OFFICER,
      Role.EXTRACURRICULAR_HEAD,
    ];

    const existingStaff = await this.prisma.user.findUnique({
      where: { id, role: { in: staffRoles } },
    });

    if (!existingStaff) {
      throw new NotFoundException(`Staff member with ID ${id} not found`);
    }

    // Delete notifications first (required relation without cascade)
    await this.prisma.notification.deleteMany({ where: { userId: id } });
    await this.prisma.user.delete({ where: { id } });
    await this.cache.invalidateByTags(['state', 'staff']);

    return { success: true, message: 'Staff member deleted successfully' };
  }

  /**
   * Delete faculty member by ID (FACULTY_SUPERVISOR or TEACHER only)
   */
  async deleteFaculty(id: string) {
    const facultyRoles: Role[] = [Role.TEACHER, Role.FACULTY_SUPERVISOR];

    const existingFaculty = await this.prisma.user.findUnique({
      where: { id, role: { in: facultyRoles } },
    });

    if (!existingFaculty) {
      throw new NotFoundException(`Faculty member with ID ${id} not found`);
    }

    // Delete mentor assignments first
    await this.prisma.mentorAssignment.deleteMany({ where: { mentorId: id } });
    // Delete notifications (required relation without cascade)
    await this.prisma.notification.deleteMany({ where: { userId: id } });
    await this.prisma.user.delete({ where: { id } });
    await this.cache.invalidateByTags(['state', 'staff', 'faculty']);

    return { success: true, message: 'Faculty member deleted successfully' };
  }

  /**
   * Reset staff member password
   */
  async resetStaffPassword(id: string) {
    const staffRoles: Role[] = [
      Role.TEACHER,
      Role.FACULTY_SUPERVISOR,
      Role.PLACEMENT_OFFICER,
      Role.ACCOUNTANT,
      Role.ADMISSION_OFFICER,
      Role.EXAMINATION_OFFICER,
      Role.PMS_OFFICER,
      Role.EXTRACURRICULAR_HEAD,
    ];

    const existingStaff = await this.prisma.user.findUnique({
      where: { id, role: { in: staffRoles } },
    });

    if (!existingStaff) {
      throw new NotFoundException(`Staff member with ID ${id} not found`);
    }

    // Generate a new random password
    const newPassword = this.generateRandomPassword();

    this.logger.log(`Resetting password for staff: ${existingStaff.email}`);

    // Hash the new password
    const hashedPassword = await bcrypt.hash(newPassword, BCRYPT_SALT_ROUNDS);

    // Update the user's password
    await this.prisma.user.update({
      where: { id },
      data: { password: hashedPassword, hasChangedDefaultPassword: false },
    });

    await this.cache.invalidateByTags(['state', 'staff']);

    return {
      success: true,
      message: 'Password reset successfully',
      newPassword, // Return the plain password so it can be shared with the user
    };
  }

  /**
   * Get all users for credentials management
   */
  async getUsers(params: {
    role?: string;
    institutionId?: string;
    search?: string;
    active?: boolean;
    page?: number;
    limit?: number;
  }) {
    const { role, institutionId, search, active, page = 1, limit = 10 } = params;
    const skip = (page - 1) * limit;

    const where: Prisma.UserWhereInput = {};

    if (role) {
      where.role = role as Role;
    }

    if (institutionId) {
      where.institutionId = institutionId;
    }

    if (active !== undefined) {
      where.active = active;
    }

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [users, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({
        where,
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          active: true,
          institutionId: true,
          lastLoginAt: true,
          createdAt: true,
          Institution: {
            select: { id: true, name: true },
          },
        },
        skip,
        take: limit,
        orderBy: { name: 'asc' },
      }),
      this.prisma.user.count({ where }),
    ]);

    return {
      data: users,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Generate a random password
   */
  private generateRandomPassword(): string {
    const length = 12;
    const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
    let password = '';

    // Ensure at least one of each type
    password += 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'[Math.floor(Math.random() * 26)]; // uppercase
    password += 'abcdefghijklmnopqrstuvwxyz'[Math.floor(Math.random() * 26)]; // lowercase
    password += '0123456789'[Math.floor(Math.random() * 10)]; // number
    password += '!@#$%^&*'[Math.floor(Math.random() * 8)]; // special char

    // Fill the rest randomly
    for (let i = password.length; i < length; i++) {
      password += charset[Math.floor(Math.random() * charset.length)];
    }

    // Shuffle the password
    return password.split('').sort(() => Math.random() - 0.5).join('');
  }
}
