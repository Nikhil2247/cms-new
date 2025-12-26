import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../core/database/prisma.service';
import { LruCacheService } from '../../../core/cache/lru-cache.service';
import { ApplicationStatus, Role } from '@prisma/client';
import { AuditService } from '../../../infrastructure/audit/audit.service';

@Injectable()
export class StateDashboardService {
  private readonly logger = new Logger(StateDashboardService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: LruCacheService,
    private readonly auditService: AuditService,
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
          // Faculty visits - this month
          this.prisma.facultyVisitLog.count({
            where: { visitDate: { gte: startOfCurrentMonth } },
          }),
          // Faculty visits - last month
          this.prisma.facultyVisitLog.count({
            where: { visitDate: { gte: startOfPrevMonth, lte: endOfPrevMonth } },
          }),
          // Total faculty visits
          this.prisma.facultyVisitLog.count(),
          // Monthly reports - submitted this month
          this.prisma.monthlyReport.count({
            where: {
              reportMonth: currentMonth,
              reportYear: currentYear,
              status: { in: ['SUBMITTED', 'APPROVED'] },
            },
          }),
          // Monthly reports - submitted last month
          this.prisma.monthlyReport.count({
            where: {
              reportMonth: prevMonth,
              reportYear: prevMonthYear,
              status: { in: ['SUBMITTED', 'APPROVED'] },
            },
          }),
          // Monthly reports - pending review
          this.prisma.monthlyReport.count({ where: { status: 'SUBMITTED' } }),
          // Monthly reports - approved this month
          this.prisma.monthlyReport.count({
            where: {
              reportMonth: currentMonth,
              reportYear: currentYear,
              status: 'APPROVED',
            },
          }),
          // Total reports submitted
          this.prisma.monthlyReport.count({
            where: { status: { in: ['SUBMITTED', 'APPROVED'] } },
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

        // Count internships currently in their training period
        // Include: startDate is NULL (legacy data) OR (startDate <= now AND (endDate >= now OR endDate IS NULL))
        const internshipsCurrentlyInTraining = await this.prisma.internshipApplication.count({
          where: {
            isSelfIdentified: true,
            status: ApplicationStatus.APPROVED,
            OR: [
              // No startDate set - treat as active (legacy data)
              { startDate: null },
              // Has startDate and is currently in training
              {
                startDate: { lte: now },
                OR: [
                  { endDate: { gte: now } },
                  { endDate: null },
                ],
              },
            ],
          },
        });

        // Calculate expected reports and visits based on internships CURRENTLY in training period
        // Not all approved internships - only those where current month is within training dates
        const expectedReportsThisMonth = internshipsCurrentlyInTraining;
        const missingReportsThisMonth = Math.max(0, expectedReportsThisMonth - reportsSubmittedThisMonth);
        const missingReportsLastMonth = Math.max(0, expectedReportsThisMonth - reportsSubmittedLastMonth);
        const expectedVisitsThisMonth = internshipsCurrentlyInTraining;
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
              ? ((acceptedApplications / totalApplications) * 100).toFixed(2)
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
            completionRate: expectedVisitsThisMonth > 0
              ? ((visitsThisMonth / expectedVisitsThisMonth) * 100).toFixed(1)
              : '100',
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
            submissionRate: expectedReportsThisMonth > 0
              ? ((reportsSubmittedThisMonth / expectedReportsThisMonth) * 100).toFixed(1)
              : '100',
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
      { ttl: 300, tags: ['state', 'dashboard'] },
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
        const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
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

          // 2. Students without mentors for > 7 days since internship start
          // Use startDate instead of createdAt for grace period
          this.prisma.student.findMany({
            where: {
              isActive: true,
              internshipApplications: {
                some: {
                  isSelfIdentified: true,
                  status: ApplicationStatus.APPROVED,
                  startDate: { lte: sevenDaysAgo },
                },
              },
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
                select: { createdAt: true },
              },
            },
            take: 20,
          }),

          // 3. Missing monthly reports (overdue by > 5 days since internship start)
          // Only check students whose internships started more than 5 days ago
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
                  status: { in: ['SUBMITTED', 'APPROVED'] },
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

          // 4. Get all institutions
          this.prisma.institution.findMany({
            where: { isActive: true },
            select: { id: true, name: true, code: true },
          }),

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
            studentsWithoutMentors: studentsWithoutMentors.map(s => ({
              studentId: s.id,
              studentName: s.name,
              rollNumber: s.rollNumber,
              institutionId: s.Institution?.id,
              institutionName: s.Institution?.name,
              institutionCode: s.Institution?.code,
              daysSinceInternshipStarted: s.internshipApplications[0]
                ? Math.floor((now.getTime() - new Date(s.internshipApplications[0].createdAt).getTime()) / (1000 * 60 * 60 * 24))
                : null,
            })),
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
      { ttl: 300, tags: ['state', 'dashboard', 'alerts'] },
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
                  status: { in: ['SUBMITTED', 'APPROVED'] },
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
        // Use selfIdentifiedApproved as denominator for consistency with main dashboard
        const requiresIntervention = institutionsWithStats.data
          .filter((inst: any) => {
            const { stats } = inst;
            if (stats.selfIdentifiedApproved === 0) return false;

            const assignmentRate = (stats.assigned / stats.selfIdentifiedApproved) * 100;
            const visitRate = stats.facultyVisits > 0
              ? Math.min((stats.facultyVisits / stats.selfIdentifiedApproved) * 100, 100)
              : 0;
            const reportRate = (stats.reportsSubmitted / stats.selfIdentifiedApproved) * 100;
            const overallCompliance = (assignmentRate + visitRate + reportRate) / 3;
            return overallCompliance < 30;
          })
          .map((inst: any) => ({
            institutionId: inst.id,
            institutionName: inst.name,
            institutionCode: inst.code,
            city: inst.city,
            complianceScore: Math.round(
              ((inst.stats.assigned / inst.stats.selfIdentifiedApproved) * 100 +
                (inst.stats.facultyVisits > 0 ? Math.min((inst.stats.facultyVisits / inst.stats.selfIdentifiedApproved) * 100, 100) : 0) +
                (inst.stats.reportsSubmitted / inst.stats.selfIdentifiedApproved) * 100) / 3),
            issues: [
              inst.stats.unassigned > 0 && `${inst.stats.unassigned} students without mentors`,
              inst.stats.facultyVisits === 0 && 'No faculty visits this month',
              inst.stats.reportsMissing > 0 && `${inst.stats.reportsMissing} missing reports`,
            ].filter(Boolean),
          }));

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
      { ttl: 300, tags: ['state', 'dashboard', 'actions'] },
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
          totalStudentsWithInternships,
          totalAssignments,
          totalVisitsThisMonth,
          totalReportsThisMonth,
          institutionsWithStats,
        ] = await Promise.all([
          this.prisma.institution.count({ where: { isActive: true } }),
          this.prisma.internshipApplication.count({
            where: {
              isSelfIdentified: true,
              status: ApplicationStatus.APPROVED,
            },
          }),
          // Count unique students with active mentor assignments WHO HAVE approved self-identified internships
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
          }).then(results => results.length),
          this.prisma.facultyVisitLog.count({
            where: { visitDate: { gte: startOfMonth } },
          }),
          this.prisma.monthlyReport.count({
            where: {
              reportMonth: currentMonth,
              reportYear: currentYear,
              status: { in: ['SUBMITTED', 'APPROVED'] },
            },
          }),
          // Run institution stats in parallel with state-wide counts
          getInstitutionsWithStats({ page: 1, limit: 100 }),
        ]);

        // Calculate state-wide compliance rates (cap at 100%)
        const mentorCoverageRate = totalStudentsWithInternships > 0
          ? Math.round(Math.min((totalAssignments / totalStudentsWithInternships) * 100, 100))
          : 100;
        const visitComplianceRate = totalStudentsWithInternships > 0
          ? Math.round(Math.min((totalVisitsThisMonth / totalStudentsWithInternships) * 100, 100))
          : 100;
        const reportComplianceRate = totalStudentsWithInternships > 0
          ? Math.round(Math.min((totalReportsThisMonth / totalStudentsWithInternships) * 100, 100))
          : 100;
        const overallCompliance = Math.round((mentorCoverageRate + visitComplianceRate + reportComplianceRate) / 3);

        // Process institution-wise compliance breakdown (cap at 100%)
        const institutionCompliance = institutionsWithStats.data.map((inst: any) => {
          const { stats } = inst;
          const mentorCov = stats.studentsWithInternships > 0
            ? Math.round(Math.min((stats.assigned / stats.studentsWithInternships) * 100, 100))
            : 100;
          const visitComp = stats.studentsWithInternships > 0
            ? Math.round(Math.min((stats.facultyVisits / stats.studentsWithInternships) * 100, 100))
            : 100;
          const reportComp = stats.studentsWithInternships > 0
            ? Math.round(Math.min((stats.reportsSubmitted / stats.studentsWithInternships) * 100, 100))
            : 100;
          const overall = Math.round((mentorCov + visitComp + reportComp) / 3);

          return {
            institutionId: inst.id,
            institutionName: inst.name,
            institutionCode: inst.code,
            city: inst.city,
            overallScore: overall,
            mentorCoverage: mentorCov,
            visitCompliance: visitComp,
            reportCompliance: reportComp,
            studentsWithInternships: stats.studentsWithInternships,
            studentsWithMentors: stats.assigned,
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
            totalStudentsWithInternships,
            totalMentorAssignments: totalAssignments,
            totalVisitsThisMonth,
            totalReportsThisMonth,
            overallComplianceScore: overallCompliance,
            mentorCoverageRate,
            visitComplianceRate,
            reportComplianceRate,
          },
          distribution: {
            excellent: institutionCompliance.filter((i: any) => i.overallScore >= 80).length,
            good: institutionCompliance.filter((i: any) => i.overallScore >= 60 && i.overallScore < 80).length,
            needsImprovement: institutionCompliance.filter((i: any) => i.overallScore >= 40 && i.overallScore < 60).length,
            critical: institutionCompliance.filter((i: any) => i.overallScore < 40).length,
          },
          institutions: institutionCompliance,
        };
      },
      { ttl: 300, tags: ['state', 'compliance'] },
    );
  }
}
