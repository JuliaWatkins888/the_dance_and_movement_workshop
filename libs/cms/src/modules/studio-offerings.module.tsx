import type { CmsModule } from './registry';
import { StudioOfferingsDashboard } from './studio-offerings/StudioOfferingsDashboard';
import { SemestersAdminModule } from './studio-offerings/SemestersAdminModule';
import { CoursesAdminModule } from './studio-offerings/CoursesAdminModule';
import { ClassesAdminModule } from './studio-offerings/ClassesAdminModule';
import { WorkshopsAdminModule } from './studio-offerings/WorkshopsAdminModule';

// Replaces the old flat classes-admin.module.tsx - one nav entry covering the whole Semester ->
// Course -> Class hierarchy plus standalone Workshops, gated by the single studio-offerings:manage
// capability (see role-capability-defaults.ts) rather than one capability per entity. Clicking the
// group's own label lands on the dashboard (Component); expanding it reveals the four child pages.
const studioOfferingsModule: CmsModule = {
  id: 'studio-offerings',
  navLabel: 'Studio Offerings',
  icon: 'MusicNotes',
  order: 37,
  requiredCapability: 'studio-offerings:manage',
  Component: StudioOfferingsDashboard,
  children: [
    { id: 'semesters', navLabel: 'Semesters', Component: SemestersAdminModule },
    { id: 'courses', navLabel: 'Courses', Component: CoursesAdminModule },
    { id: 'classes', navLabel: 'Classes', Component: ClassesAdminModule },
    { id: 'workshops', navLabel: 'Workshops', Component: WorkshopsAdminModule },
  ],
};

export default studioOfferingsModule;
