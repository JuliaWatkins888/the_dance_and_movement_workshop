import type { CmsModule } from './registry';
import { StudioOfferingsDashboard } from './studio-offerings/StudioOfferingsDashboard';
import { AcademicYearsAdminModule } from './studio-offerings/AcademicYearsAdminModule';
import { SemestersAdminModule } from './studio-offerings/SemestersAdminModule';
import { CoursesAdminModule } from './studio-offerings/CoursesAdminModule';
import { ClassesAdminModule } from './studio-offerings/ClassesAdminModule';
import { WorkshopsAdminModule } from './studio-offerings/WorkshopsAdminModule';
import { CopyOfferingsModule } from './studio-offerings/CopyOfferingsModule';

// Replaces the old flat classes-admin.module.tsx - one nav entry covering the whole Academic Year ->
// Semester -> Course -> Class hierarchy plus standalone Workshops, gated by the single
// studio-offerings:manage capability (see role-capability-defaults.ts) rather than one capability
// per entity. Clicking the group's own label lands on the dashboard (Component); expanding it
// reveals the child pages, listed top-down in hierarchy order with the year-to-year copy tool last.
const studioOfferingsModule: CmsModule = {
  id: 'studio-offerings',
  navLabel: 'Studio Offerings',
  icon: 'MusicNotes',
  order: 37,
  requiredCapability: 'studio-offerings:manage',
  Component: StudioOfferingsDashboard,
  children: [
    { id: 'academic-years', navLabel: 'Academic Years', Component: AcademicYearsAdminModule },
    { id: 'semesters', navLabel: 'Semesters', Component: SemestersAdminModule },
    { id: 'courses', navLabel: 'Courses', Component: CoursesAdminModule },
    { id: 'classes', navLabel: 'Classes', Component: ClassesAdminModule },
    { id: 'workshops', navLabel: 'Workshops', Component: WorkshopsAdminModule },
    { id: 'copy-offerings', navLabel: 'Copy Offerings', Component: CopyOfferingsModule },
  ],
};

export default studioOfferingsModule;
