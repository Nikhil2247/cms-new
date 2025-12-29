import { MongoClient } from 'mongodb';

async function verify() {
  const client = new MongoClient('mongodb://admin:Admin%401234@147.93.106.69:27017/cms_db?authSource=admin&directConnection=true');

  try {
    await client.connect();
    const db = client.db('cms_db');

    console.log('=== DATABASE VERIFICATION ===\n');

    // Get all collections
    const collections = await db.listCollections().toArray();
    console.log('Total Collections:', collections.length);
    console.log('\n--- Collection Document Counts ---');

    // Check key collections
    const keyCollections = [
      'User', 'Student', 'Institution', 'Batch', 'Semester', 'Branch',
      'branches', 'departments', 'internships', 'industries',
      'internship_applications', 'faculty_visit_logs', 'monthly_reports',
      'mentor_assignments', 'Grievance', 'GrievanceStatusHistory',
      'Document', 'Notification', 'FeeStructure', 'completion_feedbacks'
    ];

    for (const collName of keyCollections) {
      try {
        const count = await db.collection(collName).countDocuments();
        console.log(`${collName}: ${count}`);
      } catch (e) {
        console.log(`${collName}: (not found)`);
      }
    }

    // Check for archived collections
    console.log('\n--- Archived Collections ---');
    const archivedColls = collections.filter(c => c.name.startsWith('_archived'));
    for (const coll of archivedColls) {
      const count = await db.collection(coll.name).countDocuments();
      console.log(`${coll.name}: ${count}`);
    }

    // Check for missing required fields in key collections
    console.log('\n--- Data Integrity Checks ---');

    // Users without required fields
    const usersWithoutLoginCount = await db.collection('User').countDocuments({ loginCount: { $exists: false } });
    const usersWithoutChangedPwd = await db.collection('User').countDocuments({ hasChangedDefaultPassword: { $exists: false } });
    console.log('Users missing loginCount:', usersWithoutLoginCount);
    console.log('Users missing hasChangedDefaultPassword:', usersWithoutChangedPwd);

    // Internship applications without required fields
    const appsWithoutReportsGenerated = await db.collection('internship_applications').countDocuments({ reportsGenerated: { $exists: false } });
    console.log('Applications missing reportsGenerated:', appsWithoutReportsGenerated);

    // Faculty visit logs without status
    const visitsWithoutStatus = await db.collection('faculty_visit_logs').countDocuments({ status: { $exists: false } });
    console.log('Faculty visits missing status:', visitsWithoutStatus);

    // Grievances without escalationLevel
    const grievancesWithoutLevel = await db.collection('Grievance').countDocuments({ escalationLevel: { $exists: false } });
    console.log('Grievances missing escalationLevel:', grievancesWithoutLevel);

    // Check students with typo field
    const studentsWithTypo = await db.collection('Student').countDocuments({ feeStuctureId: { $exists: true } });
    console.log('Students with feeStuctureId typo:', studentsWithTypo);

    // Check institutions
    const institutionsWithoutCode = await db.collection('Institution').countDocuments({ code: { $exists: false } });
    console.log('Institutions missing code:', institutionsWithoutCode);

    console.log('\n=== VERIFICATION COMPLETE ===');

  } finally {
    await client.close();
  }
}

verify().catch(console.error);
