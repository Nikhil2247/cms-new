import { MongoClient } from 'mongodb';

async function check() {
  // Password Admin@1234 - the @ needs to be URL encoded as %40
  const uri = 'mongodb://admin:Admin%401234@147.93.106.69:27017/cms_db?authSource=admin';
  console.log('Connecting with admin:Admin@1234...\n');

  const client = new MongoClient(uri);
  try {
    await client.connect();
    console.log('SUCCESS! Connected.\n');

    // Check internship database
    console.log('=== INTERNSHIP DATABASE ===\n');
    const internshipDb = client.db('internship');
    const internshipColls = await internshipDb.listCollections().toArray();
    let internshipTotal = 0;
    for (const coll of internshipColls.sort((a, b) => a.name.localeCompare(b.name))) {
      const count = await internshipDb.collection(coll.name).countDocuments();
      internshipTotal += count;
      if (count > 0) console.log(`  ${coll.name.padEnd(30)} : ${count}`);
    }
    console.log(`\n  ${'TOTAL'.padEnd(30)} : ${internshipTotal}\n`);

    // Check cms_db database
    console.log('=== CMS_DB DATABASE ===\n');
    const cmsDb = client.db('cms_db');
    const cmsColls = await cmsDb.listCollections().toArray();
    let cmsTotal = 0;
    for (const coll of cmsColls.sort((a, b) => a.name.localeCompare(b.name))) {
      const count = await cmsDb.collection(coll.name).countDocuments();
      cmsTotal += count;
      if (count > 0) console.log(`  ${coll.name.padEnd(30)} : ${count}`);
    }
    console.log(`\n  ${'TOTAL'.padEnd(30)} : ${cmsTotal}`);

    await client.close();
  } catch (e: any) {
    console.log('Error:', e.message);
  }
}

check();
