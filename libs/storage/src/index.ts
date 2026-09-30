import { s3Provider } from './providers/s3/s3.provider';
import type { UploadObjectInput } from './contracts/storage-provider.contract';

export const uploadObject = (input: UploadObjectInput) => s3Provider.uploadObject(input);
export const deleteObject = (key: string) => s3Provider.deleteObject(key);
export const getPublicUrl = (key: string) => s3Provider.getPublicUrl(key);
export const getSignedUrl = (key: string, expiresInSeconds: number) => s3Provider.getSignedUrl(key, expiresInSeconds);

export type { StorageProvider, UploadObjectInput, UploadObjectResult } from './contracts/storage-provider.contract';
