import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../../../core/database/prisma.service';
import { LruCacheService } from '../../../core/cache/lru-cache.service';
import { AuditService } from '../../../infrastructure/audit/audit.service';
import { Prisma, ApplicationStatus, AuditAction, AuditCategory, AuditSeverity, Role } from '@prisma/client';

@Injectable()
export class StateIndustryService {
  private readonly logger = new Logger(StateIndustryService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: LruCacheService,
    private readonly auditService: AuditService,
  ) {}

  /**
   * Approve industry registration
   */
  async approveIndustry(industryId: string, approvedBy: string) {
    const industry = await this.prisma.industry.findUnique({
      where: { id: industryId },
    });

    if (!industry) {
      throw new NotFoundException(`Industry with ID ${industryId} not found`);
    }

    if (industry.isApproved) {
      throw new BadRequestException('Industry is already approved');
    }

    const updated = await this.prisma.industry.update({
      where: { id: industryId },
      data: {
        isApproved: true,
        approvedAt: new Date(),
        approvedBy,
      },
      include: {
        user: { select: { id: true, name: true, email: true } },
      },
    });

    // Audit industry approval
    this.auditService.log({
      action: AuditAction.INDUSTRY_APPROVAL,
      entityType: 'Industry',
      entityId: industryId,
      userId: approvedBy,
      userRole: Role.STATE_DIRECTORATE,
      description: `Industry approved: ${industry.companyName}`,
      category: AuditCategory.SYSTEM_ADMIN,
      severity: AuditSeverity.HIGH,
      newValues: {
        industryId,
        companyName: industry.companyName,
        isApproved: true,
        approvedBy,
        approvedAt: new Date(),
      },
    }).catch(() => {});

    await this.cache.invalidateByTags(['state', 'industries', `industry:${industryId}`]);
    return updated;
  }

  /**
   * Reject industry registration
   */
  async rejectIndustry(industryId: string, reason?: string, rejectedBy?: string) {
    const industry = await this.prisma.industry.findUnique({
      where: { id: industryId },
    });

    if (!industry) {
      throw new NotFoundException(`Industry with ID ${industryId} not found`);
    }

    if (industry.isApproved) {
      throw new BadRequestException('Cannot reject an already approved industry');
    }

    const updated = await this.prisma.industry.update({
      where: { id: industryId },
      data: { isApproved: false, isVerified: false },
    });

    // Audit industry rejection
    this.auditService.log({
      action: AuditAction.INDUSTRY_REJECTION,
      entityType: 'Industry',
      entityId: industryId,
      userId: rejectedBy || 'SYSTEM',
      userRole: Role.STATE_DIRECTORATE,
      description: `Industry rejected: ${industry.companyName}${reason ? ` - ${reason}` : ''}`,
      category: AuditCategory.SYSTEM_ADMIN,
      severity: AuditSeverity.HIGH,
      newValues: {
        industryId,
        companyName: industry.companyName,
        isApproved: false,
        rejectionReason: reason,
      },
    }).catch(() => {});

    await this.cache.invalidateByTags(['state', 'industries', `industry:${industryId}`]);
    return { ...updated, rejectionReason: reason };
  }

  /**
   * Get pending industry approvals
   */
  async getPendingIndustries(params: { page?: number; limit?: number }) {
    const { page = 1, limit = 10 } = params;
    const skip = (page - 1) * limit;

    const where: Prisma.IndustryWhereInput = { isApproved: false };

    const [industries, total] = await Promise.all([
      this.prisma.industry.findMany({
        where,
        skip,
        take: limit,
        include: {
          user: { select: { id: true, name: true, email: true, createdAt: true } },
          _count: { select: { internships: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.industry.count({ where }),
    ]);

    return {
      data: industries,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Get top industries by interns hired
   * OPTIMIZED: Uses caching with 15-minute TTL
   */
  async getTopIndustries(params: { limit?: number }) {
    const { limit = 10 } = params;
    const cacheKey = `state:top-industries:${limit}`;

    return this.cache.getOrSet(
      cacheKey,
      async () => {
        return this._fetchTopIndustries(limit);
      },
      { ttl: 15 * 60 * 1000, tags: ['state', 'industries', 'top-industries'] },
    );
  }

  /**
   * Internal method to fetch top industries data
   */
  private async _fetchTopIndustries(limit: number) {
    // Get all approved self-identified applications with company info
    const applications = await this.prisma.internshipApplication.findMany({
      where: {
        isSelfIdentified: true,
        status: ApplicationStatus.APPROVED,
        companyName: { not: '' },
      },
      select: {
        companyName: true,
        companyAddress: true,
        companyEmail: true,
        jobProfile: true,
        stipend: true,
        student: {
          select: {
            institutionId: true,
            Institution: { select: { name: true } },
          },
        },
      },
    });

    // Aggregate by company name (normalize to lowercase for grouping)
    const companyMap = new Map<string, {
      name: string;
      address: string | null;
      email: string | null;
      internsCount: number;
      institutions: Set<string>;
      jobProfiles: Set<string>;
      avgStipend: number;
      totalStipend: number;
    }>();

    for (const app of applications) {
      // Normalize key: lowercase, trim, replace hyphens with spaces, and collapse multiple spaces
      // This ensures "Multi-Skill" and "Multi Skill" are treated as the same company
      const companyKey = app.companyName?.toLowerCase().trim()
        .replace(/-/g, ' ')
        .replace(/\s+/g, ' ') || '';
      if (!companyKey) continue;

      if (!companyMap.has(companyKey)) {
        companyMap.set(companyKey, {
          name: app.companyName || '',
          address: app.companyAddress,
          email: app.companyEmail,
          internsCount: 0,
          institutions: new Set(),
          jobProfiles: new Set(),
          avgStipend: 0,
          totalStipend: 0,
        });
      }

      const company = companyMap.get(companyKey)!;
      company.internsCount++;
      if (app.student?.Institution?.name) {
        company.institutions.add(app.student.Institution.name);
      }
      if (app.jobProfile) {
        company.jobProfiles.add(app.jobProfile);
      }
      if (app.stipend) {
        company.totalStipend += Number(app.stipend);
      }
    }

    // Convert to array and calculate averages
    // Use map key for ID to ensure uniqueness (key is already normalized)
    const companies = Array.from(companyMap.entries())
      .map(([key, company]) => ({
        id: key.replace(/\s+/g, '-'),
        name: company.name,
        address: company.address,
        email: company.email,
        internsHired: company.internsCount,
        institutionsCount: company.institutions.size,
        jobProfiles: Array.from(company.jobProfiles).slice(0, 3),
        avgStipend: company.internsCount > 0 ? Math.round(company.totalStipend / company.internsCount) : 0,
      }))
      .sort((a, b) => b.internsHired - a.internsHired)
      .slice(0, limit);

    return {
      data: companies,
      total: companyMap.size,
    };
  }

  /**
   * Get joining letter statistics
   * Note: This method delegates to StateReportService
   * Kept here for API compatibility, but requires StateReportService injection
   */
  async getJoiningLetterStats() {
    // This method requires StateReportService to be injected
    // For now, return a placeholder or throw an error
    throw new BadRequestException('This method requires StateReportService. Please use StateReportService.getJoiningLetterStats() directly.');
  }

  /**
   * Get all companies (both industries and self-identified)
   */
  async getAllCompanies(params: {
    page?: number;
    limit?: number;
    search?: string;
    industryType?: string;
    sortBy?: 'studentCount' | 'institutionCount' | 'companyName';
    sortOrder?: 'asc' | 'desc';
  }) {
    const { page = 1, limit = 20, search, industryType, sortBy = 'studentCount', sortOrder = 'desc' } = params;
    const skip = (page - 1) * limit;

    // Query 1: Get all industries with applications
    const industryWhere: Prisma.IndustryWhereInput = {};
    if (search) {
      industryWhere.companyName = { contains: search, mode: 'insensitive' };
    }
    if (industryType) {
      industryWhere.industryType = industryType as any;
    }

    // Query 2: Get self-identified applications
    const selfIdWhere: Prisma.InternshipApplicationWhereInput = {
      OR: [
        { isSelfIdentified: true },
        { internshipStatus: 'SELF_IDENTIFIED' },
      ],
    };
    if (search) {
      selfIdWhere.companyName = { contains: search, mode: 'insensitive' };
    }

    // Execute queries in parallel
    const [industries, selfIdentifiedApps, industryTypes, totalIndustries] = await Promise.all([
      // Get industries with all their applications
      this.prisma.industry.findMany({
        where: industryWhere,
        select: {
          id: true,
          companyName: true,
          industryType: true,
          city: true,
          state: true,
          isApproved: true,
          isVerified: true,
          primaryEmail: true,
          primaryPhone: true,
          address: true,
          internships: {
            select: {
              institutionId: true,
              applications: {
                where: {
                  status: { in: [ApplicationStatus.APPROVED, ApplicationStatus.SELECTED, ApplicationStatus.JOINED, ApplicationStatus.COMPLETED] },
                },
                select: {
                  id: true,
                  status: true,
                  isSelfIdentified: true,
                  joiningLetterUrl: true,
                  hasJoined: true,
                  jobProfile: true,
                  student: {
                    select: {
                      id: true,
                      name: true,
                      rollNumber: true,
                      branchName: true,
                      email: true,
                      institutionId: true,
                      Institution: {
                        select: { id: true, name: true, code: true, city: true },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      }),
      // Get all self-identified applications
      this.prisma.internshipApplication.findMany({
        where: selfIdWhere,
        select: {
          id: true,
          companyName: true,
          companyAddress: true,
          companyContact: true,
          companyEmail: true,
          jobProfile: true,
          stipend: true,
          status: true,
          isSelfIdentified: true,
          joiningLetterUrl: true,
          hasJoined: true,
          student: {
            select: {
              id: true,
              name: true,
              rollNumber: true,
              branchName: true,
              email: true,
              institutionId: true,
              Institution: {
                select: { id: true, name: true, code: true, city: true },
              },
            },
          },
        },
      }),
      // Get unique industry types for filter
      this.prisma.industry.findMany({
        select: { industryType: true },
        distinct: ['industryType'],
      }),
      // Get total count
      this.prisma.industry.count({ where: industryWhere }),
    ]);

    // Transform Industry data
    const companyMap = new Map<string, any>();

    // Process regular industries
    industries.forEach((industry) => {
      const allApplications = industry.internships.flatMap(i => i.applications);
      if (allApplications.length === 0) return;

      const institutionMap = new Map<string, any>();
      const studentSet = new Set<string>();

      allApplications.forEach((app) => {
        const student = app.student;
        if (!student?.institutionId) return;

        studentSet.add(student.id);

        if (!institutionMap.has(student.institutionId)) {
          institutionMap.set(student.institutionId, {
            id: student.institutionId,
            name: student.Institution?.name || 'Unknown',
            code: student.Institution?.code || '',
            city: student.Institution?.city || '',
            students: [],
            branchWise: {},
          });
        }

        const inst = institutionMap.get(student.institutionId);
        if (!inst.students.find((s: any) => s.id === student.id)) {
          inst.students.push({
            id: student.id,
            name: student.name,
            rollNumber: student.rollNumber,
            branch: student.branchName,
            email: student.email,
            jobProfile: app.jobProfile,
            status: app.status,
            hasJoiningLetter: !!app.joiningLetterUrl,
          });

          const branch = student.branchName || 'Unknown';
          inst.branchWise[branch] = (inst.branchWise[branch] || 0) + 1;
        }
      });

      const institutions = Array.from(institutionMap.values()).map((inst) => ({
        ...inst,
        studentCount: inst.students.length,
        branchWiseData: Object.entries(inst.branchWise).map(([branch, count]) => ({ branch, count })),
      }));

      companyMap.set(industry.id, {
        id: industry.id,
        companyName: industry.companyName,
        industryType: industry.industryType || 'General',
        city: industry.city,
        state: industry.state,
        address: industry.address,
        email: industry.primaryEmail,
        phone: industry.primaryPhone,
        isApproved: industry.isApproved,
        isVerified: industry.isVerified,
        isSelfIdentifiedCompany: false,
        totalStudents: studentSet.size,
        institutionCount: institutions.length,
        institutions,
      });
    });

    // Process self-identified applications - group by company name
    // Normalize key to ensure consistent grouping (lowercase, trim, replace hyphens/spaces)
    const selfIdCompanyMap = new Map<string, any>();
    selfIdentifiedApps.forEach((app) => {
      const companyName = app.companyName || 'Unknown Company';
      const normalizedName = companyName.toLowerCase().trim().replace(/-/g, ' ').replace(/\s+/g, ' ');
      const companyKey = `self-${normalizedName.replace(/\s+/g, '-')}`;

      if (!selfIdCompanyMap.has(companyKey)) {
        selfIdCompanyMap.set(companyKey, {
          id: companyKey,
          companyName,
          industryType: 'Self-Identified',
          city: null,
          state: null,
          address: app.companyAddress,
          email: app.companyEmail,
          phone: app.companyContact,
          isApproved: true,
          isVerified: false,
          isSelfIdentifiedCompany: true,
          totalStudents: 0,
          totalApplications: 0, // Track total applications (not deduplicated)
          institutionCount: 0,
          institutionMap: new Map(),
          studentSet: new Set(),
        });
      }

      const company = selfIdCompanyMap.get(companyKey);
      const student = app.student;
      if (!student?.institutionId) return;

      // Always count the application
      company.totalApplications++;

      if (!company.studentSet.has(student.id)) {
        company.studentSet.add(student.id);
        company.totalStudents++;

        if (!company.institutionMap.has(student.institutionId)) {
          company.institutionMap.set(student.institutionId, {
            id: student.institutionId,
            name: student.Institution?.name || 'Unknown',
            code: student.Institution?.code || '',
            city: student.Institution?.city || '',
            students: [],
            branchWise: {},
          });
        }

        const inst = company.institutionMap.get(student.institutionId);
        inst.students.push({
          id: student.id,
          name: student.name,
          rollNumber: student.rollNumber,
          branch: student.branchName,
          email: student.email,
          jobProfile: app.jobProfile,
          stipend: app.stipend,
          status: app.status,
          hasJoiningLetter: !!app.joiningLetterUrl,
          isSelfIdentified: true,
        });

        const branch = student.branchName || 'Unknown';
        inst.branchWise[branch] = (inst.branchWise[branch] || 0) + 1;
      }
    });

    // Finalize self-identified companies
    selfIdCompanyMap.forEach((company, key) => {
      const institutions = Array.from(company.institutionMap.values()).map((inst: any) => ({
        ...inst,
        studentCount: inst.students.length,
        branchWiseData: Object.entries(inst.branchWise).map(([branch, count]) => ({ branch, count })),
      }));

      // Only add if has students and not filtered by industryType (unless searching for self-identified)
      if (institutions.length > 0 && (!industryType || industryType === 'Self-Identified')) {
        companyMap.set(key, {
          id: company.id,
          companyName: company.companyName,
          industryType: company.industryType,
          city: company.city,
          state: company.state,
          address: company.address,
          email: company.email,
          phone: company.phone,
          isApproved: company.isApproved,
          isVerified: company.isVerified,
          isSelfIdentifiedCompany: company.isSelfIdentifiedCompany,
          totalStudents: company.totalStudents,
          totalApplications: company.totalApplications, // Total internship applications (not deduplicated)
          institutionCount: institutions.length,
          institutions,
        });
      }
    });

    // Convert to array and sort
    let companies = Array.from(companyMap.values());

    // Sort
    companies.sort((a, b) => {
      let comparison = 0;
      switch (sortBy) {
        case 'studentCount':
          comparison = a.totalStudents - b.totalStudents;
          break;
        case 'institutionCount':
          comparison = a.institutionCount - b.institutionCount;
          break;
        case 'companyName':
          comparison = a.companyName.localeCompare(b.companyName);
          break;
        default:
          comparison = a.totalStudents - b.totalStudents;
      }
      return sortOrder === 'desc' ? -comparison : comparison;
    });

    // Paginate
    const total = companies.length;
    const paginatedCompanies = companies.slice(skip, skip + limit);

    // Calculate summary
    // For self-identified companies, use totalApplications to match institution overview count
    const totalStudentsPlaced = companies.reduce((sum, c) => {
      if (c.isSelfIdentifiedCompany) {
        return sum + (c.totalApplications || c.totalStudents);
      }
      return sum + c.totalStudents;
    }, 0);
    const totalSelfIdentified = companies
      .filter(c => c.isSelfIdentifiedCompany)
      .reduce((sum, c) => sum + (c.totalApplications || c.totalStudents), 0);
    const uniqueIndustryTypes = [...new Set(industryTypes.map(t => t.industryType).filter(Boolean)), 'Self-Identified'];

    return {
      companies: paginatedCompanies,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
      summary: {
        totalCompanies: total,
        totalStudentsPlaced,
        totalSelfIdentified,
        selfIdentifiedRate: totalStudentsPlaced > 0 ? Math.round((totalSelfIdentified / totalStudentsPlaced) * 100) : 0,
        industryTypes: uniqueIndustryTypes,
      },
    };
  }

  /**
   * Get company details with all institutions and students
   */
  async getCompanyDetails(companyId: string) {
    // Check if it's a self-identified company
    if (companyId.startsWith('self-')) {
      // Extract the normalized key part (e.g., "self-tech-hub" → "tech-hub")
      const normalizedKey = companyId.replace('self-', '');

      // First fetch all self-identified applications
      const allSelfIdApps = await this.prisma.internshipApplication.findMany({
        where: {
          OR: [
            { isSelfIdentified: true },
            { internshipStatus: 'SELF_IDENTIFIED' },
          ],
          companyName: { not: '' },
        },
        select: {
          id: true,
          companyName: true,
          companyAddress: true,
          companyContact: true,
          companyEmail: true,
          hrName: true,
          jobProfile: true,
          stipend: true,
          status: true,
          internshipDuration: true,
          startDate: true,
          endDate: true,
          joiningLetterUrl: true,
          hasJoined: true,
          student: {
            select: {
              id: true,
              name: true,
              rollNumber: true,
              branchName: true,
              email: true,
              contact: true,
              institutionId: true,
              Institution: {
                select: { id: true, name: true, code: true, city: true, district: true },
              },
            },
          },
        },
      });

      // Filter applications using the same normalization logic as getAllCompanies
      // This ensures exact match with the company key
      const applications = allSelfIdApps.filter((app) => {
        const appCompanyName = app.companyName || 'Unknown Company';
        // Use same normalization: lowercase, trim, replace hyphens with spaces, then collapse to dashes
        const appNormalizedKey = appCompanyName.toLowerCase().trim().replace(/-/g, ' ').replace(/\s+/g, '-');
        return appNormalizedKey === normalizedKey;
      });

      if (applications.length === 0) {
        throw new NotFoundException('Company not found');
      }

      // Group by institution
      const institutionMap = new Map<string, any>();
      const firstApp = applications[0];

      applications.forEach((app) => {
        const student = app.student;
        if (!student?.institutionId) return;

        if (!institutionMap.has(student.institutionId)) {
          institutionMap.set(student.institutionId, {
            id: student.institutionId,
            name: student.Institution?.name || 'Unknown',
            code: student.Institution?.code || '',
            city: student.Institution?.city || '',
            district: student.Institution?.district || '',
            students: [],
            branchWise: {},
          });
        }

        const inst = institutionMap.get(student.institutionId);
        if (!inst.students.find((s: any) => s.id === student.id)) {
          inst.students.push({
            id: student.id,
            name: student.name,
            rollNumber: student.rollNumber,
            branch: student.branchName,
            email: student.email,
            contact: student.contact,
            jobProfile: app.jobProfile,
            stipend: app.stipend,
            duration: app.internshipDuration,
            startDate: app.startDate,
            endDate: app.endDate,
            status: app.status,
            hasJoiningLetter: !!app.joiningLetterUrl,
            hasJoined: app.hasJoined,
          });

          const branch = student.branchName || 'Unknown';
          inst.branchWise[branch] = (inst.branchWise[branch] || 0) + 1;
        }
      });

      const institutions = Array.from(institutionMap.values()).map((inst) => ({
        ...inst,
        studentCount: inst.students.length,
        branchWiseData: Object.entries(inst.branchWise).map(([branch, count]) => ({ branch, count })),
      }));

      return {
        id: companyId,
        companyName: firstApp.companyName,
        industryType: 'Self-Identified',
        address: firstApp.companyAddress,
        email: firstApp.companyEmail,
        phone: firstApp.companyContact,
        hrName: firstApp.hrName,
        isSelfIdentifiedCompany: true,
        isApproved: true,
        isVerified: false,
        totalStudents: applications.length,
        institutionCount: institutions.length,
        institutions,
      };
    }

    // Regular industry company
    const industry = await this.prisma.industry.findUnique({
      where: { id: companyId },
      select: {
        id: true,
        companyName: true,
        industryType: true,
        city: true,
        state: true,
        address: true,
        primaryEmail: true,
        primaryPhone: true,
        isApproved: true,
        isVerified: true,
        website: true,
        companyDescription: true,
        internships: {
          select: {
            id: true,
            title: true,
            institutionId: true,
            applications: {
              where: {
                status: { in: [ApplicationStatus.APPROVED, ApplicationStatus.SELECTED, ApplicationStatus.JOINED, ApplicationStatus.COMPLETED] },
              },
              select: {
                id: true,
                status: true,
                jobProfile: true,
                joiningLetterUrl: true,
                hasJoined: true,
                student: {
                  select: {
                    id: true,
                    name: true,
                    rollNumber: true,
                    branchName: true,
                    email: true,
                    contact: true,
                    institutionId: true,
                    Institution: {
                      select: { id: true, name: true, code: true, city: true, district: true },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!industry) {
      throw new NotFoundException('Company not found');
    }

    // Group by institution
    const institutionMap = new Map<string, any>();

    // Type assertion for the nested select result
    const industryWithInternships = industry as typeof industry & {
      internships: Array<{
        id: string;
        title: string;
        institutionId: string;
        applications: Array<{
          id: string;
          status: string;
          jobProfile: string;
          joiningLetterUrl: string | null;
          hasJoined: boolean;
          student: {
            id: string;
            name: string;
            rollNumber: string;
            branchName: string;
            email: string;
            contact: string;
            institutionId: string;
            Institution: { id: string; name: string; code: string; city: string; district: string } | null;
          };
        }>;
      }>;
    };

    industryWithInternships.internships.forEach((internship) => {
      internship.applications.forEach((app) => {
        const student = app.student;
        if (!student?.institutionId) return;

        if (!institutionMap.has(student.institutionId)) {
          institutionMap.set(student.institutionId, {
            id: student.institutionId,
            name: student.Institution?.name || 'Unknown',
            code: student.Institution?.code || '',
            city: student.Institution?.city || '',
            district: student.Institution?.district || '',
            students: [],
            branchWise: {},
          });
        }

        const inst = institutionMap.get(student.institutionId);
        if (!inst.students.find((s: any) => s.id === student.id)) {
          inst.students.push({
            id: student.id,
            name: student.name,
            rollNumber: student.rollNumber,
            branch: student.branchName,
            email: student.email,
            contact: student.contact,
            jobProfile: app.jobProfile,
            internshipTitle: internship.title,
            status: app.status,
            hasJoiningLetter: !!app.joiningLetterUrl,
            hasJoined: app.hasJoined,
          });

          const branch = student.branchName || 'Unknown';
          inst.branchWise[branch] = (inst.branchWise[branch] || 0) + 1;
        }
      });
    });

    const institutions = Array.from(institutionMap.values()).map((inst) => ({
      ...inst,
      studentCount: inst.students.length,
      branchWiseData: Object.entries(inst.branchWise).map(([branch, count]) => ({ branch, count })),
    }));

    const totalStudents = institutions.reduce((sum, i) => sum + i.studentCount, 0);

    return {
      id: industry.id,
      companyName: industry.companyName,
      industryType: industry.industryType || 'General',
      city: industry.city,
      state: industry.state,
      address: industry.address,
      email: industry.primaryEmail,
      phone: industry.primaryPhone,
      website: industry.website,
      description: industry.companyDescription,
      isSelfIdentifiedCompany: false,
      isApproved: industry.isApproved,
      isVerified: industry.isVerified,
      totalStudents,
      institutionCount: institutions.length,
      institutions,
    };
  }
}
