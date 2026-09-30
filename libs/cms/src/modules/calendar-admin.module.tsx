import type { CmsModule } from './registry';
import { CalendarAdminModule } from './calendar/CalendarAdminModule';

const calendarAdminModule: CmsModule = {
  id: 'calendar',
  navLabel: 'Calendar',
  icon: 'CalendarBlank',
  requiredCapability: 'calendar:manage',
  Component: CalendarAdminModule,
};

export default calendarAdminModule;
