import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  Req,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../../core/auth/guards/jwt-auth.guard';
import { ReportBuilderService } from './report-builder.service';
import { GenerateReportDto } from './dto/generate-report.dto';
import { ReportHistoryDto } from './dto/report-history.dto';

@Controller('shared/reports')
@UseGuards(JwtAuthGuard)
export class ReportBuilderController {
  constructor(private reportBuilderService: ReportBuilderService) {}

  /**
   * Get available report types for user role
   */
  @Get('catalog')
  async getReportCatalog(@Req() req: any) {
    const userRole = req.user.role;
    return this.reportBuilderService.getReportCatalog(userRole);
  }

  /**
   * Get report configuration/filters
   */
  @Get('config/:type')
  async getReportConfig(@Param('type') type: string) {
    const config = this.reportBuilderService.getReportConfig(type);
    if (!config) {
      return {
        success: false,
        message: 'Report type not found',
      };
    }
    return {
      success: true,
      data: config,
    };
  }

  /**
   * Queue report generation
   */
  @Post('generate')
  async generateReport(@Req() req: any, @Body() dto: GenerateReportDto) {
    const userId = req.user.userId;
    const institutionId = req.user.institutionId;

    // Add institutionId to filters if not present (for role-based filtering)
    const filters = {
      ...dto.filters,
      institutionId: dto.filters?.institutionId || institutionId,
    };

    const result = await this.reportBuilderService.queueReportGeneration(
      userId,
      dto.type,
      filters,
      dto.format,
    );

    return {
      success: true,
      message: 'Report generation queued successfully',
      data: result,
    };
  }

  /**
   * Get report status
   */
  @Get(':id')
  async getReportStatus(@Param('id') id: string) {
    const report = await this.reportBuilderService.getReportStatus(id);

    if (!report) {
      return {
        success: false,
        message: 'Report not found',
      };
    }

    return {
      success: true,
      data: report,
    };
  }

  /**
   * Download generated report
   */
  @Get(':id/download')
  async downloadReport(@Param('id') id: string) {
    const report = await this.reportBuilderService.getReportStatus(id);

    if (!report) {
      return {
        success: false,
        message: 'Report not found',
      };
    }

    if (report.status !== 'completed') {
      return {
        success: false,
        message: 'Report is not ready for download',
        status: report.status,
      };
    }

    return {
      success: true,
      data: {
        downloadUrl: report.downloadUrl,
        format: report.format,
      },
    };
  }

  /**
   * Get user's report history
   */
  @Get()
  async getReportHistory(@Req() req: any, @Query() query: ReportHistoryDto) {
    const userId = req.user.userId;
    const pagination = {
      page: query.page || 1,
      limit: query.limit || 10,
    };

    const result = await this.reportBuilderService.getReportHistory(
      userId,
      pagination,
    );

    return {
      success: true,
      data: result,
    };
  }
}
