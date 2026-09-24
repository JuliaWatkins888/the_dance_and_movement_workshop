import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import type { CourseEntity } from '@inithium/db';

// Lives in the source tree, never under dist/ - see staff.route.ts's own STAFF_UPLOAD_DIR comment
// for why (webpack's output.clean wipes dist/apps/api on every build, and apps/api/src/assets is
// only copied into dist at build time). Mirrors that same precedent exactly for Course images.
export const COURSE_UPLOAD_DIR = path.resolve(process.cwd(), 'apps/api/uploads/courses');
fs.mkdirSync(COURSE_UPLOAD_DIR, { recursive: true });

export const resolvePublicOrigin = (): string => process.env['API_PUBLIC_URL'] || `http://localhost:${process.env['PORT'] || 3000}`;

export type CourseImageFields = Pick<CourseEntity, 'imageUrl' | 'imageSourceType' | 'imageAssetId' | 'imageStorageKey'>;

export interface DuplicatedCourseImage {
  image: CourseImageFields;
  // Set when the source had an image that couldn't be carried over - the copy then simply has none.
  warning?: string;
}

// The banner for a copied course. A locally-uploaded file is duplicated on disk rather than shared
// between the two courses: deleting a course removes its local file (see courses.route.ts's DELETE),
// so a shared file would leave the surviving course pointing at a banner that no longer exists.
// External URLs and cloud assets aren't owned by the course, so those references are copied as-is.
export const duplicateCourseImage = async (source: CourseImageFields): Promise<DuplicatedCourseImage> => {
  if (!source.imageUrl || !source.imageSourceType) return { image: {} };

  if (source.imageSourceType !== 'local') {
    return {
      image: {
        imageUrl: source.imageUrl,
        imageSourceType: source.imageSourceType,
        ...(source.imageAssetId ? { imageAssetId: source.imageAssetId } : {}),
      },
    };
  }

  const missing: DuplicatedCourseImage = { image: {}, warning: 'its banner image file was missing, so the copy has no image' };
  const storageKey = source.imageStorageKey;
  // A key with any path component isn't one this app wrote (multer only ever generates bare
  // filenames) - refuse to resolve it rather than copy from outside the uploads directory.
  if (!storageKey || path.basename(storageKey) !== storageKey) return missing;

  const newStorageKey = `${randomUUID()}${path.extname(storageKey)}`;
  try {
    await fs.promises.copyFile(path.join(COURSE_UPLOAD_DIR, storageKey), path.join(COURSE_UPLOAD_DIR, newStorageKey), fs.constants.COPYFILE_EXCL);
  } catch {
    return missing;
  }

  return {
    image: {
      imageUrl: `${resolvePublicOrigin()}/api/courses/uploads/${newStorageKey}`,
      imageSourceType: 'local',
      imageStorageKey: newStorageKey,
    },
  };
};
