import dns from 'node:dns';
import express from 'express';
import cors from 'cors';
import { connectDatabase, ensureOwnerBootstrap, ensureSeededPages, ensureSeededSettings, pruneOrphanedPluginPages } from '@inithium/db';
import { getAuthProvider } from '@inithium/auth';
import { registerCoreRoutes } from '@inithium/api-core';
import { errorHandler } from '@inithium/api-utils';
import { attachRealtimeGateway, connectRealtime } from '@inithium/realtime';

// A `mongodb+srv://` URI (MongoDB Atlas's default connection string format) resolves via a DNS
// SRV lookup before the driver ever opens a socket. Node's own DNS resolver trusts whatever the
// OS network adapter reports as its configured server - on a machine where that's been left
// pointing at a local resolver stub (127.0.0.1, common leftover config from VPN clients or
// DNS-filtering tools, even once disconnected/uninstalled) with nothing actually listening there,
// every SRV query fails with ECONNREFUSED even though the OS's own DNS tools (which fall back
// differently) resolve fine - see connectDatabase's own error if this ever regresses. Pointing
// Node's resolver at public DNS directly sidesteps that broken local config without touching the
// OS network settings at all.
dns.setServers(['8.8.8.8', '1.1.1.1']);

const app = express();
// apps/web (Vite) runs on a different origin in dev - without this, the browser silently
// blocks every request the SPA makes to this API.
app.use(cors({ origin: process.env['WEB_ORIGIN'] || 'http://localhost:5173' }));
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

    getAuthProvider().assertConfigured?.();
    registerCoreRoutes(app);
    app.use(errorHandler);

    const port = process.env['PORT'] || 3000;
    const server = app.listen(port, () => {
      console.log(`🚀 API listening at http://localhost:${port}`);
    });
    attachRealtimeGateway(server);
  } catch (error) {
    console.error('❌ Startup failed:', error);
    process.exit(1);
  }
};

startServer();
