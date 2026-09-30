import { randomUUID } from 'node:crypto';
import { Router } from 'express';
import type { NextFunction, Request, Response, Router as RouterType } from 'express';
import multer from 'multer';
import {
  asyncHandler,
  createSuccessResponse,
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from '@inithium/api-utils';
import { requireAuth } from '@inithium/auth';
import { createAsset, getAssetById, getUserRepository } from '@inithium/db';
import type { UserEntity } from '@inithium/db';
import { hasCapability } from '@inithium/permissions';
import { uploadObject } from '@inithium/storage';
import { UPLOAD_PURPOSE_CAPABILITIES, uploadAssetSchema } from '../schemas/storage.schema';
import { releaseCloudAsset } from '../services/cloud-image.service';

const router: RouterType = Router();

const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024;
// No image/svg+xml - an uploaded SVG can carry <script> and is a stored-XSS vector once rendered
// as/inlined via <img>.
const EXTENSION_BY_MIME_TYPE: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
};

const UPLOAD_CAPABILITIES = Object.values(UPLOAD_PURPOSE_CAPABILITIES);

const normalizeParam = (raw: string | string[]): string => (Array.isArray(raw) ? raw[0] : raw);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE_BYTES },
  fileFilter: (_req, file, callback) => {
    if (!(file.mimetype in EXTENSION_BY_MIME_TYPE)) {
      callback(new Error(`Unsupported file type: ${file.mimetype}`));
      return;
    }
    callback(null, true);
  },
});

// multer's own errors (and fileFilter rejections) don't compose with the shared errorHandler on
// their own - it only special-cases `instanceof AppError` - so this adapts them into a clean
// ValidationError before calling next(), rather than mounting multer directly as route middleware.
const handleUpload = (req: Request, res: Response, next: NextFunction): void => {
  upload.single('file')(req, res, (err: unknown) => {
    if (err instanceof multer.MulterError) {
      next(ValidationError(err.code === 'LIMIT_FILE_SIZE' ? 'File too large. Max size is 5MB.' : err.message));
      return;
    }
    if (err) {
      next(ValidationError(err instanceof Error ? err.message : 'Invalid file upload'));
      return;
    }
    next();
  });
};

const loadActingUser = async (req: Request): Promise<UserEntity> => {
  const user = await getUserRepository().findById(req.user!.sub);
  if (!user) {
    throw ForbiddenError('User not found');
  }
  return user;
};

// Coarse pre-check before multer buffers the body - the purpose (and so the exact capability) is
// a multipart field only readable after parsing, but a user with no upload capability at all
// shouldn't get to push 5MB into server memory first.
const requireAnyUploadCapability = asyncHandler(async (req: Request, _res: Response, next: NextFunction) => {
  const user = await loadActingUser(req);
  if (!UPLOAD_CAPABILITIES.some((capability) => hasCapability(user, capability))) {
    throw ForbiddenError('You do not have permission to upload files');
  }
  next();
});

router.post(
  '/api/storage/upload',
  requireAuth,
  requireAnyUploadCapability,
  handleUpload,
  asyncHandler(async (req: Request, res: Response) => {
    if (!req.file) {
      throw ValidationError('No file was uploaded');
    }
    const parsed = uploadAssetSchema.safeParse(req.body);
    if (!parsed.success) {
      throw ValidationError('Invalid request body', parsed.error.flatten());
    }

    const user = await loadActingUser(req);
    if (!hasCapability(user, UPLOAD_PURPOSE_CAPABILITIES[parsed.data.purpose])) {
      throw ForbiddenError('You do not have permission to upload this kind of image');
    }

    const extension = EXTENSION_BY_MIME_TYPE[req.file.mimetype] ?? 'bin';
    // Grouped by purpose for bucket-console readability only - the Asset row is the real record.
    const key = `${parsed.data.purpose}/${randomUUID()}.${extension}`;

    const { publicUrl } = await uploadObject({
      key,
      body: req.file.buffer,
      contentType: req.file.mimetype,
    });

    const asset = await createAsset({
      publicUrl,
      providerKey: key,
      altText: parsed.data.altText,
      mimeType: req.file.mimetype,
      sizeBytes: req.file.size,
      uploadedBy: user.id,
      purpose: parsed.data.purpose,
    });

    res.status(201).json(createSuccessResponse({ url: asset.publicUrl, assetId: asset.id }));
  }),
);

// Normal cleanup happens through the owning record (replacing or deleting a staff photo, gallery
// image, etc. releases its asset). This is for discarding an upload that never got attached -
// e.g. a dialog cancelled after its file had already been sent.
router.delete(
  '/api/storage/assets/:id',
  requireAuth,
  asyncHandler(async (req: Request, res: Response) => {
    const id = normalizeParam(req.params.id);
    const asset = await getAssetById(id);
    if (!asset) {
      throw NotFoundError('Asset not found');
    }

    const user = await loadActingUser(req);
    const isOwner = asset.uploadedBy === user.id;
    if (!isOwner && !hasCapability(user, 'storage:manageAssets')) {
      throw ForbiddenError('You do not have permission to delete this asset');
    }

    await releaseCloudAsset(id);
    res.status(204).send();
  }),
);

export default router;
