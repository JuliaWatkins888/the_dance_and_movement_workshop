import type { ClearableUpdate } from './commerce.contract';
import type { UserProfileBannerConfig } from './user.contract';

export const PROGRAM_IMAGE_SOURCE_TYPES = ['cloud', 'external'] as const;
export type ProgramImageSourceType = (typeof PROGRAM_IMAGE_SOURCE_TYPES)[number];

// The generated trianglify mesh shown wherever the program has no image. Unset means the
// frontend derives a stable default from the program's id.
export type ProgramBannerConfig = Omit<UserProfileBannerConfig, 'imageUrl'>;

// The top level of the class catalog - who a group of courses is for (e.g. "Early Childhood",
// "Adult Dance"). Purely an admin-curated grouping for the public Classes page; eligibility is
// always checked against a course's own age range, never the program's.
export interface ProgramEntity {
  id: string;
  name: string;
  // Public page: /programs/:slug. Programs created before slugs existed fall back to their id.
  slug: string;
  description?: string;
  // Display-only audience hint ("Ages 4–6"). Optional since some programs (e.g. wellness) span
  // courses with differing minimums and are better left without a single range.
  minAgeYears?: number;
  maxAgeYears?: number;
  // Shown on the program's grid card and as its page banner; takes precedence over `banner`.
  imageUrl?: string;
  imageSourceType?: ProgramImageSourceType;
  // cloud only - the AssetEntity id, so the R2 object can be released when the image changes.
  imageAssetId?: string;
  banner?: ProgramBannerConfig;
  order: number;
  isPublished: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export type CreateProgramInput = Omit<ProgramEntity, 'id' | 'createdAt' | 'updatedAt'>;
export type UpdateProgramInput = ClearableUpdate<CreateProgramInput>;

export interface ProgramRepository {
  // Unpaged - a studio has a handful of programs.
  findAll: () => Promise<ProgramEntity[]>;
  findById: (id: string) => Promise<ProgramEntity | null>;
  create: (input: CreateProgramInput) => Promise<ProgramEntity>;
  update: (id: string, input: UpdateProgramInput) => Promise<ProgramEntity | null>;
  delete: (id: string) => Promise<boolean>;
}
