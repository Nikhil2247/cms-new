import { S3Client, ListObjectsV2Command } from '@aws-sdk/client-s3';

const remoteClient = new S3Client({
  endpoint: 'http://147.93.106.69:9000',
  region: 'us-east-1',
  credentials: { accessKeyId: 'minioadmin', secretAccessKey: 'minioadmin' },
  forcePathStyle: true,
});

async function count() {
  let total = 0;
  let totalSize = 0;
  let token: string | undefined;

  do {
    const r = await remoteClient.send(new ListObjectsV2Command({
      Bucket: 'cms-uploads',
      ContinuationToken: token
    }));
    total += r.KeyCount || 0;
    r.Contents?.forEach(o => totalSize += o.Size || 0);
    token = r.NextContinuationToken;
  } while (token);

  console.log('Remote MinIO (147.93.106.69:9000) - cms-uploads bucket:');
  console.log('  Total objects:', total);
  console.log('  Total size:', (totalSize / 1024 / 1024).toFixed(2), 'MB');
}

count();
