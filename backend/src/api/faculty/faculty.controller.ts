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
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { FacultyService } from './faculty.service';
import { JwtAuthGuard } from '../../core/auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../core/auth/guards/roles.guard';
import { Roles } from '../../core/auth/decorators/roles.decorator';
import { Role } from '../../generated/prisma/client';
import { FileStorageService } from '../../infrastructure/file-storage/file-storage.service';
import {
  CreateVisitLogDto,
  UpdateVisitLogDto,
  ReviewMonthlyReportDto,
  ApproveMonthlyReportDto,
  RejectMonthlyReportDto,
  UpdateSelfIdentifiedApprovalDto,
  SubmitMonthlyFeedbackDto,
  UpdateInternshipDto,
  VerifyJoiningLetterDto,
  RejectJoiningLetterDto,
  UploadVisitDocumentDto,
} from './dto';
import {
  validateVisitDocument,
  validateJoiningLetter,
} from '../../core/common/utils/file-validation.util';

@ApiTags('Faculty Portal')
@Controller('faculty')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class FacultyController {
  constructor(
    private readonly facultyService: FacultyService,
    private readonly fileStorageService: FileStorageService,
  ) {}

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
  async getStudentDetail(@Param('id') studentId: string, @Req() req) {
    return this.facultyService.getStudentDetail(studentId, req.user.userId);
  }

  @Get('students/:id/progress')
  @Roles(Role.TEACHER, Role.FACULTY_SUPERVISOR)
  @ApiOperation({ summary: 'Get student progress' })
  @ApiResponse({ status: 200, description: 'Student progress retrieved successfully' })
  async getStudentProgress(@Param('id') studentId: string, @Req() req) {
    return this.facultyService.getStudentProgress(studentId, req.user.userId);
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
  @ApiOperation({
    summary: 'Create visit log (supports quick visit logging)',
    description: 'Required fields: (applicationId OR studentId), visitType, visitLocation. All other fields are optional. Auto-sets visitDate to now and status to COMPLETED if not provided.',
  })
  @ApiResponse({ status: 201, description: 'Visit log created successfully' })
  async createVisitLog(@Req() req, @Body() createVisitLogDto: CreateVisitLogDto) {
    return this.facultyService.createVisitLog(req.user.userId, createVisitLogDto);
  }

  @Put('visit-logs/:id')
  @Roles(Role.TEACHER, Role.FACULTY_SUPERVISOR)
  @ApiOperation({ summary: 'Update visit log' })
  @ApiResponse({ status: 200, description: 'Visit log updated successfully' })
  async updateVisitLog(@Param('id') id: string, @Body() updateVisitLogDto: UpdateVisitLogDto, @Req() req) {
    return this.facultyService.updateVisitLog(id, updateVisitLogDto, req.user.userId);
  }

  @Delete('visit-logs/:id')
  @Roles(Role.TEACHER, Role.FACULTY_SUPERVISOR)
  @ApiOperation({ summary: 'Delete visit log' })
  @ApiResponse({ status: 200, description: 'Visit log deleted successfully' })
  async deleteVisitLog(@Param('id') id: string, @Req() req) {
    return this.facultyService.deleteVisitLog(id, req.user.userId);
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
  async reviewMonthlyReport(@Param('id') id: string, @Body() reviewDto: ReviewMonthlyReportDto, @Req() req) {
    return this.facultyService.reviewMonthlyReport(id, {
      facultyId: req.user.userId,
      reviewComments: reviewDto.remarks,
      isApproved: reviewDto.status === 'APPROVED',
    });
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
  async updateSelfIdentifiedApproval(@Param('id') id: string, @Body() approvalDto: UpdateSelfIdentifiedApprovalDto, @Req() req) {
    return this.facultyService.updateSelfIdentifiedApproval(id, {
      facultyId: req.user.userId,
      status: approvalDto.status,
      reviewRemarks: approvalDto.remarks || approvalDto.reason,
    });
  }

  // Feedback
  @Post('feedback/monthly')
  @Roles(Role.TEACHER, Role.FACULTY_SUPERVISOR)
  @ApiOperation({ summary: 'Submit monthly feedback for student' })
  @ApiResponse({ status: 201, description: 'Monthly feedback submitted successfully' })
  async submitMonthlyFeedback(@Req() req, @Body() feedbackDto: SubmitMonthlyFeedbackDto) {
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
  async getStudentInternships(@Param('id') studentId: string, @Req() req) {
    return this.facultyService.getStudentInternships(studentId, req.user.userId);
  }

  @Put('internships/:id')
  @Roles(Role.TEACHER, Role.FACULTY_SUPERVISOR)
  @ApiOperation({ summary: 'Update internship application' })
  @ApiResponse({ status: 200, description: 'Internship updated successfully' })
  async updateInternship(@Param('id') id: string, @Body() updateDto: UpdateInternshipDto, @Req() req) {
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
  async approveMonthlyReport(@Param('id') id: string, @Body() body: ApproveMonthlyReportDto, @Req() req) {
    return this.facultyService.approveMonthlyReport(id, body.remarks, req.user.userId);
  }

  @Put('monthly-reports/:id/reject')
  @Roles(Role.TEACHER, Role.FACULTY_SUPERVISOR)
  @ApiOperation({ summary: 'Reject monthly report' })
  @ApiResponse({ status: 200, description: 'Monthly report rejected successfully' })
  async rejectMonthlyReport(@Param('id') id: string, @Body() body: RejectMonthlyReportDto, @Req() req) {
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
  async verifyJoiningLetter(@Param('id') id: string, @Body() body: VerifyJoiningLetterDto, @Req() req) {
    return this.facultyService.verifyJoiningLetter(id, body.remarks, req.user.userId);
  }

  @Put('joining-letters/:id/reject')
  @Roles(Role.TEACHER, Role.FACULTY_SUPERVISOR)
  @ApiOperation({ summary: 'Reject joining letter' })
  @ApiResponse({ status: 200, description: 'Joining letter rejected successfully' })
  async rejectJoiningLetter(@Param('id') id: string, @Body() body: RejectJoiningLetterDto, @Req() req) {
    return this.facultyService.rejectJoiningLetter(id, body.reason, req.user.userId);
  }

  @Delete('joining-letters/:id')
  @Roles(Role.TEACHER, Role.FACULTY_SUPERVISOR)
  @ApiOperation({ summary: 'Delete joining letter' })
  @ApiResponse({ status: 200, description: 'Joining letter deleted successfully' })
  async deleteJoiningLetter(@Param('id') id: string, @Req() req) {
    return this.facultyService.deleteJoiningLetter(id, req.user.userId);
  }

  @Post('joining-letters/:id/upload')
  @Roles(Role.TEACHER, Role.FACULTY_SUPERVISOR)
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage() }))
  @ApiOperation({ summary: 'Upload joining letter for a student' })
  @ApiResponse({ status: 200, description: 'Joining letter uploaded successfully' })
  async uploadJoiningLetter(
    @Param('id') applicationId: string,
    @UploadedFile() file: Express.Multer.File,
    @Req() req,
  ) {
    if (!file) {
      throw new BadRequestException('No file provided');
    }

    // SECURITY: Validate file type, size, and magic bytes
    validateJoiningLetter(file);

    // Get application details to determine student info for file path
    const application = await this.facultyService.getApplicationForUpload(applicationId);

    if (!application) {
      throw new BadRequestException('Application not found');
    }

    // Get institution name for folder structure
    const institutionName = application.student?.Institution?.name || 'default';

    // Upload to MinIO with organized folder structure
    const result = await this.fileStorageService.uploadStudentDocument(file, {
      institutionName,
      rollNumber: application.student?.rollNumber || application.studentId,
      documentType: 'joining-letter',
    });

    return this.facultyService.uploadJoiningLetter(applicationId, result.url, req.user.userId);
  }

  @Post('visit-logs/upload-document')
  @Roles(Role.TEACHER, Role.FACULTY_SUPERVISOR)
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage() }))
  @ApiOperation({ summary: 'Upload a document for visit log (photo or signed document)' })
  @ApiResponse({ status: 200, description: 'Document uploaded successfully' })
  async uploadVisitDocument(
    @UploadedFile() file: Express.Multer.File,
    @Body() body: UploadVisitDocumentDto,
    @Req() req,
  ) {
    if (!file) {
      throw new BadRequestException('No file provided');
    }

    // SECURITY: Validate file type, size, and magic bytes (prevents file spoofing)
    validateVisitDocument(file);

    // Get faculty for determining storage path
    const faculty = await this.facultyService.getProfile(req.user.userId);
    const docType = body.documentType || 'visit-photo';

    // Get institution name for folder structure
    const institutionName = faculty?.Institution?.name || 'default';

    // Upload to MinIO using 'other' type for visit documents
    const result = await this.fileStorageService.uploadStudentDocument(file, {
      institutionName,
      rollNumber: 'visit-logs', // Use 'visit-logs' as identifier for faculty visit documents
      documentType: 'other',
      customName: docType, // Store the actual type in customName for reference
    });

    return { url: result.url, documentType: docType };
  }
}
