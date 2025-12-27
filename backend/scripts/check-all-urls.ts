import { MongoClient } from 'mongodb';
import * as dotenv from 'dotenv';

dotenv.config();

async function checkUrls() {
  const client = new MongoClient(process.env.DATABASE_URL!);
  await client.connect();
  const db = client.db();

  console.log('='.repeat(70));
  console.log('DATABASE URL FIELDS ANALYSIS');
  console.log('='.repeat(70));
  console.log('');

  const checks = [
    { collection: 'internship_applications', field: 'joiningLetterUrl' },
    { collection: 'Student', field: 'profileImage' },
    { collection: 'Document', field: 'fileUrl' },
    { collection: 'monthly_reports', field: 'reportFileUrl' },
    { collection: 'monthly_feedbacks', field: 'reportUrl' },
    { collection: 'monthly_feedbacks', field: 'imageUrl' },
    { collection: 'state_reports', field: 'reportFileUrl' },
    { collection: 'completion_feedbacks', field: 'completionCertificate' },
    { collection: 'faculty_visit_logs', field: 'visitPhotos' },
  ];

  for (const { collection, field } of checks) {
    try {
      const coll = db.collection(collection);

      // Count total with field
      const existsQuery: any = {};
      existsQuery[field] = { $exists: true, $ne: null };
      const total = await coll.countDocuments(existsQuery);

      if (total > 0) {
        console.log(`\n[${collection}.${field}] - ${total} records with values`);

        // Get sample URLs
        const projection: any = { _id: 0 };
        projection[field] = 1;
        const samples = await coll.find(existsQuery).limit(5).project(projection).toArray();

        console.log('  Sample values:');
        samples.forEach((doc: any) => {
          const value = doc[field];
          if (Array.isArray(value)) {
            value.slice(0, 2).forEach((v: string) => console.log('    -', v?.substring(0, 80)));
          } else if (value) {
            console.log('    -', value.substring(0, 80));
          }
        });

        // Count by pattern
        const patterns = [
          { name: 'localhost:9000', regex: /localhost:9000/ },
          { name: '147.93.106.69:9000', regex: /147\.93\.106\.69:9000/ },
          { name: 'cloudinary', regex: /cloudinary/ },
          { name: 'firebase', regex: /firebase/ },
          { name: 'other http', regex: /^http/ },
        ];

        for (const { name, regex } of patterns) {
          const query: any = {};
          if (field === 'visitPhotos') {
            query[field] = { $elemMatch: { $regex: regex } };
          } else {
            query[field] = { $regex: regex };
          }
          const count = await coll.countDocuments(query);
          if (count > 0) {
            console.log(`  ${name}: ${count}`);
          }
        }
      }
    } catch (e: any) {
      // Ignore collection not found
    }
  }

  await client.close();
}

checkUrls().catch(console.error);
