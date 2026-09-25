# Infra & stack migration notes

This folder is about migrating **infrastructure or stack choices** — swapping the database provider, the storage provider, the hosting platform, a driver or a framework — not about migrating _data_ between schema versions (that lives in the storage layer's own versioned migrations).

Each file covers one infrastructure decision the backend depends on. It is written so it helps **without knowing the destination**: what the decision is, why it was made, exactly where the codebase and deployment are coupled to it, and a generic procedure for moving off it.

## Files

| File                                 | Decision                           |
| ------------------------------------ | ---------------------------------- |
| [database-neon.md](database-neon.md) | Postgres hosted on Neon via Vercel |

## Shape of each file

1. **What and why** — the decision, what it stores or does, alternatives rejected and the reason.
2. **Coupling points** — every place code, config or the deployment depends on this choice.
3. **Rules that keep it portable** — constraints the code follows so leaving stays cheap.
4. **Migration procedure** — destination-agnostic steps, plus what changes if the destination is a different kind of system.
5. **What does not change** — parts of the product unaffected by a move.

Add a file here when a new infrastructure decision is made (e.g. blob storage, the Postgres driver); update its file when the decision or its coupling changes.
