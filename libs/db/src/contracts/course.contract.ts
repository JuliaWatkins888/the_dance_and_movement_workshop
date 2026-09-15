import type { PaginatedResult } from './pagination.contract';

export type CourseSearchField = 'name';

export const COURSE_IMAGE_SOURCE_TYPES = ['local', 'cloud', 'external'] as const;
export type CourseImageSourceType = (typeof COURSE_IMAGE_SOURCE_TYPES)[number];

// A curriculum offered within one Semester (e.g. "Ballet") - recreated fresh each semester rather
// than reused evergreen across terms, matching how the studio actually plans: sit down each term,
// decide that term's course lineup, then build Class variants (schedule/age/instructor) under it.
// One document per scheduled variant lives on ClassEntity, which references this by courseId -
// see class.contract.ts's own note on why that split exists.
export interface CourseEntity {
  id: string;
  semesterId: string; // FK -> SemesterEntity.id, resolved at the API layer (never a Mongoose ref)
  name: string;
  description?: string;
  categories: string[];
  // Always a directly-usable <img src> value regardless of sourceType, mirroring
  // GalleryImageEntity.url's own "resolved once at write time" precedent. Absent entirely when a
  // Course has no image yet - the public CourseBrowsePage/CourseDetailPage fall back to a
  // deterministic Trianglify banner (see apps/web/src/pages/courseBannerConfig.ts) rather than
  // treating a missing image as an error.
  imageUrl?: string;
  imageSourceType?: CourseImageSourceType;
  // cloud only - the storage plugin's AssetEntity id, mirrors StaffEntity.photoAssetId.
  imageAssetId?: string;
  // local only - the filename under apps/api/uploads/courses, mirrors StaffEntity.photoStorageKey.
  imageStorageKey?: string;
  isPublished: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export type CreateCourseInput = Omit<CourseEntity, 'id' | 'createdAt' | 'updatedAt'>;
export type UpdateCourseInput = Partial<CreateCourseInput>;

export interface FindManyCoursesOptions {
  page: number;
  pageSize: number;
  search?: string;
  searchField?: CourseSearchField;
  semesterId?: string;
}

export interface CourseRepository {
  findMany: (options: FindManyCoursesOptions) => Promise<PaginatedResult<CourseEntity>>;
  // Public catalog - unpaged like ClassRepository.findPublished(), since the full offering catalog
  // is small enough for the public CourseBrowsePage to fetch whole and filter/group client-side.
  findPublished: () => Promise<CourseEntity[]>;
  // FK resolution target for Class's own toDto (courseId -> Course -> semesterId -> Semester) and
  // for the cascade-delete check on DELETE /api/courses/:id.
  findById: (id: string) => Promise<CourseEntity | null>;
  create: (input: CreateCourseInput) => Promise<CourseEntity>;
  update: (id: string, input: UpdateCourseInput) => Promise<CourseEntity | null>;
  delete: (id: string) => Promise<boolean>;
  // Powers DELETE /api/semesters/:id's cascade-delete guard and the Studio Offerings dashboard's
  // per-semester course count.
  countBySemesterId: (semesterId: string) => Promise<number>;
}
