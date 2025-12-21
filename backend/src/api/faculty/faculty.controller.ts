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
  Req,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { FacultyService } from './faculty.service';
import { JwtAuthGuard } from '../../core/auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../core/auth/guards/roles.guard';
import { Roles } from '../../core/auth/decorators/roles.decorator';
import { Role } from '@prisma/client';

@ApiTags('Faculty Portal')
@Controller('faculty')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class FacultyController {
  constructor(private readonly facultyService: FacultyService) {}

  @Get('dashboard')
  @Roles(Role.TEACHER, Role.FACULTY_SUPERVISOR)
  @ApiOperation({ summary: 'Get faculty dashboard data' })
  @ApiResponse({ status: 200, description: 'Dashboard data retrieved successfully' })
  async getDashboard(@Req() req) {
    return this.facultyService.getDashboard(req.user.userId);
  }

  @Get('profile')
  @Roles(Role.TEACHER, Role.FACULTY_SUPERVISOR)
  @ApiOperation({ summary: 'Get faculty profile' })
  @ApiResponse({ status: 200, description: 'Profile retrieved successfully' })
  async getProfile(@Req() req) {
    return this.facultyService.getProfile(req.user.userId);
  }

  @Get('students')
  @Roles(Role.TEACHER, Role.FACULTY_SUPERVISOR)
  @ApiOperation({ summary: 'Get assigned students list' })
  @ApiResponse({ status: 200, description: 'Students list retrieved successfully' })
  async getAssignedStudents(
    @Req() req,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('search') search?: string,
  ) {
    return this.facultyService.getAssignedStudents(req.user.userId, { page, limit, search });
  }

  @Get('students/:id')
  @Roles(Role.TEACHER, Role.FACULTY_SUPERVISOR)
  @ApiOperation({ summary: 'Get student detail' })
  @ApiResponse({ status: 200, description: 'Student detail retrieved successfully' })
  async getStudentDetail(@Param('id') studentId: string) {
    return this.facultyService.getStudentDetail(studentId);
  }

  @Get('students/:id/progress')
  @Roles(Role.TEACHER, Role.FACULTY_SUPERVISOR)
  @ApiOperation({ summary: 'Get student progress' })
  @ApiResponse({ status: 200, description: 'Student progress retrieved successfully' })
  async getStudentProgress(@Param('id') studentId: string) {
    return this.facultyService.getStudentProgress(studentId);
  }

  // Visit Logs
  @Get('visit-logs')
  @Roles(Role.TEACHER, Role.FACULTY_SUPERVISOR)
  @ApiOperation({ summary: 'Get all visit logs' })
  @ApiResponse({ status: 200, description: 'Visit logs retrieved successfully' })
  async getVisitLogs(
    @Req() req,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('studentId') studentId?: string,
  ) {
    return this.facultyService.getVisitLogs(req.user.userId, { page, limit, studentId });
  }

  @Post('visit-logs')
  @Roles(Role.TEACHER, Role.FACULTY_SUPERVISOR)
  @ApiOperation({ summary: 'Create visit log' })
  @ApiResponse({ status: 201, description: 'Visit log created successfully' })
  async createVisitLog(@Req() req, @Body() createVisitLogDto: any) {
    return this.facultyService.createVisitLog(req.user.userId, createVisitLogDto);
  }

  @Put('visit-logs/:id')
  @Roles(Role.TEACHER, Role.FACULTY_SUPERVISOR)
  @ApiOperation({ summary: 'Update visit log' })
  @ApiResponse({ status: 200, description: 'Visit log updated successfully' })
  async updateVisitLog(@Param('id') id: string, @Body() updateVisitLogDto: any) {
    return this.facultyService.updateVisitLog(id, updateVisitLogDto);
  }

  @Delete('visit-logs/:id')
  @Roles(Role.TEACHER, Role.FACULTY_SUPERVISOR)
  @ApiOperation({ summary: 'Delete visit log' })
  @ApiResponse({ status: 200, description: 'Visit log deleted successfully' })
  async deleteVisitLog(@Param('id') id: string) {
    return this.facultyService.deleteVisitLog(id);
  }

  // Monthly Reports
  @Get('monthly-reports')
  @Roles(Role.TEACHER, Role.FACULTY_SUPERVISOR)
  @ApiOperation({ summary: 'Get monthly reports for review' })
  @ApiResponse({ status: 200, description: 'Monthly reports retrieved successfully' })
  async getMonthlyReports(
    @Req() req,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('status') status?: string,
  ) {
    return this.facultyService.getMonthlyReports(req.user.userId, { page, limit, status });
  }

  @Put('monthly-reports/:id/review')
  @Roles(Role.TEACHER, Role.FACULTY_SUPERVISOR)
  @ApiOperation({ summary: 'Review monthly report' })
  @ApiResponse({ status: 200, description: 'Monthly report reviewed successfully' })
  async reviewMonthlyReport(@Param('id') id: string, @Body() reviewDto: any) {
    return this.facultyService.reviewMonthlyReport(id, reviewDto);
  }

  // Approvals
  @Get('approvals/self-identified')
  @Roles(Role.TEACHER, Role.FACULTY_SUPERVISOR)
  @ApiOperation({ summary: 'Get self-identified internship approvals' })
  @ApiResponse({ status: 200, description: 'Self-identified approvals retrieved successfully' })
  async getSelfIdentifiedApprovals(
    @Req() req,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('status') status?: string,
  ) {
    return this.facultyService.getSelfIdentifiedApprovals(req.user.userId, { page, limit, status });
  }

  @Put('approvals/self-identified/:id')
  @Roles(Role.TEACHER, Role.FACULTY_SUPERVISOR)
  @ApiOperation({ summary: 'Approve or reject self-identified internship' })
  @ApiResponse({ status: 200, description: 'Self-identified internship approval updated successfully' })
  async updateSelfIdentifiedApproval(@Param('id') id: string, @Body() approvalDto: any) {
    return this.facultyService.updateSelfIdentifiedApproval(id, approvalDto);
  }

  // Feedback
  @Post('feedback/monthly')
  @Roles(Role.TEACHER, Role.FACULTY_SUPERVISOR)
  @ApiOperation({ summary: 'Submit monthly feedback for student' })
  @ApiResponse({ status: 201, description: 'Monthly feedback submitted successfully' })
  async submitMonthlyFeedback(@Req() req, @Body() feedbackDto: any) {
    return this.facultyService.submitMonthlyFeedback(req.user.userId, feedbackDto);
  }

  @Get('feedback/history')
  @Roles(Role.TEACHER, Role.FACULTY_SUPERVISOR)
  @ApiOperation({ summary: 'Get feedback history' })
  @ApiResponse({ status: 200, description: 'Feedback history retrieved successfully' })
  async getFeedbackHistory(
    @Req() req,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('studentId') studentId?: string,
  ) {
    return this.facultyService.getFeedbackHistory(req.user.userId, { page, limit, studentId });
  }

  // ==================== Internship Management ====================

  @Get('students/:id/internships')
  @Roles(Role.TEACHER, Role.FACULTY_SUPERVISOR)
  @ApiOperation({ summary: 'Get student internships' })
  @ApiResponse({ status: 200, description: 'Student internships retrieved successfully' })
  async getStudentInternships(@Param('id') studentId: string) {
    return this.facultyService.getStudentInternships(studentId);
  }

  @Put('internships/:id')
  @Roles(Role.TEACHER, Role.FACULTY_SUPERVISOR)
  @ApiOperation({ summary: 'Update internship application' })
  @ApiResponse({ status: 200, description: 'Internship updated successfully' })
  async updateInternship(@Param('id') id: string, @Body() updateDto: any, @Req() req) {
    return this.facultyService.updateInternship(id, updateDto, req.user.userId);
  }

  @Delete('internships/:id')
  @Roles(Role.TEACHER, Role.FACULTY_SUPERVISOR)
  @ApiOperation({ summary: 'Delete internship application' })
  @ApiResponse({ status: 200, description: 'Internship deleted successfully' })
  async deleteInternship(@Param('id') id: string, @Req() req) {
    return this.facultyService.deleteInternship(id, req.user.userId);
  }

  // ==================== Monthly Report Actions ====================

  @Put('monthly-reports/:id/approve')
  @Roles(Role.TEACHER, Role.FACULTY_SUPERVISOR)
  @ApiOperation({ summary: 'Approve monthly report' })
  @ApiResponse({ status: 200, description: 'Monthly report approved successfully' })
  async approveMonthlyReport(@Param('id') id: string, @Body() body: any, @Req() req) {
    return this.facultyService.approveMonthlyReport(id, body.remarks, req.user.userId);
  }

  @Put('monthly-reports/:id/reject')
  @Roles(Role.TEACHER, Role.FACULTY_SUPERVISOR)
  @ApiOperation({ summary: 'Reject monthly report' })
  @ApiResponse({ status: 200, description: 'Monthly report rejected successfully' })
  async rejectMonthlyReport(@Param('id') id: string, @Body() body: any, @Req() req) {
    return this.facultyService.rejectMonthlyReport(id, body.reason, req.user.userId);
  }

  @Delete('monthly-reports/:id')
  @Roles(Role.TEACHER, Role.FACULTY_SUPERVISOR)
  @ApiOperation({ summary: 'Delete monthly report' })
  @ApiResponse({ status: 200, description: 'Monthly report deleted successfully' })
  async deleteMonthlyReport(@Param('id') id: string, @Req() req) {
    return this.facultyService.deleteMonthlyReport(id, req.user.userId);
  }

  // ==================== Joining Letter Management ====================

  @Get('joining-letters')
  @Roles(Role.TEACHER, Role.FACULTY_SUPERVISOR)
  @ApiOperation({ summary: 'Get joining letters for review' })
  @ApiResponse({ status: 200, description: 'Joining letters retrieved successfully' })
  async getJoiningLetters(
    @Req() req,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('status') status?: string,
  ) {
    return this.facultyService.getJoiningLetters(req.user.userId, { page, limit, status });
  }

  @Put('joining-letters/:id/verify')
  @Roles(Role.TEACHER, Role.FACULTY_SUPERVISOR)
  @ApiOperation({ summary: 'Verify joining letter' })
  @ApiResponse({ status: 200, description: 'Joining letter verified successfully' })
  async verifyJoiningLetter(@Param('id') id: string, @Body() body: any, @Req() req) {
    return this.facultyService.verifyJoiningLetter(id, body.remarks, req.user.userId);
  }

  @Put('joining-letters/:id/reject')
  @Roles(Role.TEACHER, Role.FACULTY_SUPERVISOR)
  @ApiOperation({ summary: 'Reject joining letter' })
  @ApiResponse({ status: 200, description: 'Joining letter rejected successfully' })
  async rejectJoiningLetter(@Param('id') id: string, @Body() body: any, @Req() req) {
    return this.facultyService.rejectJoiningLetter(id, body.reason, req.user.userId);
  }

  @Delete('joining-letters/:id')
  @Roles(Role.TEACHER, Role.FACULTY_SUPERVISOR)
  @ApiOperation({ summary: 'Delete joining letter' })
  @ApiResponse({ status: 200, description: 'Joining letter deleted successfully' })
  async deleteJoiningLetter(@Param('id') id: string, @Req() req) {
    return this.facultyService.deleteJoiningLetter(id, req.user.userId);
  }
}
