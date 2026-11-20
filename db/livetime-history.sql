CREATE TABLE IF NOT EXISTS livetime_guest_vaults (
  owner text PRIMARY KEY
);
CREATE TABLE IF NOT EXISTS livetime_guest_sessions (
  owner text NOT NULL REFERENCES livetime_guest_vaults(owner),
  id text NOT NULL,
  payload jsonb NOT NULL,
  PRIMARY KEY (owner, id)
);
