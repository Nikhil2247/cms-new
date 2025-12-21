import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { StateService } from './state.service';
import { Roles } from '../../core/auth/decorators/roles.decorator';
import { RolesGuard } from '../../core/auth/guards/roles.guard';
import { JwtAuthGuard } from '../../core/auth/guards/jwt-auth.guard';
import { Role } from '@prisma/client';

@ApiTags('State Directorate')
@ApiBearerAuth()
@Controller('state')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.STATE_DIRECTORATE)
export class StateController {
  constructor(private readonly stateService: StateService) {}

  @Get('dashboard')
  @ApiOperation({ summary: 'Get state directorate dashboard data' })
  async getDashboard() {
    return this.stateService.getDashboard();
  }

  @Get('institutions')
  @ApiOperation({ summary: 'Get all institutions under state directorate' })
  async getInstitutions(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
  ) {
    return this.stateService.getInstitutions({
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
      search,
    });
  }

  @Get('institutions/:id/overview')
  @ApiOperation({ summary: 'Get institution overview with detailed statistics' })
  async getInstitutionOverview(@Param('id') id: string) {
    return this.stateService.getInstitutionOverview(id);
  }

  @Get('institutions/:id/students')
  @ApiOperation({ summary: 'Get institution students with cursor pagination' })
  async getInstitutionStudents(
    @Param('id') id: string,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
    @Query('filter') filter?: 'assigned' | 'unassigned' | 'all',
  ) {
    return this.stateService.getInstitutionStudents(id, {
      cursor,
      limit: Number(limit) || 20,
      search,
      filter: filter || 'all',
    });
  }

  @Get('institutions/:id/companies')
  @ApiOperation({ summary: 'Get institution companies with student counts' })
  async getInstitutionCompanies(
    @Param('id') id: string,
    @Query('limit') limit?: string,
  ) {
    return this.stateService.getInstitutionCompanies(id, {
      limit: Number(limit) || 50,
    });
  }

  @Get('institutions/:id')
  @ApiOperation({ summary: 'Get institution details by ID' })
  async getInstitutionById(@Param('id') id: string) {
    return this.stateService.getInstitutionById(id);
  }

  @Post('institutions')
  @ApiOperation({ summary: 'Create new institution' })
  async createInstitution(@Body() data: any) {
    return this.stateService.createInstitution(data);
  }

  @Put('institutions/:id')
  @ApiOperation({ summary: 'Update institution by ID' })
  async updateInstitution(@Param('id') id: string, @Body() data: any) {
    return this.stateService.updateInstitution(id, data);
  }

  @Delete('institutions/:id')
  @ApiOperation({ summary: 'Delete institution by ID' })
  async deleteInstitution(@Param('id') id: string) {
    return this.stateService.deleteInstitution(id);
  }

  @Get('principals')
  @ApiOperation({ summary: 'Get all principals across institutions' })
  async getPrincipals(
    @Query('institutionId') institutionId?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.stateService.getPrincipals({
      institutionId,
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
    });
  }

  @Post('principals')
  @ApiOperation({ summary: 'Create new principal for an institution' })
  async createPrincipal(@Body() data: any) {
    return this.stateService.createPrincipal(data);
  }

  @Get('principals/:id')
  @ApiOperation({ summary: 'Get principal by ID' })
  async getPrincipalById(@Param('id') id: string) {
    return this.stateService.getPrincipalById(id);
  }

  @Put('principals/:id')
  @ApiOperation({ summary: 'Update principal by ID' })
  async updatePrincipal(@Param('id') id: string, @Body() data: any) {
    return this.stateService.updatePrincipal(id, data);
  }

  @Delete('principals/:id')
  @ApiOperation({ summary: 'Delete principal by ID' })
  async deletePrincipal(@Param('id') id: string) {
    return this.stateService.deletePrincipal(id);
  }

  @Post('principals/:id/reset-password')
  @ApiOperation({ summary: 'Reset principal password' })
  async resetPrincipalPassword(@Param('id') id: string) {
    return this.stateService.resetPrincipalPassword(id);
  }

  @Get('users')
  @ApiOperation({ summary: 'Get all users for credentials management' })
  async getUsers(
    @Query('role') role?: string,
    @Query('institutionId') institutionId?: string,
    @Query('search') search?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.stateService.getUsers({
      role,
      institutionId,
      search,
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
    });
  }

  @Get('reports/institutions')
  @ApiOperation({ summary: 'Get institutional performance reports' })
  async getInstitutionReports(
    @Query('fromDate') fromDate?: string,
    @Query('toDate') toDate?: string,
    @Query('reportType') reportType?: string,
  ) {
    return this.stateService.getInstitutionReports({ fromDate, toDate, reportType });
  }

  @Get('audit-logs')
  @ApiOperation({ summary: 'Get system-wide audit logs' })
  async getAuditLogs(
    @Query('institutionId') institutionId?: string,
    @Query('userId') userId?: string,
    @Query('action') action?: string,
    @Query('fromDate') fromDate?: string,
    @Query('toDate') toDate?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.stateService.getAuditLogs({
      institutionId,
      userId,
      action,
      fromDate,
      toDate,
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
    });
  }

  @Get('analytics/performers')
  @ApiOperation({ summary: 'Get top and bottom performing institutions' })
  async getPerformers(
    @Query('limit') limit?: string,
    @Query('month') month?: string,
    @Query('year') year?: string,
  ) {
    return this.stateService.getTopPerformers({
      limit: limit ? Number(limit) : undefined,
      month: month ? Number(month) : undefined,
      year: year ? Number(year) : undefined,
    });
  }

  @Get('analytics/industries')
  @ApiOperation({ summary: 'Get top industry partners by hiring' })
  async getTopIndustries(
    @Query('limit') limit?: string,
  ) {
    return this.stateService.getTopIndustries({ limit: limit ? Number(limit) : undefined });
  }

  @Get('analytics/monthly')
  @ApiOperation({ summary: 'Get monthly analytics data' })
  async getMonthlyAnalytics(
    @Query('month') month?: string,
    @Query('year') year?: string,
  ) {
    return this.stateService.getMonthlyAnalytics({
      month: month ? Number(month) : undefined,
      year: year ? Number(year) : undefined,
    });
  }

  @Get('analytics/institution/:id')
  @ApiOperation({ summary: 'Get performance metrics for a specific institution' })
  async getInstitutionPerformance(
    @Param('id') id: string,
    @Query('fromDate') fromDate?: string,
    @Query('toDate') toDate?: string,
  ) {
    return this.stateService.getInstitutionPerformance(id, {
      fromDate: fromDate ? new Date(fromDate) : undefined,
      toDate: toDate ? new Date(toDate) : undefined,
    });
  }

  @Get('analytics/reports')
  @ApiOperation({ summary: 'Get monthly report statistics' })
  async getMonthlyReportStats(
    @Query('institutionId') institutionId?: string,
    @Query('month') month?: string,
    @Query('year') year?: string,
  ) {
    return this.stateService.getMonthlyReportStats({
      institutionId,
      month: month ? Number(month) : undefined,
      year: year ? Number(year) : undefined,
    });
  }

  @Get('analytics/visits')
  @ApiOperation({ summary: 'Get faculty visit statistics' })
  async getFacultyVisitStats(
    @Query('institutionId') institutionId?: string,
    @Query('facultyId') facultyId?: string,
    @Query('fromDate') fromDate?: string,
    @Query('toDate') toDate?: string,
  ) {
    return this.stateService.getFacultyVisitStats({
      institutionId,
      facultyId,
      fromDate: fromDate ? new Date(fromDate) : undefined,
      toDate: toDate ? new Date(toDate) : undefined,
    });
  }

  @Get('industries/pending')
  @ApiOperation({ summary: 'Get pending industry approvals' })
  async getPendingIndustries(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.stateService.getPendingIndustries({
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
    });
  }

  @Post('industries/:id/approve')
  @ApiOperation({ summary: 'Approve industry registration' })
  async approveIndustry(
    @Param('id') id: string,
    @Body('approvedBy') approvedBy: string,
  ) {
    return this.stateService.approveIndustry(id, approvedBy);
  }

  @Post('industries/:id/reject')
  @ApiOperation({ summary: 'Reject industry registration' })
  async rejectIndustry(
    @Param('id') id: string,
    @Body('reason') reason?: string,
  ) {
    return this.stateService.rejectIndustry(id, reason);
  }

  @Get('placements/stats')
  @ApiOperation({ summary: 'Get state-wide placement statistics' })
  async getPlacementStats() {
    return this.stateService.getStateWidePlacementStats();
  }

  @Get('placements/trends')
  @ApiOperation({ summary: 'Get state-wide placement trends' })
  async getPlacementTrends(
    @Query('years') years?: string,
  ) {
    return this.stateService.getStateWidePlacementTrends(years ? Number(years) : undefined);
  }

  @Get('joining-letters/stats')
  @ApiOperation({ summary: 'Get joining letter statistics' })
  async getJoiningLetterStats() {
    return this.stateService.getJoiningLetterStats();
  }

  @Get('export/dashboard')
  @ApiOperation({ summary: 'Export dashboard data as report' })
  async exportDashboard(
    @Query('format') format: 'json' | 'csv' = 'json',
    @Query('month') month?: string,
    @Query('year') year?: string,
  ) {
    const monthNum = month ? Number(month) : undefined;
    const yearNum = year ? Number(year) : undefined;

    const stats = await this.stateService.getDashboardStats();
    const performers = await this.stateService.getTopPerformers({ limit: 10, month: monthNum, year: yearNum });
    const industries = await this.stateService.getTopIndustries({ limit: 10 });
    const monthlyData = await this.stateService.getMonthlyAnalytics({ month: monthNum, year: yearNum });

    return {
      exportedAt: new Date().toISOString(),
      format,
      data: {
        stats,
        performers,
        industries,
        monthlyAnalytics: monthlyData,
      },
    };
  }
}
