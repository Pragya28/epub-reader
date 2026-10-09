# Blob storage: Cloudflare R2

## What and why

**What.** Each user's encrypted library archive is one object in a private Cloudflare R2 bucket. The client uploads and downloads it directly through short-lived presigned URLs issued by the `push` and `pull` functions; the archive never passes through a function body. The object is ciphertext — the encryption key never reaches the server or the bucket.

**Why this one.**

- Presigned URLs with a real expiry, over the S3 API.
- No egress fees: every sync moves the whole library (tens of MB) per device.
- The S3-compatible API makes the provider swappable.

**Alternatives rejected.**

- **Vercel Blob** — one fewer account, but egress counts against Vercel bandwidth, the signed-download story was unconfirmed, and it is not portable.
- **AWS S3** — same API as R2 but egress is charged and setup (IAM) is heavier.

## Coupling points

| Coupling               | Where                                                                                             | Notes                                                                                                                                                                                                              |
| ---------------------- | ------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Credentials and bucket | Env vars: account id, bucket name, access key id, secret (names fixed when `backend/blob/` lands) | Created in the Cloudflare dashboard; the key pair is scoped to this one bucket.                                                                                                                                    |
| Signing                | `backend/blob/` only                                                                              | The one module that imports `aws4fetch` and knows the endpoint (`https://<account>.r2.cloudflarestorage.com`). Exposes sign-upload, sign-download and object-exists, behind a seam so tests use an in-memory fake. |
| Object key             | Derived from `userId` only                                                                        | Never from client input, so one user cannot request another's archive.                                                                                                                                             |
| CORS                   | Bucket CORS rule                                                                                  | The browser PUTs/GETs the bucket directly, so the app origin (and `localhost` for dev) must be allowed for `GET`/`PUT` with the needed headers.                                                                    |
| Confirming an upload   | `push` step 2                                                                                     | Checks the object exists before `last_synced_at` moves; uses the S3 `HEAD` call.                                                                                                                                   |
| Client                 | `src/services/sync/` (Sprint 3)                                                                   | Uses the returned URLs with plain `fetch`; knows nothing about R2.                                                                                                                                                 |

## Rules that keep it portable

- Only S3-API operations (presigned `PUT`/`GET`, `HEAD`) — no R2-only features or Workers bindings.
- Only `backend/blob/` imports the signer or reads the blob env vars.
- URLs are opaque to the client.

## Migration procedure

1. Create the destination bucket and a scoped credential; apply the equivalent CORS rule.
2. Copy every object under the same keys (`rclone` or any S3 sync tool).
3. Point the env vars at the destination; if it is S3-compatible only the endpoint and credentials change.
4. A non-S3 destination means rewriting `backend/blob/` against its signing mechanism; the handlers and client are unchanged.
5. Verify with one device: pull, then push, then pull.

## What does not change

Encryption, the archive format, the `pull`/`push` contracts, and the database. A client holding the right key can decrypt the object wherever it lives.
