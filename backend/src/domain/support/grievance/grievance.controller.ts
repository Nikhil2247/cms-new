import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { GrievanceService, SubmitGrievanceDto, RespondToGrievanceDto } from './grievance.service';
import { JwtAuthGuard } from '../../../core/auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../../core/auth/guards/roles.guard';
import { Roles } from '../../../core/auth/decorators/roles.decorator';
import { GrievanceStatus } from '@prisma/client';

@Controller('grievances')
@UseGuards(JwtAuthGuard, RolesGuard)
export class GrievanceController {
  constructor(private readonly grievanceService: GrievanceService) {}

  /**
   * Get all grievances (with optional filtering)
   * Access: STATE_DIRECTORATE, PRINCIPAL
   */
  @Get()
  @Roles('STATE_DIRECTORATE', 'PRINCIPAL', 'FACULTY_SUPERVISOR')
  async getAllGrievances(@Query() params: any) {
    return this.grievanceService.getGrievancesByInstitution(params.institutionId);
  }

  /**
   * Get grievances by institution ID
   * Access: STATE_DIRECTORATE, PRINCIPAL
   */
  @Get('institution/:institutionId')
  @Roles('STATE_DIRECTORATE', 'PRINCIPAL', 'FACULTY_SUPERVISOR')
  async getGrievancesByInstitution(@Param('institutionId') institutionId: string) {
    return this.grievanceService.getGrievancesByInstitution(institutionId);
  }

  /**
   * Get grievances by user ID
   * Access: Any authenticated user (for their own grievances)
   */
  @Get('user/:userId')
  async getGrievancesByUser(@Param('userId') userId: string, @Request() req: any) {
    // Ensure users can only access their own grievances unless they're admin
    if (req.user.userId !== userId && !['STATE_DIRECTORATE', 'PRINCIPAL'].includes(req.user.role)) {
      throw new HttpException('Unauthorized', HttpStatus.FORBIDDEN);
    }
    return this.grievanceService.getGrievancesByUser(userId);
  }

  /**
   * Get a single grievance by ID
   * Access: Owner or admin
   */
  @Get(':id')
  async getGrievanceById(@Param('id') id: string, @Request() req: any) {
    const grievance = await this.grievanceService.getGrievancesByUser(req.user.userId);
    const found = grievance.find((g: any) => g.id === id);

    if (!found && !['STATE_DIRECTORATE', 'PRINCIPAL'].includes(req.user.role)) {
      throw new HttpException('Grievance not found', HttpStatus.NOT_FOUND);
    }

    return found;
  }

  /**
   * Submit a new grievance
   * Access: STUDENT
   */
  @Post()
  @Roles('STUDENT')
  async submitGrievance(@Body() data: SubmitGrievanceDto, @Request() req: any) {
    return this.grievanceService.submitGrievance(req.user.userId, data);
  }

  /**
   * Respond to a grievance
   * Access: STATE_DIRECTORATE, PRINCIPAL, FACULTY_SUPERVISOR
   */
  @Post(':id/respond')
  @Roles('STATE_DIRECTORATE', 'PRINCIPAL', 'FACULTY_SUPERVISOR')
  async respondToGrievance(
    @Param('id') id: string,
    @Body() data: RespondToGrievanceDto,
    @Request() req: any,
  ) {
    return this.grievanceService.respondToGrievance(id, req.user.userId, data.response);
  }

  /**
   * Escalate a grievance
   * Access: STATE_DIRECTORATE, PRINCIPAL, FACULTY_SUPERVISOR
   */
  @Post(':id/escalate')
  @Roles('STATE_DIRECTORATE', 'PRINCIPAL', 'FACULTY_SUPERVISOR')
  async escalateGrievance(@Param('id') id: string) {
    return this.grievanceService.escalateGrievance(id);
  }

  /**
   * Update grievance status
   * Access: STATE_DIRECTORATE, PRINCIPAL, FACULTY_SUPERVISOR
   */
  @Patch(':id/status')
  @Roles('STATE_DIRECTORATE', 'PRINCIPAL', 'FACULTY_SUPERVISOR')
  async updateGrievanceStatus(@Param('id') id: string, @Body() data: { status: string }) {
    return this.grievanceService.updateGrievanceStatus(id, data.status);
  }

  /**
   * Assign grievance to a user
   * Access: STATE_DIRECTORATE, PRINCIPAL
   */
  @Patch(':id/assign')
  @Roles('STATE_DIRECTORATE', 'PRINCIPAL')
  async assignGrievance(@Param('id') id: string, @Body() data: { assigneeId: string }) {
    // This would need to be implemented in the service
    throw new HttpException('Not implemented yet', HttpStatus.NOT_IMPLEMENTED);
  }

  /**
   * Close a grievance
   * Access: STATE_DIRECTORATE, PRINCIPAL, FACULTY_SUPERVISOR
   */
  @Patch(':id/close')
  @Roles('STATE_DIRECTORATE', 'PRINCIPAL', 'FACULTY_SUPERVISOR')
  async closeGrievance(@Param('id') id: string) {
    return this.grievanceService.updateGrievanceStatus(id, GrievanceStatus.CLOSED);
  }

  /**
   * Get grievance statistics
   * Access: STATE_DIRECTORATE, PRINCIPAL
   */
  @Get('statistics')
  @Roles('STATE_DIRECTORATE', 'PRINCIPAL', 'FACULTY_SUPERVISOR')
  async getStatistics(@Query('institutionId') institutionId?: string) {
    // This would need to be implemented in the service
    // For now, return mock data
    return {
      total: 0,
      pending: 0,
      escalated: 0,
      resolved: 0,
    };
  }
}
