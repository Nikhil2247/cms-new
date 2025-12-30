import { Injectable, BadRequestException, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../core/database/prisma.service';
import { AuditAction, AuditCategory, AuditSeverity } from '../../generated/prisma/client';
import { BulkStudentRowDto, BulkStudentResultDto, BulkStudentValidationResultDto } from './dto/bulk-student.dto';
import { UserService, CreateStudentData } from '../../domain/user/user.service';
import { AuditService } from '../../infrastructure/audit/audit.service';
import * as XLSX from 'xlsx';

@Injectable()
export class BulkStudentService {
  private readonly logger = new Logger(BulkStudentService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly userService: UserService,
    private readonly auditService: AuditService,
  ) {}

  /**
   * Parse CSV/Excel file and extract student data
   */
  async parseFile(buffer: Buffer, filename: string): Promise<BulkStudentRowDto[]> {
    try {
      const workbook = XLSX.read(buffer, { type: 'buffer' });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];

      // Convert to JSON
      const rawData = XLSX.utils.sheet_to_json(worksheet, { defval: '' });

      // Map CSV columns to DTO fields
      const students: BulkStudentRowDto[] = rawData.map((row: any) => ({
        name: this.cleanString(row['Name'] || row['name'] || row['Student Name']),
        email: this.cleanString(row['Email'] || row['email'])?.toLowerCase(),
        phoneNo: this.cleanString(row['Phone'] || row['phone'] || row['Contact']),
        enrollmentNumber: this.cleanString(
          row['Enrollment Number'] || row['enrollmentNumber'] || row['Admission Number'],
        ),
        rollNumber: this.cleanString(row['Roll Number'] || row['rollNumber']),
        batchName: this.cleanString(row['Batch'] || row['batch'] || row['Batch Name']),
        branchName: this.cleanString(row['Branch'] || row['branch'] || row['Department']),
        currentSemester: this.parseNumber(row['Semester'] || row['semester'] || row['Current Semester']),
        dateOfBirth: this.cleanString(row['Date of Birth'] || row['DOB'] || row['dateOfBirth']),
        gender: this.cleanString(row['Gender'] || row['gender'])?.toUpperCase(),
        address: this.cleanString(row['Address'] || row['address']),
        parentName: this.cleanString(row['Parent Name'] || row['parentName'] || row['Father Name']),
        parentContact: this.cleanString(row['Parent Contact'] || row['parentContact'] || row['Parent Phone']),
        tenthPercentage: this.parseNumber(row['10th %'] || row['10th Percentage'] || row['tenthPercentage']),
        twelfthPercentage: this.parseNumber(row['12th %'] || row['12th Percentage'] || row['twelfthPercentage']),
      }));

      return students;
    } catch (error) {
      this.logger.error(`Error parsing file: ${error.message}`, error.stack);
      throw new BadRequestException(`Failed to parse file: ${error.message}`);
    }
  }

  /**
   * Validate student data before processing
   * Optimized: Uses batch queries instead of N+1, O(n) duplicate detection with Sets
   */
  async validateStudents(
    students: BulkStudentRowDto[],
    institutionId: string,
  ): Promise<BulkStudentValidationResultDto> {
    const errors: Array<{ row: number; field?: string; value?: string; error: string }> = [];
    const warnings: Array<{ row: number; field?: string; message: string }> = [];
    const validGenders = ['MALE', 'FEMALE', 'OTHER'];

    // Use domain service for batch/branch lookups (DRY principle)
    const [batchMap, branchMap] = await Promise.all([
      this.userService.getBatchMap(institutionId),
      this.userService.getBranchMap(),
    ]);

    const batches = await this.prisma.batch.findMany({
      where: { institutionId },
      select: { name: true },
    });

    // OPTIMIZATION: Extract all emails and enrollment numbers for batch queries
    const allEmails = students
      .map(s => s.email?.toLowerCase())
      .filter((email): email is string => !!email);
    const allEnrollmentNumbers = students
      .map(s => s.enrollmentNumber)
      .filter((num): num is string => !!num);

    // Use domain service for existing checks (DRY principle)
    const [existingEmailSet, existingEnrollmentSet] = await Promise.all([
      this.userService.findExistingEmails(allEmails),
      this.userService.findExistingEnrollments(allEnrollmentNumbers),
    ]);

    // OPTIMIZATION: O(n) duplicate detection using Maps instead of O(n²) findIndex
    const emailFirstOccurrence = new Map<string, number>();
    const enrollmentFirstOccurrence = new Map<string, number>();

    for (let i = 0; i < students.length; i++) {
      const student = students[i];
      const rowNumber = i + 2; // +2 because row 1 is header and array is 0-indexed

      // Required field validation
      if (!student.name || student.name.trim() === '') {
        errors.push({
          row: rowNumber,
          field: 'name',
          value: student.name,
          error: 'Name is required',
        });
      }

      if (!student.email || student.email.trim() === '') {
        errors.push({
          row: rowNumber,
          field: 'email',
          value: student.email,
          error: 'Email is required',
        });
      } else if (!this.isValidEmail(student.email)) {
        errors.push({
          row: rowNumber,
          field: 'email',
          value: student.email,
          error: 'Invalid email format',
        });
      }

      if (!student.enrollmentNumber || student.enrollmentNumber.trim() === '') {
        errors.push({
          row: rowNumber,
          field: 'enrollmentNumber',
          value: student.enrollmentNumber,
          error: 'Enrollment number is required',
        });
      }

      if (!student.batchName || student.batchName.trim() === '') {
        errors.push({
          row: rowNumber,
          field: 'batchName',
          value: student.batchName,
          error: 'Batch name is required',
        });
      } else if (!batchMap.has(student.batchName.toLowerCase())) {
        errors.push({
          row: rowNumber,
          field: 'batchName',
          value: student.batchName,
          error: `Batch "${student.batchName}" not found in the system. Available batches: ${batches.map(b => b.name).join(', ')}`,
        });
      }

      // Optional field validation
      if (student.gender && !validGenders.includes(student.gender)) {
        errors.push({
          row: rowNumber,
          field: 'gender',
          value: student.gender,
          error: `Invalid gender. Must be one of: ${validGenders.join(', ')}`,
        });
      }

      if (student.branchName && !branchMap.has(student.branchName.toLowerCase())) {
        warnings.push({
          row: rowNumber,
          field: 'branchName',
          message: `Branch "${student.branchName}" not found. Student will be created without branch assignment.`,
        });
      }

      if (student.currentSemester && (student.currentSemester < 1 || student.currentSemester > 8)) {
        errors.push({
          row: rowNumber,
          field: 'currentSemester',
          value: String(student.currentSemester),
          error: 'Semester must be between 1 and 8',
        });
      }

      // OPTIMIZATION: O(1) duplicate email check using Map
      if (student.email) {
        const emailLower = student.email.toLowerCase();
        const firstRow = emailFirstOccurrence.get(emailLower);
        if (firstRow !== undefined) {
          errors.push({
            row: rowNumber,
            field: 'email',
            value: student.email,
            error: `Duplicate email in file (also found in row ${firstRow})`,
          });
        } else {
          emailFirstOccurrence.set(emailLower, rowNumber);
        }

        // OPTIMIZATION: O(1) check against pre-fetched existing emails
        if (existingEmailSet.has(emailLower)) {
          errors.push({
            row: rowNumber,
            field: 'email',
            value: student.email,
            error: 'Email already exists in the system',
          });
        }
      }

      // OPTIMIZATION: O(1) duplicate enrollment check using Map
      if (student.enrollmentNumber) {
        const firstRow = enrollmentFirstOccurrence.get(student.enrollmentNumber);
        if (firstRow !== undefined) {
          errors.push({
            row: rowNumber,
            field: 'enrollmentNumber',
            value: student.enrollmentNumber,
            error: `Duplicate enrollment number in file (also found in row ${firstRow})`,
          });
        } else {
          enrollmentFirstOccurrence.set(student.enrollmentNumber, rowNumber);
        }

        // OPTIMIZATION: O(1) check against pre-fetched existing enrollment numbers
        if (existingEnrollmentSet.has(student.enrollmentNumber)) {
          errors.push({
            row: rowNumber,
            field: 'enrollmentNumber',
            value: student.enrollmentNumber,
            error: 'Enrollment number already exists in the system',
          });
        }
      }
    }

    const uniqueErrorRows = new Set(errors.map(e => e.row)).size;

    return {
      isValid: errors.length === 0,
      totalRows: students.length,
      validRows: students.length - uniqueErrorRows,
      invalidRows: uniqueErrorRows,
      errors,
      warnings,
    };
  }

  /**
   * Bulk upload students with batch processing
   */
  async bulkUploadStudents(
    students: BulkStudentRowDto[],
    institutionId: string,
    createdBy: string,
    performedByUserId?: string,
  ): Promise<BulkStudentResultDto> {
    const startTime = Date.now();
    const successRecords: any[] = [];
    const failedRecords: any[] = [];

    // Audit: Bulk student upload initiated
    this.auditService.log({
      action: AuditAction.USER_REGISTRATION,
      entityType: 'BulkStudentUpload',
      category: AuditCategory.ADMINISTRATIVE,
      severity: AuditSeverity.MEDIUM,
      userId: performedByUserId,
      institutionId,
      description: `Bulk student upload started: ${students.length} students`,
      newValues: {
        operation: 'bulk_student_upload_started',
        totalStudents: students.length,
        createdBy,
      },
    }).catch(() => {});

    // First, validate all students
    const validation = await this.validateStudents(students, institutionId);

    if (!validation.isValid) {
      // If there are validation errors, return them without processing
      const processingTime = Date.now() - startTime;
      return {
        total: students.length,
        success: 0,
        failed: students.length,
        successRecords: [],
        failedRecords: validation.errors.map(err => ({
          row: err.row,
          name: students[err.row - 2]?.name,
          email: students[err.row - 2]?.email,
          enrollmentNumber: students[err.row - 2]?.enrollmentNumber,
          error: err.error,
          details: err.field ? `Field: ${err.field}, Value: ${err.value}` : undefined,
        })),
        processingTime,
      };
    }

    // Use domain service for batch/branch mappings (DRY principle)
    const [batchMap, branchMap] = await Promise.all([
      this.userService.getBatchMap(institutionId),
      this.userService.getBranchMap(),
    ]);

    // Process students in batches
    const batchSize = 10;
    for (let i = 0; i < students.length; i += batchSize) {
      const batch = students.slice(i, i + batchSize);

      await Promise.all(
        batch.map(async (student, batchIndex) => {
          const rowNumber = i + batchIndex + 2;
          try {
            const result = await this.createStudent(student, institutionId, batchMap, branchMap);

            successRecords.push({
              row: rowNumber,
              name: student.name,
              email: student.email,
              enrollmentNumber: student.enrollmentNumber,
              studentId: result.student.id,
              userId: result.user.id,
              temporaryPassword: result.temporaryPassword,
            });

            this.logger.log(`Student created: ${student.email} (Row ${rowNumber})`);
          } catch (error) {
            failedRecords.push({
              row: rowNumber,
              name: student.name,
              email: student.email,
              enrollmentNumber: student.enrollmentNumber,
              error: error.message,
              details: error.stack?.split('\n')[0],
            });

            this.logger.error(`Failed to create student: ${student.email} (Row ${rowNumber})`, error.stack);
          }
        }),
      );
    }

    const processingTime = Date.now() - startTime;

    this.logger.log(
      `Bulk upload completed: ${successRecords.length} success, ${failedRecords.length} failed in ${processingTime}ms`,
    );

    // Audit: Bulk student upload completed
    this.auditService.log({
      action: AuditAction.USER_REGISTRATION,
      entityType: 'BulkStudentUpload',
      category: AuditCategory.ADMINISTRATIVE,
      severity: failedRecords.length > 0 ? AuditSeverity.HIGH : AuditSeverity.MEDIUM,
      userId: performedByUserId,
      institutionId,
      description: `Bulk student upload completed: ${successRecords.length} success, ${failedRecords.length} failed`,
      newValues: {
        operation: 'bulk_student_upload_completed',
        totalStudents: students.length,
        successCount: successRecords.length,
        failedCount: failedRecords.length,
        processingTimeMs: processingTime,
        createdBy,
        failedEnrollments: failedRecords.map(r => r.enrollmentNumber).filter(Boolean),
      },
    }).catch(() => {});

    return {
      total: students.length,
      success: successRecords.length,
      failed: failedRecords.length,
      successRecords,
      failedRecords,
      processingTime,
    };
  }

  /**
   * Create a single student - delegates to domain UserService
   */
  private async createStudent(
    studentDto: BulkStudentRowDto,
    institutionId: string,
    batchMap: Map<string, string>,
    branchMap: Map<string, string>,
  ) {
    // Get batch ID
    const batchId = batchMap.get(studentDto.batchName.toLowerCase());
    if (!batchId) {
      throw new BadRequestException(`Batch "${studentDto.batchName}" not found`);
    }

    // Get branch ID (optional)
    const branchId = studentDto.branchName
      ? branchMap.get(studentDto.branchName.toLowerCase())
      : undefined;

    // Map DTO to domain CreateStudentData and delegate to domain service
    const studentData: CreateStudentData = {
      name: studentDto.name,
      email: studentDto.email,
      phoneNo: studentDto.phoneNo,
      admissionNumber: studentDto.enrollmentNumber,
      rollNumber: studentDto.rollNumber,
      batchId,
      branchId,
      branchName: studentDto.branchName,
      dateOfBirth: studentDto.dateOfBirth,
      gender: studentDto.gender,
      address: studentDto.address,
      parentName: studentDto.parentName,
      parentContact: studentDto.parentContact,
      tenthPercentage: studentDto.tenthPercentage,
      twelfthPercentage: studentDto.twelfthPercentage,
      currentSemester: studentDto.currentSemester,
    };

    // Delegate to domain service (skip validation since bulk already validated)
    return this.userService.createStudent(institutionId, studentData, {
      skipValidation: true,
    });
  }

  /**
   * Download template for bulk student upload
   */
  getTemplate(): Buffer {
    const templateData = [
      {
        'Name': 'John Doe',
        'Email': 'john.doe@example.com',
        'Phone': '9876543210',
        'Enrollment Number': 'EN2023001',
        'Roll Number': 'R2023001',
        'Batch': '2023-2026',
        'Branch': 'Computer Science',
        'Semester': 1,
        'Date of Birth': '2005-01-15',
        'Gender': 'MALE',
        'Address': '123 Main Street, City',
        'Parent Name': 'Robert Doe',
        'Parent Contact': '9876543211',
        '10th %': 85.5,
        '12th %': 88.0,
      },
      {
        'Name': 'Jane Smith',
        'Email': 'jane.smith@example.com',
        'Phone': '9876543212',
        'Enrollment Number': 'EN2023002',
        'Roll Number': 'R2023002',
        'Batch': '2023-2026',
        'Branch': 'Electronics',
        'Semester': 1,
        'Date of Birth': '2005-03-20',
        'Gender': 'FEMALE',
        'Address': '456 Park Avenue, City',
        'Parent Name': 'Michael Smith',
        'Parent Contact': '9876543213',
        '10th %': 90.0,
        '12th %': 92.5,
      },
    ];

    const worksheet = XLSX.utils.json_to_sheet(templateData);

    // Set column widths
    worksheet['!cols'] = [
      { wch: 20 }, // Name
      { wch: 30 }, // Email
      { wch: 15 }, // Phone
      { wch: 20 }, // Enrollment Number
      { wch: 15 }, // Roll Number
      { wch: 15 }, // Batch
      { wch: 20 }, // Branch
      { wch: 10 }, // Semester
      { wch: 15 }, // Date of Birth
      { wch: 10 }, // Gender
      { wch: 30 }, // Address
      { wch: 20 }, // Parent Name
      { wch: 15 }, // Parent Contact
      { wch: 10 }, // 10th %
      { wch: 10 }, // 12th %
    ];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Students');

    // Add instructions sheet
    const instructionsData = [
      { Field: 'Name', Required: 'Yes', Description: 'Full name of the student', Example: 'John Doe' },
      { Field: 'Email', Required: 'Yes', Description: 'Valid email address (must be unique)', Example: 'john.doe@example.com' },
      { Field: 'Phone', Required: 'No', Description: 'Contact phone number', Example: '9876543210' },
      { Field: 'Enrollment Number', Required: 'Yes', Description: 'Unique enrollment/admission number', Example: 'EN2023001' },
      { Field: 'Roll Number', Required: 'No', Description: 'Student roll number', Example: 'R2023001' },
      { Field: 'Batch', Required: 'Yes', Description: 'Batch name (must exist in system)', Example: '2023-2026' },
      { Field: 'Branch', Required: 'No', Description: 'Branch/Department name', Example: 'Computer Science' },
      { Field: 'Semester', Required: 'No', Description: 'Current semester (1-8)', Example: '1' },
      { Field: 'Date of Birth', Required: 'No', Description: 'Date of birth (YYYY-MM-DD)', Example: '2005-01-15' },
      { Field: 'Gender', Required: 'No', Description: 'Gender: MALE, FEMALE, or OTHER', Example: 'MALE' },
      { Field: 'Address', Required: 'No', Description: 'Residential address', Example: '123 Main Street' },
      { Field: 'Parent Name', Required: 'No', Description: 'Parent/Guardian name', Example: 'Robert Doe' },
      { Field: 'Parent Contact', Required: 'No', Description: 'Parent contact number', Example: '9876543211' },
      { Field: '10th %', Required: 'No', Description: '10th grade percentage', Example: '85.5' },
      { Field: '12th %', Required: 'No', Description: '12th grade percentage', Example: '88.0' },
    ];
    const instructionsSheet = XLSX.utils.json_to_sheet(instructionsData);
    instructionsSheet['!cols'] = [
      { wch: 20 },
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
   * Helper: Parse number values
   */
  private parseNumber(value: any): number | undefined {
    if (value === null || value === undefined || value === '') {
      return undefined;
    }
    const num = Number(value);
    return isNaN(num) ? undefined : num;
  }

  /**
   * Helper: Validate email format
   */
  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }
}
