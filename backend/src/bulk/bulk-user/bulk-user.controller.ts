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
import { BulkUserService } from './bulk-user.service';
import { JwtAuthGuard } from '../../core/auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../core/auth/guards/roles.guard';
import { Roles } from '../../core/auth/decorators/roles.decorator';
import { Role } from '@prisma/client';
import { BulkUserResultDto } from './dto/bulk-user.dto';

@ApiTags('Bulk Operations - Users')
@Controller('bulk/users')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
export class BulkUserController {
  constructor(private readonly bulkUserService: BulkUserService) {}

  @Post('upload')
  @Roles(Role.PRINCIPAL, Role.SYSTEM_ADMIN)
  @UseInterceptors(FileInterceptor('file'))
  @ApiOperation({ summary: 'Bulk upload users (staff/faculty) from CSV/Excel file' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
          description: 'CSV or Excel file containing user data',
        },
      },
    },
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Bulk upload results',
    type: BulkUserResultDto,
  })
  @ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'Invalid file or data' })
  async bulkUploadUsers(
    @UploadedFile() file: Express.Multer.File,
    @Req() req: any,
  ): Promise<BulkUserResultDto> {
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
    const institutionId = user.institutionId;

    if (!institutionId) {
      throw new BadRequestException('Institution ID not found for the user');
    }

    // Parse file
    const users = await this.bulkUserService.parseFile(file.buffer, file.originalname);

    if (users.length === 0) {
      throw new BadRequestException('No valid data found in the file');
    }

    if (users.length > 500) {
      throw new BadRequestException('Maximum 500 users can be uploaded at once');
    }

    // Process bulk upload
    const result = await this.bulkUserService.bulkUploadUsers(users, institutionId, user.sub);

    return result;
  }

  @Post('validate')
  @Roles(Role.PRINCIPAL, Role.SYSTEM_ADMIN)
  @UseInterceptors(FileInterceptor('file'))
  @ApiOperation({ summary: 'Validate user data from CSV/Excel file without creating records' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
          description: 'CSV or Excel file containing user data',
        },
      },
    },
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Validation results',
  })
  async validateUsers(@UploadedFile() file: Express.Multer.File, @Req() req: any) {
    if (!file) {
      throw new BadRequestException('File is required');
    }

    const user = req.user;
    const institutionId = user.institutionId;

    if (!institutionId) {
      throw new BadRequestException('Institution ID not found for the user');
    }

    // Parse file
    const users = await this.bulkUserService.parseFile(file.buffer, file.originalname);

    // Validate users
    const validationResult = await this.bulkUserService.validateUsers(users, institutionId);

    return validationResult;
  }

  @Get('template')
  @Roles(Role.PRINCIPAL, Role.SYSTEM_ADMIN)
  @ApiOperation({ summary: 'Download template Excel file for bulk user upload' })
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
    const template = this.bulkUserService.getTemplate();

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=bulk-user-upload-template.xlsx');

    res.send(template);
  }
}
