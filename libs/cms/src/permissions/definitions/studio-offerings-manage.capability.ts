import type { CapabilityDefinition } from './registry';

// One shared capability for the whole Studio Offerings feature area (Academic Years, Semesters,
// Courses, Classes, Workshops) rather than one per entity - they're all managed by the same admin
// persona with no "track vs manage" style distinction the way
// libs/permissions/src/roles/role-capability-defaults.ts's own time:track/time:manage pair needs for
// its own multi-entity feature area. Replaces the old classes-manage.capability.ts (now retired) now
// that Class is one of several entities this gates.
const studioOfferingsManageCapability: CapabilityDefinition = {
  key: 'studio-offerings:manage',
  label: 'Manage Studio Offerings',
  description: 'Create, edit, and delete academic years, courses, classes, and workshops, and edit semesters.',
  group: 'Content',
  order: 16,
  defaultRoles: ['contributor', 'editor', 'admin'],
};

export default studioOfferingsManageCapability;
