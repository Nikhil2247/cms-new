import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../../../core/database/prisma.service';
import { CacheService } from '../../../core/cache/cache.service';
import { AdmissionType, ScholarshipType } from '@prisma/client';

export interface CreateFeeStructureDto {
  admissionType: AdmissionType; // FIRST_YEAR or LEET
  scholarshipScheme: ScholarshipType;
  semesterNumber: number; // 1-6
  df: number; // Development Fee
  sf: number; // Student Fee
  security: number; // Security Deposit
  tf: number; // Tuition Fee
  total?: string; // Total Fee (stored as string in schema)
  isActive?: boolean;
}

export interface UpdateFeeStructureDto extends Partial<CreateFeeStructureDto> {}

@Injectable()
export class FeeStructureService {
  private readonly logger = new Logger(FeeStructureService.name);
  // OPTIMIZED: Extended cache TTL to 1 hour for fee structures (rarely change)
  private readonly CACHE_TTL = 3600; // 1 hour

  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
  ) {}

  async createFeeStructure(institutionId: string, data: CreateFeeStructureDto) {
    try {
      this.logger.log(`Creating fee structure for institution ${institutionId}`);

      const institution = await this.prisma.institution.findUnique({
        where: { id: institutionId },
      });

      if (!institution) {
        throw new NotFoundException('Institution not found');
      }

      const feeParts = [data.df, data.sf, data.security, data.tf];
      if (feeParts.some(v => typeof v !== 'number' || Number.isNaN(v) || v < 0)) {
        throw new BadRequestException('Fee amounts must be valid non-negative numbers');
      }

      if (!Number.isInteger(data.semesterNumber) || data.semesterNumber < 1) {
        throw new BadRequestException('semesterNumber must be a positive integer');
      }

      const existing = await this.prisma.feeStructure.findFirst({
        where: {
          admissionType: data.admissionType,
          scholarshipScheme: data.scholarshipScheme,
          semesterNumber: data.semesterNumber,
        },
      });

      if (existing) {
        throw new BadRequestException('Fee structure already exists for this admission type, scholarship scheme, and semester');
      }

      const computedTotal = (data.df + data.sf + data.security + data.tf).toString();

      const feeStructure = await this.prisma.feeStructure.create({
        data: {
          institutionId,
          admissionType: data.admissionType,
          scholarshipScheme: data.scholarshipScheme,
          semesterNumber: data.semesterNumber,
          df: data.df,
          sf: data.sf,
          security: data.security,
          tf: data.tf,
          total: data.total ?? computedTotal,
          isActive: data.isActive !== undefined ? data.isActive : true,
        },
        include: {
          Institution: true,
        },
      });

      // Invalidate cache
      await this.cache.del(`fee-structures:institution:${institutionId}`);

      return feeStructure;
    } catch (error) {
      this.logger.error(`Failed to create fee structure: ${error.message}`, error.stack);
      throw error;
    }
  }

  async getFeeStructures(institutionId: string) {
    try {
      const cacheKey = `fee-structures:institution:${institutionId}`;

      return await this.cache.getOrSet(
        cacheKey,
        async () => {
          return await this.prisma.feeStructure.findMany({
            where: { institutionId },
            include: {
              Institution: true,
            },
            orderBy: { createdAt: 'desc' },
          });
        },
        this.CACHE_TTL,
      );
    } catch (error) {
      this.logger.error(`Failed to get fee structures for institution ${institutionId}: ${error.message}`, error.stack);
      throw error;
    }
  }

  async updateFeeStructure(id: string, data: UpdateFeeStructureDto) {
    try {
      this.logger.log(`Updating fee structure ${id}`);

      const feeStructure = await this.prisma.feeStructure.findUnique({
        where: { id },
      });

      if (!feeStructure) {
        throw new NotFoundException('Fee structure not found');
      }

      const feeParts = [data.df, data.sf, data.security, data.tf].filter(v => v !== undefined);
      if (feeParts.some(v => typeof v !== 'number' || Number.isNaN(v) || v < 0)) {
        throw new BadRequestException('Fee amounts must be valid non-negative numbers');
      }

      if (data.semesterNumber !== undefined && (!Number.isInteger(data.semesterNumber) || data.semesterNumber < 1)) {
        throw new BadRequestException('semesterNumber must be a positive integer');
      }

      const df = data.df ?? feeStructure.df;
      const sf = data.sf ?? feeStructure.sf;
      const security = data.security ?? feeStructure.security;
      const tf = data.tf ?? feeStructure.tf;
      const computedTotal = (df + sf + security + tf).toString();

      const updated = await this.prisma.feeStructure.update({
        where: { id },
        data: {
          admissionType: data.admissionType,
          scholarshipScheme: data.scholarshipScheme,
          semesterNumber: data.semesterNumber,
          df: data.df,
          sf: data.sf,
          security: data.security,
          tf: data.tf,
          total: data.total ?? computedTotal,
          isActive: data.isActive,
        },
        include: {
          Institution: true,
        },
      });

      // Invalidate cache
      await this.cache.del(`fee-structures:institution:${feeStructure.institutionId}`);

      return updated;
    } catch (error) {
      this.logger.error(`Failed to update fee structure: ${error.message}`, error.stack);
      throw error;
    }
  }

  async getFeeStructureById(id: string) {
    try {
      const feeStructure = await this.prisma.feeStructure.findUnique({
        where: { id },
        include: {
          Institution: true,
        },
      });

      if (!feeStructure) {
        throw new NotFoundException('Fee structure not found');
      }

      return feeStructure;
    } catch (error) {
      this.logger.error(`Failed to get fee structure: ${error.message}`, error.stack);
      throw error;
    }
  }
}
