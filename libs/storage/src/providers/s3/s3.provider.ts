import { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl as getS3SignedUrl } from '@aws-sdk/s3-request-presigner';
import { z } from 'zod';
import { StorageProvider, UploadObjectInput, UploadObjectResult } from '../../contracts/storage-provider.contract';

// One driver serves Cloudflare R2 / AWS S3 / DigitalOcean Spaces / any custom S3-compatible
// endpoint - they only differ by endpoint+credentials, not by API, so there's no per-vendor
// provider to swap (unlike a swappable database driver, which genuinely changes SDKs).
const envSchema = z.object({
  STORAGE_ENDPOINT: z.string().min(1, 'STORAGE_ENDPOINT environment variable must be set'),
  STORAGE_REGION: z.string().min(1).default('auto'),
  STORAGE_BUCKET: z.string().min(1, 'STORAGE_BUCKET environment variable must be set'),
  STORAGE_ACCESS_KEY_ID: z.string().min(1, 'STORAGE_ACCESS_KEY_ID environment variable must be set'),
  STORAGE_SECRET_ACCESS_KEY: z.string().min(1, 'STORAGE_SECRET_ACCESS_KEY environment variable must be set'),
  STORAGE_PUBLIC_BASE_URL: z.string().min(1, 'STORAGE_PUBLIC_BASE_URL environment variable must be set'),
  STORAGE_FORCE_PATH_STYLE: z.enum(['true', 'false']).default('false'),
});

const getEnv = () =>
  envSchema.parse({
    STORAGE_ENDPOINT: process.env['STORAGE_ENDPOINT'],
    STORAGE_REGION: process.env['STORAGE_REGION'],
    STORAGE_BUCKET: process.env['STORAGE_BUCKET'],
    STORAGE_ACCESS_KEY_ID: process.env['STORAGE_ACCESS_KEY_ID'],
    STORAGE_SECRET_ACCESS_KEY: process.env['STORAGE_SECRET_ACCESS_KEY'],
    STORAGE_PUBLIC_BASE_URL: process.env['STORAGE_PUBLIC_BASE_URL'],
    STORAGE_FORCE_PATH_STYLE: process.env['STORAGE_FORCE_PATH_STYLE'],
  });

let cachedClient: S3Client | undefined;

// Lazily built on first real use, not at import time or a main.ts boot hook - mirrors
// mongoProvider.connect's own lazy `if (!config.uri) throw` rather than libs/auth's
// assertConfigured-at-startup pattern, so this package never needs a plugin injection into the
// shared apps/api/src/main.ts bootstrap file.
const getClient = (): { client: S3Client; env: ReturnType<typeof getEnv> } => {
  const env = getEnv();
  if (!cachedClient) {
    cachedClient = new S3Client({
      region: env.STORAGE_REGION,
      endpoint: env.STORAGE_ENDPOINT,
      forcePathStyle: env.STORAGE_FORCE_PATH_STYLE === 'true',
      credentials: {
        accessKeyId: env.STORAGE_ACCESS_KEY_ID,
        secretAccessKey: env.STORAGE_SECRET_ACCESS_KEY,
      },
    });
  }
  return { client: cachedClient, env };
};

export const s3Provider: StorageProvider = {
  name: 'S3-compatible',
  uploadObject: async ({ key, body, contentType }: UploadObjectInput): Promise<UploadObjectResult> => {
    const { client, env } = getClient();
    await client.send(
      new PutObjectCommand({ Bucket: env.STORAGE_BUCKET, Key: key, Body: body, ContentType: contentType }),
    );
    return { key, publicUrl: s3Provider.getPublicUrl(key) };
  },
  deleteObject: async (key: string): Promise<void> => {
    const { client, env } = getClient();
    await client.send(new DeleteObjectCommand({ Bucket: env.STORAGE_BUCKET, Key: key }));
  },
  // Deliberately built from STORAGE_PUBLIC_BASE_URL, not STORAGE_ENDPOINT - the endpoint is only
  // used for authenticated PUT/DELETE calls; the public base URL is whatever actually serves the
  // bucket (a custom domain, a CDN, or the provider's own public host, e.g. R2's *.r2.dev).
  getPublicUrl: (key: string): string => {
    const env = getEnv();
    return `${env.STORAGE_PUBLIC_BASE_URL.replace(/\/$/, '')}/${key}`;
  },
  getSignedUrl: async (key: string, expiresInSeconds: number): Promise<string> => {
    const { client, env } = getClient();
    return getS3SignedUrl(client, new GetObjectCommand({ Bucket: env.STORAGE_BUCKET, Key: key }), {
      expiresIn: expiresInSeconds,
    });
  },
};
