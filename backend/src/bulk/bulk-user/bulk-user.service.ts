import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../../core/database/prisma.service';
import { Role } from '@prisma/client';
import { BulkUserRowDto, BulkUserResultDto, BulkUserValidationResultDto } from './dto/bulk-user.dto';
import * as XLSX from 'xlsx';
import * as bcrypt from 'bcryptjs';

@Injectable()
export class BulkUserService {
  private readonly logger = new Logger(BulkUserService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Parse CSV/Excel file and extract user data
   */
  async parseFile(buffer: Buffer, filename: string): Promise<BulkUserRowDto[]> {
    try {
      const workbook = XLSX.read(buffer, { type: 'buffer' });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];

      // Convert to JSON
      const rawData = XLSX.utils.sheet_to_json(worksheet, { defval: '' });

      // Map CSV columns to DTO fields
      const users: BulkUserRowDto[] = rawData.map((row: any) => ({
        name: this.cleanString(row['Name'] || row['name'] || row['Full Name']),
        email: this.cleanString(row['Email'] || row['email'])?.toLowerCase(),
        phone: this.cleanString(row['Phone'] || row['phone'] || row['Contact']),
        role: this.cleanString(row['Role'] || row['role'])?.toUpperCase(),
        designation: this.cleanString(row['Designation'] || row['designation']),
        department: this.cleanString(row['Department'] || row['department']),
        employeeId: this.cleanString(row['Employee ID'] || row['employeeId'] || row['Employee Id']),
      }));

      return users;
    } catch (error) {
      this.logger.error(`Error parsing file: ${error.message}`, error.stack);
      throw new BadRequestException(`Failed to parse file: ${error.message}`);
    }
  }

  /**
   * Validate user data before processing
   */
  async validateUsers(users: BulkUserRowDto[], institutionId: string): Promise<BulkUserValidationResultDto> {
    const errors: Array<{ row: number; field?: string; value?: string; error: string }> = [];
    const validRoles = ['FACULTY', 'MENTOR', 'PRINCIPAL'];

    for (let i = 0; i < users.length; i++) {
      const user = users[i];
      const rowNumber = i + 2; // +2 because row 1 is header and array is 0-indexed

      // Required field validation
      if (!user.name || user.name.trim() === '') {
        errors.push({
          row: rowNumber,
          field: 'name',
          value: user.name,
          error: 'Name is required',
        });
      }

      if (!user.email || user.email.trim() === '') {
        errors.push({
          row: rowNumber,
          field: 'email',
          value: user.email,
          error: 'Email is required',
        });
      } else if (!this.isValidEmail(user.email)) {
        errors.push({
          row: rowNumber,
          field: 'email',
          value: user.email,
          error: 'Invalid email format',
        });
      }

      if (!user.role || user.role.trim() === '') {
        errors.push({
          row: rowNumber,
          field: 'role',
          value: user.role,
          error: 'Role is required',
        });
      } else if (!validRoles.includes(user.role)) {
        errors.push({
          row: rowNumber,
          field: 'role',
          value: user.role,
          error: `Invalid role. Must be one of: ${validRoles.join(', ')}`,
        });
      }

      // Check for duplicate email in the file
      const duplicateInFile = users.findIndex(
        (u, idx) => idx !== i && u.email?.toLowerCase() === user.email?.toLowerCase(),
      );
      if (duplicateInFile !== -1) {
        errors.push({
          row: rowNumber,
          field: 'email',
          value: user.email,
          error: `Duplicate email in file (also found in row ${duplicateInFile + 2})`,
        });
      }

      // Check if email already exists in database
      if (user.email) {
        const existingUser = await this.prisma.user.findUnique({
          where: { email: user.email },
        });

        if (existingUser) {
          errors.push({
            row: rowNumber,
            field: 'email',
            value: user.email,
            error: 'Email already exists in the system',
          });
        }
      }
    }

    return {
      isValid: errors.length === 0,
      totalRows: users.length,
      validRows: users.length - errors.filter((e, i, arr) => arr.findIndex(err => err.row === e.row) === i).length,
      invalidRows: errors.filter((e, i, arr) => arr.findIndex(err => err.row === e.row) === i).length,
      errors,
    };
  }

  /**
   * Bulk upload users with batch processing
   */
  async bulkUploadUsers(
    users: BulkUserRowDto[],
    institutionId: string,
    createdBy: string,
  ): Promise<BulkUserResultDto> {
    const startTime = Date.now();
    const successRecords: any[] = [];
    const failedRecords: any[] = [];

    // First, validate all users
    const validation = await this.validateUsers(users, institutionId);

    if (!validation.isValid) {
      // If there are validation errors, return them without processing
      const processingTime = Date.now() - startTime;
      return {
        total: users.length,
        success: 0,
        failed: users.length,
        successRecords: [],
        failedRecords: validation.errors.map(err => ({
          row: err.row,
          name: users[err.row - 2]?.name,
          email: users[err.row - 2]?.email,
          role: users[err.row - 2]?.role,
          error: err.error,
          details: err.field ? `Field: ${err.field}, Value: ${err.value}` : undefined,
        })),
        processingTime,
      };
    }

    // Process users in batches
    const batchSize = 10;
    for (let i = 0; i < users.length; i += batchSize) {
      const batch = users.slice(i, i + batchSize);

      await Promise.all(
        batch.map(async (user, batchIndex) => {
          const rowNumber = i + batchIndex + 2;
          try {
            const createdUser = await this.createUser(user, institutionId);

            successRecords.push({
              row: rowNumber,
              name: user.name,
              email: user.email,
              role: user.role,
              userId: createdUser.id,
            });

            this.logger.log(`User created: ${user.email} (Row ${rowNumber})`);
          } catch (error) {
            failedRecords.push({
              row: rowNumber,
              name: user.name,
              email: user.email,
              role: user.role,
              error: error.message,
              details: error.stack?.split('\n')[0],
            });

            this.logger.error(`Failed to create user: ${user.email} (Row ${rowNumber})`, error.stack);
          }
        }),
      );
    }

    const processingTime = Date.now() - startTime;

    this.logger.log(
      `Bulk upload completed: ${successRecords.length} success, ${failedRecords.length} failed in ${processingTime}ms`,
    );

    return {
      total: users.length,
      success: successRecords.length,
      failed: failedRecords.length,
      successRecords,
      failedRecords,
      processingTime,
    };
  }

  /**
   * Create a single user
   */
  private async createUser(userDto: BulkUserRowDto, institutionId: string) {
    // Map role to Prisma Role enum
    const roleMapping: Record<string, Role> = {
      FACULTY: Role.TEACHER,
      MENTOR: Role.FACULTY_SUPERVISOR,
      PRINCIPAL: Role.PRINCIPAL,
    };

    const role = roleMapping[userDto.role] || Role.TEACHER;

    // Generate default password
    const defaultPassword = 'Welcome@123';
    const hashedPassword = await bcrypt.hash(defaultPassword, 10);

    // Create user
    const user = await this.prisma.user.create({
      data: {
        name: userDto.name,
        email: userDto.email,
        password: hashedPassword,
        role,
        phoneNo: userDto.phone,
        designation: userDto.designation,
        active: true,
        institutionId,
        hasChangedDefaultPassword: false,
      },
    });

    return user;
  }

  /**
   * Download template for bulk user upload
   */
  getTemplate(): Buffer {
    const templateData = [
      {
        'Name': 'John Doe',
        'Email': 'john.doe@example.com',
        'Phone': '9876543210',
        'Role': 'FACULTY',
        'Designation': 'Professor',
        'Department': 'Computer Science',
        'Employee ID': 'EMP001',
      },
      {
        'Name': 'Jane Smith',
        'Email': 'jane.smith@example.com',
        'Phone': '9876543211',
        'Role': 'MENTOR',
        'Designation': 'Assistant Professor',
        'Department': 'Electronics',
        'Employee ID': 'EMP002',
      },
    ];

    const worksheet = XLSX.utils.json_to_sheet(templateData);

    // Set column widths
    worksheet['!cols'] = [
      { wch: 20 }, // Name
      { wch: 30 }, // Email
      { wch: 15 }, // Phone
      { wch: 15 }, // Role
      { wch: 25 }, // Designation
      { wch: 20 }, // Department
      { wch: 15 }, // Employee ID
    ];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Users');

    // Add instructions sheet
    const instructionsData = [
      { Field: 'Name', Required: 'Yes', Description: 'Full name of the user', Example: 'John Doe' },
      { Field: 'Email', Required: 'Yes', Description: 'Valid email address (must be unique)', Example: 'john.doe@example.com' },
      { Field: 'Phone', Required: 'No', Description: 'Contact phone number', Example: '9876543210' },
      { Field: 'Role', Required: 'Yes', Description: 'User role: FACULTY, MENTOR, or PRINCIPAL', Example: 'FACULTY' },
      { Field: 'Designation', Required: 'No', Description: 'Job designation', Example: 'Professor' },
      { Field: 'Department', Required: 'No', Description: 'Department name', Example: 'Computer Science' },
      { Field: 'Employee ID', Required: 'No', Description: 'Employee identification number', Example: 'EMP001' },
    ];
    const instructionsSheet = XLSX.utils.json_to_sheet(instructionsData);
    instructionsSheet['!cols'] = [
      { wch: 15 },
      { wch: 10 },
      { wch: 50 },
      { wch: 30 },
    ];
    XLSX.utils.book_append_sheet(workbook, instructionsSheet, 'Instructions');

    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
    return buffer;
  }

  /**
   * Helper: Clean string values
   */
  private cleanString(value: any): string | undefined {
    if (value === null || value === undefined) {
      return undefined;
    }
    return String(value).trim();
  }

  /**
   * Helper: Validate email format
   */
  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }
}
