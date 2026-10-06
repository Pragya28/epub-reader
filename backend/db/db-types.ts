// Raw rows, column names as in migrations/001_init.sql.

export interface UserRow {
  id: string;
  created_at: Date;
  invited: boolean;
}

export interface SyncStateRow {
  user_id: string;
  registration_proof_hash: string;
  last_synced_at: Date | null;
}

export interface InviteRow {
  code_hash: string;
  created_by: string;
  created_at: Date;
  expires_at: Date;
  used_at: Date | null;
  used_by: string | null;
}

export interface DeviceRow {
  device_id: string;
  user_id: string;
  label: string;
  token_hash: string;
  prev_token_hash: string | null;
  token_rotated_at: Date;
  first_seen_at: Date;
  last_seen_at: Date;
}
