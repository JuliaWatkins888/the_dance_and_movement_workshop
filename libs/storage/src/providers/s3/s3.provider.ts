import { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl as getS3SignedUrl } from '@aws-sdk/s3-request-presigner';
import { z } from 'zod';
import { StorageProvider, UploadObjectInput, UploadObjectResult } from '../../contracts/storage-provider.contract';
import type { StorageConfigSummary } from '../../contracts/storage-config.contract';
import { formatConfigIssues, withStorageFailure } from '../../errors/storage-error';

// One driver serves Cloudflare R2 / AWS S3 / DigitalOcean Spaces / any custom S3-compatible
// endpoint - they only differ by endpoint+credentials, not by API, so there's no per-vendor
// provider to swap (unlike a swappable database driver, which genuinely changes SDKs).
const envSchema = z.object({
  STORAGE_ENDPOINT: z.string().url('STORAGE_ENDPOINT must be a full URL, e.g. https://<accountid>.r2.cloudflarestorage.com'),
  STORAGE_REGION: z.string().min(1).default('auto'),
  STORAGE_BUCKET: z.string().min(1, 'STORAGE_BUCKET environment variable must be set'),
  STORAGE_ACCESS_KEY_ID: z.string().min(1, 'STORAGE_ACCESS_KEY_ID environment variable must be set'),
  STORAGE_SECRET_ACCESS_KEY: z.string().min(1, 'STORAGE_SECRET_ACCESS_KEY environment variable must be set'),
  STORAGE_PUBLIC_BASE_URL: z.string().url('STORAGE_PUBLIC_BASE_URL must be a full URL, e.g. https://pub-xxxx.r2.dev'),
  STORAGE_FORCE_PATH_STYLE: z.enum(['true', 'false']).default('false'),
});

type StorageEnv = z.infer<typeof envSchema>;

// Trimmed because a value pasted into a hosting dashboard often carries a trailing space or
// newline, which would otherwise surface as an opaque SignatureDoesNotMatch from R2.
const readVar = (name: string): string | undefined => {
  const value = process.env[name]?.trim();
  return value ? value : undefined;
};

const getEnv = (): StorageEnv =>
  envSchema.parse({
    STORAGE_ENDPOINT: readVar('STORAGE_ENDPOINT'),
    STORAGE_REGION: readVar('STORAGE_REGION'),
    STORAGE_BUCKET: readVar('STORAGE_BUCKET'),
    STORAGE_ACCESS_KEY_ID: readVar('STORAGE_ACCESS_KEY_ID'),
    STORAGE_SECRET_ACCESS_KEY: readVar('STORAGE_SECRET_ACCESS_KEY'),
    STORAGE_PUBLIC_BASE_URL: readVar('STORAGE_PUBLIC_BASE_URL'),
    STORAGE_FORCE_PATH_STYLE: readVar('STORAGE_FORCE_PATH_STYLE'),
  });

let cachedClient: S3Client | undefined;

// Lazily built on first real use, not at import time or a main.ts boot hook - mirrors
// mongoProvider.connect's own lazy `if (!config.uri) throw` rather than libs/auth's
// assertConfigured-at-startup pattern, so a missing storage config never blocks API boot.
const getClient = (): { client: S3Client; env: StorageEnv } => {
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
      // @aws-sdk/client-s3 >= 3.729 attaches CRC32 checksums to every PutObject by default; R2
      // rejects some of those requests. Only send/verify checksums when an operation requires one.
      requestChecksumCalculation: 'WHEN_REQUIRED',
      responseChecksumValidation: 'WHEN_REQUIRED',
    });
  }
  return { client: cachedClient, env };
};

const buildPublicUrl = (key: string): string => `${getEnv().STORAGE_PUBLIC_BASE_URL.replace(/\/$/, '')}/${key}`;

const R2_API_HOST_SUFFIX = '.r2.cloudflarestorage.com';

// Catches the misconfigurations that otherwise only show up as an opaque 4xx from R2, or as an
// upload that "succeeds" but renders a broken image.
const findConfigWarnings = (env: StorageEnv): readonly string[] => {
  const endpoint = new URL(env.STORAGE_ENDPOINT);
  const publicBase = new URL(env.STORAGE_PUBLIC_BASE_URL);
  const isR2 = endpoint.hostname.endsWith(R2_API_HOST_SUFFIX);
  return [
    ...(endpoint.pathname.replace(/\/$/, '') !== ''
      ? [`STORAGE_ENDPOINT has a path (${endpoint.pathname}); it must be the bare account host with no bucket name`]
      : []),
    ...(publicBase.hostname.endsWith(R2_API_HOST_SUFFIX)
      ? ['STORAGE_PUBLIC_BASE_URL points at the private R2 API host; use the bucket\'s public r2.dev URL or custom domain']
      : []),
    ...(isR2 && env.STORAGE_REGION !== 'auto' ? [`STORAGE_REGION is "${env.STORAGE_REGION}"; R2 expects "auto"`] : []),
  ];
};

const describeConfig = (): StorageConfigSummary => {
  try {
    const env = getEnv();
    return {
      configured: true,
      bucket: env.STORAGE_BUCKET,
      endpointHost: new URL(env.STORAGE_ENDPOINT).host,
      publicBaseUrl: env.STORAGE_PUBLIC_BASE_URL,
      warnings: findConfigWarnings(env),
    };
  } catch (error) {
    const issues = error instanceof z.ZodError ? formatConfigIssues(error) : [error instanceof Error ? error.message : String(error)];
    return { configured: false, issues };
  }
};

export const s3Provider: StorageProvider = {
  name: 'S3-compatible',
  uploadObject: withStorageFailure('upload', async ({ key, body, contentType }: UploadObjectInput): Promise<UploadObjectResult> => {
    const { client, env } = getClient();
    await client.send(
      new PutObjectCommand({ Bucket: env.STORAGE_BUCKET, Key: key, Body: body, ContentType: contentType }),
    );
    return { key, publicUrl: buildPublicUrl(key) };
  }),
  deleteObject: withStorageFailure('delete', async (key: string): Promise<void> => {
    const { client, env } = getClient();
    await client.send(new DeleteObjectCommand({ Bucket: env.STORAGE_BUCKET, Key: key }));
  }),
  // Deliberately built from STORAGE_PUBLIC_BASE_URL, not STORAGE_ENDPOINT - the endpoint is only
  // used for authenticated PUT/DELETE calls; the public base URL is whatever actually serves the
  // bucket (a custom domain, a CDN, or the provider's own public host, e.g. R2's *.r2.dev).
  getPublicUrl: buildPublicUrl,
  getSignedUrl: withStorageFailure('sign', async (key: string, expiresInSeconds: number): Promise<string> => {
    const { client, env } = getClient();
    return getS3SignedUrl(client, new GetObjectCommand({ Bucket: env.STORAGE_BUCKET, Key: key }), {
      expiresIn: expiresInSeconds,
    });
  }),
  describeConfig,
};
