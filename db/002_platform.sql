CREATE TABLE IF NOT EXISTS schema_migrations (name text PRIMARY KEY,applied_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS destination_schemas(version int PRIMARY KEY,contract jsonb NOT NULL,digest text NOT NULL);
ALTER TABLE jobs DROP CONSTRAINT IF EXISTS jobs_schema_version_check;
ALTER TABLE jobs ADD CONSTRAINT jobs_schema_version_check CHECK(schema_version IN(1,2));
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS schema_hash text;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS approval_format int NOT NULL DEFAULT 1;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS destination text NOT NULL DEFAULT 'local' CHECK(destination IN('local','test-api'));
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS transformations jsonb NOT NULL DEFAULT '{}';
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS file_format text NOT NULL DEFAULT 'csv' CHECK(file_format IN('csv','xlsx'));
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS crash_before_injected boolean NOT NULL DEFAULT false;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS suspended_status text;
CREATE TABLE IF NOT EXISTS delivery_outbox(
 org_id uuid NOT NULL,job_id uuid NOT NULL,row_no int NOT NULL,idempotency_key text NOT NULL UNIQUE,payload jsonb NOT NULL,
 state text NOT NULL DEFAULT 'pending' CHECK(state IN('pending','uncertain','delivered','abandoned')),
 outcome text, attempts int NOT NULL DEFAULT 0, last_error text,updated_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(job_id,row_no),FOREIGN KEY(org_id,job_id) REFERENCES jobs(org_id,id),FOREIGN KEY(job_id,row_no) REFERENCES import_rows(job_id,row_no)
);
CREATE INDEX IF NOT EXISTS outbox_pending ON delivery_outbox(job_id,state,row_no);
CREATE TABLE IF NOT EXISTS worker_heartbeats(id uuid PRIMARY KEY,version text NOT NULL,schemas int[] NOT NULL,last_seen timestamptz NOT NULL,memory_bytes bigint NOT NULL);
CREATE TABLE IF NOT EXISTS batch_metrics(
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,org_id uuid NOT NULL,job_id uuid NOT NULL,
 worker_id uuid NOT NULL,phase text NOT NULL,rows_processed int NOT NULL,duration_ms double precision NOT NULL,
 memory_bytes bigint NOT NULL,checkpoint int NOT NULL,trace_id text NOT NULL,span_id text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),FOREIGN KEY(org_id,job_id) REFERENCES jobs(org_id,id)
);
CREATE INDEX IF NOT EXISTS metrics_tenant_time ON batch_metrics(org_id,created_at DESC);
CREATE TABLE IF NOT EXISTS mapping_suggestions(
 id uuid PRIMARY KEY,org_id uuid NOT NULL,job_id uuid NOT NULL,mapping_version int NOT NULL,
 model text NOT NULL,model_revision text NOT NULL,result jsonb NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(org_id,job_id) REFERENCES jobs(org_id,id)
);
CREATE TABLE IF NOT EXISTS account_tokens(
 token_hash text PRIMARY KEY,purpose text NOT NULL CHECK(purpose IN('invite','reset')),
 email text NOT NULL,org_id uuid REFERENCES organizations(id),role text CHECK(role IN('operator','reviewer')),
 expires_at timestamptz NOT NULL,used_at timestamptz,created_by uuid REFERENCES users(id),created_at timestamptz NOT NULL DEFAULT now()
);
-- A deliberately separate destination ledger; only the test HTTP service writes these tables.
CREATE TABLE IF NOT EXISTS test_destination_contacts(
 org_id uuid NOT NULL,email text NOT NULL,data jsonb NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),PRIMARY KEY(org_id,email)
);
CREATE TABLE IF NOT EXISTS test_destination_receipts(
 org_id uuid NOT NULL,key text NOT NULL,payload_hash text NOT NULL,outcome text NOT NULL,trace_id text,
 created_at timestamptz NOT NULL DEFAULT now(),PRIMARY KEY(org_id,key)
);
CREATE TABLE IF NOT EXISTS test_destination_faults(
 org_id uuid PRIMARY KEY,mode text NOT NULL DEFAULT 'none',remaining int NOT NULL DEFAULT 0,
 calls int NOT NULL DEFAULT 0,throttles int NOT NULL DEFAULT 0,lost_responses int NOT NULL DEFAULT 0
);
