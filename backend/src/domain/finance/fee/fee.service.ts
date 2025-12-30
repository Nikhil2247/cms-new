import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../../../core/database/prisma.service';
import { CacheService } from '../../../core/cache/cache.service';
import { FeeStatus } from '../../../generated/prisma/client';

export interface CreateFeePaymentDto {
  semesterId: string;
  feeStructureId?: string;
  amount: number;
  dueDate?: Date;
}

export interface UpdatePaymentStatusDto {
  status: FeeStatus;
}

@Injectable()
export class FeeService {
  private readonly logger = new Logger(FeeService.name);
  private readonly CACHE_TTL = 300; // 5 minutes

  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
  ) {}

  async createFeePayment(studentId: string, data: CreateFeePaymentDto) {
    try {
      this.logger.log(`Creating fee payment for student ${studentId}`);

      const student = await this.prisma.student.findUnique({ where: { id: studentId } });

      if (!student) {
        throw new NotFoundException('Student not found');
      }

      if (data.amount <= 0) {
        throw new BadRequestException('Payment amount must be greater than 0');
      }

      const semester = await this.prisma.semester.findUnique({ where: { id: data.semesterId } });
      if (!semester) {
        throw new NotFoundException('Semester not found');
      }

      const feeStructure = data.feeStructureId
        ? await this.prisma.feeStructure.findUnique({ where: { id: data.feeStructureId } })
        : null;

      if (data.feeStructureId && !feeStructure) {
        throw new NotFoundException('Fee structure not found');
      }

      const derivedAmountDue = feeStructure?.total ? Number.parseFloat(feeStructure.total) : undefined;
      if (feeStructure?.total && (Number.isNaN(derivedAmountDue!) || derivedAmountDue! < 0)) {
        throw new BadRequestException('Invalid total on fee structure');
      }

      const existingFee = await this.prisma.fee.findFirst({
        where: {
          studentId,
          semesterId: data.semesterId,
        },
      });

      const amountDue = existingFee?.amountDue ?? derivedAmountDue ?? data.amount;
      const nextAmountPaid = (existingFee?.amountPaid ?? 0) + data.amount;
      const nextStatus: FeeStatus =
        nextAmountPaid >= amountDue ? FeeStatus.PAID : nextAmountPaid > 0 ? FeeStatus.PARTIAL : FeeStatus.PENDING;

      const saved = existingFee
        ? await this.prisma.fee.update({
            where: { id: existingFee.id },
            data: {
              feeStructureId: data.feeStructureId ?? existingFee.feeStructureId,
              amountDue,
              amountPaid: nextAmountPaid,
              status: nextStatus,
              dueDate: existingFee.dueDate ?? data.dueDate ?? new Date(),
              institutionId: existingFee.institutionId ?? student.institutionId,
            },
            include: {
              Student: {
                include: {
                  user: true,
                },
              },
              Semester: true,
              FeeStructure: true,
            },
          })
        : await this.prisma.fee.create({
            data: {
              studentId,
              semesterId: data.semesterId,
              feeStructureId: data.feeStructureId,
              amountDue,
              amountPaid: nextAmountPaid,
              dueDate: data.dueDate ?? new Date(),
              status: nextStatus,
              institutionId: student.institutionId,
            },
            include: {
              Student: {
                include: {
                  user: true,
                },
              },
              Semester: true,
              FeeStructure: true,
            },
          });

      // Invalidate cache (parallel)
      await Promise.all([
        this.cache.del(`fees:student:${studentId}`),
        this.cache.del(`fees:institution:${student.institutionId}`),
      ]);

      return saved;
    } catch (error) {
      this.logger.error(`Failed to create fee payment: ${error.message}`, error.stack);
      throw error;
    }
  }

  async getFeesByStudent(studentId: string) {
    try {
      const cacheKey = `fees:student:${studentId}`;

      return await this.cache.getOrSet(
        cacheKey,
        async () => {
          const fees = await this.prisma.fee.findMany({
            where: { studentId },
            include: {
              Semester: true,
              FeeStructure: true,
            },
            orderBy: { dueDate: 'desc' },
          });

          const totalPaid = fees.reduce((sum, fee) => {
            return sum + (fee.amountPaid ?? 0);
          }, 0);

          return {
            fees,
            totalPaid,
            feeCount: fees.length,
          };
        },
        this.CACHE_TTL,
      );
    } catch (error) {
      this.logger.error(`Failed to get fees for student ${studentId}: ${error.message}`, error.stack);
      throw error;
    }
  }

  async getFeesByInstitution(institutionId: string) {
    try {
      const cacheKey = `fees:institution:${institutionId}`;

      return await this.cache.getOrSet(
        cacheKey,
        async () => {
          const fees = await this.prisma.fee.findMany({
            where: {
              Student: {
                institutionId,
              },
            },
            include: {
              Student: {
                include: {
                  user: true,
                },
              },
              Semester: true,
              FeeStructure: true,
            },
            orderBy: { dueDate: 'desc' },
          });

          const totalCollected = fees.reduce((sum, fee) => {
            return sum + (fee.amountPaid ?? 0);
          }, 0);

          const pending = fees.filter(f => f.status === FeeStatus.PENDING).length;
          const paid = fees.filter(f => f.status === FeeStatus.PAID).length;
          const partial = fees.filter(f => f.status === FeeStatus.PARTIAL).length;
          const waived = fees.filter(f => f.status === FeeStatus.WAIVED).length;

          return {
            fees,
            statistics: {
              totalCollected,
              totalRecords: fees.length,
              pending,
              paid,
              partial,
              waived,
            },
          };
        },
        this.CACHE_TTL,
      );
    } catch (error) {
      this.logger.error(`Failed to get fees for institution ${institutionId}: ${error.message}`, error.stack);
      throw error;
    }
  }

  async updatePaymentStatus(id: string, status: UpdatePaymentStatusDto['status']) {
    try {
      this.logger.log(`Updating payment ${id} status to ${status}`);

      const fee = await this.prisma.fee.findUnique({
        where: { id },
        include: {
          Student: true,
        },
      });

      if (!fee) {
        throw new NotFoundException('Fee record not found');
      }

      const updated = await this.prisma.fee.update({
        where: { id },
        data: {
          status,
        },
        include: {
          Student: true,
          Semester: true,
          FeeStructure: true,
        },
      });

      // Invalidate cache (parallel)
      await Promise.all([
        this.cache.del(`fees:student:${fee.studentId}`),
        this.cache.del(`fees:institution:${fee.Student.institutionId}`),
      ]);

      return updated;
    } catch (error) {
      this.logger.error(`Failed to update payment status: ${error.message}`, error.stack);
      throw error;
    }
  }
}
