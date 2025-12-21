import {
  Controller,
  Post,
  Get,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  Req,
  BadRequestException,
  Res,
  HttpStatus,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiConsumes, ApiBody } from '@nestjs/swagger';
import { Response } from 'express';
import { BulkStudentService } from './bulk-student.service';
import { JwtAuthGuard } from '../../core/auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../core/auth/guards/roles.guard';
import { Roles } from '../../core/auth/decorators/roles.decorator';
import { Role } from '@prisma/client';
import { BulkStudentResultDto } from './dto/bulk-student.dto';

@ApiTags('Bulk Operations - Students')
@Controller('bulk/students')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
export class BulkStudentController {
  constructor(private readonly bulkStudentService: BulkStudentService) {}

  @Post('upload')
  @Roles(Role.PRINCIPAL, Role.SYSTEM_ADMIN)
  @UseInterceptors(FileInterceptor('file'))
  @ApiOperation({ summary: 'Bulk upload students from CSV/Excel file' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
          description: 'CSV or Excel file containing student data',
        },
      },
    },
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Bulk upload results',
    type: BulkStudentResultDto,
  })
  @ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'Invalid file or data' })
  async bulkUploadStudents(
    @UploadedFile() file: Express.Multer.File,
    @Req() req: any,
  ): Promise<BulkStudentResultDto> {
    if (!file) {
      throw new BadRequestException('File is required');
    }

    // Validate file type
    const allowedMimeTypes = [
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'text/csv',
    ];

    if (!allowedMimeTypes.includes(file.mimetype)) {
      throw new BadRequestException('Invalid file type. Only CSV and Excel files are allowed.');
    }

    // Validate file size (max 10MB for students as there can be more records)
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      throw new BadRequestException('File size exceeds 10MB limit');
    }

    const user = req.user;
    const institutionId = user.institutionId;

    if (!institutionId) {
      throw new BadRequestException('Institution ID not found for the user');
    }

    // Parse file
    const students = await this.bulkStudentService.parseFile(file.buffer, file.originalname);

    if (students.length === 0) {
      throw new BadRequestException('No valid data found in the file');
    }

    if (students.length > 1000) {
      throw new BadRequestException('Maximum 1000 students can be uploaded at once');
    }

    // Process bulk upload
    const result = await this.bulkStudentService.bulkUploadStudents(students, institutionId, user.sub);

    return result;
  }

  @Post('validate')
  @Roles(Role.PRINCIPAL, Role.SYSTEM_ADMIN)
  @UseInterceptors(FileInterceptor('file'))
  @ApiOperation({ summary: 'Validate student data from CSV/Excel file without creating records' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
          description: 'CSV or Excel file containing student data',
        },
      },
    },
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Validation results',
  })
  async validateStudents(@UploadedFile() file: Express.Multer.File, @Req() req: any) {
    if (!file) {
      throw new BadRequestException('File is required');
    }

    const user = req.user;
    const institutionId = user.institutionId;

    if (!institutionId) {
      throw new BadRequestException('Institution ID not found for the user');
    }

    // Parse file
    const students = await this.bulkStudentService.parseFile(file.buffer, file.originalname);

    // Validate students
    const validationResult = await this.bulkStudentService.validateStudents(students, institutionId);

    return validationResult;
  }

  @Get('template')
  @Roles(Role.PRINCIPAL, Role.SYSTEM_ADMIN)
  @ApiOperation({ summary: 'Download template Excel file for bulk student upload' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Excel template file',
    content: {
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': {
        schema: {
          type: 'string',
          format: 'binary',
        },
      },
    },
  })
  async downloadTemplate(@Res() res: Response) {
    const template = this.bulkStudentService.getTemplate();

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=bulk-student-upload-template.xlsx');

    res.send(template);
  }
}
