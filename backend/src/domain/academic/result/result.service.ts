import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../../../core/database/prisma.service';
import { CacheService } from '../../../core/cache/cache.service';

export interface AddResultDto {
  semesterId: string;
  subjectId: string;
  marksObtained: number;
  totalMarks?: number;
  grade?: string;
  credits?: number;
  remarks?: string;
}

export interface BulkResultDto {
  studentId: string;
  results: AddResultDto[];
}

@Injectable()
export class ResultService {
  private readonly logger = new Logger(ResultService.name);
  private readonly CACHE_TTL = 300; // 5 minutes

  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
  ) {}

  async addResult(studentId: string, data: AddResultDto) {
    try {
      this.logger.log(`Adding result for student ${studentId}`);

      const [student, subject, semester] = await Promise.all([
        this.prisma.student.findUnique({ where: { id: studentId } }),
        this.prisma.subject.findUnique({ where: { id: data.subjectId } }),
        this.prisma.semester.findUnique({ where: { id: data.semesterId } }),
      ]);

      if (!student) {
        throw new NotFoundException('Student not found');
      }

      if (!subject) {
        throw new NotFoundException('Subject not found');
      }

      if (!semester) {
        throw new NotFoundException('Semester not found');
      }

      // Validate marks
      const maxMarks = data.totalMarks ?? 100;
      if (data.marksObtained < 0 || data.marksObtained > maxMarks) {
        throw new BadRequestException('Invalid marks obtained');
      }

      // Check for duplicate result
      const existingResult = await this.prisma.examResult.findFirst({
        where: {
          studentId,
          semesterId: data.semesterId,
          subjectId: data.subjectId,
        },
      });

      if (existingResult) {
        // Update existing result
        const updated = await this.prisma.examResult.update({
          where: { id: existingResult.id },
          data: {
            marks: data.marksObtained,
            maxMarks,
          },
          include: {
            Subject: true,
            Semester: true,
          },
        });

        // Invalidate cache
        await this.cache.del(`results:student:${studentId}`);

        return updated;
      }

      const result = await this.prisma.examResult.create({
        data: {
          studentId,
          semesterId: data.semesterId,
          subjectId: data.subjectId,
          marks: data.marksObtained,
          maxMarks,
        },
        include: {
          Subject: true,
          Semester: true,
        },
      });

      // Invalidate cache
      await this.cache.del(`results:student:${studentId}`);

      return result;
    } catch (error) {
      this.logger.error(`Failed to add result: ${error.message}`, error.stack);
      throw error;
    }
  }

  async getResultsByStudent(studentId: string) {
    try {
      const cacheKey = `results:student:${studentId}`;

      return await this.cache.getOrSet(
        cacheKey,
        async () => {
          const results = await this.prisma.examResult.findMany({
            where: { studentId },
            include: {
              Subject: true,
              Semester: true,
            },
            orderBy: [
              { Semester: { number: 'asc' } },
              { Subject: { subjectName: 'asc' } },
            ],
          });

          const resultsWithComputed = results.map(r => ({
            ...r,
            grade: this.calculateGrade(r.marks, r.maxMarks ?? 100),
            credits: 1,
            semester: r.Semester,
            subject: r.Subject,
          }));

          // Calculate aggregate data
          const semesterWise = this.groupBySemester(resultsWithComputed);

          return {
            results: resultsWithComputed,
            semesterWise,
            cgpa: this.calculateCGPA(resultsWithComputed),
          };
        },
        this.CACHE_TTL,
      );
    } catch (error) {
      this.logger.error(`Failed to get results for student ${studentId}: ${error.message}`, error.stack);
      throw error;
    }
  }

  async bulkUploadResults(data: BulkResultDto[]) {
    try {
      this.logger.log(`Bulk uploading results for ${data.length} students`);

      const results = [];

      for (const studentData of data) {
        const studentResults = [];

        for (const resultData of studentData.results) {
          const result = await this.addResult(studentData.studentId, resultData);
          studentResults.push(result);
        }

        results.push({
          studentId: studentData.studentId,
          results: studentResults,
        });
      }

      return {
        success: true,
        message: `Successfully uploaded results for ${data.length} students`,
        data: results,
      };
    } catch (error) {
      this.logger.error(`Failed to bulk upload results: ${error.message}`, error.stack);
      throw error;
    }
  }

  private calculateGrade(marksObtained: number, totalMarks: number): string {
    const percentage = (marksObtained / totalMarks) * 100;

    if (percentage >= 90) return 'O';
    if (percentage >= 80) return 'A+';
    if (percentage >= 70) return 'A';
    if (percentage >= 60) return 'B+';
    if (percentage >= 50) return 'B';
    if (percentage >= 40) return 'C';
    return 'F';
  }

  private gradeToPoint(grade: string): number {
    const gradePoints = {
      'O': 10,
      'A+': 9,
      'A': 8,
      'B+': 7,
      'B': 6,
      'C': 5,
      'F': 0,
    };

    return gradePoints[grade] || 0;
  }

  private calculateCGPA(results: any[]): number {
    if (results.length === 0) return 0;

    let totalPoints = 0;
    let totalCredits = 0;

    for (const result of results) {
      const gradePoint = this.gradeToPoint(result.grade);
      const credits = result.credits || 1;

      totalPoints += gradePoint * credits;
      totalCredits += credits;
    }

    return totalCredits > 0 ? totalPoints / totalCredits : 0;
  }

  private groupBySemester(results: any[]): any {
    const semesterMap = new Map();

    for (const result of results) {
      const semesterId = result.semesterId;

      if (!semesterMap.has(semesterId)) {
        semesterMap.set(semesterId, {
          semester: result.semester,
          results: [],
          sgpa: 0,
        });
      }

      semesterMap.get(semesterId).results.push(result);
    }

    // Calculate SGPA for each semester
    semesterMap.forEach((semesterData) => {
      semesterData.sgpa = this.calculateCGPA(semesterData.results);
    });

    return Array.from(semesterMap.values());
  }
}
