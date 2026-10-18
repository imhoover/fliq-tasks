# Deployment and remaining external setup

The Owner authorized a public GitHub repository and Cloudflare deployment, selected an existing Google identity, and explicitly approved the scoped Wrangler connection. No new account or paid plan is authorized. The app is deployed at [Fliq](https://fliq.gn8hoover.workers.dev); guest capture and flicks were verified there in Chrome. Google app credentials and authenticated live-provider tests remain pending. Google Cloud currently blocks access until the Owner enables two-step verification; that account-security change requires the Owner's own interaction.

## 1. GitHub

Created public repository: [imhoover/fliq-tasks](https://github.com/imhoover/fliq-tasks), repository ID `1423923157`. Browser sign-in and connected repository metadata both identify `imhoover` as the owner.

Only this standalone `fliq` directory was published, never the parent CEO workspace. The browser created the repository; the existing GitHub connector uploaded all 45 tracked files. Public source commit: `285c1035e517df3444f2addfd9af2af12b723499`. Public source and the local tracked files were compared with `git diff origin/main --stat`; no differences were reported.

```sh
git remote add origin https://github.com/imhoover/fliq-tasks.git
git push -u origin main
```

The CI workflow uses GitHub's official checkout/setup-node v7 actions, read-only repository permissions and Node 24. [Initial run 39090526686](https://github.com/imhoover/fliq-tasks/actions/runs/39090526686) completed successfully: clean install, tests, lint, build, dependency audit and deployment dry run all passed. The dry run does not publish the app.

## 2. Cloudflare resource configuration

Use the Owner's existing account. `npx wrangler whoami` must report it is authenticated. If needed, the Owner completes Wrangler's authorization in the browser. Do not use a temporary preview account as a substitute for an Owner-owned deployment.

The Owner approved and the CLI confirmed `account:read user:read workers_scripts:write d1:write ai:write`, plus `offline_access`. The consent screen showed six permissions: User Read, Background Access, Account Read, Workers Scripts Write, D1 Write and Workers AI write. Credentials are encrypted by Wrangler with the encryption key held in Windows Credential Manager using the official `@napi-rs/keyring@1.3.0` dependency. Wrangler's warning about other default scopes reflects the deliberately restricted grant; those unrelated scopes were not added.

Confirmed resources: D1 `fliq-db`, ID `640934e9-97c5-4276-8a09-d862b17ca282`, region APAC. Migration `0001_initial.sql` applied remotely with 8 successful SQL commands. The existing account subdomain is `gn8hoover.workers.dev`; `APP_ORIGIN` is `https://fliq.gn8hoover.workers.dev`. The commands below describe the initial provisioning procedure; do not create a duplicate database.

```sh
npx wrangler d1 create fliq-db
```

Copy the returned database ID into `wrangler.production.jsonc`. Set `vars.APP_ORIGIN` to the exact public HTTPS origin, with no trailing slash. Use a workers.dev subdomain or an existing custom domain. Keep the local configuration for development. The production configuration includes the AI binding and daily expiry cleanup cron.

```sh
npm run release:check
npm run db:remote
```

## 3. Google OAuth and secrets

`SESSION_SECRET` is configured. It was generated from 48 random bytes and piped directly into Wrangler without printing or writing its value to a project file. A name-only secret listing confirmed it exists. `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` are not configured. The public account sheet truthfully disables Google login until all required settings exist.

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

On 2026-10-18 JST, `npm run deploy` completed successfully. Initial upload version: `931856c0-bf84-441a-99e3-6d65ab251a59`. The subsequent session-secret change deployed version `4ccb89ed-9ca5-4aef-a60f-3735a55e85bf` at 100%. Daily cleanup is scheduled at `0 3 * * *` UTC. `/api/health` returned `{"ok":true,"googleConfigured":false,"aiConfigured":true}`. The AI flag confirms the deployed binding, not a successful inference or authenticated app flow.

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
