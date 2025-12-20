import 'server-only';
import { S3Client } from '@aws-sdk/client-s3';

const endpointRaw = process.env.S3_ENDPOINT;
const endpoint = endpointRaw ? endpointRaw.trim().replace(/\/+$/,'') : undefined;
const region = (process.env.S3_REGION || 'us-east-1').trim();
const forcePathStyle = String(process.env.S3_FORCE_PATH_STYLE ?? 'true').trim().toLowerCase() === 'true';
const accessKeyId = (process.env.S3_ACCESS_KEY_ID || '').trim();
const secretAccessKey = (process.env.S3_SECRET_ACCESS_KEY || '').trim();
const haveCreds = !!(accessKeyId && secretAccessKey);

function createClient() {
  const base = {
    region,
    endpoint,
    forcePathStyle,
  } as any;
  if (haveCreds) {
    base.credentials = { accessKeyId, secretAccessKey };
  }
  return new S3Client(base);
}

export function getS3Client() {
  if (!haveCreds) {
    throw new Error(
      'S3 credentials are missing. Set S3_ACCESS_KEY_ID and S3_SECRET_ACCESS_KEY in .env.local. For MinIO, also set S3_ENDPOINT and S3_FORCE_PATH_STYLE=true.'
    );
  }
  return createClient();
}
