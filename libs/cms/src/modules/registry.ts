import type { ComponentType } from 'react';
import type { IconName } from '@inithium/ui';

// A sub-page of a CmsModule that itself has `children` - reached at /cms/:moduleId/:id (see
// ModuleRenderer), with its own nav link nested under the parent's in CmsSidebar. Falls back to
// the parent module's own requiredCapability when omitted, the same "inherit unless overridden"
// default a plain CmsModule uses implicitly by having only one capability to check.
export interface CmsChildRoute {
  readonly id: string;
  readonly navLabel: string;
  readonly requiredCapability?: string;
  readonly Component: ComponentType;
}

export interface CmsModule {
  readonly id: string;
  readonly navLabel: string;
  readonly icon: IconName;
  readonly order?: number;
  // Gates this module's nav entry (CmsSidebar) and direct-navigation access (ModuleRenderer) to
  // viewers whose resolved capabilities include this key, or who are the owner. Omit for a
  // module every CMS-capable viewer should reach regardless of capability (e.g. the dashboard).
  readonly requiredCapability?: string;
  readonly Component: ComponentType;
  // Optional sub-pages - when present, the module's own nav link becomes an expandable group
  // (CmsSidebar) whose label still navigates to `Component` (a landing/dashboard page for the
  // group), while each child gets its own nested link and route. Omitted entirely by every
  // existing flat module, which keeps the one-module-one-page shape unchanged for them.
  readonly children?: readonly CmsChildRoute[];
}

// Every plugin extending the CMS (a future blog plugin, etc.) drops its own uniquely-named
// *.module.tsx file here, default-exporting a CmsModule descriptor - this glob auto-discovers
// all of them at build time, so extending the CMS never requires editing a shared file.
const moduleFiles = import.meta.glob<CmsModule>('./*.module.tsx', { eager: true, import: 'default' });

export const cmsModules: CmsModule[] = Object.values(moduleFiles).sort(
  (a, b) => (a.order ?? 0) - (b.order ?? 0),
);
