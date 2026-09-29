import type { CreatePageInput } from '../contracts/page.contract';

// One course's public detail page (description, dress code, time slots, plan pricing) - linked
// from each course card on /classes, and the href the cart will point class lines back to.
const classDetailPageSeed: CreatePageInput = {
  slug: 'class-detail',
  title: 'Class Details',
  routePattern: '/classes/:slug',
  isPluginPage: false,
  animation: { enter: 'animate__fadeIn', exit: 'animate__fadeOut', duration: 300, delay: 0 },
  backgroundColor: { color: 'surface', intensity: 100 },
  foregroundColor: { color: 'surface', intensity: 950 },
  access: { isPublic: true, isAnonymousOnly: false, requiredRoles: [] },
  navigation: { locations: [], label: 'Class Details', order: 0 },
  layoutTemplate: 'default',
  isPublished: true,
};

export default classDetailPageSeed;
