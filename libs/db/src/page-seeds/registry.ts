import type { CreatePageInput } from '../contracts/page.contract';
import homePageSeed from './home.page-seed';
import loginPageSeed from './login.page-seed';
import signupPageSeed from './signup.page-seed';
import privacyPolicyPageSeed from './privacy-policy.page-seed';
import profilePageSeed from './profile.page-seed';
// inithium:block:gallery:imports:start
import galleryPageSeed from './gallery.page-seed';
// inithium:block:gallery:imports:end
// inithium:block:contact:imports:start
import contactPageSeed from './contact.page-seed';
// inithium:block:contact:imports:end
// inithium:block:staff:imports:start
import staffPageSeed from './staff.page-seed';
// inithium:block:staff:imports:end
// inithium:block:policy:imports:start
import policiesPageSeed from './policies.page-seed';
// inithium:block:policy:imports:end
// inithium:block:classes:imports:start
import classesPageSeed from './classes.page-seed';
import classDetailPageSeed from './class-detail.page-seed';
import programDetailPageSeed from './program-detail.page-seed';
// inithium:block:classes:imports:end
// inithium:block:ecommerce:imports:start
import productsPageSeed from './products.page-seed';
import cartPageSeed from './cart.page-seed';
import checkoutPageSeed from './checkout.page-seed';
import orderPageSeed from './order.page-seed';
// inithium:block:ecommerce:imports:end
// inithium:block:workshops:imports:start
import workshopsPageSeed from './workshops.page-seed';
import workshopDetailPageSeed from './workshop-detail.page-seed';
// inithium:block:workshops:imports:end
// inithium:block:events:imports:start
import eventsPageSeed from './events.page-seed';
import eventDetailPageSeed from './event-detail.page-seed';
// inithium:block:events:imports:end
// inithium:anchor:imports

// Every page the app should always have a Page DB record for, reconciled once at API startup by
// ensureSeededPages(). Keyed by slug at reconcile time - slug is the one field the CMS's Pages
// module treats as immutable (see PageEditDialog's "not editable here" note), so it's the
// natural idempotency key: a page already present is left completely alone, even if every other
// field has since been hand-edited by an admin.
//
// A plugin adding its own page(s) appends its own seed(s) to this array via a merge-strategy
// injection anchored below - there's no Vite-style import.meta.glob equivalent available on the
// Node-run backend for zero-edit auto-discovery, so this stays an explicit list rather than a
// directory scan.
export const pageSeeds: CreatePageInput[] = [
  homePageSeed,
  loginPageSeed,
  signupPageSeed,
  privacyPolicyPageSeed,
  profilePageSeed,
// inithium:block:gallery:seeds:start
  galleryPageSeed,
// inithium:block:gallery:seeds:end
// inithium:block:contact:seeds:start
  contactPageSeed,
// inithium:block:contact:seeds:end
// inithium:block:staff:seeds:start
  staffPageSeed,
// inithium:block:staff:seeds:end
// inithium:block:policy:seeds:start
  policiesPageSeed,
// inithium:block:policy:seeds:end
// inithium:block:classes:seeds:start
  classesPageSeed,
  classDetailPageSeed,
  programDetailPageSeed,
// inithium:block:classes:seeds:end
// inithium:block:ecommerce:seeds:start
  productsPageSeed,
  cartPageSeed,
  checkoutPageSeed,
  orderPageSeed,
// inithium:block:ecommerce:seeds:end
// inithium:block:workshops:seeds:start
  workshopsPageSeed,
  workshopDetailPageSeed,
// inithium:block:workshops:seeds:end
// inithium:block:events:seeds:start
  eventsPageSeed,
  eventDetailPageSeed,
// inithium:block:events:seeds:end
  // inithium:anchor:seeds
];
