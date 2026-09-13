import type { CmsModule } from './registry';
import { GalleryAdminModule } from './gallery/GalleryAdminModule';

const galleryAdminModule: CmsModule = {
  id: 'gallery',
  navLabel: 'Gallery',
  icon: 'Images',
  order: 30,
  requiredCapability: 'gallery:manage',
  Component: GalleryAdminModule,
};

export default galleryAdminModule;
