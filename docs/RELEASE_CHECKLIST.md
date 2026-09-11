# Release Checklist

Librune is a static PWA deployed on Vercel with no backend and no user
accounts — releases are a `main` push, not a coordinated rollout. This
checklist is for tagging a version, not for infra/migration risk that
doesn't apply here.

## Before merging to `main`

- [ ] CI green on the PR: both `Vitest` and `Playwright (cross-device e2e)`
      jobs in `.github/workflows/test.yml`.
- [ ] `pnpm build` passes locally (pre-push hook already enforces this,
      including the bundle-size guard in `scripts/check-bundle-size.mjs`).
- [ ] If `src/index.css` reading-token changes shipped, confirm
      `iframe-renderer.ts` was updated to match (see CLAUDE.md — the reader
      iframe doesn't inherit parent CSS custom properties).
- [ ] If the Dexie schema changed, confirm a new `db.version(n).stores(...)`
      block was added (`services/storage/db.ts`) — no manual migration step
      needed, but a skipped version bump corrupts existing users' data.

## Versioning

- [ ] Bump `version` in `package.json` (semver: patch for fixes, minor for
      features, major for breaking changes to stored data or backup format).
- [ ] If the backup archive format changed, bump `BACKUP_VERSION` in
      `backup-types.ts` separately — it's intentionally decoupled from the
      app version.
- [ ] Tag the release commit: `git tag vX.Y.Z && git push origin vX.Y.Z`.

## After merge (Vercel auto-deploys `main`)

- [ ] Open the deployed URL, confirm the app loads and the service worker
      updates (`registerType: "autoUpdate"` — no manual cache-bust needed).
- [ ] Smoke test: import a book, read a page, search, add to a collection —
      the same chain `e2e/cross-device.spec.ts` covers, done once by hand
      against production.
- [ ] Check the PWA install prompt still fires on a fresh profile (manifest + icons unchanged unintentionally).

## Rollback

- [ ] If the deploy is broken: revert the merge commit on `main` and push —
      Vercel redeploys the previous commit automatically. No database
      rollback exists or is needed (IndexedDB is per-device and unaffected
      by app-code rollbacks).

## Not applicable here (documented so nobody looks for it)

- No server-side migration step — all data lives in each user's IndexedDB.
- No feature flags or staged rollout — Vercel serves the latest `main` to
  everyone at once.
- No changelog automation yet — none exists; this checklist doesn't gate on
  writing one.
