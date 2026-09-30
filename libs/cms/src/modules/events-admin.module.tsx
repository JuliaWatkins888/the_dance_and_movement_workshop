import type { CmsModule } from './registry';
import { EventsAdminModule } from './events/EventsAdminModule';

const eventsAdminModule: CmsModule = {
  id: 'events',
  navLabel: 'Events',
  icon: 'Ticket',
  requiredCapability: 'events:manage',
  Component: EventsAdminModule,
};

export default eventsAdminModule;
