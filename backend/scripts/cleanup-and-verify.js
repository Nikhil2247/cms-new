const { MongoClient } = require('mongodb');
require('dotenv').config();

async function cleanupAndVerify() {
  const client = new MongoClient(process.env.DATABASE_URL);
  await client.connect();
  const db = client.db();

  console.log('='.repeat(70));
  console.log('CLEANUP AND VERIFICATION SCRIPT');
  console.log('='.repeat(70));
  console.log('');

  // =========================================================================
  // STEP 1: Clean up orphaned joining letter URLs
  // =========================================================================
  console.log('STEP 1: Cleaning up orphaned joiningLetterUrl records...');

  const orphanedJoining = await db.collection('internship_applications').find({
    joiningLetterUrl: { $exists: true, $ne: null, $not: /localhost:9000/ }
  }).toArray();

  console.log(`  Found ${orphanedJoining.length} orphaned joiningLetterUrl records`);

  for (const app of orphanedJoining) {
    // Check if student exists
    const student = await db.collection('Student').findOne({ _id: app.studentId });

    if (!student) {
      console.log(`  - Removing orphaned app (student not found): ${app.joiningLetterUrl}`);
      // Delete the entire orphaned application
      await db.collection('internship_applications').deleteOne({ _id: app._id });
    } else {
      console.log(`  - Clearing old URL for student ${student.rollNumber}: ${app.joiningLetterUrl}`);
      // Just clear the URL, keep the application
      await db.collection('internship_applications').updateOne(
        { _id: app._id },
        { $set: { joiningLetterUrl: null, joiningLetterUploadedAt: null } }
      );
    }
  }

  // =========================================================================
  // STEP 2: Clean up orphaned profile images
  // =========================================================================
  console.log('\nSTEP 2: Cleaning up orphaned profileImage records...');

  const orphanedProfiles = await db.collection('Student').find({
    profileImage: { $exists: true, $ne: null, $not: /localhost:9000/ }
  }).toArray();

  console.log(`  Found ${orphanedProfiles.length} orphaned profileImage records`);

  for (const student of orphanedProfiles) {
    console.log(`  - Clearing old profileImage for ${student.rollNumber}: ${student.profileImage}`);
    await db.collection('Student').updateOne(
      { _id: student._id },
      { $set: { profileImage: null } }
    );
  }

  // =========================================================================
  // STEP 3: Clean up orphaned document URLs
  // =========================================================================
  console.log('\nSTEP 3: Cleaning up orphaned Document.fileUrl records...');

  const orphanedDocs = await db.collection('Document').find({
    fileUrl: { $exists: true, $ne: null, $not: /localhost:9000/ }
  }).toArray();

  console.log(`  Found ${orphanedDocs.length} orphaned Document records`);

  for (const doc of orphanedDocs) {
    // Check if student exists
    const student = await db.collection('Student').findOne({ _id: doc.studentId });

    if (!student) {
      console.log(`  - Deleting orphaned document (student not found): ${doc.fileUrl}`);
      await db.collection('Document').deleteOne({ _id: doc._id });
    } else {
      console.log(`  - Clearing old fileUrl for student ${student.rollNumber}: ${doc.fileUrl}`);
      await db.collection('Document').updateOne(
        { _id: doc._id },
        { $set: { fileUrl: null } }
      );
    }
  }

  // =========================================================================
  // STEP 4: Comprehensive verification of all file URL fields
  // =========================================================================
  console.log('\n' + '='.repeat(70));
  console.log('VERIFICATION: All File URL Fields in Database');
  console.log('='.repeat(70));

  // InternshipApplication fields
  console.log('\n[InternshipApplication]');
  const joiningLetterCount = await db.collection('internship_applications').countDocuments({
    joiningLetterUrl: { $exists: true, $ne: null }
  });
  const joiningMinioCount = await db.collection('internship_applications').countDocuments({
    joiningLetterUrl: /localhost:9000/
  });
  console.log(`  joiningLetterUrl: ${joiningMinioCount} MinIO URLs (${joiningLetterCount} total)`);

  // Student fields
  console.log('\n[Student]');
  const profileCount = await db.collection('Student').countDocuments({
    profileImage: { $exists: true, $ne: null }
  });
  const profileMinioCount = await db.collection('Student').countDocuments({
    profileImage: /localhost:9000/
  });
  console.log(`  profileImage: ${profileMinioCount} MinIO URLs (${profileCount} total)`);

  // Document fields
  console.log('\n[Document]');
  const docCount = await db.collection('Document').countDocuments({
    fileUrl: { $exists: true, $ne: null }
  });
  const docMinioCount = await db.collection('Document').countDocuments({
    fileUrl: /localhost:9000/
  });
  console.log(`  fileUrl: ${docMinioCount} MinIO URLs (${docCount} total)`);

  // MonthlyReport fields
  console.log('\n[MonthlyReport]');
  const reportCount = await db.collection('monthly_reports').countDocuments({
    reportFileUrl: { $exists: true, $ne: null }
  });
  const reportMinioCount = await db.collection('monthly_reports').countDocuments({
    reportFileUrl: /localhost:9000/
  });
  console.log(`  reportFileUrl: ${reportMinioCount} MinIO URLs (${reportCount} total)`);

  // MonthlyFeedback fields
  console.log('\n[MonthlyFeedback]');
  const feedbackReportCount = await db.collection('monthly_feedbacks').countDocuments({
    reportUrl: { $exists: true, $ne: null }
  });
  const feedbackImageCount = await db.collection('monthly_feedbacks').countDocuments({
    imageUrl: { $exists: true, $ne: null }
  });
  console.log(`  reportUrl: ${feedbackReportCount} records`);
  console.log(`  imageUrl: ${feedbackImageCount} records`);

  // FacultyVisitLog fields
  console.log('\n[FacultyVisitLog]');
  const visitPhotoCount = await db.collection('faculty_visit_logs').countDocuments({
    visitPhotos: { $exists: true, $ne: [], $ne: null }
  });
  console.log(`  visitPhotos: ${visitPhotoCount} records with photos`);

  // StateReport fields
  console.log('\n[StateReport]');
  const stateReportCount = await db.collection('state_reports').countDocuments({
    reportFileUrl: { $exists: true, $ne: null }
  });
  console.log(`  reportFileUrl: ${stateReportCount} records`);

  // CompletionFeedback fields
  console.log('\n[CompletionFeedback]');
  const completionCertCount = await db.collection('completion_feedbacks').countDocuments({
    completionCertificate: { $exists: true, $ne: null }
  });
  console.log(`  completionCertificate: ${completionCertCount} records`);

  // =========================================================================
  // STEP 5: Check for any remaining non-MinIO URLs
  // =========================================================================
  console.log('\n' + '='.repeat(70));
  console.log('CHECKING FOR REMAINING NON-MINIO URLs');
  console.log('='.repeat(70));

  const collections = [
    { name: 'internship_applications', field: 'joiningLetterUrl' },
    { name: 'Student', field: 'profileImage' },
    { name: 'Document', field: 'fileUrl' },
    { name: 'monthly_reports', field: 'reportFileUrl' },
    { name: 'monthly_feedbacks', field: 'reportUrl' },
    { name: 'monthly_feedbacks', field: 'imageUrl' },
    { name: 'state_reports', field: 'reportFileUrl' },
    { name: 'completion_feedbacks', field: 'completionCertificate' },
  ];

  let totalNonMinio = 0;
  for (const { name, field } of collections) {
    const query = {};
    query[field] = { $exists: true, $ne: null, $not: /localhost:9000/ };

    const count = await db.collection(name).countDocuments(query);
    if (count > 0) {
      console.log(`  ${name}.${field}: ${count} non-MinIO URLs`);
      totalNonMinio += count;
    }
  }

  if (totalNonMinio === 0) {
    console.log('  ✓ All URL fields are either null or contain MinIO URLs!');
  }

  // =========================================================================
  // FINAL SUMMARY
  // =========================================================================
  console.log('\n' + '='.repeat(70));
  console.log('FINAL SUMMARY');
  console.log('='.repeat(70));

  const totalMinioUrls = joiningMinioCount + profileMinioCount + docMinioCount;
  console.log(`\n  Total MinIO URLs in database: ${totalMinioUrls}`);
  console.log(`  - Joining Letters: ${joiningMinioCount}`);
  console.log(`  - Profile Images: ${profileMinioCount}`);
  console.log(`  - Documents: ${docMinioCount}`);
  console.log(`\n  Orphaned records cleaned: ${orphanedJoining.length + orphanedProfiles.length + orphanedDocs.length}`);
  console.log(`  Non-MinIO URLs remaining: ${totalNonMinio}`);

  if (totalNonMinio === 0) {
    console.log('\n  ✓ DATABASE IS CLEAN AND ALL FILES ARE ON MINIO!');
  }

  await client.close();
}

cleanupAndVerify().catch(console.error);
