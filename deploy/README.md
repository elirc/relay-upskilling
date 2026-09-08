# Deployment and compatibility

The repository contains a deployable single-host stack. Source is hosted in the private repository https://github.com/elirc/relay-upskilling. No hosting account or domain was supplied, so no public deployment is claimed. Hosted CI results must be verified separately. Docker is not installed on the build machine; native production-build and restore evidence is recorded separately.

## Local containers
`docker compose up --build` starts PostgreSQL, migrations, demo seed, web, worker, AI and the external test API. Web listens at 127.0.0.1:4317. The AI and connector remain inside the container network. The AI model is cached on a named volume.

## Public host
Use a Linux Docker host with persistent disks, sufficient space for uploads/database/backups, and a DNS name pointing at it. A practical initial allocation is 4 CPU cores and 8 GB RAM; measure your workload before setting a capacity commitment.

1. Copy `.env.production.example` to `.env.production`; use independent random hex secrets and your domain. This file is ignored by version control and image builds.
2. Review `compose.production.yaml` and `deploy/Caddyfile`. The production override disables demo seeding and puts Caddy TLS in front of the app. Only ports 80/443 need public ingress; 4317 and PostgreSQL are bound to localhost.
3. Run `docker compose --env-file .env.production -f compose.yaml -f compose.production.yaml up -d --build`.
4. Bootstrap a real reviewer with `scripts/account-admin.mjs bootstrap email "Workspace name"` inside the web container, setting `RELAY_INITIAL_PASSWORD` securely in its environment. Do not put passwords into source control or command history.
5. Check `/api/health`, sign in over HTTPS, invite an operator, run a small import, and inspect Operations for compatible worker heartbeats.
6. Rehearse backup restoration and both crash windows before routing real onboarding traffic.

The shared `uploads` volume must be available to web and worker. This deployment intentionally stays on one host. Moving workers to multiple hosts requires shared object storage or a mounted filesystem with the same immutable-file semantics. Store off-host backups encrypted and restrict access; they include customer data and authentication state.

## Rolling upgrade sequence
1. Back up PostgreSQL and immutable originals.
2. Apply additive migrations before deploying new binaries. `scripts/migrate.mjs` serializes migrations and rejects edits to previously registered contract fingerprints.
3. Deploy workers supporting both v1 and v2, confirm advertised versions in Operations, then expose v2 uploads in the web app.
4. To rehearse older worker compatibility, set `Relay__MaxSchema=1`. It selects only v1 jobs; v2 stays queued for a compatible worker. This is capability gating in the current binary, not proof that every historical binary can read a future database.
5. Never change an existing schema JSON object. Add a new version and update the compatibility checks. Existing jobs keep their old version and approval format.
6. Roll back the web application only while retaining workers capable of draining all accepted contracts. Do not roll back additive columns or reset checkpoints.

## Private service contract
Configure matching `RELAY_AI_KEY` and `Relay__ConnectorKey`/`RELAY_CONNECTOR_KEY` across clients/services. Their URLs are deployment configuration, never operator-supplied URLs. Keep auxiliary services private: possession of the connector key authorizes its test-destination tenant parameter.

The connector is a reference API with durable idempotency and receipt lookup. Adapting a real external service requires documenting whether it provides the same guarantees. An absent receipt from an eventually consistent API is not proof that a write failed.

## Hosted CI
`.github/workflows/ci.yml` runs type checks, unit tests, production build, core/advanced acceptance, AI evaluation and browser checks on a fresh PostgreSQL service. It needs a GitHub repository before it can execute. Network access is needed for dependency and model downloads. Evidence is uploaded as workflow artifacts; raw credentials and model caches are not artifacts.