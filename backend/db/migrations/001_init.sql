-- Bare anchor row: no profile, no email. The id is non-secret (shown in Settings).
-- `invited` is false only for the first user, who sets up without an invite (D11).
CREATE TABLE users (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  invited    boolean     NOT NULL
);

-- First-user guard: at most one user without an invite. Every uninvited row indexes the same
-- constant, so a second one is a unique violation (`invite_required`), even when two setups race.
CREATE UNIQUE INDEX users_single_uninvited ON users ((true)) WHERE NOT invited;

-- One row per user.
CREATE TABLE sync_state (
  user_id                 uuid        PRIMARY KEY REFERENCES users (id) ON DELETE CASCADE,
  registration_proof_hash text        NOT NULL,
  last_synced_at          timestamptz
);

-- Single-use, expiring invites minted by an existing user (D11). Only the code's SHA-256 is stored.
-- Timestamps here and in `devices` have no defaults: callers pass their injected clock so tests never mix it with the DB clock.
CREATE TABLE invites (
  code_hash  text        PRIMARY KEY,
  created_by uuid        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL,
  expires_at timestamptz NOT NULL,
  used_at    timestamptz,
  used_by    uuid        REFERENCES users (id),
  -- An invite is either unused (both empty) or used (both set), never half.
  CHECK ((used_at IS NULL) = (used_by IS NULL))
);

-- One row per device; each device's token rotates and expires independently.
CREATE TABLE devices (
  device_id        text        PRIMARY KEY,
  user_id          uuid        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  label            text        NOT NULL,
  token_hash       text        NOT NULL,
  prev_token_hash  text,
  token_rotated_at timestamptz NOT NULL,
  first_seen_at    timestamptz NOT NULL,
  last_seen_at     timestamptz NOT NULL -- the 7-day idle-expiry clock
);

CREATE INDEX devices_user_id ON devices (user_id);
