import { MongoClient } from 'mongodb';

async function verifyDetailed() {
  const client = new MongoClient('mongodb://admin:Admin%401234@147.93.106.69:27017/cms_db?authSource=admin&directConnection=true');

  try {
    await client.connect();
    const db = client.db('cms_db');

    console.log('=== DETAILED DATABASE VERIFICATION ===\n');

    // Get all collections with counts
    const collections = await db.listCollections().toArray();

    console.log('--- ALL COLLECTIONS ---');
    const collectionData: { name: string; count: number }[] = [];

    for (const coll of collections) {
      const count = await db.collection(coll.name).countDocuments();
      collectionData.push({ name: coll.name, count });
    }

    // Sort by count descending
    collectionData.sort((a, b) => b.count - a.count);

    for (const { name, count } of collectionData) {
      console.log(`${name}: ${count}`);
    }

    // Check potential naming issues
    console.log('\n--- CHECKING FOR SIMILAR COLLECTION NAMES ---');

    const searchTerms = ['branch', 'department', 'intern', 'industry', 'semester', 'fee', 'month', 'report'];

    for (const term of searchTerms) {
      const matches = collectionData.filter(c => c.name.toLowerCase().includes(term));
      if (matches.length > 0) {
        console.log(`\n"${term}" matches:`);
        matches.forEach(m => console.log(`  - ${m.name}: ${m.count}`));
      }
    }

    // Check institutions with missing code
    console.log('\n--- INSTITUTIONS MISSING CODE ---');
    const institutionsMissingCode = await db.collection('Institution').find({ code: { $exists: false } }).toArray();
    for (const inst of institutionsMissingCode) {
      console.log(`  - ${inst.name || inst.shortName || inst._id}`);
    }

    // Sample check for data in key collections
    console.log('\n--- SAMPLE DATA CHECK ---');

    // Check a sample user
    const sampleUser = await db.collection('User').findOne({});
    if (sampleUser) {
      console.log('Sample User fields:', Object.keys(sampleUser).join(', '));
    }

    // Check a sample student
    const sampleStudent = await db.collection('Student').findOne({});
    if (sampleStudent) {
      console.log('Sample Student fields:', Object.keys(sampleStudent).join(', '));
    }

    // Check a sample application
    const sampleApp = await db.collection('internship_applications').findOne({});
    if (sampleApp) {
      console.log('Sample Application fields:', Object.keys(sampleApp).join(', '));
    }

    console.log('\n=== VERIFICATION COMPLETE ===');

  } finally {
    await client.close();
  }
}

verifyDetailed().catch(console.error);
