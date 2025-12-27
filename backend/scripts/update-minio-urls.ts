import { MongoClient } from 'mongodb';
import * as dotenv from 'dotenv';

dotenv.config();

const OLD_URL = 'http://localhost:9000';
const NEW_URL = 'http://147.93.106.69:9000';

async function updateUrls() {
  const client = new MongoClient(process.env.DATABASE_URL!);
  await client.connect();
  const db = client.db();

  console.log('='.repeat(70));
  console.log('UPDATE MINIO URLs: localhost:9000 -> 147.93.106.69:9000');
  console.log('='.repeat(70));
  console.log('');

  const updates = [
    { collection: 'internship_applications', field: 'joiningLetterUrl' },
    { collection: 'Student', field: 'profileImage' },
    { collection: 'Document', field: 'fileUrl' },
    { collection: 'monthly_reports', field: 'reportFileUrl' },
    { collection: 'monthly_feedbacks', field: 'reportUrl' },
    { collection: 'monthly_feedbacks', field: 'imageUrl' },
    { collection: 'state_reports', field: 'reportFileUrl' },
    { collection: 'completion_feedbacks', field: 'completionCertificate' },
    { collection: 'faculty_visit_logs', field: 'visitPhotos' }, // Array field
  ];

  let totalUpdated = 0;

  for (const { collection, field } of updates) {
    try {
      const coll = db.collection(collection);

      if (field === 'visitPhotos') {
        // Handle array field
        const docs = await coll.find({
          visitPhotos: { $elemMatch: { $regex: /localhost:9000/ } }
        }).toArray();

        for (const doc of docs) {
          const updatedPhotos = doc.visitPhotos.map((url: string) =>
            url.replace(OLD_URL, NEW_URL)
          );
          await coll.updateOne(
            { _id: doc._id },
            { $set: { visitPhotos: updatedPhotos } }
          );
        }

        if (docs.length > 0) {
          console.log(`  ${collection}.${field}: ${docs.length} documents updated (array)`);
          totalUpdated += docs.length;
        }
      } else {
        // Handle string field
        const query: any = {};
        query[field] = { $regex: /localhost:9000/ };

        const count = await coll.countDocuments(query);

        if (count > 0) {
          // Get all documents and update them
          const docs = await coll.find(query).toArray();

          for (const doc of docs) {
            const oldValue = doc[field];
            const newValue = oldValue.replace(OLD_URL, NEW_URL);

            const updateQuery: any = {};
            updateQuery[field] = newValue;

            await coll.updateOne(
              { _id: doc._id },
              { $set: updateQuery }
            );
          }

          console.log(`  ${collection}.${field}: ${count} URLs updated`);
          totalUpdated += count;
        }
      }
    } catch (e: any) {
      // Collection may not exist
      if (!e.message.includes('does not exist')) {
        console.log(`  Error updating ${collection}.${field}: ${e.message}`);
      }
    }
  }

  console.log('\n' + '='.repeat(70));
  console.log('VERIFICATION');
  console.log('='.repeat(70));

  // Verify no localhost URLs remain
  let remainingLocalhost = 0;
  for (const { collection, field } of updates) {
    try {
      const coll = db.collection(collection);
      const query: any = {};

      if (field === 'visitPhotos') {
        query[field] = { $elemMatch: { $regex: /localhost:9000/ } };
      } else {
        query[field] = { $regex: /localhost:9000/ };
      }

      const count = await coll.countDocuments(query);
      if (count > 0) {
        console.log(`  ${collection}.${field}: ${count} localhost URLs remaining!`);
        remainingLocalhost += count;
      }
    } catch (e) {
      // Ignore
    }
  }

  // Count new URLs
  let newUrlCount = 0;
  for (const { collection, field } of updates) {
    try {
      const coll = db.collection(collection);
      const query: any = {};

      if (field === 'visitPhotos') {
        query[field] = { $elemMatch: { $regex: /147\.93\.106\.69:9000/ } };
      } else {
        query[field] = { $regex: /147\.93\.106\.69:9000/ };
      }

      const count = await coll.countDocuments(query);
      if (count > 0) {
        console.log(`  ${collection}.${field}: ${count} remote URLs`);
        newUrlCount += count;
      }
    } catch (e) {
      // Ignore
    }
  }

  console.log('\n' + '='.repeat(70));
  console.log('SUMMARY');
  console.log('='.repeat(70));
  console.log(`  Total URLs updated: ${totalUpdated}`);
  console.log(`  Remaining localhost URLs: ${remainingLocalhost}`);
  console.log(`  Total remote URLs: ${newUrlCount}`);

  if (remainingLocalhost === 0 && newUrlCount > 0) {
    console.log('\n  ✓ ALL URLs SUCCESSFULLY UPDATED TO REMOTE SERVER!');
  }

  await client.close();
}

updateUrls().catch(console.error);
