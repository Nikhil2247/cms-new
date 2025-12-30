import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../core/database/prisma.service';
import { LruCacheService } from '../../../core/cache/lru-cache.service';
import { ApplicationStatus, Role } from '../../../generated/prisma/client';
import { AuditService } from '../../../infrastructure/audit/audit.service';
import { LookupService } from '../../shared/lookup.service';
import {
  calculateExpectedMonths,
  getExpectedReportsAsOfToday,
  getExpectedVisitsAsOfToday,
  MONTHLY_CYCLE,
} from '../../../common/utils/monthly-cycle.util';

@Injectable()
export class StateDashboardService {
  private readonly logger = new Logger(StateDashboardService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: LruCacheService,
    private readonly auditService: AuditService,
    private readonly lookupService: LookupService,
  ) {}

  /**
   * Get State Directorate Dashboard Statistics
   * Uses domain services where available, with state-level aggregation
   */
  async getDashboardStats() {
    const cacheKey = 'state:dashboard:stats';

    return this.cache.getOrSet(
      cacheKey,
      async () => {
        const now = new Date();
        const lastWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        const lastMonthDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

        // Current and previous month dates for detailed stats
        const currentMonth = now.getMonth() + 1;
        const currentYear = now.getFullYear();
        const prevMonth = currentMonth === 1 ? 12 : currentMonth - 1;
        const prevMonthYear = currentMonth === 1 ? currentYear - 1 : currentYear;

        // Start of current month and previous month
        const startOfCurrentMonth = new Date(currentYear, currentMonth - 1, 1);
        const startOfPrevMonth = new Date(prevMonthYear, prevMonth - 1, 1);
        const endOfPrevMonth = new Date(currentYear, currentMonth - 1, 0);

        // Use parallel queries for efficiency
        // Only count self-identified internships (not placement-based)
        const [
          totalInstitutions,
          activeInstitutions,
          totalStudents,
          activeStudents,
          totalFaculty,
          activeFaculty,
          totalSelfIdentifiedInternships,
          activeSelfIdentifiedInternships,
          totalApplications,
          acceptedApplications,
          totalIndustries,
          approvedIndustries,
          // Mentor assignments
          totalAssignments,
          activeAssignments,
          studentsWithActiveMentorsData, // Unique students with active mentors (array)
          internshipsWithMentorsData, // Students with internships who have mentors (array)
          // Faculty visits
          visitsThisMonth,
          visitsLastMonth,
          totalFacultyVisits,
          // Monthly reports
          reportsSubmittedThisMonth,
          reportsSubmittedLastMonth,
          reportsPendingReview,
          reportsApprovedThisMonth,
          totalReportsSubmitted,
          // Recent activity
          recentApplications,
          recentIndustryRegistrations,
        ] = await this.prisma.$transaction([
          this.prisma.institution.count(),
          this.prisma.institution.count({ where: { isActive: true } }),
          this.prisma.student.count(),
          this.prisma.student.count({ where: { isActive: true } }),
          this.prisma.user.count({
            where: { role: { in: [Role.TEACHER, Role.FACULTY_SUPERVISOR] } },
          }),
          this.prisma.user.count({
            where: {
              role: { in: [Role.TEACHER, Role.FACULTY_SUPERVISOR] },
              active: true,
            },
          }),
          // Count self-identified internships only
          this.prisma.internshipApplication.count({
            where: { isSelfIdentified: true },
          }),
          this.prisma.internshipApplication.count({
            where: {
              isSelfIdentified: true,
              status: ApplicationStatus.APPROVED,
            },
          }),
          // All application counts are for self-identified only
          this.prisma.internshipApplication.count({
            where: { isSelfIdentified: true },
          }),
          this.prisma.internshipApplication.count({
            where: { isSelfIdentified: true, status: ApplicationStatus.APPROVED },
          }),
          this.prisma.industry.count(),
          this.prisma.industry.count({
            where: { isApproved: true, isVerified: true },
          }),
          // Mentor assignments - count records (for reference)
          this.prisma.mentorAssignment.count(),
          this.prisma.mentorAssignment.count({ where: { isActive: true } }),
          // Unique students with active mentor assignments (all students with mentors)
          this.prisma.mentorAssignment.findMany({
            where: {
              isActive: true,
            },
            select: { studentId: true },
            distinct: ['studentId'],
          }),
          // Internships with mentors (students with approved internships who have active mentors)
          this.prisma.mentorAssignment.findMany({
            where: {
              isActive: true,
              student: {
                internshipApplications: {
                  some: {
                    isSelfIdentified: true,
                    status: ApplicationStatus.APPROVED,
                  },
                },
              },
            },
            select: { studentId: true },
            distinct: ['studentId'],
          }),
          // Faculty visits - this month (only for internships that have started)
          this.prisma.facultyVisitLog.count({
            where: {
              visitDate: { gte: startOfCurrentMonth },
              application: {
                startDate: { lte: now },
              },
            },
          }),
          // Faculty visits - last month (only for internships that have started)
          this.prisma.facultyVisitLog.count({
            where: {
              visitDate: { gte: startOfPrevMonth, lte: endOfPrevMonth },
              application: {
                startDate: { lte: now },
              },
            },
          }),
          // Total faculty visits (only for internships that have started)
          this.prisma.facultyVisitLog.count({
            where: {
              application: {
                startDate: { lte: now },
              },
            },
          }),
          // Monthly reports - submitted this month (with auto-approval, all are APPROVED)
          this.prisma.monthlyReport.count({
            where: {
              reportMonth: currentMonth,
              reportYear: currentYear,
              status: 'APPROVED',
            },
          }),
          // Monthly reports - submitted last month (with auto-approval, all are APPROVED)
          this.prisma.monthlyReport.count({
            where: {
              reportMonth: prevMonth,
              reportYear: prevMonthYear,
              status: 'APPROVED',
            },
          }),
          // Monthly reports - pending review (should be 0 with auto-approval, kept for legacy)
          this.prisma.monthlyReport.count({ where: { status: 'SUBMITTED' } }),
          // Monthly reports - approved this month
          this.prisma.monthlyReport.count({
            where: {
              reportMonth: currentMonth,
              reportYear: currentYear,
              status: 'APPROVED',
            },
          }),
          // Total reports submitted (with auto-approval, all are APPROVED)
          this.prisma.monthlyReport.count({
            where: { status: 'APPROVED' },
          }),
          // Recent activity
          this.prisma.internshipApplication.count({
            where: { isSelfIdentified: true, createdAt: { gte: lastWeek } },
          }),
          this.prisma.industry.count({
            where: { createdAt: { gte: lastMonthDate } },
          }),
        ]);

        // Get count from the distinct studentIds arrays
        const studentsWithActiveMentors = studentsWithActiveMentorsData.length;
        const internshipsWithMentors = internshipsWithMentorsData.length;

        // Calculate students without mentor assignments
        // Students with no mentor (total students - students with active mentors)
        const studentsWithNoMentor = Math.max(0, totalStudents - studentsWithActiveMentors);

        // Fetch internships currently in their training period with dates for monthly cycle calculation
        // Requires startDate to be set and in the past, with endDate in the future or not set
        const internshipsInTraining = await this.prisma.internshipApplication.findMany({
          where: {
            isSelfIdentified: true,
            status: ApplicationStatus.APPROVED,
            startDate: { not: null, lte: now },
            OR: [
              { endDate: { gte: now } },
              { endDate: null },
            ],
          },
          select: {
            id: true,
            startDate: true,
            endDate: true,
          },
        });

        const internshipsCurrentlyInTraining = internshipsInTraining.length;

        /**
         * Calculate expected reports/visits using monthly cycles
         * @see COMPLIANCE_CALCULATION_ANALYSIS.md Section V (Q47-49)
         *
         * For each internship:
         * - Reports: 1 per month (due on the 5th of the following month)
         * - Visits: 1 per month (due at month end)
         *
         * "Expected this month" = sum of all months where submission deadline has passed
         *
         * OPTIMIZED: Use helper functions instead of calculating full cycle objects
         */
        let expectedReportsThisMonth = 0;
        let expectedVisitsThisMonth = 0;

        for (const internship of internshipsInTraining) {
          // startDate is guaranteed to be set by the query filter
          try {
            const endDate = internship.endDate || new Date(now.getTime() + 180 * 24 * 60 * 60 * 1000); // Default 6 months if no end date

            // Use optimized helper functions - much faster than building full cycle objects
            expectedReportsThisMonth += getExpectedReportsAsOfToday(internship.startDate!, endDate);
            expectedVisitsThisMonth += getExpectedVisitsAsOfToday(internship.startDate!, endDate);
          } catch (error) {
            // Skip internships with invalid dates
            this.logger.warn(`Invalid dates for internship ${internship.id}: ${error.message}`);
            continue;
          }
        }

        const missingReportsThisMonth = Math.max(0, expectedReportsThisMonth - reportsSubmittedThisMonth);
        // Note: missingReportsLastMonth should use last month's expected count, but we don't have historical data
        // For now, use this month's expected as an approximation (most internships are long-term)
        const missingReportsLastMonth = Math.max(0, expectedReportsThisMonth - reportsSubmittedLastMonth);
        const pendingVisitsThisMonth = Math.max(0, expectedVisitsThisMonth - visitsThisMonth);

        return {
          institutions: {
            total: totalInstitutions,
            active: activeInstitutions,
          },
          students: {
            total: totalStudents,
            active: activeStudents,
          },
          faculty: {
            total: totalFaculty,
            active: activeFaculty,
          },
          totalFaculty,
          activeFaculty,
          internships: {
            total: totalSelfIdentifiedInternships,
            active: activeSelfIdentifiedInternships,
          },
          applications: {
            total: totalApplications,
            accepted: acceptedApplications,
            approvalRate: totalApplications > 0
              ? Math.round((acceptedApplications / totalApplications) * 100)
              : 0,
          },
          industries: {
            total: totalIndustries,
            approved: approvedIndustries,
          },
          // Mentor Assignments Card - uses unique students with mentors, not assignment records
          assignments: {
            total: totalAssignments, // Total assignment records (for reference)
            active: activeAssignments, // Active assignment records (for reference)
            assigned: studentsWithActiveMentors, // Unique students who have active mentors
            unassigned: studentsWithNoMentor, // Students with no mentor
            totalStudents, // Total students for reference
            studentsWithInternships: activeSelfIdentifiedInternships, // Total approved internships
            internshipsWithMentors, // Internships with mentors assigned
            internshipsWithoutMentors: activeSelfIdentifiedInternships - internshipsWithMentors, // Internships without mentors
          },
          // Faculty Visits Card with details
          facultyVisits: {
            total: totalFacultyVisits,
            thisMonth: visitsThisMonth,
            lastMonth: visitsLastMonth,
            expectedThisMonth: expectedVisitsThisMonth,
            pendingThisMonth: pendingVisitsThisMonth,
            // Return null when no data to show N/A on frontend
            completionRate: expectedVisitsThisMonth > 0
              ? Math.round((visitsThisMonth / expectedVisitsThisMonth) * 100)
              : null,
          },
          // Monthly Reports Card with details
          monthlyReports: {
            total: totalReportsSubmitted,
            thisMonth: reportsSubmittedThisMonth,
            lastMonth: reportsSubmittedLastMonth,
            pendingReview: reportsPendingReview,
            approvedThisMonth: reportsApprovedThisMonth,
            expectedThisMonth: expectedReportsThisMonth,
            missingThisMonth: missingReportsThisMonth,
            missingLastMonth: missingReportsLastMonth,
            // Return null when no data to show N/A on frontend
            submissionRate: expectedReportsThisMonth > 0
              ? Math.round((reportsSubmittedThisMonth / expectedReportsThisMonth) * 100)
              : null,
          },
          compliance: {
            totalVisits: totalFacultyVisits,
            pendingReports: reportsPendingReview,
          },
          recentActivity: {
            applicationsLastWeek: recentApplications,
            industriesLastMonth: recentIndustryRegistrations,
          },
        };
      },
      { ttl: 900, tags: ['state', 'dashboard'] }, // OPTIMIZED: Increased from 5 to 15 minutes - data rarely changes
    );
  }

  // Backwards-compatible alias
  async getDashboard() {
    return this.getDashboardStats();
  }

  /**
   * Get critical alerts for state dashboard
   * Returns institutions with compliance < 50%, students without mentors for > 7 days,
   * missing monthly reports (overdue by > 5 days), and faculty visit gaps (> 30 days)
   */
  async getCriticalAlerts(getInstitutionsWithStats: (params: any) => Promise<any>) {
    const cacheKey = 'state:dashboard:critical-alerts';

    return this.cache.getOrSet(
      cacheKey,
      async () => {
        const now = new Date();
        const currentMonth = now.getMonth() + 1;
        const currentYear = now.getFullYear();
        const fiveDaysAgo = new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000);
        const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

        // Run all independent queries in parallel
        const [
          institutionsWithStats,
          studentsWithoutMentors,
          missingReports,
          institutions,
          allLastVisits,
        ] = await Promise.all([
          // 1. Get institutions with stats
          getInstitutionsWithStats({ page: 1, limit: 100 }),

          // 2. All students without mentors (no day limit)
          this.prisma.student.findMany({
            where: {
              isActive: true,
              mentorAssignments: {
                none: { isActive: true },
              },
            },
            select: {
              id: true,
              name: true,
              rollNumber: true,
              Institution: { select: { id: true, name: true, code: true } },
              internshipApplications: {
                where: { isSelfIdentified: true, status: ApplicationStatus.APPROVED },
                orderBy: { createdAt: 'desc' },
                take: 1,
                select: { createdAt: true, startDate: true },
              },
            },
            take: 50,
          }),

          // 3. Missing monthly reports (overdue by > 5 days since internship start)
          // Only check students whose internships started more than 5 days ago
          // With auto-approval, all submitted reports are APPROVED
          this.prisma.student.findMany({
            where: {
              isActive: true,
              internshipApplications: {
                some: {
                  isSelfIdentified: true,
                  status: ApplicationStatus.APPROVED,
                  startDate: { lte: fiveDaysAgo },
                },
              },
              monthlyReports: {
                none: {
                  reportMonth: currentMonth,
                  reportYear: currentYear,
                  status: 'APPROVED',
                },
              },
            },
            select: {
              id: true,
              name: true,
              rollNumber: true,
              Institution: { select: { id: true, name: true, code: true } },
            },
            take: 20,
          }),

          // 4. Get all institutions (cached via LookupService)
          this.lookupService.getInstitutions().then(data => data.institutions),

          // 5. Get last visit per institution using raw aggregation - avoiding N+1
          this.prisma.facultyVisitLog.groupBy({
            by: ['applicationId'],
            _max: { visitDate: true },
          }),
        ]);

        // Calculate low compliance institutions (using pre-calculated complianceScore)
        const lowCompliance = institutionsWithStats.data
          .filter((inst: any) => {
            // Only include institutions with students and compliance score < 50%
            return inst.stats.totalStudents > 0 && inst.stats.complianceScore < 50;
          })
          .map((inst: any) => ({
            institutionId: inst.id,
            institutionName: inst.name,
            institutionCode: inst.code,
            city: inst.city,
            complianceScore: inst.stats.complianceScore,
          }));

        // Calculate visit gaps efficiently - get last visit per institution in batch
        const applicationIds = allLastVisits.map(v => v.applicationId);
        const applicationsWithInstitution = applicationIds.length > 0
          ? await this.prisma.internshipApplication.findMany({
              where: { id: { in: applicationIds } },
              select: {
                id: true,
                student: { select: { institutionId: true } },
              },
            })
          : [];

        // Build map of institution -> last visit date
        const institutionLastVisit = new Map<string, Date>();
        for (const app of applicationsWithInstitution) {
          const visitInfo = allLastVisits.find(v => v.applicationId === app.id);
          if (visitInfo?._max.visitDate) {
            const instId = app.student.institutionId;
            const existingDate = institutionLastVisit.get(instId);
            const visitDate = new Date(visitInfo._max.visitDate);
            if (!existingDate || visitDate > existingDate) {
              institutionLastVisit.set(instId, visitDate);
            }
          }
        }

        // Find institutions with visit gaps
        const visitGaps: any[] = [];
        for (const inst of institutions) {
          const lastVisitDate = institutionLastVisit.get(inst.id);
          if (lastVisitDate && lastVisitDate < thirtyDaysAgo) {
            const daysSince = Math.floor((now.getTime() - lastVisitDate.getTime()) / (1000 * 60 * 60 * 24));
            visitGaps.push({
              institutionId: inst.id,
              institutionName: inst.name,
              institutionCode: inst.code,
              lastVisitDate: lastVisitDate,
              daysSinceLastVisit: daysSince,
            });
          }
        }

        return {
          timestamp: now.toISOString(),
          summary: {
            totalAlerts: lowCompliance.length + studentsWithoutMentors.length + missingReports.length + visitGaps.length,
            lowComplianceCount: lowCompliance.length,
            studentsWithoutMentorsCount: studentsWithoutMentors.length,
            missingReportsCount: missingReports.length,
            visitGapsCount: visitGaps.length,
          },
          alerts: {
            lowComplianceInstitutions: lowCompliance,
            studentsWithoutMentors: studentsWithoutMentors.map(s => {
              const internship = s.internshipApplications[0];
              const startDate = internship?.startDate ? new Date(internship.startDate) : null;
              return {
                studentId: s.id,
                studentName: s.name,
                rollNumber: s.rollNumber,
                institutionId: s.Institution?.id,
                institutionName: s.Institution?.name,
                institutionCode: s.Institution?.code,
                hasInternship: !!internship,
                internshipStartDate: startDate?.toISOString() || null,
                daysSinceInternshipStarted: startDate
                  ? Math.floor((now.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24))
                  : null,
              };
            }),
            missingReports: missingReports.map(s => ({
              studentId: s.id,
              studentName: s.name,
              rollNumber: s.rollNumber,
              institutionId: s.Institution?.id,
              institutionName: s.Institution?.name,
              institutionCode: s.Institution?.code,
              daysOverdue: now.getDate() - 5,
            })),
            facultyVisitGaps: visitGaps,
          },
        };
      },
      { ttl: 900, tags: ['state', 'dashboard', 'alerts'] }, // OPTIMIZED: Increased from 5 to 15 minutes
    );
  }

  /**
   * Get action items for state dashboard
   * Returns pending approvals, institutions requiring intervention, and overdue compliance items
   */
  async getActionItems(getInstitutionsWithStats: (params: any) => Promise<any>) {
    const cacheKey = 'state:dashboard:action-items';

    return this.cache.getOrSet(
      cacheKey,
      async () => {
        const now = new Date();
        const currentMonth = now.getMonth() + 1;
        const currentYear = now.getFullYear();
        const fifteenDaysAgo = new Date(now.getTime() - 15 * 24 * 60 * 60 * 1000);

        // Run all independent queries in parallel
        const [pendingApprovals, institutionsWithStats, overdueItems] = await Promise.all([
          // 1. Pending principal approvals (industry registrations)
          this.prisma.industry.findMany({
            where: { isApproved: false },
            select: {
              id: true,
              companyName: true,
              industryType: true,
              city: true,
              state: true,
              createdAt: true,
              user: { select: { id: true, name: true, email: true } },
            },
            orderBy: { createdAt: 'asc' },
            take: 20,
          }),

          // 2. Get institutions with stats
          getInstitutionsWithStats({ page: 1, limit: 100 }),

          // 3. Overdue compliance items
          // With auto-approval, all submitted reports are APPROVED
          this.prisma.student.findMany({
            where: {
              isActive: true,
              internshipApplications: {
                some: {
                  isSelfIdentified: true,
                  status: ApplicationStatus.APPROVED,
                  createdAt: { lte: fifteenDaysAgo },
                },
              },
              monthlyReports: {
                none: {
                  reportMonth: currentMonth,
                  reportYear: currentYear,
                  status: 'APPROVED',
                },
              },
            },
            select: {
              id: true,
              name: true,
              rollNumber: true,
              Institution: { select: { id: true, name: true, code: true } },
            },
            take: 15,
          }),
        ]);

        // Institutions requiring intervention (compliance < 30%)
        // Use activeStudents as denominator per approved specification
        // Compliance = (MentorRate + JoiningLetterRate) / 2
        const requiresIntervention = institutionsWithStats.data
          .filter((inst: any) => {
            const { stats } = inst;
            // Use activeStudents as denominator
            if (stats.activeStudents === 0) return false;

            // 2-metric formula: MentorRate + JoiningLetterRate
            const assignmentRate = Math.min((stats.assigned / stats.activeStudents) * 100, 100);
            const joiningLetterRate = Math.min((stats.joiningLettersSubmitted / stats.activeStudents) * 100, 100);
            const overallCompliance = (assignmentRate + joiningLetterRate) / 2;
            return overallCompliance < 30;
          })
          .map((inst: any) => {
            const { stats } = inst;
            const assignmentRate = Math.min((stats.assigned / stats.activeStudents) * 100, 100);
            const joiningLetterRate = Math.min((stats.joiningLettersSubmitted / stats.activeStudents) * 100, 100);
            return {
              institutionId: inst.id,
              institutionName: inst.name,
              institutionCode: inst.code,
              city: inst.city,
              complianceScore: Math.round((assignmentRate + joiningLetterRate) / 2),
              issues: [
                stats.unassigned > 0 && `${stats.unassigned} students without mentors`,
                stats.facultyVisits === 0 && 'No faculty visits this month',
                stats.reportsMissing > 0 && `${stats.reportsMissing} missing reports`,
              ].filter(Boolean),
            };
          });

        return {
          timestamp: now.toISOString(),
          summary: {
            totalActionItems: pendingApprovals.length + requiresIntervention.length + overdueItems.length,
            pendingApprovalsCount: pendingApprovals.length,
            interventionRequiredCount: requiresIntervention.length,
            overdueComplianceCount: overdueItems.length,
          },
          actions: {
            pendingIndustryApprovals: pendingApprovals.map(p => ({
              industryId: p.id,
              companyName: p.companyName,
              industryType: p.industryType,
              city: p.city,
              state: p.state,
              submittedAt: p.createdAt,
              contactName: p.user?.name,
              contactEmail: p.user?.email,
              daysPending: Math.floor((now.getTime() - new Date(p.createdAt).getTime()) / (1000 * 60 * 60 * 24)),
              priority: Math.floor((now.getTime() - new Date(p.createdAt).getTime()) / (1000 * 60 * 60 * 24)) > 7 ? 'high' : 'normal',
            })),
            institutionsRequiringIntervention: requiresIntervention,
            overdueComplianceItems: overdueItems.map(s => ({
              studentId: s.id,
              studentName: s.name,
              rollNumber: s.rollNumber,
              institutionName: s.Institution?.name,
              institutionCode: s.Institution?.code,
              daysOverdue: 15,
              priority: 'high',
            })),
          },
        };
      },
      { ttl: 900, tags: ['state', 'dashboard', 'actions'] }, // OPTIMIZED: Increased from 5 to 15 minutes
    );
  }

  /**
   * Get compliance summary for state dashboard
   * Returns overall compliance metrics and breakdown by institution
   */
  async getComplianceSummary(getInstitutionsWithStats: (params: any) => Promise<any>) {
    const cacheKey = 'state:compliance:summary';

    return this.cache.getOrSet(
      cacheKey,
      async () => {
        const now = new Date();
        const currentMonth = now.getMonth() + 1;
        const currentYear = now.getFullYear();
        const startOfMonth = new Date(currentYear, currentMonth - 1, 1);

        // Run state-wide counts AND institution stats in parallel
        const [
          totalInstitutions,
          activeStudents,
          totalStudentsWithInternships,
          totalAssignments,
          totalJoiningLetters,
          totalVisitsThisMonth,
          totalReportsThisMonth,
          institutionsWithStats,
        ] = await Promise.all([
          this.prisma.institution.count({ where: { isActive: true } }),
          // Count active students (denominator for compliance)
          this.prisma.student.count({ where: { isActive: true } }),
          this.prisma.internshipApplication.count({
            where: {
              isSelfIdentified: true,
              status: ApplicationStatus.APPROVED,
            },
          }),
          // Count unique students with active mentor assignments
          this.prisma.mentorAssignment.findMany({
            where: {
              isActive: true,
            },
            select: { studentId: true },
            distinct: ['studentId'],
          }).then(results => results.length),
          // Count joining letters submitted (students with approved internships who have joining letter)
          this.prisma.internshipApplication.count({
            where: {
              isSelfIdentified: true,
              status: ApplicationStatus.APPROVED,
              joiningLetterUrl: { not: null },
            },
          }),
          this.prisma.facultyVisitLog.count({
            where: { visitDate: { gte: startOfMonth } },
          }),
          // With auto-approval, all submitted reports are APPROVED
          this.prisma.monthlyReport.count({
            where: {
              reportMonth: currentMonth,
              reportYear: currentYear,
              status: 'APPROVED',
            },
          }),
          // Run institution stats in parallel with state-wide counts
          getInstitutionsWithStats({ page: 1, limit: 100 }),
        ]);

        // Calculate state-wide compliance rates (cap at 100%, null when no data)
        // NEW FORMULA: Compliance = (MentorCoverage + JoiningLetterRate) / 2
        // Denominator: activeStudents (per approved specification)
        const mentorCoverageRate = activeStudents > 0
          ? Math.round(Math.min((totalAssignments / activeStudents) * 100, 100))
          : null;
        const joiningLetterRate = activeStudents > 0
          ? Math.round(Math.min((totalJoiningLetters / activeStudents) * 100, 100))
          : null;
        // Visit and report rates are tracked separately (NOT in compliance score)
        const visitComplianceRate = totalStudentsWithInternships > 0
          ? Math.round(Math.min((totalVisitsThisMonth / totalStudentsWithInternships) * 100, 100))
          : null;
        const reportComplianceRate = totalStudentsWithInternships > 0
          ? Math.round(Math.min((totalReportsThisMonth / totalStudentsWithInternships) * 100, 100))
          : null;
        // Calculate overall compliance from 2 metrics only (MentorCoverage + JoiningLetterRate)
        const stateValidRates = [mentorCoverageRate, joiningLetterRate].filter(r => r !== null) as number[];
        const overallCompliance = stateValidRates.length > 0
          ? Math.round(stateValidRates.reduce((a, b) => a + b, 0) / stateValidRates.length)
          : null;

        // Process institution-wise compliance breakdown (cap at 100%, null when no data)
        // NEW FORMULA: Compliance = (MentorCoverage + JoiningLetterRate) / 2
        // Denominator: activeStudents (per approved specification)
        const institutionCompliance = institutionsWithStats.data.map((inst: any) => {
          const { stats } = inst;
          // Use activeStudents as denominator for compliance metrics
          const mentorCov = stats.activeStudents > 0
            ? Math.round(Math.min((stats.assigned / stats.activeStudents) * 100, 100))
            : null;
          const joiningLetterCov = stats.activeStudents > 0
            ? Math.round(Math.min((stats.joiningLettersSubmitted / stats.activeStudents) * 100, 100))
            : null;
          // Visit and report rates tracked separately (NOT in compliance score)
          const visitComp = stats.studentsWithInternships > 0
            ? Math.round(Math.min((stats.facultyVisits / stats.studentsWithInternships) * 100, 100))
            : null;
          const reportComp = stats.studentsWithInternships > 0
            ? Math.round(Math.min((stats.reportsSubmitted / stats.studentsWithInternships) * 100, 100))
            : null;
          // Calculate overall from 2 metrics only (MentorCoverage + JoiningLetterRate)
          const instValidRates = [mentorCov, joiningLetterCov].filter(r => r !== null) as number[];
          const overall = instValidRates.length > 0
            ? Math.round(instValidRates.reduce((a, b) => a + b, 0) / instValidRates.length)
            : null;

          return {
            institutionId: inst.id,
            institutionName: inst.name,
            institutionCode: inst.code,
            city: inst.city,
            overallScore: overall,
            mentorCoverage: mentorCov,
            joiningLetterRate: joiningLetterCov,
            // Keep visit and report as separate tracked metrics (not in compliance)
            visitCompliance: visitComp,
            reportCompliance: reportComp,
            activeStudents: stats.activeStudents,
            studentsWithInternships: stats.studentsWithInternships,
            studentsWithMentors: stats.assigned,
            joiningLettersSubmitted: stats.joiningLettersSubmitted,
            visitsThisMonth: stats.facultyVisits,
            reportsThisMonth: stats.reportsSubmitted,
          };
        }).sort((a: any, b: any) => a.overallScore - b.overallScore);

        return {
          timestamp: now.toISOString(),
          month: currentMonth,
          year: currentYear,
          stateWide: {
            totalInstitutions,
            activeStudents,
            totalStudentsWithInternships,
            totalMentorAssignments: totalAssignments,
            totalJoiningLetters,
            totalVisitsThisMonth,
            totalReportsThisMonth,
            // Overall compliance based on 2 metrics: MentorCoverage + JoiningLetterRate
            overallComplianceScore: overallCompliance,
            mentorCoverageRate,
            joiningLetterRate,
            // Visit and report rates tracked separately (NOT in compliance score)
            visitComplianceRate,
            reportComplianceRate,
          },
          distribution: {
            excellent: institutionCompliance.filter((i: any) => i.overallScore >= 90).length,
            good: institutionCompliance.filter((i: any) => i.overallScore >= 70 && i.overallScore < 90).length,
            warning: institutionCompliance.filter((i: any) => i.overallScore >= 50 && i.overallScore < 70).length,
            critical: institutionCompliance.filter((i: any) => i.overallScore >= 30 && i.overallScore < 50).length,
            interventionRequired: institutionCompliance.filter((i: any) => i.overallScore !== null && i.overallScore < 30).length,
          },
          institutions: institutionCompliance,
        };
      },
      { ttl: 900, tags: ['state', 'compliance'] }, // OPTIMIZED: Increased from 5 to 15 minutes
    );
  }
}
