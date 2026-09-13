import type { ComponentType } from 'react';
import type { ProfileDto } from '@inithium/api-client';

export interface ProfileTabProps {
  // Already-fetched by ProfilePage - tabs never call useGetProfileQuery themselves, so a page
  // with many plugin-contributed tabs never fires it more than once. Shaped identically to
  // sections/registry.ts's own ProfileSectionProps, deliberately duplicated rather than shared -
  // the two registries are independent extension points (a tab plugin has no reason to import
  // anything from the unrelated left-column sections registry), the same "duplicate the shape,
  // not the import" convention this codebase already uses for small, stable cross-layer shapes.
  readonly profile: ProfileDto;
  readonly isOwnProfile: boolean;
}

export const PROFILE_TAB_VISIBILITIES = ['owned', 'all'] as const;
export type ProfileTabVisibility = (typeof PROFILE_TAB_VISIBILITIES)[number];

export interface ProfileTabDescriptor {
  readonly id: string;
  readonly label: string;
  readonly order?: number;
  // 'owned': the tab only ever appears for the profile's own owner (e.g. Account Settings -
  // there's nothing to configure on someone else's account, so the tab itself never shows up
  // rather than mounting and rendering empty). 'all': the tab appears for every viewer, owner or
  // not - the Component is handed `isOwnProfile` and decides how to vary its own UI (e.g. a
  // future friends tab: manage-your-own-friends UI for the owner, mutual-friends UI for anyone
  // else viewing it).
  readonly visibility: ProfileTabVisibility;
  readonly Component: ComponentType<ProfileTabProps>;
}

// Any plugin that wants to contribute a tab to the profile page's right-hand column (order
// history, an asset manager, a friends list, ...) drops its own uniquely-named *.tab.tsx file
// here, default-exporting a ProfileTabDescriptor - the same zero-shared-file-edit convention
// this page's own sections/registry.ts (left column) and @inithium/cms's modules/widgets/
// settings-definitions registries already established. Core dogfoods it for its own Account
// Settings tab (account-settings.tab.tsx) rather than special-casing itself.
const tabFiles = import.meta.glob<ProfileTabDescriptor>('./*.tab.tsx', { eager: true, import: 'default' });

export const profileTabs: ProfileTabDescriptor[] = Object.values(tabFiles).sort(
  (a, b) => (a.order ?? 0) - (b.order ?? 0),
);
