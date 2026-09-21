import type { PaginatedResult } from './pagination.contract';

export const NAV_LOCATIONS = ['primary-nav', 'profile-nav', 'primary-footer', 'secondary-footer'] as const;
export type NavLocation = (typeof NAV_LOCATIONS)[number];

export const PAGE_LAYOUT_TEMPLATES = ['default', 'full-width', 'sidebar-left', 'sidebar-right'] as const;
export type PageLayoutTemplate = (typeof PAGE_LAYOUT_TEMPLATES)[number];

export interface PageAnimationConfig {
  enter: string;
  exit: string;
  duration: number;
  delay: number;
}

// Deliberately not `@inithium/ui`'s ColorSpec - libs/db must stay ignorant of any frontend
// presentation package. Shaped identically (color/intensity/opacity) so the API layer can pass
// it straight through to a `@inithium/ui` Box/AnimateBox's bgColor (or a resolveColorClass call
// for text color) without translation.
export interface PageColorConfig {
  color: string;
  intensity?: number;
  opacity?: number;
}

export interface PageAccessConfig {
  isPublic: boolean;
  isAnonymousOnly: boolean;
  requiredRoles: string[];
}

export interface PageNavigationConfig {
  // A page can be surfaced in more than one nav at once (e.g. Home in both `primary-nav` and
  // `primary-footer`) - an empty array means the page appears in no nav.
  locations: NavLocation[];
  label: string;
  order: number;
  icon?: string;
  // Groups this page under a shared dropdown in the nav instead of rendering it as a flat
  // top-level link - any other page with the same (trimmed, case-sensitive) parentGroup string
  // collapses into the same dropdown, labeled with that string, positioned at the lowest `order`
  // among its members. Deliberately just a plain string rather than a reference to a separate
  // "nav group" entity - renaming a dropdown means editing this field on each of its member
  // pages, and creating a new dropdown is just giving 2+ pages a new shared value here. See
  // Navbar.tsx's buildNavItems for the grouping logic this drives.
  parentGroup?: string;
}

export interface PageSeoConfig {
  metaTitle?: string;
  metaDescription?: string;
  ogImage?: string;
}

export interface PageEntity {
  id: string;
  slug: string;
  title: string;
  routePattern: string;
  isPluginPage: boolean;
  pluginOrigin?: string;
  animation: PageAnimationConfig;
  backgroundColor: PageColorConfig;
  foregroundColor: PageColorConfig;
  access: PageAccessConfig;
  navigation: PageNavigationConfig;
  seo?: PageSeoConfig;
  layoutTemplate: PageLayoutTemplate;
  isPublished: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export type CreatePageInput = Omit<PageEntity, 'id' | 'createdAt' | 'updatedAt'>;
export type UpdatePageInput = Partial<CreatePageInput>;

export type PageSearchField = 'title' | 'slug' | 'routePattern';

export interface FindManyPagesOptions {
  page: number;
  pageSize: number;
  search?: string;
  searchField?: PageSearchField;
}

export interface PageRepository {
  findByRoutePattern: (routePattern: string) => Promise<PageEntity | null>;
  // Slug is the one field the CMS's own Pages module treats as immutable (see
  // PageEditDialog's "not editable here" note) - the natural idempotency key for seeding.
  findBySlug: (slug: string) => Promise<PageEntity | null>;
  findByNavLocation: (location: NavLocation) => Promise<PageEntity[]>;
  findPublished: () => Promise<PageEntity[]>;
  findMany: (options: FindManyPagesOptions) => Promise<PaginatedResult<PageEntity>>;
  // Every page a plugin ever seeded (isPluginPage:true), published or not - the candidate set
  // pruneOrphanedPluginPages() reconciles on every boot against whichever plugins are currently
  // installed. Core's own hand-authored pages (isPluginPage:false) never appear here.
  findPluginPages: () => Promise<PageEntity[]>;
  create: (input: CreatePageInput) => Promise<PageEntity>;
  update: (id: string, input: UpdatePageInput) => Promise<PageEntity | null>;
  delete: (id: string) => Promise<boolean>;
}
