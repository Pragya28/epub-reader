# Sprint 8 — Task List (Gap Analysis vs Codebase)

Generated 2026-08-28 by comparing `central-docs/06 - Implementation/Sprint - 08 Production Polish.md` against the current codebase, following the format of `docs/tasks/SPRINT-07-TASKS.md`.

Status refreshed 2026-09-10 (spec re-verified against the restored `central-docs` symlink — every Day 1-7 Dev/Test bullet and Related Gap is reflected below):

- Days 1-4 ✅ complete and tested.
- Day 5 (Cross-Device Validation) 🟡 — real device/browser-lab QA isn't possible in this environment, so it shipped as automated Playwright e2e coverage (`e2e/cross-device.spec.ts`, wired into CI as a `playwright` job) plus an OPFS-fallback unit-test gap closed and one real responsive fix (search input < 24px). Now committed (#18, test fix #17). See Day 5 below for what that does and doesn't substitute for.
- Day 6 item 31 (backup/export workflow validation) ✅ — the backup/restore feature is built (`src/services/backup/` + `features/library/actions/{export-library,import-backup,reset-library}.ts`, Settings UI, `e2e/backup-restore.spec.ts`). Item 28 (full-chain workflow test) ✅ — already covered by `e2e/cross-device.spec.ts` (Day 5, #18). Item 30 (release checklist) ✅ — `docs/RELEASE_CHECKLIST.md`. Item 29 (long-session stress) ✅ — `use-reader-engine.test.ts` gains a bounded-listeners/blob-URL regression block, plus `backup.perf.test.ts` for real-EPUB backup/search stress at library scale. Item 27 (manual regression pass) ✅ — live browser walkthrough (import, read, search, organize, backup/restore, cross-tab, dark/mobile) found and fixed three real bugs: a kebab-case SVG attribute React console error in `word-mark.tsx`, five nav buttons losing native link semantics, and a stale "Space used" readout after "Delete all". **Day 6 fully complete.**
- Day 7 not started — no release checklist, no changelog.
- Since the 2026-08-31 refresh: automated suite is 90 test files (was 75 at the 2026-08-30 code-review pass); CI restructured — full suite moved out of the pre-push hook into GitHub Actions, pre-push now runs `pnpm build` only (#14), Node bumped to 22 for pnpm 11 (#15); Vercel Speed Insights added (#16). None of these are sprint tasks; noted here so the delta is traceable.
- Post-Day-6, off-sprint: reading progress now displays to one decimal place (`computeReaderProgress`, `save-reader-progress.ts`) instead of a whole number. That change, plus the manual-QA button fix, each broke CI once — a bad `nativeButton={false}` fix flipped 5 nav elements from accessible role "link" to "button" (Base UI injects `role="button"` unconditionally when `nativeButton={false}`, with no exception for a real anchor), and the decimal percent broke `backup-restore.spec.ts`'s whole-number-only regex. Both fixed and CI reconfirmed green. Also fixed: freshly imported multi-chapter books were never reaching "unread" status (import seeds a full progress object, so `deriveReadingStatus`'s `!progress` check never fired) — folded the existing "untouched" heuristic (already used for the NEW badge) into the status derivation itself.

Legend: ✅ done · 🟡 partial · ❌ missing

---

# Baseline (what already exists going in)

Unlike Sprint 7 (zero prior art for series/collections), Sprint 8 is a hardening pass over things earlier sprints already built, several explicitly deferred here:

- **Accessibility contract already written** — `.agents/context/ACCESSIBILITY.md` (Sprint 5 Day 6) sets the WCAG 2.2 AA target, documents what's shipped vs. open, and says outright: _"Sprint 8: validation and polish against this document, not first-pass implementation."_ It also names the one real open question — the reader's virtualized iframe not being fully in the accessibility tree — as **"Open — decide before Sprint 8."**
- **PWA already installable** — `vite-plugin-pwa` (`vite.config.ts`) precaches the app shell with `registerType: "autoUpdate"` (Workbox handles cache versioning/cleanup automatically), a real manifest with maskable icons, and deliberately excludes EPUB/cover blobs from the SW cache (they live in IndexedDB). This is "early PWA support landed ahead of schedule" the sprint spec's own note references — Day 2 is a hardening pass on this, not a from-scratch build.
- **DRM detection already shipped** — `epub.service.ts` checks for `META-INF/encryption.xml` and throws a clear "protected by DRM" error before parsing proceeds, closing most of Import-01's scope already.
- **Storage quota — nothing built yet.** No `navigator.storage.estimate()`/`persist()` call anywhere in `src/`. Deferred from Sprint 6 Day 6, then again from Sprint 7 (Day 6 note: "Collections increase what's stored... but not by enough to change that call").
- **No install-prompt/onboarding UI, no multi-tab concurrency handling** (no `BroadcastChannel`, no cross-tab storage-event handling) — both greenfield for this sprint.
- **Perf regression-guard pattern established** — four `*.perf.test.ts` files already exist (search, EPUB parsing, library load, grouping sort), all "generous budget, not a tight gate." Day 3 extends this pattern to bundle size/startup/memory rather than inventing a new one.
- **Sprint 7's data model was kept export-friendly on purpose** (Day 1 note: "every field is a plain string/number... so a future export can serialize the schema directly") — Day 6's backup/export gap has no schema work left, only the export/import mechanism itself.

---

## Day 1 — Accessibility ✅

1. ✅ **Keyboard navigation across reader and library** — chrome reveal-on-focus (`use-chrome-visibility.ts`) confirmed; regression tests added: `reader-screen.test.tsx` asserts header/footer chrome controls stay in the tab order while the chrome is hidden (WCAG 2.4.11), and `use-reader-engine.test.ts` now asserts `defaultPrevented` on the PageUp/PageDown/arrow/space scroll handling. Library keyboard walkthrough: no dedicated interaction code, standard buttons/links.
2. ✅ **Focus management (modals, TOC, search, settings)** — `focus-visible:ring` shared primitive; Base UI `Dialog`/`Sheet` (TOC drawer, external-link dialog, settings, search) trap focus by default, confirmed via existing component tests. No code change needed.
3. ✅ **Screen reader improvements** — decision: reader-iframe virtualization is an **accepted, documented limitation** (not a parallel linear view). Mitigation shipped: a polite `role="status"` / `aria-live="polite"` live region in `reader-screen.tsx`, fed by `currentChapterLabel` from `use-reader-screen.ts` (TOC label → `Chapter N of M` fallback, reuses `flattenToc`), announcing every chapter transition. ACCESSIBILITY.md's "The reader is the hard part" section rewritten to match.
4. ✅ **Contrast validation across themes** — `/impeccable audit` re-run 2026-08-28 (`AUDIT_REPORT.md`): 18/20, Theming 4/4, no contrast/focus regressions. `token-contrast.test.ts` (46 pairs, both themes) green.

### Done Criteria

✅ Complete. Reader-a11y-tree decision made and mitigated; keyboard/focus/contrast validated. One finding (bundle size) carried to Day 3.

**Related Gap:** [[Accessibility-01 Accessibility Scope]] — reader open question resolved (accepted limitation + live region).

**Audit findings reconciled** (`/impeccable audit`, 2026-08-28, `AUDIT_REPORT.md`):

- **Reader iframe not fully in the a11y tree** — resolved as item 3 above (accepted limitation + chapter-transition live region).
- **`icon-xs` button variant at the 24px WCAG 2.5.8 floor** — resolved: variant had zero call sites, deleted from `button.tsx`. Smallest icon button in use is `icon-sm` (28px).
- **P2 — main JS bundle 945.95 kB (295.92 kB gzip)** — out of scope for Day 1; already tracked as Day 3 items 9 and 13. **Confirmed resolved**: the 2026-08-30 full-codebase audit rerun (`docs/AUDIT_REPORT.md`, `docs/code-review-2026-08-30.md`) explicitly notes "the prior audit's bundle-size P2 was already resolved by Sprint 8 Day 3's route splitting" — score now 20/20, 0 P0-P3 outstanding.

---

## Day 2 — Offline & PWA ✅

5. ✅ **Service worker polish** — `autoUpdate` + Workbox precaching confirmed; `cleanupOutdatedCaches: true` made explicit in `vite.config.ts` (verified present in generated `dist/sw.js`). `// ponytail:` note that Workbox owns cache versioning — no hand-rolled logic.
6. ✅ **Offline reading validation** — `src/features/pwa/__tests__/offline-reading.test.ts`: import a book, stub `fetch` to reject, then `loadLibrary` + EPUB parse + `searchLibrary` all succeed and `fetch` is never called.
7. ✅ **Cache management + quota/eviction** — the real gap (per the spec's own annotation) was quota/eviction, now built:
   - `src/services/storage/storage-quota.ts` — `estimateStorage` / `requestPersistentStorage` / `isStoragePersisted` / `hasRoomFor`, all feature-detected and fail-soft.
   - **Persist request**: fired once after the first successful import (`use-import-book-fab.ts`).
   - **Pre-flight check**: `hasRoomFor(file.size * 3)` before every import; rejects with a storage-full toast (Day 4 refines the copy/retry).
   - **Usage display**: Settings → Storage section — used/quota + progress bar + persistent-storage status with a "Protect" button (`use-storage-settings.ts`).
   - **Eviction detection**: `load-library.ts` — persisted `hadBooks` flag; library loads empty + `hadBooks` → distinct "Your books were cleared" state in `book-grid.tsx` (not the first-run empty state). Reader's missing-file error copy broadened for the partial-eviction case.
8. ✅ **Install experience** — `src/features/pwa/`: `use-install-prompt.ts` captures + defers `beforeinstallprompt`, detects iOS Safari; `install-banner.tsx` — dismissible banner shown only after first import, Android install button / iOS Add-to-Home-Screen hint, dismissal persisted; Settings also carries an "Install app" action. Empty state kept as a single well-designed state (Onboarding-01), reviewed against DESIGN.md — no tour.
9. ✅ **Keep screen awake while reading** — [[Reader-02 Keep Screen Awake]]. `src/features/reader/hooks/use-wake-lock.ts` (consumed by the reader screen via `use-reader-screen.ts`): feature-detected, fail-soft `navigator.wakeLock.request("screen")` on mount/enable; re-acquire on `visibilitychange` → `"visible"`; auto-release after a configurable idle window, with `notifyActivity()` (wired to the reader's scroll/tap) resetting the timer. Settings → Reading: a "Keep screen awake" `Switch` (default **on**) and, when on, a "Screen-on limit" `StepperRow` (5–60 min, step 5, default 20) — the `KEEP_AWAKE_MINUTES_*` constants live in `preferences-store.ts` alongside the other reader-pref ranges.

### Done Criteria

✅ Complete. App installs as a PWA (deferred prompt + Settings button); reading / browsing / search verified to work with the network down; storage quota is requested, surfaced, pre-checked, and eviction is detected rather than silent; the screen stays on while reading with a user-configurable idle cap.

**Related Gaps resolved:** [[Onboarding-01 First-Run Experience]] (install timing + empty state), [[Storage-01 Quota and Eviction]] (all four recommendations: persist, estimate display, pre-flight check, eviction detection). Day 4 still owns the refined quota-exceeded UX + multi-tab concurrency.

---

## Day 3 — Performance ✅

9. ✅ **Bundle optimization** — route-level `React.lazy` for the Reader/Search/Settings screens (`router.tsx`, one `<Suspense>`) plus dynamic `import()` of the EPUB parser and search-service inside `importBook`. `epub-parser` (JSZip, ~134 kB), `reader-screen`, `search-screen`, `settings-screen`, and `font-selector` are now separate chunks — precached by `vite-plugin-pwa` (so still offline-safe) but not parsed on the library landing path. Entry chunk: 945.76 → ~750 kB (295.84 → ~230 kB gzip).
10. ✅ **Rendering optimization** — no work needed. The reader's windowing engine (`MAX_WINDOW_SIZE = 5`) and the library's memoized derivation pipelines (Sprint 7 Day 6) cover the known hot paths; no profiling surfaced anything further.
11. ✅ **Startup time** — for a local-first PWA with no server round-trips, startup cost is dominated by initial-JS parse/execute, which the bundle-size guard (item 13) tracks directly. No separate jsdom startup timer — it would be a weak signal in that environment.
12. ✅ **Memory profiling** — covered by the long-session windowing test (item 15). jsdom has no GC or `performance.memory`, so the windowing engine's unmount discipline is verified structurally rather than via a memory number.

### Test

13. ✅ **Bundle size regression test** — `scripts/check-bundle-size.mjs` gzips every `dist/assets/*.js` and fails the build if the largest chunk exceeds 310 kB gzip (vs the ~230 kB entry). Wired into the `build` script, so the pre-push hook enforces it. Vite's fixed 500 kB chunk warning is raised clear of it (`vite.config.ts`) so the two guards don't disagree.
14. ✅ **Startup time benchmarks** — folded into item 13 (see item 11).
15. ✅ **Memory leak/profiling tests** — `chapter-window.test.ts` gains a long-session block: a 60-chapter book scrolled forward then backward through `maintainChapterWindow`, asserting the mounted-section count and the loaded-index set never exceed `MAX_WINDOW_SIZE` at any step. Fails if the radius check or the section-cache invalidation regresses.

### Also landed

- **Icon library consolidation** — the app imported icons from both `lucide-react` and `@phosphor-icons/react`; `components.json` already specifies Phosphor. All usages moved to Phosphor and `lucide-react` removed. Bundle-neutral (~230 kB gzip entry either way) — a consistency change, not a size win.

### Done Criteria

✅ Complete. Reader engine + JSZip are off the initial parse path; bundle size and long-session windowing bounds both have regression guards enforced by the pre-push hook.

---

## Day 4 — Error Handling ✅

16. ✅ **Edge-case handling: corrupt EPUB** — `epub.service.ts`/`epub-parser.ts` already throw descriptive errors for broken spine references, invalid files, missing metadata (all covered by existing fixtures/tests — see `src/tests/fixtures/*.epub`'s "missing-metadata", "broken-spine", "invalid" cases).
17. ✅ **Edge-case handling: unsupported/DRM'd files** — DRM detection shipped (see Baseline); "unsupported" (non-EPUB file types) is caught by the `isEpub()` extension/MIME check in `use-import-book-fab.ts`. The one remaining gap (no test exercised the DRM-detection path) is closed: `epub.service.test.ts` builds a minimal in-memory zip with `META-INF/encryption.xml` and asserts `extractOpf` rejects with the DRM message.
18. ✅ **Edge-case handling: storage quota exceeded** — `storage-quota.ts` gains `isQuotaExceededError()`; `use-import-book-fab.ts`'s catch blocks (single and batch import) now check it first and show a distinct "Ran out of storage space..." message instead of the generic import-failure toast. `use-import-book-fab.test.tsx` simulates a real `DOMException("QuotaExceededError")` from the primary write (not just the pre-flight `hasRoomFor` estimate) and asserts the distinct copy.
19. ✅ **Recovery improvements (graceful degradation on failure)** — the "index/derived-data failures must never fail the thing around them" discipline, already applied to search indexing and series/collection membership and further hardened by the 2026-08-30 code-review pass (PR #12), is now also applied to storage quota (item 18) and multi-tab conflicts (item 21) — the two gaps this item used to point at are closed below.
20. ✅ **Logging refinement** — `Logger.error()` now also records into `shared/logger/error-log.ts`, a capped (50-entry) `localStorage`-backed ring buffer, always active regardless of the `enabled`/DEV gate — closing Infrastructure-01's "local error-log recommendation". Settings → Storage gets a Diagnostics row (`use-diagnostics.ts`) to Copy or Share (Web Share API, feature-detected) the log as a timestamped JSON file.
21. ✅ **Multi-tab concurrency** — scoped via user decision: last-write-wins at the storage layer (unchanged) + live cross-tab awareness via a new `BroadcastChannel`-based `reading-progress-channel.ts` (feature-detected/fail-soft), surfaced through two reader dialogs — "also open in another tab" on presence from another tab, and "progress updated in another tab" (with a Reload action) when a broadcast save is newer than what this tab loaded. Makes the conflict visible instead of silent rather than adding a full lock.
22. ✅ **User-friendly error messaging** — the systematic audit this item called for is done (an Explore pass over every `actions/`/`hooks/` call site into `services/storage|epub|search`): collection mutations (`toggle`/`createAndAdd`, `rename`/`removeBook`), book-status actions (`markBookFinished`/`Unread`, `startBookAtBeginning`), the shelves/grouping-detail loads, and the search-result preview loader all get a try/catch + `notify.error` now, matching the import/delete/rebuild-index pattern that was already consistent. `use-storage-settings.ts`'s `requestPersist` gets a try/catch too but logs only — denial is already a normal `false` return, not a throw.

### Done Criteria

✅ Complete. Corrupt/DRM/unsupported-file handling, quota-exceeded messaging, a persistent local error log, cross-tab progress-conflict awareness, and consistent error-messaging across action call sites are all shipped and tested.

**Related Gaps resolved:** [[Storage-01 Quota and Eviction]] (item 18), [[Import-01 DRM and Unsupported Files]] (items 16-17), [[Platform-01 Multi-Tab Concurrency]] (item 21 — scoped to last-write-wins + cross-tab awareness, not a full lock), [[Infrastructure-01 Error and Crash Visibility]] (item 20).

---

## Day 5 — Cross-Device Validation

No physical devices or non-Chromium browser engines are available in this environment, so this day shipped as automated coverage standing in for the manual QA pass, plus real fixes/tests for the gaps it actually found. What it is _not_ is a substitute for a real device lab or Safari/Firefox testing before release — that limitation is inherent to the environment, not a scope cut, and is worth re-running for real before a public launch.

23. 🟡 **Mobile testing** — `e2e/cross-device.spec.ts` (Playwright) runs the full import → read → search → organize flow against the `mobile` project (`devices["Pixel 7"]` — Android Chrome viewport + touch emulation, `playwright.config.ts`). Automated, but one engine (Chromium) on one emulated device, not a real-device matrix.
24. 🟡 **Tablet testing** — same spec against the `tablet` project (`devices["Galaxy Tab S9"]` — an iPad preset was tried first but defaults to WebKit, unavailable in this sandbox; a Chromium-based tablet preset was substituted instead). Same caveat as item 23.
25. 🟡 **Responsive validation** — the e2e spec asserts, on every screen in the flow and on all three projects (mobile/tablet/desktop): no horizontal overflow (`document.documentElement.scrollWidth` never exceeds the viewport), and that primary interactive elements (FAB, arc actions, back button, search input, "More options", collection creation) clear the WCAG 2.5.8 24×24 CSS px floor from `.agents/context/ACCESSIBILITY.md`. This audit already found and fixed one real gap: the search screen's `<input>` (`search-screen.tsx`) had no vertical padding of its own and rendered at ~22.5px tall, under the floor — given an explicit `h-7` (28px, matching the `icon-sm` convention from Day 1). Still not a systematic sweep of every interactive element app-wide — only what this flow's screens touch.
26. 🟡 **Browser compatibility testing** — still no real cross-browser matrix (no Firefox/WebKit engine available here), so genuinely unverified Safari/Firefox-specific gaps remain open. The one concrete, testable piece the Day 5 notes called out — confirming the OPFS→IndexedDB fallback is actually exercised on a browser without OPFS — is closed: `opfs-files.test.ts` (new) covers both branches of `opfs-files.ts` directly (unsupported browser, a supported-but-no-`createWritable` browser like Safari outside workers, and a fully-supported browser) via an in-memory fake OPFS (`src/tests/utils/fake-opfs.ts`); `book-files.test.ts` gains an "OPFS available" describe block covering the primary-store path and the lazy legacy→OPFS migration on read, which previously had zero coverage (the pre-existing tests there only ever exercised jsdom's no-OPFS fallback).

### Done Criteria

🟡 Automated substitute shipped: cross-device e2e (`pnpm test:e2e`, wired into CI as a separate `playwright` job in `.github/workflows/test.yml`), one real responsive gap found and fixed, and the OPFS-fallback test gap closed. Not done: an actual device lab / real Safari or Firefox pass, and a full app-wide target-size sweep beyond this flow's screens — both stay open as real, not cosmetic, gaps until Sprint 8 or a later hardening pass covers them for real.

---

## Day 6 — Final QA ✅

27. ✅ **Full regression suite execution** — automated suite (90+ files, runs on every push) already covers regression; the missing piece was a manual/exploratory pass on top. Done: a live browser walkthrough (dev server + Browser pane) covering import — single and bulk, including edge-case fixtures (`missing-metadata.epub` degrading to "Unknown" author, `nested-opf.epub`) — read/scroll/reader-toolbar, metadata + content search, collections/Shelves, backup export → delete-all → verify, cross-tab dialogs, dark mode, and mobile viewport, with console/network checked throughout. Real-vs-jsdom perf compared directly against `backup.perf.test.ts`'s budgets (real IndexedDB came in well under the generous jsdom-based numbers). Found and fixed three real bugs, none caught by the existing automated suite:
    - `word-mark.tsx` used kebab-case SVG attributes (`fill-rule`/`stroke-width`/`stroke-linejoin`) instead of the camelCase JSX equivalents — fired a React console error on every render since the logo shipped.
    - Five nav buttons rendered via Base UI's `render={<Link/>}` override were missing `nativeButton={false}` — first "fixed" by adding it, which turned out to be wrong (see the top-of-doc post-Day-6 note: Base UI unconditionally injects `role="button"` when `nativeButton={false}`, with no exception for a real anchor, which broke both real link semantics and CI). Reverted; the original console warning was a false positive for this case.
    - Settings → Storage "Space used" stayed at its pre-delete value after "Delete all" until the next page load — `useStorageSettings` only read storage on mount. Now exposes `refresh()`, called from `handleReset`.
28. ✅ **Import → Read → Search → Organize workflow validation** — `e2e/cross-device.spec.ts` ("import, read, search, and organize a book", added Day 5, #18) walks the full chain end-to-end: import → reader loads → back to library → metadata search finds the book → add to a new collection → collection shows under Shelves. Runs across all three viewport projects in `playwright.config.ts`.
29. ✅ **Stress testing (large libraries, large books, long sessions)** — large-library (`load-library.perf.test.ts`, `sort-groupings.perf.test.ts`) and large-book (`epub-parser.perf.test.ts`) perf guards already existed, both against synthetic data. "Long sessions" gap closed: `chapter-window.test.ts` already bounded the pure windowing math; `use-reader-engine.test.ts` gains a "long reading session" block proving the actual hook stays bounded too — 2000 simulated scroll ticks attach the iframe scroll listener exactly once (no per-tick accumulation), every listener added is removed exactly once on unmount, and chapter asset blob URLs are revoked exactly once each at teardown rather than per scroll tick. A further gap found in review — no test exercised backup/export/search against a realistic _real-EPUB_ library rather than a large synthetic one — closed by `backup.perf.test.ts`: seeds a 14-book library from the real fixture files (`src/tests/fixtures/*.epub`), then times `exportLibrary()`/`readBackup()`+`applyBackup()` (real ZIP + real blobs) and a `searchLibrary()` query, all within generous budgets. Indexing is mocked to a no-op everywhere except one explicit real `buildIndex` call — indexing every book for real (import + explicit + restore, 3x over on multi-MB fixtures) crashed the Vitest worker outright in an earlier draft; indexing correctness itself is already covered by `import-book.test.ts`/`import-backup.test.ts`, so this file only needs to prove the backup pipeline holds at realistic book count.
30. ✅ **Release checklist** — `docs/RELEASE_CHECKLIST.md`. Scoped to what actually applies to a static Vercel-deployed PWA with no backend/accounts: CI gates, versioning (including the separately-tracked `BACKUP_VERSION`), post-deploy smoke test, and rollback via reverting `main` (no DB migration risk since all data is per-device IndexedDB).
31. ✅ **Backup/export workflow validation** — `services/backup/` (ZIP archive: `manifest.json` + `books/<id>.epub` + `covers/<id>`, `createArchive`/`readArchive`, framework-agnostic). `exportLibrary()` packs every book/file/cover/grouping plus the ten persisted preference keys; `import-backup.ts` merges by `StoredBook.fileHash` — unknown books restored with a fresh `createId()` + a fire-and-forget background index build, known books skipped unless a chapter-level reading-progress conflict is resolved "use backup" via `BackupConflictDialog` (per book). Series membership is re-derived by `ensureSeriesGroupings` on import, not trusted from the archive; collections are recreated by case-insensitive name; preferences apply only on a device with no `librune-preferences` in `localStorage`. `resetLibrary()` wipes all seven tables + OPFS files + cached cover URLs and resets the library/pwa stores. Settings → "Backup & Restore" (Export/Import) and Settings → Storage → "Delete all books & data" (reuses `ConfirmDeleteDialog`). Covered by unit tests (`backup-archive`, `export-library`, `import-backup`, `reset-library`, `download-blob`, `use-backup`, `backup-conflict-dialog`) and `e2e/backup-restore.spec.ts` (export → reset → restore round-trip, all three device projects, in CI's `playwright` job).

### Done Criteria

✅ Complete. Items 27-31 all done: manual regression pass (3 bugs found and fixed), full-chain e2e test, long-session stress coverage, release checklist, and backup/export.

**Related Gap:** [[Library-02 Backup and Export]] — closed. `services/backup/` + `features/library/actions/{export-library,import-backup,reset-library}.ts` implement export/import from scratch (Sprint 7 kept the schema export-friendly but built no mechanism); the Settings UI and `e2e/backup-restore.spec.ts` cover the round-trip.

---

## Day 7 — Release Preparation 🟡

32. ✅ **Documentation** — `CLAUDE.md` was already well-maintained per-subsystem. Added `CHANGELOG.md` (Keep a Changelog format, one `[1.0.0]` entry summarizing Sprints 1-8 by feature area, since no prior tags/changelog existed to build on incrementally) and refreshed `README.md`, which had drifted well behind the codebase — missing search, series/collections, backup/restore, cross-tab awareness, storage quota, and diagnostics entirely, plus a stale hooks description (pre-commit/pre-push no longer run the full `pnpm test`, see Sprint 8's CI restructuring, #14).
33. ❌ **Final cleanup** — TBD until items 34/35 surface what needs cleaning up.
34. ❌ **Versioning** — `package.json` is pinned at `"version": "1.0.0"` already (not `0.x`); `CHANGELOG.md` now exists (item 32) but no tagging convention or version-bump process is established yet.
35. ❌ **Production build validation** — `pnpm build` runs in every pre-push hook already (tsc -b && vite build), so the build itself is continuously validated; a dedicated "production build smoke test" (serving the built output and exercising it, not just compiling it) doesn't exist.

### Done Criteria

🟡 Item 32 done. Items 33-35 remain.

---

# Suggested Sequencing

Day 1 (accessibility) and Day 2 (PWA/offline) can run in parallel — different surfaces, no shared code. Day 1's real work is entirely gated on one decision (how to handle the reader's virtualization/accessibility-tree gap); resolve that first via a design doc, the same way Sprint 7 Day 1 resolved its data-model questions before writing code. Day 3 (performance) is independent of both and can start immediately — it's the day with the least existing scaffolding, so it benefits from starting early rather than being squeezed at the end. Day 4 (error handling) touches storage (quota), import (DRM — mostly done), and a new multi-tab concern — the multi-tab item is genuinely greenfield and probably the sprint's second-riskiest item after Day 1's reader accessibility gap, worth flagging for early design discussion rather than leaving to late-sprint improvisation. Day 5 (cross-device) is manual QA and benefits from running after Days 1-4 land, not before. Day 6 (final QA) needs a scoping call on backup/export (see Related Gap) before it can be estimated at all — recommend resolving that in Day 1 of the sprint, not Day 6, since "build export from scratch" is a multi-day task hiding inside a QA day's related-gap footnote. Day 7 is release prep, last as in every prior sprint.

---

# Deferred / Out of Scope

- **[[Reader-01 Volume-Key Scrolling]]** — platform-blocked, not a Sprint 8 task. Volume-key page-turning is impossible in a browser/PWA on iOS and Android (no web API exposes hardware volume-key events to a page). No revisit until an Android TWA wrapper exists, which isn't on the roadmap; permanently out of reach on iOS. Documented here so it doesn't read as a silently-missed gap.
- **[[Storage-02 TTL and Smart Eviction]]** — removed from Sprint 8 by product decision (was originally a Day 8 item in earlier planning). Auto-expiring or soft-deleting a user's books on a timer cuts against the app's local-first trust model, and the underlying problem (storage pressure) isn't confirmed to exist yet — Storage-01's cheaper telemetry (Day 2/4 above) is the thing to ship and observe first. Revisit only if real usage shows Storage-01 alone isn't enough.
- **[[Library-01 Sort and Filter]]** — fully closed (Sprint 4), nothing left to do. Its own non-goals (faceted filtering, tags, smart collections) are ruled out by design, not merely deferred.

# Open Questions (need user input before implementation starts)

- **Reader accessibility tree** (Day 1, item 3): documented limitation vs. live-region announcement vs. a linear-reading affordance — ACCESSIBILITY.md flags this as open but doesn't decide it. Resolved in Day 1 (see item 3) — left here as a stale entry from the initial gap list, not a live question.
- **Backup/export scope** (Day 6, item 31 / Related Gap): settled — Sprint 8 built export/import from scratch (`services/backup/` + `features/library/actions/`). Series groupings are re-derived on import rather than trusted from the archive; preferences apply only on a fresh device.
- ~~**Multi-tab concurrency** (Day 4, item 21)~~ — resolved 2026-08-31: last-write-wins on reading progress + cross-tab awareness via `BroadcastChannel`-backed dialogs, not a full lock. See item 21.
