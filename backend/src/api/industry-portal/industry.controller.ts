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
  Request,
} from '@nestjs/common';
import { IndustryService } from './industry.service';
import { JwtAuthGuard } from '../../core/auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../core/auth/guards/roles.guard';
import { Roles } from '../../core/auth/decorators/roles.decorator';
import { Role } from '@prisma/client';

@Controller('industry')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.INDUSTRY)
export class IndustryController {
  constructor(private readonly industryService: IndustryService) {}

  @Get('dashboard')
  async getDashboard(@Request() req) {
    return this.industryService.getDashboard(req.user.userId);
  }

  @Get('profile')
  async getProfile(@Request() req) {
    return this.industryService.getProfile(req.user.userId);
  }

  @Put('profile')
  async updateProfile(@Request() req, @Body() updateData: any) {
    return this.industryService.updateProfile(req.user.userId, updateData);
  }

  // Internships
  @Get('internships')
  async getInternships(@Request() req, @Query() query: any) {
    return this.industryService.getPostings(req.user.userId, query);
  }

  @Post('internships')
  async createInternship(@Request() req, @Body() internshipData: any) {
    return this.industryService.createInternshipPosting(req.user.userId, internshipData);
  }

  @Put('internships/:id')
  async updateInternship(
    @Param('id') id: string,
    @Body() updateData: any,
    @Request() req,
  ) {
    return this.industryService.updateInternshipPosting(req.user.userId, id, updateData);
  }

  @Delete('internships/:id')
  async deleteInternship(@Param('id') id: string, @Request() req) {
    return this.industryService.deleteInternshipPosting(req.user.userId, id);
  }

  // Applications
  @Get('applications')
  async getApplications(@Request() req, @Query() query: any) {
    return this.industryService.getApplications(req.user.userId, query);
  }

  @Get('applications/:id')
  async getApplicationById(@Param('id') id: string, @Request() req) {
    return this.industryService.getApplicationById(req.user.userId, id);
  }

  @Put('applications/:id/status')
  async updateApplicationStatus(
    @Param('id') id: string,
    @Body() statusData: any,
    @Request() req,
  ) {
    return this.industryService.updateApplicationStatus(
      req.user.userId,
      id,
      statusData,
    );
  }

  // Supervisors
  @Get('supervisors')
  async getSupervisors(@Request() req) {
    return this.industryService.getSupervisors(req.user.userId);
  }

  @Post('supervisors')
  async createSupervisor(@Request() req, @Body() supervisorData: any) {
    return this.industryService.createSupervisor(req.user.userId, supervisorData);
  }

  @Put('supervisors/:id')
  async updateSupervisor(
    @Param('id') id: string,
    @Body() updateData: any,
    @Request() req,
  ) {
    return this.industryService.updateSupervisor(req.user.userId, id, updateData);
  }

  // Feedback
  @Post('feedback/monthly')
  async submitMonthlyFeedback(@Request() req, @Body() feedbackData: any) {
    return this.industryService.submitMonthlyFeedback(
      req.user.userId,
      feedbackData,
    );
  }

  @Post('feedback/completion')
  async submitCompletionFeedback(@Request() req, @Body() feedbackData: any) {
    return this.industryService.submitCompletionFeedback(
      req.user.userId,
      feedbackData,
    );
  }

  @Get('feedback/history')
  async getFeedbackHistory(@Request() req, @Query() query: any) {
    return this.industryService.getFeedbackHistory(req.user.userId, query);
  }

  // Requests
  @Post('requests')
  async createRequest(@Request() req, @Body() requestData: any) {
    return this.industryService.createRequest(req.user.userId, requestData);
  }

  @Get('requests')
  async getRequests(@Request() req, @Query() query: any) {
    return this.industryService.getRequests(req.user.userId, query);
  }
}
