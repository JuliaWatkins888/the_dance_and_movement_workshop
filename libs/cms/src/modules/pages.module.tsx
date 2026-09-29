import type { CmsModule } from './registry';
import { PagesModule } from './pages/PagesModule';

const pagesModule: CmsModule = {
  id: 'pages',
  navLabel: 'Pages',
  icon: 'FileText',
  requiredCapability: 'pages:manage',
  Component: PagesModule,
};

export default pagesModule;
