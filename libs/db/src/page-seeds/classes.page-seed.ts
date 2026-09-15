import type { CreatePageInput } from '../contracts/page.contract';

const classesPageSeed: CreatePageInput = {
  slug: 'classes',
  title: 'Classes',
  routePattern: '/classes',
  isPluginPage: false,
  animation: { enter: 'animate__fadeIn', exit: 'animate__fadeOut', duration: 300, delay: 0 },
  backgroundColor: { color: 'surface', intensity: 100 },
  foregroundColor: { color: 'surface', intensity: 950 },
  access: { isPublic: true, isAnonymousOnly: false, requiredRoles: [] },
  navigation: { locations: ['primary-nav', 'primary-footer'], label: 'Classes', order: 2 },
  layoutTemplate: 'default',
  isPublished: true,
};

export default classesPageSeed;
