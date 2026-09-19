import type { CreatePageInput } from '../contracts/page.contract';

// Not linked from any nav location - its href needs a real Staff member's own id, same reasoning
// course-detail.page-seed.ts documents for its own dynamic /courses/:courseId. Reached by
// clicking a card on the staff list page - nested under /instructors, not /staff, since the list
// page's own route was renamed to /instructors via the CMS (its slug, "staff", stays unchanged -
// see staff.page-seed.ts).
const staffDetailPageSeed: CreatePageInput = {
  slug: 'staff-detail',
  title: 'Instructor',
  routePattern: '/instructors/:staffId',
  isPluginPage: false,
  animation: { enter: 'animate__fadeIn', exit: 'animate__fadeOut', duration: 300, delay: 0 },
  backgroundColor: { color: 'surface', intensity: 100 },
  foregroundColor: { color: 'surface', intensity: 950 },
  access: { isPublic: true, isAnonymousOnly: false, requiredRoles: [] },
  navigation: { locations: [], label: 'Instructor', order: 0 },
  layoutTemplate: 'default',
  isPublished: true,
};

export default staffDetailPageSeed;
