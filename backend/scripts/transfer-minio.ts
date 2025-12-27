import {
  S3Client,
  ListObjectsV2Command,
  GetObjectCommand,
  PutObjectCommand,
  HeadBucketCommand,
  CreateBucketCommand
} from '@aws-sdk/client-s3';
import { Readable } from 'stream';

// Local Docker MinIO
const localClient = new S3Client({
  endpoint: 'http://localhost:9000',
  region: 'us-east-1',
  credentials: {
    accessKeyId: 'minioadmin',
    secretAccessKey: 'minioadmin123',
  },
  forcePathStyle: true,
});

// Remote MinIO Server
const remoteClient = new S3Client({
  endpoint: 'http://147.93.106.69:9000',
  region: 'us-east-1',
  credentials: {
    accessKeyId: 'minioadmin',
    secretAccessKey: 'minioadmin',
  },
  forcePathStyle: true,
});

const BUCKET = 'cms-uploads';

async function streamToBuffer(stream: Readable): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

async function ensureBucket(client: S3Client, name: string): Promise<boolean> {
  try {
    await client.send(new HeadBucketCommand({ Bucket: name }));
    return true;
  } catch (e: any) {
    if (e.name === 'NotFound' || e.$metadata?.httpStatusCode === 404) {
      await client.send(new CreateBucketCommand({ Bucket: name }));
      console.log(`Created bucket: ${name}`);
      return true;
    }
    throw e;
  }
}

async function transfer() {
  console.log('='.repeat(60));
  console.log('MinIO Data Transfer: Local Docker -> Remote Server');
  console.log('='.repeat(60));
  console.log('');

  try {
    // Check local MinIO
    console.log('Checking local MinIO (localhost:9000)...');
    let localObjects: any[] = [];
    let continuationToken: string | undefined;

    do {
      const response = await localClient.send(new ListObjectsV2Command({
        Bucket: BUCKET,
        ContinuationToken: continuationToken,
      }));

      if (response.Contents) {
        localObjects.push(...response.Contents);
      }
      continuationToken = response.NextContinuationToken;
    } while (continuationToken);

    console.log(`Found ${localObjects.length} objects in local MinIO\n`);

    if (localObjects.length === 0) {
      console.log('No objects to transfer.');
      return;
    }

    // Ensure remote bucket exists
    console.log('Checking remote MinIO (147.93.106.69:9000)...');
    await ensureBucket(remoteClient, BUCKET);
    console.log('Remote bucket ready.\n');

    // Transfer objects
    console.log('Starting transfer...\n');
    let transferred = 0;
    let failed = 0;
    let totalBytes = 0;

    for (const obj of localObjects) {
      try {
        process.stdout.write(`  Transferring: ${obj.Key} (${obj.Size} bytes)... `);

        // Get from local
        const getResponse = await localClient.send(new GetObjectCommand({
          Bucket: BUCKET,
          Key: obj.Key,
        }));

        const body = await streamToBuffer(getResponse.Body as Readable);

        // Put to remote
        await remoteClient.send(new PutObjectCommand({
          Bucket: BUCKET,
          Key: obj.Key,
          Body: body,
          ContentType: getResponse.ContentType,
        }));

        console.log('OK');
        transferred++;
        totalBytes += obj.Size || 0;
      } catch (e: any) {
        console.log('FAILED -', e.message);
        failed++;
      }
    }

    console.log('\n' + '='.repeat(60));
    console.log('Transfer Complete!');
    console.log('='.repeat(60));
    console.log(`  Transferred: ${transferred} objects`);
    console.log(`  Failed: ${failed} objects`);
    console.log(`  Total size: ${(totalBytes / 1024 / 1024).toFixed(2)} MB`);

  } catch (e: any) {
    console.log('Error:', e.message);
    if (e.code === 'ECONNREFUSED') {
      console.log('\nMake sure local Docker MinIO is running:');
      console.log('  docker-compose up -d minio');
    }
  }
}

transfer();
