import type { CreatePageInput } from '../contracts/page.contract';

// One event's public page (date, location, ticket types) - linked from each card on /events, and
// the href event ticket cart lines point back to.
const eventDetailPageSeed: CreatePageInput = {
  slug: 'event-detail',
  title: 'Event Details',
  routePattern: '/events/:slug',
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
  navigation: { locations: [], label: 'Event Details', order: 0 },
  layoutTemplate: 'default',
  isPublished: true,
};

export default eventDetailPageSeed;
