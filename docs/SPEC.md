# Fliq implementation specification

## Objective and assumptions

Mobile-first installable web application, optimized for iPhone Safari, with a responsive desktop layout. Native iOS/App Store delivery is outside this first release. Working title: Fliq. The user delegated technology choices and requested GitHub repository creation and publication.

Open directly into an editable composer. Capture works before login and offline. Google login enables account-isolated cloud synchronization. No marketing copy or onboarding gate. The first load has a full-screen skeleton with an immediately usable composer. No artificial loading delay.

## Acceptance criteria

- Capture a task with title and optional notes, preserve an unsent draft across refresh, and save locally before network work. Surface storage failures without clearing text.
- Move tasks through inbox → doing → done by right flick; left flick reverses. Short drags and vertical scrolling do not change status. Buttons and keyboard offer the same actions. Changes can be undone.
- Search, status filters, star, edit and recoverable delete work. No fabricated personal tasks on first use; optional examples are explicitly loaded by the user.
- Glass materials, layered highlights, animated tabs, list transitions, gesture feedback, sheets and toasts. Respect reduced motion, focus, safe areas and 44px touch targets.
- Google OAuth code flow with state, PKCE, nonce and verified Google ID tokens. HttpOnly session cookie; user-owned D1 records; CSRF origin checking; input/body limits; rate limits. No other sign-in methods or development login bypass.
- Cloudflare Workers API/static assets, D1 migrations, Workers AI task breakdown. Show and confirm AI suggestions before saving; never present a local mock as AI success.
- Signed-in accounts use separate local namespaces. Guest import is explicit. Pending changes remain pending after failures; conflicts preserve both versions.
- Build, unit/integration checks and actual browser tests pass. Record production-only tests that require credentials separately until performed.

## Stack and structure

React + TypeScript + Vite for the client, Motion for interaction, lucide-react icons, Hono for Workers routes, jose for Google JWT verification, D1 SQL for data. Vanilla CSS owns glass visuals. Vitest and Miniflare verify logic/API using a real local SQLite-compatible D1 runtime.

`src/`: client. `shared/`: validated task contract. `worker/`: API and authentication. `migrations/`: D1 schema. `tests/`: automated evidence. `docs/`: decisions, release and test records.

Code example: `const next = moveStatus(task.status, 1);` Pure helpers use explicit types. Validate all server inputs; SQL must use bind parameters. Never log tokens or task content.

## Commands and ordered slices

1. Foundation and task logic: `npm install`, `npm test -- tests/tasks.test.ts`; verify blank input rejection, status boundaries, merge/conflict behavior.
2. Persistent capture and responsive glass UI: `npm run build`; verify input, draft, refresh, flick and keyboard flows in Chrome at phone and desktop widths.
3. Google + D1 APIs: `npm test`; use Miniflare to verify unauthorized access, origin validation, account isolation, revision conflicts and database operations.
4. Workers AI suggestion review and PWA: `npm run lint`, `npm run build`; verify service worker restrictions and error states.
5. Review and publish: `npm audit`, `npm run deploy:check`; create standalone Git repository, push only this directory, provision D1 and deploy if existing credentials permit. Test live Google login and Workers AI only with valid credentials; do not mark these passed otherwise.

Development: `npm run dev`. D1 local schema: `npm run db:local`. Deployment: `npm run deploy` after configuring D1, APP_ORIGIN and Worker secrets.

## Boundaries

Always: preserve input, expose actual sync state, validate and test affected flows. Never: commit secrets, bypass real authentication, claim production tests passed without evidence, alter the parent app, create accounts or incur charges without Owner approval.

The user authorized implementation and publication. Additional skill review gates are handled as reviewable artifacts and progress updates under the session's existing authorization. New material decisions, sensitive credential entry and paid plans still require the Owner.
