import type { ComponentType } from 'react';
import type { IconName } from '@inithium/ui';

export interface CmsModule {
  readonly id: string;
  readonly navLabel: string;
  readonly icon: IconName;
  // Gates this module's nav entry (CmsSidebar) and direct-navigation access (ModuleRenderer) to
  // viewers whose resolved capabilities include this key, or who are the owner. Omit for a
  // module every CMS-capable viewer should reach regardless of capability (e.g. the dashboard).
  readonly requiredCapability?: string;
  readonly Component: ComponentType;
}

// Every plugin extending the CMS (a future blog plugin, etc.) drops its own uniquely-named
// *.module.tsx file here, default-exporting a CmsModule descriptor - this glob auto-discovers
// all of them at build time, so extending the CMS never requires editing a shared file.
const moduleFiles = import.meta.glob<CmsModule>('./*.module.tsx', { eager: true, import: 'default' });

// Dashboard is pinned first (it's also the /cms default redirect) and Settings pinned last;
// everything between is alphabetical by nav label.
const PINNED_RANK: Readonly<Record<string, number>> = { dashboard: -1, settings: 1 };

const pinnedRank = (cmsModule: CmsModule): number => PINNED_RANK[cmsModule.id] ?? 0;

export const cmsModules: CmsModule[] = Object.values(moduleFiles).sort(
  (a, b) => pinnedRank(a) - pinnedRank(b) || a.navLabel.localeCompare(b.navLabel),
);
