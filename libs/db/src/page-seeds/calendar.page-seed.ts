import type { CreatePageInput } from '../contracts/page.contract';

const calendarPageSeed: CreatePageInput = {
  slug: 'calendar',
  title: 'Calendar',
  routePattern: '/calendar',
  isPluginPage: false,
  animation: {
    enter: 'animate__fadeIn',
    exit: 'animate__fadeOut',
    duration: 300,
    delay: 0,
  },
  backgroundColor: { color: 'surface', intensity: 100 },
  foregroundColor: { color: 'surface', intensity: 950 },
  access: { isPublic: true, isAnonymousOnly: false, requiredRoles: [] },
  navigation: {
    locations: ['primary-nav', 'primary-footer'],
    label: 'Calendar',
    order: 1,
  },
  layoutTemplate: 'full-width',
  isPublished: true,
};

export default calendarPageSeed;
