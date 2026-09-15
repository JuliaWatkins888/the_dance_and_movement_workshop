import type { CreatePageInput } from '../contracts/page.contract';

// Not linked from any nav location - its href needs a real Course's own id, which a static Page
// record can't embed, so it's only ever reached by clicking a tile on the /courses browse page.
// Same reasoning profile.page-seed.ts already documents for its own dynamic /profile/:id.
const courseDetailPageSeed: CreatePageInput = {
  slug: 'course-detail',
  title: 'Course',
  routePattern: '/courses/:courseId',
  isPluginPage: false,
  animation: { enter: 'animate__fadeIn', exit: 'animate__fadeOut', duration: 300, delay: 0 },
  backgroundColor: { color: 'surface', intensity: 100 },
  foregroundColor: { color: 'surface', intensity: 950 },
  access: { isPublic: true, isAnonymousOnly: false, requiredRoles: [] },
  navigation: { locations: [], label: 'Course', order: 0 },
  layoutTemplate: 'default',
  isPublished: true,
};

export default courseDetailPageSeed;
