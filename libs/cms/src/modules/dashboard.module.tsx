import type { CmsModule } from './registry';
import { DashboardPage } from '../dashboard/DashboardPage';

const dashboardModule: CmsModule = {
  id: 'dashboard',
  navLabel: 'Dashboard',
  icon: 'Gauge',
  order: 0,
  Component: DashboardPage,
};

export default dashboardModule;
