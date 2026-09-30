export interface UploadObjectInput {
  // Full bucket-relative object key - the caller (the storage route) decides the path
  // convention, this package just stores bytes at whatever key it's given.
  key: string;
  body: Buffer;
  contentType: string;
}

export interface UploadObjectResult {
  key: string;
  publicUrl: string;
}

export interface StorageProvider {
  name: string;
  uploadObject: (input: UploadObjectInput) => Promise<UploadObjectResult>;
  deleteObject: (key: string) => Promise<void>;
  getPublicUrl: (key: string) => string;
  // Unused by any route in this pass (nothing needs a private asset yet) - defined from day one
  // so a future private-gallery/ecommerce feature never needs a breaking StorageProvider change,
  // only a new route that calls this.
  getSignedUrl: (key: string, expiresInSeconds: number) => Promise<string>;
}
