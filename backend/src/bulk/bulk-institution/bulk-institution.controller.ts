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
import { BulkInstitutionService } from './bulk-institution.service';
import { JwtAuthGuard } from '../../core/auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../core/auth/guards/roles.guard';
import { Roles } from '../../core/auth/decorators/roles.decorator';
import { Role } from '@prisma/client';
import { BulkInstitutionResultDto } from './dto/bulk-institution.dto';

@ApiTags('Bulk Operations - Institutions')
@Controller('bulk/institutions')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
export class BulkInstitutionController {
  constructor(private readonly bulkInstitutionService: BulkInstitutionService) {}

  @Post('upload')
  @Roles(Role.SYSTEM_ADMIN, Role.STATE_DIRECTORATE)
  @UseInterceptors(FileInterceptor('file'))
  @ApiOperation({ summary: 'Bulk upload institutions from CSV/Excel file (Admin only)' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
          description: 'CSV or Excel file containing institution data',
        },
      },
    },
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Bulk upload results',
    type: BulkInstitutionResultDto,
  })
  @ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'Invalid file or data' })
  async bulkUploadInstitutions(
    @UploadedFile() file: Express.Multer.File,
    @Req() req: any,
  ): Promise<BulkInstitutionResultDto> {
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

    // Validate file size (max 5MB)
    const maxSize = 5 * 1024 * 1024; // 5MB
    if (file.size > maxSize) {
      throw new BadRequestException('File size exceeds 5MB limit');
    }

    const user = req.user;

    // Parse file
    const institutions = await this.bulkInstitutionService.parseFile(file.buffer, file.originalname);

    if (institutions.length === 0) {
      throw new BadRequestException('No valid data found in the file');
    }

    if (institutions.length > 100) {
      throw new BadRequestException('Maximum 100 institutions can be uploaded at once');
    }

    // Process bulk upload
    const result = await this.bulkInstitutionService.bulkUploadInstitutions(institutions, user.sub);

    return result;
  }

  @Post('validate')
  @Roles(Role.SYSTEM_ADMIN, Role.STATE_DIRECTORATE)
  @UseInterceptors(FileInterceptor('file'))
  @ApiOperation({ summary: 'Validate institution data from CSV/Excel file without creating records' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
          description: 'CSV or Excel file containing institution data',
        },
      },
    },
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Validation results',
  })
  async validateInstitutions(@UploadedFile() file: Express.Multer.File, @Req() req: any) {
    if (!file) {
      throw new BadRequestException('File is required');
    }

    // Parse file
    const institutions = await this.bulkInstitutionService.parseFile(file.buffer, file.originalname);

    // Validate institutions
    const validationResult = await this.bulkInstitutionService.validateInstitutions(institutions);

    return validationResult;
  }

  @Get('template')
  @Roles(Role.SYSTEM_ADMIN, Role.STATE_DIRECTORATE)
  @ApiOperation({ summary: 'Download template Excel file for bulk institution upload' })
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
    const template = this.bulkInstitutionService.getTemplate();

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=bulk-institution-upload-template.xlsx');

    res.send(template);
  }
}
