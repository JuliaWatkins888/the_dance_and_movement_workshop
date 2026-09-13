import type { Role } from '@inithium/db';

export interface CapabilityDefinition {
  key: string;
  label: string;
  description?: string;
  group?: string;
  order?: number;
  // Display-only mirror of what @inithium/permissions's ROLE_CAPABILITY_DEFAULTS encodes
  // server-side for this key - used only so the Permissions module can show "(role default)"
  // next to a checkbox before any override exists. This glob is frontend-only (Vite's
  // import.meta.glob has no Node-run equivalent), so the server-side table can't be derived from
  // it; kept in sync by hand, the same accepted duplication blog.commentsEnabled's frontend
  // default and its route's own inline fallback already live with.
  defaultRoles?: Role[];
}

// Every plugin that wants to participate in the Permissions module drops its own uniquely-named
// *.capability.ts file here, default-exporting a CapabilityDefinition - the same
// zero-shared-file-edit convention modules/registry.ts, dashboard/widgets/registry.ts, and
// settings/definitions/registry.ts already established. A capability whose plugin isn't
// installed simply never has a file here to discover, so nothing extra is needed to keep the
// Permissions module in sync with which plugins are actually present.
const definitionFiles = import.meta.glob<CapabilityDefinition>('./*.capability.ts', {
  eager: true,
  import: 'default',
});

export const capabilityDefinitions: CapabilityDefinition[] = Object.values(definitionFiles).sort(
  (a, b) => (a.order ?? 0) - (b.order ?? 0),
);
