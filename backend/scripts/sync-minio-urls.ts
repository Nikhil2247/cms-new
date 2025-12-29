import { MongoClient, ObjectId } from 'mongodb';
import { S3Client, ListObjectsV2Command } from '@aws-sdk/client-s3';
import * as dotenv from 'dotenv';

dotenv.config();

const MINIO_ENDPOINT = 'http://147.93.106.69:9000';
const BUCKET = 'cms-uploads';

const s3Client = new S3Client({
  endpoint: MINIO_ENDPOINT,
  region: 'us-east-1',
  credentials: {
    accessKeyId: 'minioadmin',
    secretAccessKey: 'minioadmin',
  },
  forcePathStyle: true,
});

interface MinioFile {
  key: string;
  studentId: string;
  type: string;
  url: string;
}

async function syncMinioUrls() {
  const mongoClient = new MongoClient(process.env.DATABASE_URL!);
  await mongoClient.connect();
  const db = mongoClient.db();

  console.log('='.repeat(70));
  console.log('SYNC MINIO URLs TO DATABASE');
  console.log('='.repeat(70));
  console.log('');

  // Step 1: Get all MinIO files
  console.log('Step 1: Scanning MinIO bucket...');
  const minioFiles: MinioFile[] = [];
  let continuationToken: string | undefined;

  do {
    const response = await s3Client.send(new ListObjectsV2Command({
      Bucket: BUCKET,
      Prefix: 'institutions/',
      ContinuationToken: continuationToken,
    }));

    if (response.Contents) {
      for (const obj of response.Contents) {
        const key = obj.Key || '';
        // Parse: institutions/{instId}/students/{studentId}/{type}/{filename}
        const match = key.match(/institutions\/([^\/]+)\/students\/([^\/]+)\/([^\/]+)\/(.+)/);
        if (match) {
          minioFiles.push({
            key,
            studentId: match[2],
            type: match[3], // joining-letter, profile, other, etc.
            url: `${MINIO_ENDPOINT}/${BUCKET}/${key}`,
          });
        }
      }
    }
    continuationToken = response.NextContinuationToken;
  } while (continuationToken);

  console.log(`  Found ${minioFiles.length} student files in MinIO\n`);

  // Group by student and type
  const filesByStudent = new Map<string, Map<string, MinioFile[]>>();
  for (const file of minioFiles) {
    if (!filesByStudent.has(file.studentId)) {
      filesByStudent.set(file.studentId, new Map());
    }
    const studentFiles = filesByStudent.get(file.studentId)!;
    if (!studentFiles.has(file.type)) {
      studentFiles.set(file.type, []);
    }
    studentFiles.get(file.type)!.push(file);
  }

  console.log(`  Grouped into ${filesByStudent.size} students\n`);

  // Step 2: Update Student profileImage
  console.log('Step 2: Updating Student.profileImage...');
  let profileUpdated = 0;
  for (const [studentId, types] of filesByStudent) {
    const profileFiles = types.get('profile');
    if (profileFiles && profileFiles.length > 0) {
      try {
        const result = await db.collection('Student').updateOne(
          { _id: new ObjectId(studentId) },
          { $set: { profileImage: profileFiles[0].url } }
        );
        if (result.modifiedCount > 0) profileUpdated++;
      } catch (e) {
        // Student may not exist
      }
    }
  }
  console.log(`  Updated ${profileUpdated} profile images\n`);

  // Step 3: Update InternshipApplication joiningLetterUrl
  console.log('Step 3: Updating internship_applications.joiningLetterUrl...');
  let joiningUpdated = 0;
  for (const [studentId, types] of filesByStudent) {
    const joiningFiles = types.get('joining-letter');
    if (joiningFiles && joiningFiles.length > 0) {
      try {
        const result = await db.collection('internship_applications').updateMany(
          { studentId: new ObjectId(studentId) },
          { $set: { joiningLetterUrl: joiningFiles[0].url } }
        );
        joiningUpdated += result.modifiedCount;
      } catch (e) {
        // Application may not exist
      }
    }
  }
  console.log(`  Updated ${joiningUpdated} joining letter URLs\n`);

  // Step 4: Update Document fileUrl
  console.log('Step 4: Updating Document.fileUrl...');
  let docUpdated = 0;
  for (const [studentId, types] of filesByStudent) {
    const otherFiles = types.get('other');
    if (otherFiles && otherFiles.length > 0) {
      // Update documents based on filename patterns
      for (const file of otherFiles) {
        const filename = file.key.split('/').pop() || '';
        let docType: string | null = null;

        if (filename.includes('marksheet_10th')) docType = 'MARKSHEET_10TH';
        else if (filename.includes('marksheet_12th')) docType = 'MARKSHEET_12TH';
        else if (filename.includes('caste_certificate')) docType = 'CASTE_CERTIFICATE';
        else if (filename.includes('photo')) docType = 'PHOTO';

        if (docType) {
          try {
            const result = await db.collection('Document').updateOne(
              { studentId: new ObjectId(studentId), type: docType },
              { $set: { fileUrl: file.url } }
            );
            if (result.modifiedCount > 0) docUpdated++;
          } catch (e) {
            // Document may not exist
          }
        }
      }
    }
  }
  console.log(`  Updated ${docUpdated} document URLs\n`);

  // Step 5: Verification
  console.log('='.repeat(70));
  console.log('VERIFICATION');
  console.log('='.repeat(70));

  const verifications = [
    { collection: 'Student', field: 'profileImage' },
    { collection: 'internship_applications', field: 'joiningLetterUrl' },
    { collection: 'Document', field: 'fileUrl' },
  ];

  for (const { collection, field } of verifications) {
    const query: any = {};
    query[field] = { $regex: /147\.93\.106\.69:9000/ };
    const count = await db.collection(collection).countDocuments(query);
    console.log(`  ${collection}.${field}: ${count} remote MinIO URLs`);
  }

  console.log('\n' + '='.repeat(70));
  console.log('SUMMARY');
  console.log('='.repeat(70));
  console.log(`  Profile images updated: ${profileUpdated}`);
  console.log(`  Joining letters updated: ${joiningUpdated}`);
  console.log(`  Documents updated: ${docUpdated}`);
  console.log(`  Total: ${profileUpdated + joiningUpdated + docUpdated}`);

  await mongoClient.close();
}

syncMinioUrls().catch(console.error);
