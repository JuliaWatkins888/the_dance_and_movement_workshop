import type { CreatePageInput } from '../contracts/page.contract';

// One workshop's public page (schedule, instructors, day picker) - linked from each card on
// /workshops, and the href workshop cart lines point back to.
const workshopDetailPageSeed: CreatePageInput = {
  slug: 'workshop-detail',
  title: 'Workshop Details',
  routePattern: '/workshops/:slug',
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
  navigation: { locations: [], label: 'Workshop Details', order: 0 },
  layoutTemplate: 'default',
  isPublished: true,
};

export default workshopDetailPageSeed;
