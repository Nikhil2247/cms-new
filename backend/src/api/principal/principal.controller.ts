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
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiConsumes } from '@nestjs/swagger';
import { PrincipalService } from './principal.service';
import { JwtAuthGuard } from '../../core/auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../core/auth/guards/roles.guard';
import { Roles } from '../../core/auth/decorators/roles.decorator';
import { Role } from '@prisma/client';
import { CreateStudentDto } from './dto/create-student.dto';
import { UpdateStudentDto } from './dto/update-student.dto';
import { CreateStaffDto } from './dto/create-staff.dto';
import { AssignMentorDto } from './dto/assign-mentor.dto';

@ApiTags('Principal')
@ApiBearerAuth()
@Controller('principal')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.PRINCIPAL)
export class PrincipalController {
  constructor(private readonly principalService: PrincipalService) {}

  // Dashboard
  @Get('dashboard')
  @ApiOperation({ summary: 'Get principal dashboard overview' })
  async getDashboard(@Request() req) {
    return this.principalService.getDashboard(req.user.userId);
  }

  @Get('dashboard/alerts')
  @ApiOperation({ summary: 'Get pending actions and alerts' })
  async getDashboardAlerts(@Request() req) {
    return this.principalService.getDashboardAlerts(req.user.userId);
  }

  // Institution Management
  @Get('institution')
  @ApiOperation({ summary: 'Get own institution details' })
  async getInstitution(@Request() req) {
    return this.principalService.getInstitution(req.user.userId);
  }

  @Put('institution')
  @ApiOperation({ summary: 'Update institution details' })
  async updateInstitution(@Request() req, @Body() updateData: any) {
    return this.principalService.updateInstitution(req.user.userId, updateData);
  }

  // Student Management
  @Get('students/progress')
  @ApiOperation({ summary: 'Get student internship progress with reports' })
  async getStudentProgress(@Request() req, @Query() query: any) {
    return this.principalService.getStudentProgress(req.user.userId, query);
  }

  @Get('students')
  @ApiOperation({ summary: 'Get paginated list of students' })
  async getStudents(@Request() req, @Query() query: any) {
    return this.principalService.getStudents(req.user.userId, query);
  }

  @Get('students/:id')
  @ApiOperation({ summary: 'Get student details by ID' })
  async getStudentById(@Request() req, @Param('id') id: string) {
    return this.principalService.getStudentById(req.user.userId, id);
  }

  @Post('students')
  @ApiOperation({ summary: 'Create new student' })
  async createStudent(@Request() req, @Body() createStudentDto: CreateStudentDto) {
    return this.principalService.createStudent(req.user.userId, createStudentDto);
  }

  @Put('students/:id')
  @ApiOperation({ summary: 'Update student details' })
  async updateStudent(
    @Request() req,
    @Param('id') id: string,
    @Body() updateStudentDto: UpdateStudentDto,
  ) {
    return this.principalService.updateStudent(req.user.userId, id, updateStudentDto);
  }

  @Delete('students/:id')
  @ApiOperation({ summary: 'Delete student (soft delete)' })
  async deleteStudent(@Request() req, @Param('id') id: string) {
    return this.principalService.deleteStudent(req.user.userId, id);
  }

  @Post('students/bulk-upload')
  @ApiOperation({ summary: 'Bulk upload students from file' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file'))
  async bulkUploadStudents(@Request() req, @UploadedFile() file: Express.Multer.File) {
    return this.principalService.bulkUploadStudents(req.user.userId, [file]);
  }

  // Staff Management
  @Post('staff/bulk-upload')
  @ApiOperation({ summary: 'Bulk upload staff from file' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file'))
  async bulkUploadStaff(@Request() req, @UploadedFile() file: Express.Multer.File) {
    return this.principalService.bulkUploadStaff(req.user.userId, [file]);
  }
  @Get('staff')
  @ApiOperation({ summary: 'Get institution staff list' })
  async getStaff(@Request() req, @Query() query: any) {
    return this.principalService.getStaff(req.user.userId, query);
  }

  @Post('staff')
  @ApiOperation({ summary: 'Create new staff member' })
  async createStaff(@Request() req, @Body() createStaffDto: CreateStaffDto) {
    return this.principalService.createStaff(req.user.userId, createStaffDto);
  }

  @Put('staff/:id')
  @ApiOperation({ summary: 'Update staff details' })
  async updateStaff(@Request() req, @Param('id') id: string, @Body() updateData: any) {
    return this.principalService.updateStaff(req.user.userId, id, updateData);
  }

  @Delete('staff/:id')
  @ApiOperation({ summary: 'Delete staff member' })
  async deleteStaff(@Request() req, @Param('id') id: string) {
    return this.principalService.deleteStaff(req.user.userId, id);
  }

  // Mentor Management
  @Get('mentors')
  @ApiOperation({ summary: 'Get list of mentors' })
  async getMentors(@Request() req) {
    return this.principalService.getMentors(req.user.userId);
  }

  @Get('mentors/assignments')
  @ApiOperation({ summary: 'Get mentor-student assignments' })
  async getMentorAssignments(@Request() req) {
    return this.principalService.getMentorAssignments(req.user.userId);
  }

  @Post('mentors/assign')
  @ApiOperation({ summary: 'Assign mentor to students' })
  async assignMentor(@Request() req, @Body() assignMentorDto: AssignMentorDto) {
    return this.principalService.assignMentor(req.user.userId, assignMentorDto);
  }

  @Get('mentors/stats')
  @ApiOperation({ summary: 'Get mentor assignment statistics' })
  async getMentorStats(@Request() req) {
    return this.principalService.getMentorStats(req.user.userId);
  }

  @Delete('students/:id/mentor')
  @ApiOperation({ summary: 'Remove mentor assignment from student' })
  async removeMentorAssignment(@Request() req, @Param('id') studentId: string) {
    return this.principalService.removeMentorAssignment(req.user.userId, studentId);
  }

  @Post('mentors/bulk-unassign')
  @ApiOperation({ summary: 'Bulk unassign mentors from students' })
  async bulkUnassignMentors(@Request() req, @Body() body: { studentIds: string[] }) {
    return this.principalService.bulkUnassignMentors(req.user.userId, body.studentIds);
  }

  @Post('mentors/auto-assign')
  @ApiOperation({ summary: 'Auto-assign unassigned students to mentors evenly' })
  async autoAssignMentors(@Request() req) {
    return this.principalService.autoAssignMentors(req.user.userId);
  }

  // Reports
  @Get('faculty/reports')
  @ApiOperation({ summary: 'Get faculty visit reports with stats for principal dashboard' })
  async getFacultyReportsForDashboard(@Request() req, @Query() query: any) {
    return this.principalService.getFacultyReportsForDashboard(req.user.userId, query);
  }

  @Get('reports/pending-by-month')
  @ApiOperation({ summary: 'Get pending/missing reports grouped by month' })
  async getPendingReportsByMonth(@Request() req, @Query() query: any) {
    return this.principalService.getPendingReportsByMonth(req.user.userId, query);
  }

  @Get('reports/students')
  @ApiOperation({ summary: 'Get student reports' })
  async getStudentReports(@Request() req, @Query() query: any) {
    return this.principalService.getStudentReports(req.user.userId, query);
  }

  @Get('reports/faculty-visits')
  @ApiOperation({ summary: 'Get faculty visit reports' })
  async getFacultyVisitReports(@Request() req, @Query() query: any) {
    return this.principalService.getFacultyVisitReports(req.user.userId, query);
  }

  @Get('reports/monthly')
  @ApiOperation({ summary: 'Get monthly reports' })
  async getMonthlyReports(@Request() req, @Query() query: any) {
    return this.principalService.getMonthlyReports(req.user.userId, query);
  }

  // Academic Management
  @Get('batches')
  @ApiOperation({ summary: 'Get institution batches' })
  async getBatches(@Request() req) {
    return this.principalService.getBatches(req.user.userId);
  }

  @Post('batches')
  @ApiOperation({ summary: 'Create new batch' })
  async createBatch(@Request() req, @Body() batchData: any) {
    return this.principalService.createBatch(req.user.userId, batchData);
  }

  @Get('semesters')
  @ApiOperation({ summary: 'Get institution semesters' })
  async getSemesters(@Request() req) {
    return this.principalService.getSemesters(req.user.userId);
  }

  @Get('subjects')
  @ApiOperation({ summary: 'Get institution subjects' })
  async getSubjects(@Request() req) {
    return this.principalService.getSubjects(req.user.userId);
  }

  // Analytics
  @Get('analytics')
  @ApiOperation({ summary: 'Get institution analytics' })
  async getAnalytics(@Request() req) {
    return this.principalService.getAnalytics(req.user.userId);
  }

  @Get('internships/stats')
  @ApiOperation({ summary: 'Get internship statistics' })
  async getInternshipStats(@Request() req) {
    return this.principalService.getInternshipStats(req.user.userId);
  }

  @Get('placements/stats')
  @ApiOperation({ summary: 'Get placement statistics' })
  async getPlacementStats(@Request() req) {
    return this.principalService.getPlacementStats(req.user.userId);
  }
}
