import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { ReportsService } from './reports.service';
import { JwtAuthGuard } from '../../core/auth/guards/jwt-auth.guard';

@Controller('shared/reports')
@UseGuards(JwtAuthGuard)
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('catalog')
  async getReportCatalog(@Request() req) {
    return this.reportsService.getReportCatalog(req.user.role);
  }

  @Get('config/:type')
  async getReportConfig(@Param('type') type: string) {
    return this.reportsService.getReportConfig(type);
  }

  @Post('generate')
  async generateReport(@Request() req, @Body() reportData: any) {
    return this.reportsService.generateReport(req.user.userId, reportData);
  }

  @Get('history')
  async getReportHistory(
    @Request() req,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.reportsService.getReportHistory(req.user.userId, {
      page: page ? Number(page) : 1,
      limit: limit ? Number(limit) : 10,
    });
  }

  @Get(':id')
  async getReport(@Param('id') id: string, @Request() req) {
    return this.reportsService.getReport(req.user.userId, id);
  }

  @Get(':id/download')
  async downloadReport(@Param('id') id: string, @Request() req) {
    return this.reportsService.downloadReport(id, req.user.userId);
  }
}
