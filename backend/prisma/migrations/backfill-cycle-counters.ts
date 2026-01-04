/**
 * Backfill Migration Script: Expected Cycle Counters
 *
 * This script populates the new counter fields on InternshipApplication:
 * - totalExpectedReports: Calculated from internship dates using getTotalExpectedCount()
 * - totalExpectedVisits: Same calculation as expected reports
 * - submittedReportsCount: Count of existing approved monthly reports
 * - completedVisitsCount: Count of existing completed faculty visits
 * - expectedCountsLastCalculated: Set to current timestamp
 *
 * Run with: npx ts-node prisma/migrations/backfill-cycle-counters.ts
 */

import { PrismaClient, MonthlyReportStatus, VisitLogStatus } from '../../src/generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import { getTotalExpectedCount } from '../../src/common/utils/monthly-cycle.util';
import 'dotenv/config';

// Create PostgreSQL connection pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// Create Prisma client with pg adapter
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter } as any);

async function main() {
  console.log('Starting backfill of cycle counters...\n');

  // Get all internship applications with dates
  const applications = await prisma.internshipApplication.findMany({
    where: {
      isActive: true,
    },
    select: {
      id: true,
      startDate: true,
      endDate: true,
      joiningDate: true,
      completionDate: true,
      studentId: true,
    },
  });

  console.log(`Found ${applications.length} active internship applications\n`);

  let successCount = 0;
  let errorCount = 0;
  let skippedCount = 0;

  for (const app of applications) {
    try {
      // Use startDate/endDate, fallback to joiningDate/completionDate
      const startDate = app.startDate || app.joiningDate;
      const endDate = app.endDate || app.completionDate;

      if (!startDate || !endDate) {
        console.log(`Skipping ${app.id}: No valid dates`);
        skippedCount++;
        continue;
      }

      // Calculate expected counts using the monthly cycle utility
      const totalExpected = getTotalExpectedCount(startDate, endDate);

      // Count existing approved monthly reports
      const submittedReportsCount = await prisma.monthlyReport.count({
        where: {
          applicationId: app.id,
          status: MonthlyReportStatus.APPROVED,
          isDeleted: false,
        },
      });

      // Count existing completed faculty visits
      const completedVisitsCount = await prisma.facultyVisitLog.count({
        where: {
          applicationId: app.id,
          status: VisitLogStatus.COMPLETED,
        },
      });

      // Update the application with calculated values
      await prisma.internshipApplication.update({
        where: { id: app.id },
        data: {
          totalExpectedReports: totalExpected,
          totalExpectedVisits: totalExpected,
          submittedReportsCount,
          completedVisitsCount,
          expectedCountsLastCalculated: new Date(),
        },
      });

      console.log(
        `Updated ${app.id}: expected=${totalExpected}, reports=${submittedReportsCount}, visits=${completedVisitsCount}`
      );
      successCount++;
    } catch (error) {
      console.error(`Error updating ${app.id}:`, error);
      errorCount++;
    }
  }

  console.log('\n=== Backfill Complete ===');
  console.log(`Success: ${successCount}`);
  console.log(`Skipped (no dates): ${skippedCount}`);
  console.log(`Errors: ${errorCount}`);
  console.log(`Total processed: ${applications.length}`);
}

main()
  .catch((e) => {
    console.error('Fatal error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
