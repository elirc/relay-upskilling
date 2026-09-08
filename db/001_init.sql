CREATE TABLE IF NOT EXISTS organizations (
  id uuid PRIMARY KEY, name text NOT NULL, slug text UNIQUE NOT NULL
);
CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY, email text UNIQUE NOT NULL, name text NOT NULL, password_hash text NOT NULL
);
CREATE TABLE IF NOT EXISTS memberships (
  user_id uuid REFERENCES users(id), org_id uuid REFERENCES organizations(id),
  role text NOT NULL CHECK (role IN ('operator','reviewer')), PRIMARY KEY (user_id,org_id)
);
CREATE TABLE IF NOT EXISTS sessions (
  token_hash text PRIMARY KEY, user_id uuid NOT NULL REFERENCES users(id), expires_at timestamptz NOT NULL
);
CREATE TABLE IF NOT EXISTS jobs (
  id uuid PRIMARY KEY, org_id uuid NOT NULL REFERENCES organizations(id), created_by uuid NOT NULL REFERENCES users(id),
  file_name text NOT NULL, file_key text NOT NULL UNIQUE, file_hash text NOT NULL, file_bytes bigint NOT NULL,
  status text NOT NULL DEFAULT 'parsing' CHECK (status IN ('parsing','mapping','validating','review','queued','running','paused','completed','cancelled','failed')),
  schema_version integer NOT NULL DEFAULT 1 CHECK (schema_version=1), mapping_version integer NOT NULL DEFAULT 0,
  headers jsonb NOT NULL DEFAULT '[]', mapping jsonb NOT NULL DEFAULT '{}',
  total_rows integer NOT NULL DEFAULT 0, parse_checkpoint integer NOT NULL DEFAULT 0,
  validation_checkpoint integer NOT NULL DEFAULT 0, commit_checkpoint integer NOT NULL DEFAULT 0,
  approved_hash text, approved_by uuid REFERENCES users(id), approved_at timestamptz,
  attempts integer NOT NULL DEFAULT 0, next_attempt_at timestamptz NOT NULL DEFAULT now(),
  crash_injected boolean NOT NULL DEFAULT false, last_error text,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id,id)
);
CREATE INDEX IF NOT EXISTS jobs_queue ON jobs(status,next_attempt_at,updated_at);
CREATE TABLE IF NOT EXISTS import_rows (
  org_id uuid NOT NULL, job_id uuid NOT NULL, row_no integer NOT NULL,
  raw jsonb NOT NULL, normalized jsonb, email text,
  disposition text NOT NULL DEFAULT 'pending' CHECK (disposition IN ('pending','ready','rejected','duplicate','existing','conflict','imported')),
  errors jsonb NOT NULL DEFAULT '[]', committed boolean NOT NULL DEFAULT false,
  PRIMARY KEY (job_id,row_no), FOREIGN KEY (org_id,job_id) REFERENCES jobs(org_id,id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS rows_identity ON import_rows(job_id,email,row_no) WHERE email IS NOT NULL;
CREATE INDEX IF NOT EXISTS rows_filter ON import_rows(job_id,disposition,row_no);
CREATE TABLE IF NOT EXISTS contacts (
  id uuid PRIMARY KEY, org_id uuid NOT NULL REFERENCES organizations(id), email text NOT NULL,
  data jsonb NOT NULL, source_job_id uuid NOT NULL, source_row_no integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id,email), FOREIGN KEY (org_id,source_job_id) REFERENCES jobs(org_id,id),
  CHECK (email = lower(trim(email)))
);
CREATE TABLE IF NOT EXISTS job_events (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, org_id uuid NOT NULL, job_id uuid NOT NULL,
  kind text NOT NULL, message text NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (org_id,job_id) REFERENCES jobs(org_id,id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS events_job ON job_events(job_id,id DESC);
CREATE TABLE IF NOT EXISTS login_attempts (
  email text PRIMARY KEY, attempts integer NOT NULL, window_start timestamptz NOT NULL DEFAULT now()
);
