import dns from 'node:dns';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import {
  connectDatabase,
  ensureOwnerBootstrap,
  ensureSeededClassCatalog,
  ensureSeededPages,
  ensureSeededPolicies,
  ensureSeededSettings,
  pruneOrphanedPluginPages,
} from '@inithium/db';
import { getAuthProvider, setSessionValidator } from '@inithium/auth';
import { resolveSession } from '@inithium/permissions';
import { registerCoreRoutes } from '@inithium/api-core';
import { errorHandler } from '@inithium/api-utils';
import { attachRealtimeGateway, connectRealtime } from '@inithium/realtime';
// inithium:block:ecommerce:imports:start
import { createPaymentWebhookRouter } from '@inithium/ecommerce';
// inithium:block:ecommerce:imports:end
// inithium:anchor:imports

// A `mongodb+srv://` URI (MongoDB Atlas's default connection string format) resolves via a DNS
// SRV lookup before the driver ever opens a socket. Node's own DNS resolver trusts whatever the
// OS network adapter reports as its configured server - on a machine where that's been left
// pointing at a local resolver stub (127.0.0.1, common leftover config from VPN clients or
// DNS-filtering tools, even once disconnected/uninstalled) with nothing actually listening there,
// every SRV query fails with ECONNREFUSED even though the OS's own DNS tools (which fall back
// differently) resolve fine - see connectDatabase's own error if this ever regresses. Pointing
// Node's resolver at public DNS directly sidesteps that broken local config without touching the
// OS network settings at all. Development only - a production host's own resolver may be the only
// one that can see private/internal names.
const isProduction = process.env['NODE_ENV'] === 'production';
if (!isProduction) {
  dns.setServers(['8.8.8.8', '1.1.1.1']);
}

// Comma-separated list of browser origins allowed to call this API and open realtime sockets.
// Required in production - a missing value must fail loudly rather than fall back to localhost.
const webOrigins = (process.env['WEB_ORIGIN'] ?? '')
  .split(',')
  .map((origin) => origin.trim().replace(/\/$/, ''))
  .filter(Boolean);
if (webOrigins.length === 0) {
  if (isProduction) throw new Error('WEB_ORIGIN must be set in production (e.g. https://www.example.com)');
  webOrigins.push('http://localhost:5173');
}

const app = express();
// Number of reverse proxies in front of this server (Render's load balancer = 1). Makes req.ip the
// real visitor address so rate limits are per visitor; never `true`, which trusts a
// client-supplied X-Forwarded-For.
app.set('trust proxy', Number.parseInt(process.env['TRUST_PROXY'] ?? '0', 10) || 0);
// A JSON-only API: helmet's defaults (HSTS, nosniff, frame denial, a deny-all CSP, no
// X-Powered-By) cost nothing here. The SPA's own CSP is emitted by apps/web's build.
app.use(helmet());
// apps/web (Vite) runs on a different origin - without this, the browser silently blocks every
// request the SPA makes to this API.
app.use(cors({ origin: webOrigins }));
// Routes that must see the untouched request body (e.g. a payment provider's signed webhook,
// verified against the exact bytes sent) mount here, ahead of the global JSON parser below.
// inithium:block:ecommerce:pre-body-parser:start
app.use(createPaymentWebhookRouter());
// inithium:block:ecommerce:pre-body-parser:end
// inithium:anchor:pre-body-parser
app.use(express.json());

const startServer = async () => {
  try {
    await connectDatabase({ uri: process.env['MONGO_URI'] });
    await connectRealtime();
    // Idempotent - creates only the pages missing by slug, never touches an existing (possibly
    // admin-edited) one. Runs on every boot, which is what makes a plugin's newly seeded pages
    // reach a deployed instance the same way any other code change does: git push -> redeploy ->
    // this runs again against the persistent database.
    await ensureSeededPages();
    // Same idempotent seed-once pattern as ensureSeededPages, for the settings collection instead
    // of pages - see settings-seeds/registry.ts's own comment for why this is core's
    // responsibility rather than something left to each admin to configure by hand.
    await ensureSeededSettings();
    // The other direction of the reconciliation above: a page whose plugin has since been
    // removed (inithium remove deletes its page-seed and registry.ts entry, but never touches
    // the database) would otherwise linger forever, still published, still in the nav. Deletes
    // it if it was never edited since being seeded, or just unpublishes it if an admin has since
    // customized it - see pruneOrphanedPluginPages's own comment.
    await pruneOrphanedPluginPages();
    // Idempotent, same "run on every boot" precedent as ensureSeededPages above - the concrete
    // migration path for a workspace upgrading into capability-based permissions with
    // pre-existing users that predate the isOwner field.
    await ensureOwnerBootstrap();
    // One-time content seed for the Policies plugin - only ever inserts anything on a database
    // that has zero policy categories (a brand-new instance, or one from before this plugin was
    // added); see ensureSeededPolicies's own comment for why this doesn't need
    // ensureSeededPages's per-slug reconcile loop.
    await ensureSeededPolicies();
    // Same one-time, empty-collection-only seed for the class catalog (programs, courses, time
    // slots, and the school year they run in) - see ensureSeededClassCatalog.
    await ensureSeededClassCatalog();

    getAuthProvider().assertConfigured?.();
    setSessionValidator(resolveSession);
    registerCoreRoutes(app);
    app.use(errorHandler);

    const port = process.env['PORT'] || 3000;
    const server = app.listen(port, () => {
      console.log(`🚀 API listening at http://localhost:${port}`);
    });
    attachRealtimeGateway(server, { allowedOrigins: webOrigins });
  } catch (error) {
    console.error('❌ Startup failed:', error);
    process.exit(1);
  }
};

startServer();
