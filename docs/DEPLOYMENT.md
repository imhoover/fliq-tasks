# Deployment and remaining external setup

The Owner authorized a public GitHub repository and Cloudflare deployment, and selected an existing Google identity for sign-in. No new account or paid plan is authorized. GitHub browser sign-in succeeded as `imhoover`. Cloudflare sign-in is awaiting the Owner's confirmation of the terms shown on its login form; Wrangler authorization and app-specific Google OAuth credentials remain missing. Do not claim a deployed app URL or live app authentication result until they exist.

## 1. GitHub

Created public repository: [imhoover/fliq-tasks](https://github.com/imhoover/fliq-tasks), repository ID `1423923157`. Browser sign-in and connected repository metadata both identify `imhoover` as the owner.

Publish only this standalone `fliq` directory, never the parent CEO workspace. A local repository is initialized on `main`. The browser created an empty repository; the connected GitHub tools can upload its reviewed files without creating a new credential.

```sh
git remote add origin https://github.com/imhoover/fliq-tasks.git
git push -u origin main
```

The prepared CI workflow uses GitHub's official checkout/setup-node v7 actions, read-only repository permissions and Node 24. Do not mark CI passed until the run finishes on GitHub.

## 2. Cloudflare resource configuration

Use the Owner's existing account. `npx wrangler whoami` must report it is authenticated. If needed, the Owner completes Wrangler's authorization in the browser. Do not use a temporary preview account as a substitute for an Owner-owned deployment.

```sh
npx wrangler d1 create fliq-db
```

Copy the returned database ID into `wrangler.production.jsonc`. Set `vars.APP_ORIGIN` to the exact public HTTPS origin, with no trailing slash. Use a workers.dev subdomain or an existing custom domain. Keep the local configuration for development. The production configuration includes the AI binding and daily expiry cleanup cron.

```sh
npm run release:check
npm run db:remote
```

## 3. Google OAuth and secrets

In the existing Google Cloud project, configure an OAuth web client and consent screen. Redirect URI: `<APP_ORIGIN>/auth/callback`. Development redirect URI, if needed: `http://127.0.0.1:5178/auth/callback`. Only `openid profile` is requested. Add authorized test users while the consent screen is in testing mode. Any publishing/verification requirements must be completed in Google's console before claiming unrestricted public login.

Set these Worker secrets through Cloudflare's settings or Wrangler's hidden input prompt:

```sh
npx wrangler secret put GOOGLE_CLIENT_ID --config wrangler.production.jsonc
npx wrangler secret put GOOGLE_CLIENT_SECRET --config wrangler.production.jsonc
npx wrangler secret put SESSION_SECRET --config wrangler.production.jsonc
```

`SESSION_SECRET` must be at least 32 random bytes. Do not paste secret values in chat, shell command arguments, tracked files, or logs. For local Google testing, the Owner may create ignored `.dev.vars` using `.dev.vars.example`. Secrets and the D1 ID are not interchangeable.

## 4. Verify and deploy

```sh
npm ci
npm test
npm run lint
npm run build
npm audit --audit-level=high
npm run deploy:check
npm run deploy
```

`deploy:check` bundles without publishing and is not proof of a successful remote deployment. `deploy` refuses placeholder origin/database settings. Do not enable paid Cloudflare plans or expand account permissions without the Owner's approval.

## 5. Live acceptance tests

- Open the returned public URL. Confirm initial capture, refresh, both flick directions, search and undo.
- Google sign-in completes with a real account; callback URI matches; Secure/HttpOnly cookie is set. A second authorized account cannot read the first account's tasks.
- Explicitly import guest tasks. Verify a task on a second browser/device, then change status and verify it synchronizes.
- Invoke real Workers AI on a synthetic note. Review selected suggestions and add them. Confirm the original draft remains available and malformed responses are handled.
- Reopen after a network interruption, capture a task and reconnect. Verify outbox drains and conflicts preserve both versions.
- Test on actual iPhone Safari, home-screen mode and a desktop browser. Chrome viewport tests are not an actual iPhone Safari test.

## Operations and rollback

Monitor `/api/health`, Google callback failures, API errors and D1/AI usage without logging tokens or memo content. `GET /api/health` reveals only configuration flags. Sessions last seven days; OAuth state is valid for ten minutes and accepted once. Auth requests are limited to 20 per IP hash per ten minutes; task writes to 200 per user per minute; AI to 20 per user per UTC day. Daily cleanup removes expired sessions, OAuth state markers and quota buckets, never user tasks.

The initial schema is additive. Before subsequent remote schema changes, take a D1 backup and review migration compatibility. Roll back the Worker with Cloudflare's version/rollback facilities; keep the compatible database schema. Service-worker shell cache versions should be changed intentionally when changing cache policy. An old open tab may retain its previous version until reloaded.
