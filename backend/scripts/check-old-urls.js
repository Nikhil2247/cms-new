const { MongoClient } = require('mongodb');
require('dotenv').config();

async function analyze() {
  const client = new MongoClient(process.env.DATABASE_URL);
  await client.connect();
  const db = client.db();

  // Get old joining letter URLs (not containing localhost:9000)
  const oldJoining = await db.collection('internship_applications').aggregate([
    { $match: { joiningLetterUrl: { $exists: true, $ne: null } } },
    { $match: { joiningLetterUrl: { $not: /localhost:9000/ } } }
  ]).toArray();

  console.log('=== OLD JOINING LETTER URLs ===');
  console.log('Total:', oldJoining.length);

  // Group by extension
  const byExt = {};
  oldJoining.forEach(app => {
    const url = app.joiningLetterUrl || '';
    const ext = url.split('.').pop().toLowerCase();
    byExt[ext] = (byExt[ext] || 0) + 1;
  });

  console.log('\nBy extension:');
  Object.entries(byExt).sort((a, b) => b[1] - a[1]).forEach(([ext, count]) => {
    console.log(`  .${ext}: ${count}`);
  });

  console.log('\nSample URLs:');
  oldJoining.slice(0, 10).forEach(app => {
    console.log('  -', app.joiningLetterUrl);
  });

  await client.close();
}

analyze().catch(console.error);
