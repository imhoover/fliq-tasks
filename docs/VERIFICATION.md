# Verification — 2026-10-18 JST

Confirmed: the local application builds, all 34 automated checks pass, and the browser flows below were exercised in real Chrome. Public deployment, a live Google sign-in, live cross-device cloud sync and real Workers AI inference remain unverified. The overall publication goal is not complete.

## Environment and commands

Windows; Node.js 24.14.0. Development URL: `http://127.0.0.1:5178/`. Production-build preview: `http://127.0.0.1:5179/`.

| Command | Observed result |
| --- | --- |
| `npm install` | Dependencies installed; lockfile recorded. |
| `npm run db:local` | Initial D1 migration applied successfully; 8 SQL commands. |
| `npm test` | PASS — 34 tests in 5 files, latest full run at 08:03:18 JST. |
| `npm test -- tests/shell.test.ts` | PASS — 3 focused shell/cache checks at 08:12:31 JST, after the initial caption-spacing adjustment. |
| `npm run lint` | PASS — no errors or warnings. |
| `npm run build` | PASS — TypeScript and both Worker/client builds. Latest client JavaScript: 493.04 kB, gzip 154.42 kB; CSS: 29.27 kB, gzip 7.34 kB. |
| `npm audit --audit-level=high` | PASS — 0 vulnerabilities. |
| `npm run deploy:check` | PASS — dry run, 13 static files, Worker upload 894.38 KiB / gzip 152.28 KiB. This did not publish. |
| `npm run release:check` | EXPECTED BLOCK — real HTTPS origin and D1 ID are placeholders. The guard reports the missing configuration. Tests also verify a valid JSONC fixture is accepted. |
| `npx wrangler whoami` | NOT AUTHENTICATED. No account was created and no remote resource was provisioned. |
| `npm run writing:doctor` in parent workspace | natural and textlint available; semantic analysis not run. |
| `npm run lint:ja -- fliq/README.md` in parent workspace | Completed with 4 lexical suggestions, 0 execution errors. The terms at L29 (照合), L31 (検査), and L39 (検査 twice) were retained as accurate technical descriptions. An exit code 0 is not treated as a writing-quality certificate. |

Automated tests use the real Miniflare D1 implementation. AI success/invalid-output/quota cases use an explicitly stubbed binding. Google redirect tests verify state, nonce, PKCE and cookie attributes, without performing a real provider sign-in. Initial HTML and service-worker scope/fallback tests complement browser checks; no artificial loading delay was added.

## Browser checks

Real Chrome was controlled through the browser UI. Responsive viewports were 320×740, 390×844 and 1280×900. These are viewport checks, not a physical iPhone or Safari run.

| Flow | Observed result |
| --- | --- |
| Capture | Japanese title, note, number `120` and date text `10月18日` preserved. Saved tasks survive refresh. |
| Draft | Unsent multiline text survives refresh; Ctrl+Enter saves and clears the composer. Retested against the production build after keyboard-motion changes. |
| Before the application bundle loads | Held the real production JavaScript response at a loopback QA proxy. The skeleton occupied the full 844px viewport; the boot textarea accepted Japanese multiline text. Releasing the bundle preserved the exact text and focus; saving and refreshing retained the task and note. |
| Flick | Right drag changed inbox → doing; left drag changed doing → inbox. A short drag left status unchanged. |
| Status buttons | All three states exercised; done can return to inbox. |
| Search | Entering `提案書` showed the matching task only. Clearing search restored the list. |
| Edit | Title and status changed; original note and numeric/date text retained. |
| Undo | Status change undone; soft deletion undone and task restored. |
| Important filter | Starred task alone appeared under the mobile important filter. |
| Trash | Deleted task remained in the trash; Restore returned it with its previous completed status. |
| Sorting | Oldest-first moved the earliest captured offline note to the first row; newest-first restored the latest task first. |
| Account / AI | Only Google sign-in was offered. Missing configuration was clearly shown; unauthenticated AI opened a login requirement, never fabricated suggestions. |
| Dialog | Focus stayed inside the modal; editor focused its title; Escape closed the AI sheet. |
| Export | Browser downloaded JSON. Parsed actual files contained tasks/notes/statuses and no token, secret or cookie fields. Local-date filename verified as `fliq-2026-10-18.json`. |
| Offline boot | Preview server was stopped. Browser reload still opened the application and existing note. |
| Offline capture | Added `通信停止中に追加したタスク` while the server was stopped; refreshed and confirmed it remained. Server was restarted afterwards. |
| Input limits | Whitespace-only input disabled Add. A 301-character first line showed a Japanese limit message and preserved all 301 characters. |
| Mobile geometry | No horizontal overflow at 320px or 390px. Status/star/details touch targets measured 44×44px. |
| Desktop | Sidebar, composer, tasks and progress panels shown at 1280px; progress correctly displayed 1 / 3 and 33%. |
| Console | No warnings/errors on the initial online production-build capture. Expected network failures occurred during the deliberate offline test. |

Screenshots contain synthetic verification tasks, not the Owner's personal task data:

- [Mobile overview](screenshots/mobile.jpg)
- [Mobile editor](screenshots/mobile-sheet.jpg)
- [Desktop overview](screenshots/desktop.jpg)
- [Editable full-screen loading skeleton](screenshots/loading.jpg)

### Controlled first-load check

The first-load check used the actual build on port 5179 through a temporary read-only loopback proxy on fresh origins 5182 and 5183. Only `/assets/*.js` delivery was held; initial HTML, CSS and `boot.js` loaded normally. The browser's navigation observation timed out while delivery was deliberately held; the same live tab was then inspected and operated without restarting the server. After releasing delivery, assertions verified exact text and focus preservation, then task persistence after refresh.

The fixture was `読込中に入力したメモ` followed by `数値120、10月18日を保持`. A caption spacing issue was corrected with a 12px top margin; the final caption-to-textarea gap measured 16px. The final build and focused shell checks passed. The hold existed only in the QA proxy; the product has no artificial loading timer. Public authentication prerequisites remain unchanged.

## Remaining external checks

| Item | Status and missing prerequisite |
| --- | --- |
| Public GitHub repository | CREATED on 2026-10-18 JST: `https://github.com/imhoover/fliq-tasks`, repository ID `1423923157`, visibility public. Owner selected an existing Google identity; browser sign-in succeeded as `imhoover`. Source upload is being prepared. |
| GitHub Actions | PREPARED, NOT RUN. Requires repository creation and push. |
| Public Cloudflare deployment | NOT DEPLOYED. Browser and Wrangler are unauthenticated; real D1 ID/origin are missing. |
| Real Google OAuth | NOT RUN. Requires the Owner's OAuth client, secret, consent configuration and registered callback URI. |
| Live account isolation / cross-device sync | NOT RUN. Requires a real deployed database, valid provider sign-in and two authorized test accounts/devices. |
| Real Workers AI | NOT RUN. Requires a deployed AI binding and authenticated user. Japanese breakdown quality and response time have not been benchmarked. |
| Actual iPhone Safari / home-screen launch / Japanese IME | NOT RUN. Implemented with web standards and reviewed, but not exercised on an actual iPhone. |
| OS reduced-motion setting | Source reviewed; no actual operating-system preference was changed during testing. |

Do not mark these pending items passed based on unit fixtures, a dry run or a responsive screenshot. Deployment steps are in [DEPLOYMENT.md](DEPLOYMENT.md); review limitations are in [REVIEW.md](REVIEW.md). The first release assumes one active editing tab per local account namespace.

### External handoff audit

The original account-selection blocker was recorded across the initial goal turn and two continuations. The Owner subsequently selected an existing Google identity; GitHub sign-in succeeded as `imhoover`, and an empty public repository was created. Cloudflare's sign-in form explicitly states that continuing accepts its terms, so confirmation is pending before continuing that form. Wrangler remains unauthenticated, production origin/D1 ID are placeholders, and only `.dev.vars.example` exists. No new account was created. Authentication screenshots stay under ignored `artifacts/`, outside the public repository files. Deployment and live-provider tests still require Cloudflare access and app-specific OAuth configuration.
