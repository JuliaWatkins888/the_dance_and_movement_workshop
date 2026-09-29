import type { CreatePageInput } from '../contracts/page.contract';

// One program's public page (banner, filters, and a card per open time slot) - linked from each
// program card on /classes. Each time slot links on to its course's /classes/:slug page.
const programDetailPageSeed: CreatePageInput = {
  slug: 'program-detail',
  title: 'Program',
  routePattern: '/programs/:slug',
  isPluginPage: false,
  animation: { enter: 'animate__fadeIn', exit: 'animate__fadeOut', duration: 300, delay: 0 },
  backgroundColor: { color: 'surface', intensity: 100 },
  foregroundColor: { color: 'surface', intensity: 950 },
  access: { isPublic: true, isAnonymousOnly: false, requiredRoles: [] },
  navigation: { locations: [], label: 'Program', order: 0 },
  layoutTemplate: 'default',
  isPublished: true,
};

export default programDetailPageSeed;
