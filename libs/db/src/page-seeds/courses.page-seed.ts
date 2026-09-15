import type { CreatePageInput } from '../contracts/page.contract';

// Public copy stays "Classes" (the nav label a parent actually looks for) even though the slug/
// route and the underlying data model are now Course-based - see CourseBrowsePage.tsx's own note
// on why "Course"/"Semester" stay internal vocabulary, not visitor-facing labels.
const coursesPageSeed: CreatePageInput = {
  slug: 'courses',
  title: 'Classes',
  routePattern: '/courses',
  isPluginPage: false,
  animation: { enter: 'animate__fadeIn', exit: 'animate__fadeOut', duration: 300, delay: 0 },
  backgroundColor: { color: 'surface', intensity: 100 },
  foregroundColor: { color: 'surface', intensity: 950 },
  access: { isPublic: true, isAnonymousOnly: false, requiredRoles: [] },
  navigation: { locations: ['primary-nav', 'primary-footer'], label: 'Classes', order: 2 },
  layoutTemplate: 'default',
  isPublished: true,
};

export default coursesPageSeed;
