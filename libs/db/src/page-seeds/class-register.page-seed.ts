import type { CreatePageInput } from '../contracts/page.contract';

// Scaffold only - the real registration flow (payment, family/student selection, confirmation)
// doesn't exist yet. This page exists so RegistrationButton.tsx has somewhere real to send an
// eligible visitor instead of the Contact page, and so that real flow has a route to grow into
// later without another round of page-seed/pageComponents wiring. Not linked from any nav
// location - its href needs a real Class/Workshop's own id, same reasoning as
// course-detail.page-seed.ts's identical /courses/:courseId.
const classRegisterPageSeed: CreatePageInput = {
  slug: 'register',
  title: 'Register',
  routePattern: '/register/:offeringType/:offeringId',
  isPluginPage: false,
  animation: { enter: 'animate__fadeIn', exit: 'animate__fadeOut', duration: 300, delay: 0 },
  backgroundColor: { color: 'surface', intensity: 100 },
  foregroundColor: { color: 'surface', intensity: 950 },
  access: { isPublic: true, isAnonymousOnly: false, requiredRoles: [] },
  navigation: { locations: [], label: 'Register', order: 0 },
  layoutTemplate: 'default',
  isPublished: true,
};

export default classRegisterPageSeed;
