import type { CreatePageInput } from '../contracts/page.contract';

const privacyPolicyPageSeed: CreatePageInput = {
  slug: 'privacy-policy',
  title: 'Privacy Policy',
  routePattern: '/privacy-policy',
  isPluginPage: false,
  animation: { enter: 'animate__fadeIn', exit: 'animate__fadeOut', duration: 300, delay: 0 },
  backgroundColor: { color: 'surface', intensity: 100 },
  foregroundColor: { color: 'surface', intensity: 950 },
  access: { isPublic: true, isAnonymousOnly: false, requiredRoles: [] },
  navigation: { locations: ['secondary-footer'], label: 'Privacy Policy', order: 0 },
  layoutTemplate: 'default',
  isPublished: true,
};

export default privacyPolicyPageSeed;
