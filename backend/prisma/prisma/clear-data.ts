import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Clear all data from the database
 * Deletes data in order to respect foreign key constraints
 */
async function clearAllData() {
  console.log('🗑️  Starting to clear all data from the database...\n');

  try {
    // Delete in order of dependencies (child tables first, then parent tables)
    
    // =============================================
    // LEVEL 1: Models with no dependencies or only leaf dependencies
    // =============================================
    
    console.log('📋 Clearing technical queries...');
    await prisma.technicalQuery.deleteMany({});
    
    console.log('📋 Clearing grievances...');
    await prisma.grievance.deleteMany({});
    
    console.log('📋 Clearing approved referrals...');
    await prisma.approvedReferral.deleteMany({});
    
    console.log('📋 Clearing industry requests...');
    await prisma.industryRequest.deleteMany({});
    
    console.log('📋 Clearing referral applications...');
    await prisma.referralApplication.deleteMany({});
    
    console.log('📋 Clearing faculty visit logs...');
    await prisma.facultyVisitLog.deleteMany({});
    
    console.log('📋 Clearing completion feedbacks...');
    await prisma.completionFeedback.deleteMany({});
    
    console.log('📋 Clearing monthly feedbacks...');
    await prisma.monthlyFeedback.deleteMany({});
    
    console.log('📋 Clearing monthly reports...');
    await prisma.monthlyReport.deleteMany({});
    
    console.log('📋 Clearing compliance records...');
    await prisma.complianceRecord.deleteMany({});
    
    console.log('📋 Clearing mentor assignments...');
    await prisma.mentorAssignment.deleteMany({});
    
    console.log('📋 Clearing internship applications...');
    await prisma.internshipApplication.deleteMany({});
    
    console.log('📋 Clearing internships...');
    await prisma.internship.deleteMany({});
    
    console.log('📋 Clearing industries...');
    await prisma.industry.deleteMany({});
    
    // =============================================
    // LEVEL 2: Placement, Events, Class Assignments
    // =============================================
    
    console.log('📋 Clearing placements...');
    await prisma.placement.deleteMany({});

    
    console.log('📋 Clearing class assignments...');
    await prisma.classAssignment.deleteMany({});
    
    // =============================================
    // LEVEL 3: Academic & Fee Related
    // =============================================
    
    console.log('📋 Clearing exam results...');
    await prisma.examResult.deleteMany({});
    
    console.log('📋 Clearing fees...');
    await prisma.fee.deleteMany({});
    
    console.log('📋 Clearing documents...');
    await prisma.document.deleteMany({});
    
    console.log('📋 Clearing internship preferences...');
    await prisma.internshipPreference.deleteMany({});
    
    // =============================================
    // LEVEL 4: Student Related
    // =============================================
    
    console.log('📋 Clearing students...');
    await prisma.student.deleteMany({});
    
    // =============================================
    // LEVEL 5: Notifications & FCM
    // =============================================
    
    console.log('📋 Clearing notifications...');
    await prisma.notification.deleteMany({});
    
    console.log('📋 Clearing notification settings...');
    await prisma.notificationSettings.deleteMany({});
    
    console.log('📋 Clearing FCM tokens...');
    await prisma.fCMToken.deleteMany({});
    
    // =============================================
    // LEVEL 6: Reports & Logs
    // =============================================
    
    console.log('📋 Clearing state reports...');
    await prisma.stateReport.deleteMany({});
    
    console.log('📋 Clearing fee reports...');
    await prisma.feeReport.deleteMany({});
    
    console.log('📋 Clearing audit logs...');
    await prisma.auditLog.deleteMany({});
    
    console.log('📋 Clearing calendars...');
    await prisma.calendar.deleteMany({});
    
    console.log('📋 Clearing notices...');
    await prisma.notice.deleteMany({});
    
    // =============================================
    // LEVEL 7: Academic Structure
    // =============================================
    
    console.log('📋 Clearing subjects...');
    await prisma.subject.deleteMany({});
    
    console.log('📋 Clearing semesters...');
    await prisma.semester.deleteMany({});
    
    console.log('📋 Clearing scholarships...');
    await prisma.scholarship.deleteMany({});
    
    console.log('📋 Clearing fee structures...');
    await prisma.feeStructure.deleteMany({});
    
    console.log('📋 Clearing batches...');
    await prisma.batch.deleteMany({});
    
    console.log('📋 Clearing branches...');
    await prisma.branch.deleteMany({});
    
    console.log('📋 Clearing departments...');
    await prisma.department.deleteMany({});
    
    // =============================================
    // LEVEL 8: Institution & User
    // =============================================
    
    console.log('📋 Clearing institution settings...');
    await prisma.institutionSettings.deleteMany({});
    
    console.log('📋 Clearing blacklisted tokens...');
    await prisma.blacklistedToken.deleteMany({});
    
    console.log('📋 Clearing users...');
    await prisma.user.deleteMany({});
    
    console.log('📋 Clearing institutions...');
    await prisma.institution.deleteMany({});

    console.log('\n✅ All data has been cleared successfully!');
    console.log('📊 Database is now empty and ready for fresh data.\n');

  } catch (error) {
    console.error('❌ Error clearing data:', error);
    throw error;
  }
}

async function main() {
  console.log('═══════════════════════════════════════════════════════');
  console.log('         DATABASE CLEAR UTILITY                        ');
  console.log('═══════════════════════════════════════════════════════\n');
  
  console.log('⚠️  WARNING: This will DELETE ALL DATA from the database!');
  console.log('   This action is IRREVERSIBLE!\n');

  await clearAllData();
}

main()
  .catch((e) => {
    console.error('❌ Failed to clear database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
