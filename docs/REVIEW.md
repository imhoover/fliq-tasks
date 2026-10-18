# Review record

Scope: the standalone Fliq application. No parent landing-page files were changed. Review covers task persistence, cloud revision conflicts, Google identity boundaries, AI input/output handling, initial capture and motion.

## Corrections made during review

| Before | After | Why |
| --- | --- | --- |
| A draft keystroke rewrote every saved task. | Draft writes use a small separate record; a token marks consumed drafts. | Keeps input cost independent of library size and prevents a saved draft from reappearing. A failing 50,936-byte write test was reduced to less than 1,000 bytes. |
| All matching tasks were mounted at once. | Fifty are displayed at a time; counts/search are memoized. | Bounds initial DOM/animation work while preserving access to all matches. |
| Context controls could be under 44px on mobile. | Task state, star and details controls use 44px targets. | Improves one-handed touch access. |
| Glass captions had weak contrast. | Captions and task details use darker text. | Preserves translucency while improving readability. This is a visual/contrast review, not a complete WCAG certification. |
| Default modal focus landed on its close button. | Editable sheets focus their first input after `showModal`. | Preserves direct entry; native dialog provides focus containment and Escape behavior. |
| UTC export filenames differed from the local day. | Filenames use the browser's local calendar date; exported timestamps remain ISO UTC. | Aligns the filename with the visible date without losing an audit timestamp. |
| Initial composition could be interrupted by replacing the loading input. | Mount waits for an ongoing IME composition to end. | Preserves Japanese input begun during loading. Actual iPhone IME behavior remains unverified. |
| Keyboard-triggered list and sheet actions used pointer animation durations. | Keyboard interaction sets zero-duration motion; pointer interaction restores normal motion. | Keeps repeated keyboard actions immediate while preserving pointer feedback. |
| Toast centering and animated transforms competed. | CSS individual `translate` handles centering separately. | Prevents animation transforms from moving the desktop toast off its intended center. |
| The release guard parsed JSONC with a strict JSON parser. | A JSONC parser validates real Wrangler configuration and fails with an actionable exit code 2. | A regression test reproduces the original syntax failure and verifies placeholder settings are rejected correctly. |
| The boot draft caption touched the textarea's focus outline. | A 12px top margin separates it; the actual mobile gap measured 16px. | The held-bundle browser check verifies readable loading feedback while preserving input through startup and refresh. |

## Motion verdict

Local review: approve for continued local acceptance testing. Pointer motion uses the `[0.22, 1, 0.36, 1]` curve and 180–280ms timing. Flick return uses a retargetable spring and release velocity. Motion indicates drag direction, status, list changes and modal depth. Reduced motion and keyboard interaction suppress movement. Loading shimmer and AI spinner run only during their corresponding pending state. The progress ring animates stroke offset as an intentional data-visualization exception to compositor-only movement.

## Security and release verdict

The local tests exercise real Miniflare D1 storage, authenticated test sessions, owner isolation, optimistic revisions, input/body limits, foreign-origin rejection, logout, AI response validation and quotas. The AI binding in automated success/quota tests is explicitly stubbed; it is not evidence of a real model invocation. The Google redirect test verifies PKCE/state/nonce/cookie configuration; it is not evidence of real Google sign-in.

The guest application is now deployed on Cloudflare with real D1/Workers AI bindings and a session secret. Public Chrome capture/refresh/both-flick checks and the initial GitHub CI run passed. Google Cloud is blocked by the Owner account's two-step-verification requirement; Google app secrets and live OAuth/sync/AI tests remain pending. Never describe those pending checks as passed. Local snapshots do not currently coordinate simultaneous edits between multiple browser tabs sharing one local namespace; use one active editing tab per account during this first release. Browser task storage is not encrypted and is not intended to promise encrypted secret storage; the encrypted Wrangler credential store is a separate mechanism.
