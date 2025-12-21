import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../../core/database/prisma.service';
import { Role, InstitutionType } from '@prisma/client';
import { BulkInstitutionRowDto, BulkInstitutionResultDto, BulkInstitutionValidationResultDto } from './dto/bulk-institution.dto';
import * as XLSX from 'xlsx';
import * as bcrypt from 'bcryptjs';

@Injectable()
export class BulkInstitutionService {
  private readonly logger = new Logger(BulkInstitutionService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Parse CSV/Excel file and extract institution data
   */
  async parseFile(buffer: Buffer, filename: string): Promise<BulkInstitutionRowDto[]> {
    try {
      const workbook = XLSX.read(buffer, { type: 'buffer' });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];

      // Convert to JSON
      const rawData = XLSX.utils.sheet_to_json(worksheet, { defval: '' });

      // Map CSV columns to DTO fields
      const institutions: BulkInstitutionRowDto[] = rawData.map((row: any) => ({
        name: this.cleanString(row['Name'] || row['name'] || row['Institution Name']),
        code: this.cleanString(row['Code'] || row['code'] || row['Institution Code']),
        type: this.cleanString(row['Type'] || row['type']),
        email: this.cleanString(row['Email'] || row['email'])?.toLowerCase(),
        phone: this.cleanString(row['Phone'] || row['phone'] || row['Contact']),
        address: this.cleanString(row['Address'] || row['address']),
        city: this.cleanString(row['City'] || row['city']),
        state: this.cleanString(row['State'] || row['state']),
        pinCode: this.cleanString(row['Pin Code'] || row['pinCode'] || row['Pincode']),
        website: this.cleanString(row['Website'] || row['website']),
        principalName: this.cleanString(row['Principal Name'] || row['principalName']),
        principalEmail: this.cleanString(row['Principal Email'] || row['principalEmail'])?.toLowerCase(),
        principalPhone: this.cleanString(row['Principal Phone'] || row['principalPhone']),
      }));

      return institutions;
    } catch (error) {
      this.logger.error(`Error parsing file: ${error.message}`, error.stack);
      throw new BadRequestException(`Failed to parse file: ${error.message}`);
    }
  }

  /**
   * Validate institution data before processing
   */
  async validateInstitutions(institutions: BulkInstitutionRowDto[]): Promise<BulkInstitutionValidationResultDto> {
    const errors: Array<{ row: number; field?: string; value?: string; error: string }> = [];

    for (let i = 0; i < institutions.length; i++) {
      const institution = institutions[i];
      const rowNumber = i + 2; // +2 because row 1 is header and array is 0-indexed

      // Required field validation
      if (!institution.name || institution.name.trim() === '') {
        errors.push({
          row: rowNumber,
          field: 'name',
          value: institution.name,
          error: 'Institution name is required',
        });
      }

      if (!institution.code || institution.code.trim() === '') {
        errors.push({
          row: rowNumber,
          field: 'code',
          value: institution.code,
          error: 'Institution code is required',
        });
      }

      if (!institution.email || institution.email.trim() === '') {
        errors.push({
          row: rowNumber,
          field: 'email',
          value: institution.email,
          error: 'Email is required',
        });
      } else if (!this.isValidEmail(institution.email)) {
        errors.push({
          row: rowNumber,
          field: 'email',
          value: institution.email,
          error: 'Invalid email format',
        });
      }

      // Optional principal email validation
      if (institution.principalEmail && !this.isValidEmail(institution.principalEmail)) {
        errors.push({
          row: rowNumber,
          field: 'principalEmail',
          value: institution.principalEmail,
          error: 'Invalid principal email format',
        });
      }

      // Check for duplicate code in the file
      const duplicateInFile = institutions.findIndex(
        (inst, idx) => idx !== i && inst.code?.toLowerCase() === institution.code?.toLowerCase(),
      );
      if (duplicateInFile !== -1) {
        errors.push({
          row: rowNumber,
          field: 'code',
          value: institution.code,
          error: `Duplicate institution code in file (also found in row ${duplicateInFile + 2})`,
        });
      }

      // Check if code already exists in database
      if (institution.code) {
        const existingInstitution = await this.prisma.institution.findUnique({
          where: { code: institution.code },
        });

        if (existingInstitution) {
          errors.push({
            row: rowNumber,
            field: 'code',
            value: institution.code,
            error: 'Institution code already exists in the system',
          });
        }
      }

      // Check if principal email already exists
      if (institution.principalEmail) {
        const existingUser = await this.prisma.user.findUnique({
          where: { email: institution.principalEmail },
        });

        if (existingUser) {
          errors.push({
            row: rowNumber,
            field: 'principalEmail',
            value: institution.principalEmail,
            error: 'Principal email already exists in the system',
          });
        }
      }
    }

    const uniqueErrorRows = new Set(errors.map(e => e.row)).size;

    return {
      isValid: errors.length === 0,
      totalRows: institutions.length,
      validRows: institutions.length - uniqueErrorRows,
      invalidRows: uniqueErrorRows,
      errors,
    };
  }

  /**
   * Bulk upload institutions with batch processing
   */
  async bulkUploadInstitutions(
    institutions: BulkInstitutionRowDto[],
    createdBy: string,
  ): Promise<BulkInstitutionResultDto> {
    const startTime = Date.now();
    const successRecords: any[] = [];
    const failedRecords: any[] = [];

    // First, validate all institutions
    const validation = await this.validateInstitutions(institutions);

    if (!validation.isValid) {
      // If there are validation errors, return them without processing
      const processingTime = Date.now() - startTime;
      return {
        total: institutions.length,
        success: 0,
        failed: institutions.length,
        successRecords: [],
        failedRecords: validation.errors.map(err => ({
          row: err.row,
          name: institutions[err.row - 2]?.name,
          code: institutions[err.row - 2]?.code,
          error: err.error,
          details: err.field ? `Field: ${err.field}, Value: ${err.value}` : undefined,
        })),
        processingTime,
      };
    }

    // Process institutions in batches
    const batchSize = 5;
    for (let i = 0; i < institutions.length; i += batchSize) {
      const batch = institutions.slice(i, i + batchSize);

      await Promise.all(
        batch.map(async (institution, batchIndex) => {
          const rowNumber = i + batchIndex + 2;
          try {
            const result = await this.createInstitution(institution);

            successRecords.push({
              row: rowNumber,
              name: institution.name,
              code: institution.code,
              institutionId: result.institution.id,
              principalCreated: !!result.principal,
              principalUserId: result.principal?.id,
            });

            this.logger.log(`Institution created: ${institution.code} (Row ${rowNumber})`);
          } catch (error) {
            failedRecords.push({
              row: rowNumber,
              name: institution.name,
              code: institution.code,
              error: error.message,
              details: error.stack?.split('\n')[0],
            });

            this.logger.error(`Failed to create institution: ${institution.code} (Row ${rowNumber})`, error.stack);
          }
        }),
      );
    }

    const processingTime = Date.now() - startTime;

    this.logger.log(
      `Bulk upload completed: ${successRecords.length} success, ${failedRecords.length} failed in ${processingTime}ms`,
    );

    return {
      total: institutions.length,
      success: successRecords.length,
      failed: failedRecords.length,
      successRecords,
      failedRecords,
      processingTime,
    };
  }

  /**
   * Create a single institution and optionally create principal user
   */
  private async createInstitution(institutionDto: BulkInstitutionRowDto) {
    // Map institution type to enum
    let institutionType: InstitutionType | undefined;
    if (institutionDto.type) {
      const typeMapping: Record<string, InstitutionType> = {
        'POLYTECHNIC': InstitutionType.POLYTECHNIC,
        'ENGINEERING_COLLEGE': InstitutionType.ENGINEERING_COLLEGE,
        'ENGINEERING': InstitutionType.ENGINEERING_COLLEGE,
        'UNIVERSITY': InstitutionType.UNIVERSITY,
        'DEGREE_COLLEGE': InstitutionType.DEGREE_COLLEGE,
        'DEGREE': InstitutionType.DEGREE_COLLEGE,
        'ITI': InstitutionType.ITI,
        'SKILL_CENTER': InstitutionType.SKILL_CENTER,
        'SKILL': InstitutionType.SKILL_CENTER,
      };
      institutionType = typeMapping[institutionDto.type.toUpperCase()];
    }

    // Create institution
    const institution = await this.prisma.institution.create({
      data: {
        name: institutionDto.name,
        code: institutionDto.code,
        type: institutionType,
        contactEmail: institutionDto.email,
        contactPhone: institutionDto.phone,
        address: institutionDto.address,
        city: institutionDto.city,
        state: institutionDto.state,
        pinCode: institutionDto.pinCode,
        website: institutionDto.website,
        isActive: true,
      },
    });

    // Create principal user if details are provided
    let principal = null;
    if (institutionDto.principalName && institutionDto.principalEmail) {
      const defaultPassword = 'Principal@123';
      const hashedPassword = await bcrypt.hash(defaultPassword, 10);

      principal = await this.prisma.user.create({
        data: {
          name: institutionDto.principalName,
          email: institutionDto.principalEmail,
          password: hashedPassword,
          role: Role.PRINCIPAL,
          phoneNo: institutionDto.principalPhone,
          institutionId: institution.id,
          active: true,
          hasChangedDefaultPassword: false,
        },
      });

      this.logger.log(`Principal created for institution ${institution.code}: ${principal.email}`);
    }

    return {
      institution,
      principal,
    };
  }

  /**
   * Download template for bulk institution upload
   */
  getTemplate(): Buffer {
    const templateData = [
      {
        'Name': 'ABC Engineering College',
        'Code': 'ABC001',
        'Type': 'ENGINEERING_COLLEGE',
        'Email': 'contact@abcengineering.edu',
        'Phone': '0121-2345678',
        'Address': '123 College Road',
        'City': 'Bangalore',
        'State': 'Karnataka',
        'Pin Code': '560001',
        'Website': 'https://www.abcengineering.edu',
        'Principal Name': 'Dr. John Smith',
        'Principal Email': 'principal@abcengineering.edu',
        'Principal Phone': '9876543210',
      },
      {
        'Name': 'XYZ Polytechnic',
        'Code': 'XYZ001',
        'Type': 'POLYTECHNIC',
        'Email': 'contact@xyzpolytechnic.edu',
        'Phone': '0121-9876543',
        'Address': '456 Tech Street',
        'City': 'Mumbai',
        'State': 'Maharashtra',
        'Pin Code': '400001',
        'Website': 'https://www.xyzpolytechnic.edu',
        'Principal Name': 'Dr. Jane Doe',
        'Principal Email': 'principal@xyzpolytechnic.edu',
        'Principal Phone': '9876543211',
      },
    ];

    const worksheet = XLSX.utils.json_to_sheet(templateData);

    // Set column widths
    worksheet['!cols'] = [
      { wch: 30 }, // Name
      { wch: 15 }, // Code
      { wch: 15 }, // Type
      { wch: 35 }, // Email
      { wch: 15 }, // Phone
      { wch: 30 }, // Address
      { wch: 15 }, // City
      { wch: 15 }, // State
      { wch: 10 }, // Pin Code
      { wch: 35 }, // Website
      { wch: 25 }, // Principal Name
      { wch: 35 }, // Principal Email
      { wch: 15 }, // Principal Phone
    ];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Institutions');

    // Add instructions sheet
    const instructionsData = [
      { Field: 'Name', Required: 'Yes', Description: 'Full name of the institution', Example: 'ABC Engineering College' },
      { Field: 'Code', Required: 'Yes', Description: 'Unique institution code', Example: 'ABC001' },
      { Field: 'Type', Required: 'No', Description: 'Institution type: POLYTECHNIC, ENGINEERING_COLLEGE, UNIVERSITY, DEGREE_COLLEGE, ITI, SKILL_CENTER', Example: 'ENGINEERING_COLLEGE' },
      { Field: 'Email', Required: 'Yes', Description: 'Institution contact email', Example: 'contact@abc.edu' },
      { Field: 'Phone', Required: 'No', Description: 'Institution contact phone', Example: '0121-2345678' },
      { Field: 'Address', Required: 'No', Description: 'Institution address', Example: '123 College Road' },
      { Field: 'City', Required: 'No', Description: 'City name', Example: 'Bangalore' },
      { Field: 'State', Required: 'No', Description: 'State name', Example: 'Karnataka' },
      { Field: 'Pin Code', Required: 'No', Description: 'Postal pin code', Example: '560001' },
      { Field: 'Website', Required: 'No', Description: 'Institution website URL', Example: 'https://www.abc.edu' },
      { Field: 'Principal Name', Required: 'No', Description: 'Principal full name (will create principal user)', Example: 'Dr. John Smith' },
      { Field: 'Principal Email', Required: 'No', Description: 'Principal email (required if creating principal)', Example: 'principal@abc.edu' },
      { Field: 'Principal Phone', Required: 'No', Description: 'Principal contact number', Example: '9876543210' },
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
   * Helper: Validate email format
   */
  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }
}
