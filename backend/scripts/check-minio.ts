import { S3Client, ListBucketsCommand, ListObjectsV2Command, CreateBucketCommand, HeadBucketCommand } from '@aws-sdk/client-s3';

const s3Client = new S3Client({
  endpoint: 'http://147.93.106.69:9000',
  region: 'us-east-1',
  credentials: {
    accessKeyId: 'minioadmin',
    secretAccessKey: 'minioadmin',
  },
  forcePathStyle: true, // Required for MinIO
});

async function check() {
  try {
    console.log('Connecting to MinIO at 147.93.106.69:9000...\n');

    // List buckets
    const bucketsResponse = await s3Client.send(new ListBucketsCommand({}));
    console.log('Buckets found:', bucketsResponse.Buckets?.length || 0);
    bucketsResponse.Buckets?.forEach(b => console.log('  -', b.Name));

    // Check if cms-uploads exists
    let bucketExists = false;
    try {
      await s3Client.send(new HeadBucketCommand({ Bucket: 'cms-uploads' }));
      bucketExists = true;
    } catch (e: any) {
      if (e.name === 'NotFound' || e.$metadata?.httpStatusCode === 404) {
        bucketExists = false;
      } else {
        throw e;
      }
    }

    console.log('\ncms-uploads bucket exists:', bucketExists);

    if (!bucketExists) {
      console.log('Creating cms-uploads bucket...');
      await s3Client.send(new CreateBucketCommand({ Bucket: 'cms-uploads' }));
      console.log('Bucket created!');
    } else {
      // List some objects
      console.log('\nListing objects in cms-uploads (first 10):');
      const objects = await s3Client.send(new ListObjectsV2Command({
        Bucket: 'cms-uploads',
        MaxKeys: 10,
      }));

      if (objects.Contents && objects.Contents.length > 0) {
        objects.Contents.forEach(obj => {
          console.log('  -', obj.Key, `(${obj.Size} bytes)`);
        });
      } else {
        console.log('  (empty bucket)');
      }
    }

    console.log('\nMinIO connection successful!');

  } catch (e: any) {
    console.log('Error:', e.message);
    if (e.code) console.log('Code:', e.code);
  }
}

check();
