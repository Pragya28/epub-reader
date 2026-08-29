# Sprint 8 — Task List (Gap Analysis vs Codebase)

Generated 2026-08-28 by comparing `central-docs/06 - Implementation/Sprint - 08 Production Polish.md` against the current codebase, following the format of `docs/tasks/SPRINT-07-TASKS.md`.

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
- **P2 — main JS bundle 945.95 kB (295.92 kB gzip)** — out of scope for Day 1; already tracked as Day 3 items 9 and 13.

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

13. ✅ **Bundle size regression test** — `scripts/check-bundle-size.mjs` gzips every `dist/assets/*.js` and fails the build if the largest chunk exceeds 310 kB gzip (vs the ~230 kB entry). Wired into the `build` script, so the pre-push hook enforces it. Vite's fixed 500 kB chunk warning is raised to 750 kB (`vite.config.ts`) so the two guards don't disagree.
14. ✅ **Startup time benchmarks** — folded into item 13 (see item 11).
15. ✅ **Memory leak/profiling tests** — `chapter-window.test.ts` gains a long-session block: a 60-chapter book scrolled forward then backward through `maintainChapterWindow`, asserting the mounted-section count and the loaded-index set never exceed `MAX_WINDOW_SIZE` at any step. Fails if the radius check or the section-cache invalidation regresses.

### Also landed

- **Icon library consolidation** — the app imported icons from both `lucide-react` and `@phosphor-icons/react`; `components.json` already specifies Phosphor. All usages moved to Phosphor and `lucide-react` removed. Bundle-neutral (~230 kB gzip entry either way) — a consistency change, not a size win.

### Done Criteria

✅ Complete. Reader engine + JSZip are off the initial parse path; bundle size and long-session windowing bounds both have regression guards enforced by the pre-push hook.

---

## Day 4 — Error Handling

16. ✅ **Edge-case handling: corrupt EPUB** — `epub.service.ts`/`epub-parser.ts` already throw descriptive errors for broken spine references, invalid files, missing metadata (all covered by existing fixtures/tests — see `src/tests/fixtures/*.epub`'s "missing-metadata", "broken-spine", "invalid" cases).
17. 🟡 **Edge-case handling: unsupported/DRM'd files** — essentially closed. DRM detection shipped (see Baseline); "unsupported" (non-EPUB file types) is caught by the `isEpub()` extension/MIME check in `use-import-book-fab.ts`. Only gap: no test exercises the DRM-detection path specifically — cosmetic, not a real risk.
18. ❌ **Edge-case handling: storage quota exceeded** — the _code path_ is defensive (index-build failures already caught and logged without failing the import — Sprint 6/7's established pattern), but there's no actual quota-exceeded simulation test, and no user-facing messaging for it specifically (a generic import-failure toast would fire, not a quota-specific one).
19. 🟡 **Recovery improvements (graceful degradation on failure)** — the "index/derived-data failures must never fail the thing around them" discipline (Sprint 6, reinforced Sprint 7) is exactly this, already applied to search indexing and series/collection membership. Not yet applied-and-verified for storage quota specifically (item 18) or multi-tab conflicts (item 21).
20. 🟡 **Logging refinement** — `Logger` (`shared/logger/logger.ts`) exists with scoped child loggers and levels, but is `console`-only and dev-enabled by default (`enabled: options?.enabled ?? import.meta.env.DEV`) — no persistent local error log for production debugging, which is specifically what Infrastructure-01's "local error-log recommendation" asks for.
21. ❌ **Multi-tab concurrency** — nothing exists (no `BroadcastChannel`, no cross-tab IndexedDB-write coordination). Two tabs open on the same book could both write conflicting reading progress with no reconciliation. Fully greenfield.
22. 🟡 **User-friendly error messaging** — `use-import-book-fab.ts` already distinguishes error types in its toast copy; the `ErrorBoundary` component exists for React crashes. Coverage is inconsistent across other action call sites — worth an audit pass rather than a rebuild.

### Done Criteria

🟡 Partial. Corrupt/DRM/unsupported-file handling is genuinely done; quota messaging, local error logging, and multi-tab concurrency are the real gaps.

**Related Gaps:** [[Storage-01 Quota and Eviction]] (item 18), [[Import-01 DRM and Unsupported Files]] (items 16-17, mostly closed), [[Platform-01 Multi-Tab Concurrency]] (item 21, fully open), [[Infrastructure-01 Error and Crash Visibility]] (item 20).

---

## Day 5 — Cross-Device Validation

23. ❌ **Mobile testing** — no device-matrix test suite exists. `resize_window` (mobile/tablet presets) is available as a manual verification tool but nothing automated.
24. ❌ **Tablet testing** — same as above.
25. 🟡 **Responsive validation** — Tailwind responsive classes are used throughout; WCAG target-size minimums are partially audited per ACCESSIBILITY.md ("Target size — Partially shipped, not audited"). No systematic pass across the full app.
26. ❌ **Browser compatibility testing** — no cross-browser test matrix; unknown Safari/Firefox-specific gaps (e.g. OPFS support, which `services/storage/opfs-files.ts` already treats as optional/fallback-safe — worth confirming that fallback is actually exercised on a non-OPFS browser).

### Done Criteria

❌ Not started. Manual QA day — largely validation work, not code, except for whatever gaps it surfaces.

---

## Day 6 — Final QA

27. ❌ **Full regression suite execution** — the automated suite (70 files / 625 tests as of Sprint 7) already runs on every push; "full regression suite" here likely means a manual/exploratory pass on top, not new automation.
28. ❌ **Import → Read → Search → Organize workflow validation** — `book-lifecycle.test.ts` and `groupings-lifecycle.test.ts` cover import→progress→delete and series/collection arcs respectively, but no single test walks the full import→read→search→organize chain end-to-end.
29. ❌ **Stress testing (large libraries, large books, long sessions)** — large-library (`load-library.perf.test.ts`, `sort-groupings.perf.test.ts`) and large-book (`epub-parser.perf.test.ts`) perf guards exist; "long sessions" (memory/state accumulation over hours of reading) has no coverage — ties directly to Day 3 item 12.
30. ❌ **Release checklist** — doesn't exist yet as a document.
31. ❌ **Backup/export workflow validation** — moot until export itself is built (see Related Gap below).

### Done Criteria

❌ Not started — blocked on Days 1-5 (and the missing export feature) landing first, same shape as every prior sprint's QA day.

**Related Gap:** [[Library-02 Backup and Export]] — explicitly deferred from Sprint 7 to "the last practical point to include it before release," i.e. here. Not yet scoped as a Day 6 dev task in the spec itself (the spec lists it only under "Related Gap," not the Dev bullets) — **needs a scoping decision**: is Sprint 8 building export/import from scratch, or only validating it if it already existed? Given Sprint 7 explicitly did not build it, Sprint 8 must build it if this gap is to close at all before release.

---

## Day 7 — Release Preparation

32. 🟡 **Documentation** — `CLAUDE.md` is well-maintained per-subsystem (most recently Sprint 7's grouping section); no user-facing release notes/changelog exist yet.
33. ❌ **Final cleanup** — TBD until Days 1-6 surface what needs cleaning up.
34. ❌ **Versioning** — `package.json` is pinned at `"version": "1.0.0"` already (not `0.x`), but no versioning _process_ (changelog, tagging convention) exists.
35. ❌ **Production build validation** — `pnpm build` runs in every pre-push hook already (tsc -b && vite build), so the build itself is continuously validated; a dedicated "production build smoke test" (serving the built output and exercising it, not just compiling it) doesn't exist.

### Done Criteria

❌ Not started. Naturally sequenced last.

---

# Suggested Sequencing

Day 1 (accessibility) and Day 2 (PWA/offline) can run in parallel — different surfaces, no shared code. Day 1's real work is entirely gated on one decision (how to handle the reader's virtualization/accessibility-tree gap); resolve that first via a design doc, the same way Sprint 7 Day 1 resolved its data-model questions before writing code. Day 3 (performance) is independent of both and can start immediately — it's the day with the least existing scaffolding, so it benefits from starting early rather than being squeezed at the end. Day 4 (error handling) touches storage (quota), import (DRM — mostly done), and a new multi-tab concern — the multi-tab item is genuinely greenfield and probably the sprint's second-riskiest item after Day 1's reader accessibility gap, worth flagging for early design discussion rather than leaving to late-sprint improvisation. Day 5 (cross-device) is manual QA and benefits from running after Days 1-4 land, not before. Day 6 (final QA) needs a scoping call on backup/export (see Related Gap) before it can be estimated at all — recommend resolving that in Day 1 of the sprint, not Day 6, since "build export from scratch" is a multi-day task hiding inside a QA day's related-gap footnote. Day 7 is release prep, last as in every prior sprint.

---

# Deferred / Out of Scope

- **[[Reader-01 Volume-Key Scrolling]]** — platform-blocked, not a Sprint 8 task. Volume-key page-turning is impossible in a browser/PWA on iOS and Android (no web API exposes hardware volume-key events to a page). No revisit until an Android TWA wrapper exists, which isn't on the roadmap; permanently out of reach on iOS. Documented here so it doesn't read as a silently-missed gap.
- **[[Storage-02 TTL and Smart Eviction]]** — removed from Sprint 8 by product decision (was originally a Day 8 item in earlier planning). Auto-expiring or soft-deleting a user's books on a timer cuts against the app's local-first trust model, and the underlying problem (storage pressure) isn't confirmed to exist yet — Storage-01's cheaper telemetry (Day 2/4 above) is the thing to ship and observe first. Revisit only if real usage shows Storage-01 alone isn't enough.
- **[[Library-01 Sort and Filter]]** — fully closed (Sprint 4), nothing left to do. Its own non-goals (faceted filtering, tags, smart collections) are ruled out by design, not merely deferred.

# Open Questions (need user input before implementation starts)

- **Reader accessibility tree** (Day 1, item 3): documented limitation vs. live-region announcement vs. a linear-reading affordance — ACCESSIBILITY.md flags this as open but doesn't decide it.
- **Backup/export scope** (Day 6, item 31 / Related Gap): is this a Sprint 8 Day 6 QA-only day, or does export/import need building from scratch first? The sprint spec's Dev bullets don't list it — only the Related Gap footnote does.
- **Multi-tab concurrency** (Day 4, item 21): how much reconciliation is in scope — last-write-wins on reading progress, a cross-tab lock, or just a "this book is open in another tab" warning?
