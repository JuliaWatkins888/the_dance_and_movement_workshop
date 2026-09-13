import type { ComponentType } from 'react';
import type { ProfileDto } from '@inithium/api-client';

export interface ProfileSectionProps {
  // Already-fetched by ProfilePage - sections never call useGetProfileQuery themselves, so a
  // page with many plugin-contributed sections never fires it more than once.
  readonly profile: ProfileDto;
  readonly isOwnProfile: boolean;
}

export interface ProfileSectionDescriptor {
  readonly id: string;
  readonly order?: number;
  readonly Component: ComponentType<ProfileSectionProps>;
}

// This is the profile page's *left*-column extension point specifically - any plugin that wants
// to contribute left-column content (a birthday field, a short bio, an address, ...) drops its
// own uniquely-named *.section.tsx file here, default-exporting a ProfileSectionDescriptor - the
// same zero-shared-file-edit convention @inithium/cms's own modules/*.module.tsx, dashboard/
// widgets/*.widget.tsx, and settings/definitions/*.setting.ts registries already established,
// just scoped to this page instead of the CMS admin. Core dogfoods the exact same mechanism for
// its own account-info.section.tsx rather than special-casing itself.
//
// The right column is a different, tabbed extension point instead - see ../tabs/registry.ts.
const sectionFiles = import.meta.glob<ProfileSectionDescriptor>('./*.section.tsx', {
  eager: true,
  import: 'default',
});

export const profileSections: ProfileSectionDescriptor[] = Object.values(sectionFiles).sort(
  (a, b) => (a.order ?? 0) - (b.order ?? 0),
);
