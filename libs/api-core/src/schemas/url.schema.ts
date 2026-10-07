import { z } from 'zod';

// Every admin-entered link or image URL that the site renders as an href/src. A bare z.url()
// accepts `javascript:` and `data:` URLs, which turn a CMS field into a script-injection vector.
export const httpUrlSchema = z.string().trim().max(2000).pipe(z.url({ protocol: /^https?$/, message: 'Must be an http(s) URL' }));
