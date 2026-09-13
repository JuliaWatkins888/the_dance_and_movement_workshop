import type { CreatePageInput } from '../contracts/page.contract';

// Public: anyone can view this page and read the form, logged in or not - it's linked from the
// primary navbar for every visitor, so gating page access itself would mean an anonymous click
// on "Contact" 404s despite the link being right there (pages.route.ts throws Unauthorized on a
// non-public page for an anonymous visitor, which app.tsx renders as NotFoundPage). Submission
// itself still requires login (enforced both client-side in ContactPage, for a friendly prompt,
// and server-side via requireAuth on POST /api/contact, which is the real gate) - that's what
// lets replies flow through the existing userId-keyed notification center with zero changes to
// it, without needing the page itself to turn away anonymous visitors.
const contactPageSeed: CreatePageInput = {
  slug: 'contact',
  title: 'Contact',
  routePattern: '/contact',
  isPluginPage: true,
  pluginOrigin: 'contact',
  animation: { enter: 'animate__fadeIn', exit: 'animate__fadeOut', duration: 300, delay: 0 },
  backgroundColor: { color: 'surface', intensity: 100 },
  foregroundColor: { color: 'surface', intensity: 950 },
  access: { isPublic: true, isAnonymousOnly: false, requiredRoles: [] },
  navigation: { locations: ['primary-nav', 'primary-footer'], label: 'Contact', order: 4 },
  layoutTemplate: 'default',
  isPublished: true,
};

export default contactPageSeed;
