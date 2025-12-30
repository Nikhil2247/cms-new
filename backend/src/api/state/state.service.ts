import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client';

// Import sub-services
import { StateDashboardService } from './services/state-dashboard.service';
import { StateInstitutionService } from './services/state-institution.service';
import { StatePrincipalService } from './services/state-principal.service';
import { StateStaffService } from './services/state-staff.service';
import { StateReportsService } from './services/state-reports.service';
import { StateIndustryService } from './services/state-industry.service';
import { StateMentorService } from './services/state-mentor.service';

/**
 * State Service - Main facade that delegates to specialized sub-services
 *
 * This service acts as a facade/coordinator for all state-level operations.
 * Each sub-service handles a specific domain:
 * - StateDashboardService: Dashboard stats, alerts, compliance summary
 * - StateInstitutionService: Institution CRUD and details
 * - StatePrincipalService: Principal management
 * - StateStaffService: Staff and user management
 * - StateReportsService: Reports, analytics, performance metrics
 * - StateIndustryService: Industry approval and company management
 * - StateMentorService: Mentor assignment operations
 */
@Injectable()
export class StateService {
  private readonly logger = new Logger(StateService.name);

  constructor(
    private readonly dashboardService: StateDashboardService,
    private readonly institutionService: StateInstitutionService,
    private readonly principalService: StatePrincipalService,
    private readonly staffService: StateStaffService,
    private readonly reportsService: StateReportsService,
    private readonly industryService: StateIndustryService,
    private readonly mentorService: StateMentorService,
  ) {}

  // ==========================================
  // DASHBOARD & OVERVIEW METHODS
  // ==========================================

  async getDashboardStats() {
    return this.dashboardService.getDashboardStats();
  }

  async getDashboard() {
    return this.dashboardService.getDashboard();
  }

  async getCriticalAlerts() {
    // Pass getInstitutionsWithStats method for internal use
    return this.dashboardService.getCriticalAlerts(
      (params) => this.institutionService.getInstitutionsWithStats(params)
    );
  }

  async getActionItems() {
    return this.dashboardService.getActionItems(
      (params) => this.institutionService.getInstitutionsWithStats(params)
    );
  }

  async getComplianceSummary() {
    return this.dashboardService.getComplianceSummary(
      (params) => this.institutionService.getInstitutionsWithStats(params)
    );
  }

  // ==========================================
  // INSTITUTION METHODS
  // ==========================================

  async getInstitutions(params: {
    page?: number;
    limit?: number;
    search?: string;
    city?: string;
    isActive?: boolean;
  }) {
    return this.institutionService.getInstitutions(params);
  }

  async getInstitutionsWithStats(params: { page?: number; limit?: number; search?: string }) {
    return this.institutionService.getInstitutionsWithStats(params);
  }

  async getInstitutionById(id: string) {
    return this.institutionService.getInstitutionById(id);
  }

  async getInstitutionOverview(id: string) {
    return this.institutionService.getInstitutionOverview(id);
  }

  async getInstitutionStudents(
    institutionId: string,
    params: {
      cursor?: string;
      limit: number;
      search?: string;
      filter: 'assigned' | 'unassigned' | 'all';
      branch?: string;
      companyId?: string;
      reportStatus?: 'all' | 'submitted' | 'pending' | 'not_submitted';
      visitStatus?: 'all' | 'visited' | 'pending';
      selfIdentified?: 'all' | 'yes' | 'no';
      status?: 'active' | 'inactive' | 'all';
    },
  ) {
    return this.institutionService.getInstitutionStudents(institutionId, params);
  }

  async getInstitutionCompanies(id: string, params: { limit: number; search?: string }) {
    return this.institutionService.getInstitutionCompanies(id, params);
  }

  async getInstitutionFacultyAndPrincipal(id: string) {
    return this.institutionService.getInstitutionFacultyAndPrincipal(id);
  }

  async createInstitution(data: Prisma.InstitutionCreateInput, userId?: string) {
    return this.institutionService.createInstitution(data, userId);
  }

  async updateInstitution(id: string, data: Prisma.InstitutionUpdateInput, userId?: string) {
    return this.institutionService.updateInstitution(id, data, userId);
  }

  async deleteInstitution(id: string, userId?: string) {
    return this.institutionService.deleteInstitution(id, userId);
  }

  // ==========================================
  // PRINCIPAL METHODS
  // ==========================================

  async getPrincipals(params: {
    page?: number;
    limit?: number;
    institutionId?: string;
    search?: string;
  }) {
    return this.principalService.getPrincipals(params);
  }

  async createPrincipal(data: {
    name: string;
    email: string;
    password: string;
    phoneNo?: string;
    institutionId: string;
  }) {
    return this.principalService.createPrincipal(data);
  }

  async getPrincipalById(id: string) {
    return this.principalService.getPrincipalById(id);
  }

  async updatePrincipal(id: string, data: {
    name?: string;
    email?: string;
    phoneNo?: string;
    phone?: string;
    institutionId?: string;
    active?: boolean;
    designation?: string;
  }) {
    return this.principalService.updatePrincipal(id, data);
  }

  async deletePrincipal(id: string, deletedBy?: string) {
    return this.principalService.deletePrincipal(id, deletedBy);
  }

  async resetPrincipalPassword(id: string, resetBy?: string) {
    return this.principalService.resetPrincipalPassword(id, resetBy);
  }

  // ==========================================
  // STAFF METHODS
  // ==========================================

  async getStaff(params: {
    page?: number;
    limit?: number;
    institutionId?: string;
    role?: string;
    search?: string;
    branchName?: string;
    active?: boolean;
  }) {
    return this.staffService.getStaff(params);
  }

  async createStaff(data: {
    name: string;
    email: string;
    password: string;
    phoneNo?: string;
    role: string;
    institutionId: string;
    designation?: string;
  }) {
    return this.staffService.createStaff(data);
  }

  async getStaffById(id: string) {
    return this.staffService.getStaffById(id);
  }

  async updateStaff(id: string, data: {
    name?: string;
    email?: string;
    phoneNo?: string;
    role?: string;
    designation?: string;
    institutionId?: string;
    isActive?: boolean;
    active?: boolean;
  }) {
    return this.staffService.updateStaff(id, data);
  }

  async deleteStaff(id: string) {
    return this.staffService.deleteStaff(id);
  }

  async deleteFaculty(id: string) {
    return this.staffService.deleteFaculty(id);
  }

  async resetStaffPassword(id: string) {
    return this.staffService.resetStaffPassword(id);
  }

  async getUsers(params: {
    page?: number;
    limit?: number;
    search?: string;
    role?: string;
    institutionId?: string;
    active?: boolean;
  }) {
    return this.staffService.getUsers(params);
  }

  // ==========================================
  // REPORTS & ANALYTICS METHODS
  // ==========================================

  async getInstitutionPerformance(institutionId: string, params: {
    month?: number;
    year?: number;
    fromDate?: Date;
    toDate?: Date;
  }) {
    // Convert month/year to fromDate/toDate if provided
    let fromDate = params.fromDate;
    let toDate = params.toDate;

    if (params.month && params.year && !fromDate && !toDate) {
      fromDate = new Date(params.year, params.month - 1, 1);
      toDate = new Date(params.year, params.month, 0, 23, 59, 59);
    }

    return this.reportsService.getInstitutionPerformance(institutionId, { fromDate, toDate });
  }

  async getMonthlyReportStats(params: { month?: number; year?: number; institutionId?: string }) {
    return this.reportsService.getMonthlyReportStats(params);
  }

  async getInstitutionReports(params: {
    institutionId?: string;
    fromDate?: string;
    toDate?: string;
    reportType?: string;
  }) {
    return this.reportsService.getInstitutionReports(params);
  }

  async getAuditLogs(params: {
    page?: number;
    limit?: number;
    institutionId?: string;
    userId?: string;
    action?: string;
    fromDate?: string;
    toDate?: string;
  }) {
    return this.reportsService.getAuditLogs(params);
  }

  async getFacultyVisitStats(params: {
    month?: number;
    year?: number;
    institutionId?: string;
    facultyId?: string;
    fromDate?: Date;
    toDate?: Date;
  }) {
    // Convert month/year to fromDate/toDate if provided
    let fromDate = params.fromDate;
    let toDate = params.toDate;

    if (params.month && params.year && !fromDate && !toDate) {
      fromDate = new Date(params.year, params.month - 1, 1);
      toDate = new Date(params.year, params.month, 0, 23, 59, 59);
    }

    return this.reportsService.getFacultyVisitStats({
      institutionId: params.institutionId,
      facultyId: params.facultyId,
      fromDate,
      toDate,
    });
  }

  async getTopPerformers(params: { limit?: number; month?: number; year?: number }) {
    return this.reportsService.getTopPerformers(params);
  }

  async getStateWidePlacementTrends(years: number = 5) {
    return this.reportsService.getStateWidePlacementTrends(years);
  }

  async getStateWidePlacementStats() {
    return this.reportsService.getStateWidePlacementStats();
  }

  async getMonthlyAnalytics(params: { month?: number; year?: number; institutionId?: string }) {
    return this.reportsService.getMonthlyAnalytics(params);
  }

  // ==========================================
  // INDUSTRY & COMPANY METHODS
  // ==========================================

  async approveIndustry(industryId: string, approvedBy: string) {
    return this.industryService.approveIndustry(industryId, approvedBy);
  }

  async rejectIndustry(industryId: string, reason?: string, rejectedBy?: string) {
    return this.industryService.rejectIndustry(industryId, reason, rejectedBy);
  }

  async getPendingIndustries(params: { page?: number; limit?: number }) {
    return this.industryService.getPendingIndustries(params);
  }

  async getTopIndustries(params: { limit?: number }) {
    return this.industryService.getTopIndustries(params);
  }

  async getJoiningLetterStats() {
    return this.reportsService.getJoiningLetterStats();
  }

  async getAllCompanies(params: {
    page?: number;
    limit?: number;
    search?: string;
    industryType?: string;
    sortBy?: 'studentCount' | 'institutionCount' | 'companyName';
    sortOrder?: 'asc' | 'desc';
  }) {
    return this.industryService.getAllCompanies(params);
  }

  async getCompanyDetails(companyId: string) {
    return this.industryService.getCompanyDetails(companyId);
  }

  // ==========================================
  // MENTOR METHODS
  // ==========================================

  async getAllMentors(params?: { search?: string; institutionId?: string }) {
    return this.mentorService.getAllMentors(params);
  }

  async getInstitutionMentors(institutionId: string) {
    return this.mentorService.getInstitutionMentors(institutionId);
  }

  async assignMentorToStudent(studentId: string, mentorId: string, assignedBy: string) {
    return this.mentorService.assignMentorToStudent(studentId, mentorId, assignedBy);
  }

  async removeMentorFromStudent(studentId: string, removedBy: string) {
    return this.mentorService.removeMentorFromStudent(studentId, removedBy);
  }

  async deleteStudent(studentId: string, deletedBy: string) {
    return this.mentorService.deleteStudent(studentId, deletedBy);
  }
}
