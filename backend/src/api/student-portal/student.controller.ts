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
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiConsumes } from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { StudentService } from './student.service';
import { JwtAuthGuard } from '../../core/auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../core/auth/guards/roles.guard';
import { Roles } from '../../core/auth/decorators/roles.decorator';
import { Role } from '@prisma/client';

@ApiTags('Student Portal')
@Controller('student')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class StudentController {
  constructor(private readonly studentService: StudentService) {}

  @Get('dashboard')
  @Roles(Role.STUDENT)
  @ApiOperation({ summary: 'Get student dashboard data' })
  @ApiResponse({ status: 200, description: 'Dashboard data retrieved successfully' })
  async getDashboard(@Req() req) {
    return this.studentService.getDashboard(req.user.userId);
  }

  @Get('profile')
  @Roles(Role.STUDENT)
  @ApiOperation({ summary: 'Get student profile' })
  @ApiResponse({ status: 200, description: 'Profile retrieved successfully' })
  async getProfile(@Req() req) {
    return this.studentService.getProfile(req.user.userId);
  }

  @Put('profile')
  @Roles(Role.STUDENT)
  @ApiOperation({ summary: 'Update student profile' })
  @ApiResponse({ status: 200, description: 'Profile updated successfully' })
  async updateProfile(@Req() req, @Body() updateProfileDto: any) {
    return this.studentService.updateProfile(req.user.userId, updateProfileDto);
  }

  @Post('profile/image')
  @Roles(Role.STUDENT)
  @ApiOperation({ summary: 'Upload profile image' })
  @ApiConsumes('multipart/form-data')
  @ApiResponse({ status: 200, description: 'Profile image uploaded successfully' })
  @UseInterceptors(FileInterceptor('file'))
  async uploadProfileImage(@Req() req, @UploadedFile() file: Express.Multer.File) {
    const imageUrl = (file as any)?.path || (file as any)?.location || (file as any)?.url || '';
    return this.studentService.uploadProfileImage(req.user.userId, imageUrl);
  }

  // Internships
  @Get('internships')
  @Roles(Role.STUDENT)
  @ApiOperation({ summary: 'Get available internships' })
  @ApiResponse({ status: 200, description: 'Internships list retrieved successfully' })
  async getInternships(
    @Req() req,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('search') search?: string,
    @Query('industry') industry?: string,
  ) {
    return this.studentService.getAvailableInternships(req.user.userId, {
      page,
      limit,
      search,
      industryType: industry,
    });
  }

  @Get('internships/:id')
  @Roles(Role.STUDENT)
  @ApiOperation({ summary: 'Get internship details' })
  @ApiResponse({ status: 200, description: 'Internship details retrieved successfully' })
  async getInternshipDetails(@Req() req, @Param('id') id: string) {
    return this.studentService.getInternshipDetails(req.user.userId, id);
  }

  @Post('internships/:id/apply')
  @Roles(Role.STUDENT)
  @ApiOperation({ summary: 'Apply for internship' })
  @ApiResponse({ status: 201, description: 'Application submitted successfully' })
  async applyForInternship(@Req() req, @Param('id') internshipId: string, @Body() applicationDto: any) {
    return this.studentService.applyToInternship(req.user.userId, internshipId, applicationDto);
  }

  @Get('applications')
  @Roles(Role.STUDENT)
  @ApiOperation({ summary: 'Get all student applications' })
  @ApiResponse({ status: 200, description: 'Applications retrieved successfully' })
  async getApplications(
    @Req() req,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('status') status?: string,
  ) {
    return this.studentService.getApplications(req.user.userId, { page, limit, status });
  }

  @Get('applications/:id')
  @Roles(Role.STUDENT)
  @ApiOperation({ summary: 'Get application details' })
  @ApiResponse({ status: 200, description: 'Application details retrieved successfully' })
  async getApplicationDetails(@Param('id') id: string) {
    return this.studentService.getApplicationDetails(id);
  }

  // Self-Identified Internships
  @Post('self-identified')
  @Roles(Role.STUDENT)
  @ApiOperation({ summary: 'Submit self-identified internship' })
  @ApiResponse({ status: 201, description: 'Self-identified internship submitted successfully' })
  async submitSelfIdentified(@Req() req, @Body() selfIdentifiedDto: any) {
    return this.studentService.submitSelfIdentified(req.user.userId, selfIdentifiedDto);
  }

  @Get('self-identified')
  @Roles(Role.STUDENT)
  @ApiOperation({ summary: 'Get self-identified internships' })
  @ApiResponse({ status: 200, description: 'Self-identified internships retrieved successfully' })
  async getSelfIdentified(
    @Req() req,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.studentService.getSelfIdentified(req.user.userId, { page, limit });
  }

  // Monthly Reports
  @Get('monthly-reports')
  @Roles(Role.STUDENT)
  @ApiOperation({ summary: 'Get all monthly reports' })
  @ApiResponse({ status: 200, description: 'Monthly reports retrieved successfully' })
  async getMonthlyReports(
    @Req() req,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.studentService.getMonthlyReports(req.user.userId, { page, limit });
  }

  @Post('monthly-reports')
  @Roles(Role.STUDENT)
  @ApiOperation({ summary: 'Submit monthly report' })
  @ApiResponse({ status: 201, description: 'Monthly report submitted successfully' })
  async submitMonthlyReport(@Req() req, @Body() reportDto: any) {
    return this.studentService.submitMonthlyReport(req.user.userId, reportDto);
  }

  @Put('monthly-reports/:id')
  @Roles(Role.STUDENT)
  @ApiOperation({ summary: 'Update monthly report' })
  @ApiResponse({ status: 200, description: 'Monthly report updated successfully' })
  async updateMonthlyReport(@Req() req, @Param('id') id: string, @Body() reportDto: any) {
    return this.studentService.updateMonthlyReport(req.user.userId, id, reportDto);
  }

  // Documents
  @Get('documents')
  @Roles(Role.STUDENT)
  @ApiOperation({ summary: 'Get all student documents' })
  @ApiResponse({ status: 200, description: 'Documents retrieved successfully' })
  async getDocuments(
    @Req() req,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('type') type?: string,
  ) {
    return this.studentService.getDocuments(req.user.userId, { page, limit, type });
  }

  @Post('documents')
  @Roles(Role.STUDENT)
  @ApiOperation({ summary: 'Upload document' })
  @ApiConsumes('multipart/form-data')
  @ApiResponse({ status: 201, description: 'Document uploaded successfully' })
  @UseInterceptors(FileInterceptor('file'))
  async uploadDocument(
    @Req() req,
    @UploadedFile() file: Express.Multer.File,
    @Body() documentDto: any,
  ) {
    return this.studentService.uploadDocument(req.user.userId, file, documentDto);
  }

  @Delete('documents/:id')
  @Roles(Role.STUDENT)
  @ApiOperation({ summary: 'Delete document' })
  @ApiResponse({ status: 200, description: 'Document deleted successfully' })
  async deleteDocument(@Param('id') id: string) {
    return this.studentService.deleteDocument(id);
  }

  // Support
  @Post('grievances')
  @Roles(Role.STUDENT)
  @ApiOperation({ summary: 'Submit grievance' })
  @ApiResponse({ status: 201, description: 'Grievance submitted successfully' })
  async submitGrievance(@Req() req, @Body() grievanceDto: any) {
    return this.studentService.submitGrievance(req.user.userId, grievanceDto);
  }

  @Get('grievances')
  @Roles(Role.STUDENT)
  @ApiOperation({ summary: 'Get all grievances' })
  @ApiResponse({ status: 200, description: 'Grievances retrieved successfully' })
  async getGrievances(
    @Req() req,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('status') status?: string,
  ) {
    return this.studentService.getGrievances(req.user.userId, { page, limit, status });
  }

  @Post('technical-queries')
  @Roles(Role.STUDENT)
  @ApiOperation({ summary: 'Submit technical query' })
  @ApiResponse({ status: 201, description: 'Technical query submitted successfully' })
  async submitTechnicalQuery(@Req() req, @Body() queryDto: any) {
    return this.studentService.submitTechnicalQuery(req.user.userId, queryDto);
  }
}
