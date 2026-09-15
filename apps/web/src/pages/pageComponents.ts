import type { PageComponentMap } from '@inithium/ui';
import { HomePage } from './HomePage';
import { LoginPage } from './LoginPage';
import { SignupPage } from './SignupPage';
import { PrivacyPolicyPage } from './PrivacyPolicyPage';
import { ProfilePage } from './ProfilePage';
// inithium:block:gallery:imports:start
import { GalleryPage } from './GalleryPage';
// inithium:block:gallery:imports:end
// inithium:block:contact:imports:start
import { ContactPage } from './ContactPage';
// inithium:block:contact:imports:end
// inithium:block:staff:imports:start
import { StaffPage } from './StaffPage';
// inithium:block:staff:imports:end
// inithium:block:policy:imports:start
import { PoliciesPage } from './PoliciesPage';
// inithium:block:policy:imports:end
// inithium:block:studio-offerings:imports:start
import { CourseBrowsePage } from './CourseBrowsePage';
import { CourseDetailPage } from './CourseDetailPage';
import { WorkshopsPage } from './WorkshopsPage';
// inithium:block:studio-offerings:imports:end
// inithium:anchor:imports

// Keyed by Page.slug, matching libs/db/src/page-seeds/registry.ts's own seeded records: home
// ("/"), login ("/login"), signup ("/signup"), privacy-policy ("/privacy-policy"), profile
// ("/profile/:id"). A plugin that adds its own page(s) appends its own slug(s) here via a
// merge-strategy injection - every entry here has a corresponding page-seed reconciled by
// ensureSeededPages() at API boot, and must still be added here by hand alongside its seed (no
// mechanism auto-derives this map from the seed registry).
export const pageComponents: PageComponentMap = {
  home: HomePage,
  login: LoginPage,
  signup: SignupPage,
  'privacy-policy': PrivacyPolicyPage,
  profile: ProfilePage,
// inithium:block:gallery:components:start
  gallery: GalleryPage,
// inithium:block:gallery:components:end
// inithium:block:contact:components:start
  contact: ContactPage,
// inithium:block:contact:components:end
// inithium:block:staff:components:start
  staff: StaffPage,
// inithium:block:staff:components:end
// inithium:block:policy:components:start
  policies: PoliciesPage,
// inithium:block:policy:components:end
// inithium:block:studio-offerings:components:start
  courses: CourseBrowsePage,
  'course-detail': CourseDetailPage,
  workshops: WorkshopsPage,
// inithium:block:studio-offerings:components:end
  // inithium:anchor:components
};
