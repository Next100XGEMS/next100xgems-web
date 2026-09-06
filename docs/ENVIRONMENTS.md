# Environment and Secrets Strategy

## Environment separation

```text
LOCAL Supabase  !=  PREVIEW / STAGING Supabase  !=  PRODUCTION Supabase
```

Each environment has separate database state, authentication users, Storage content, project configuration and privileged credentials. No environment may casually reuse another environment's privileged credentials or personal data.

## Variable ownership

### Public

`NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` are intentionally browser-visible. The `NEXT_PUBLIC_` prefix allows Next.js to include a value in client bundles. Public availability does not grant permission; Supabase database grants and RLS remain authoritative when application data exists.

### Server-only

`SUPABASE_URL` and `SUPABASE_SECRET_KEY` are reserved for explicitly server-only infrastructure. Secret keys are privileged and bypass RLS, so they must be isolated behind named, authorized operations. A value being available to the server does not mean every server module may use it.

Never place secret keys, administrative credentials, API credentials, database passwords, access tokens or internal service credentials in `NEXT_PUBLIC_` variables, props, client modules, logs or repository files. Do not use legacy `SUPABASE_SERVICE_ROLE_KEY` or `NEXT_PUBLIC_SUPABASE_ANON_KEY` as the preferred naming model for this project. Existing integrations, if ever migrated, must be handled deliberately rather than by silently accepting both models.

### Build and infrastructure

Deployment-specific values may be introduced later for Vercel, migrations and other infrastructure. They are not added to this foundation. Migration credentials belong to release tooling and must not be treated as ordinary web runtime variables.

## Local

Local development uses Next.js with the project-local Supabase CLI:

```text
pnpm supabase:init
pnpm supabase:start
pnpm supabase:status
pnpm supabase:stop
```

The local Supabase runtime requires Docker or a Docker-compatible runtime. Local `.env.local` values are developer-local and gitignored. Use the local stack's generated values when the runtime is available; do not copy staging or production values into local files. `.env.example` documents names only and is safe to commit. It contains no values.

Gate 3 did not create or populate `.env.local`, install Docker, start the local stack, or create a remote project. Gate 2 initialized the local CLI configuration; the local container runtime and Supabase stack were validated during Gate 11.

## Preview / staging

Vercel Preview deployments use a separate non-production Supabase project/environment. Preview and staging secrets are managed through deployment environment settings, not repository files. Trusted previews may share staging data according to the Phase 1 plan; previews must never use production privileged credentials or production personal data. Untrusted pull requests must not receive privileged secrets.

## Production

Vercel Production uses a dedicated production Supabase project with separate Auth, Storage, database state and credentials. Production secrets belong in Vercel's Production environment configuration and must never appear in repository files, build logs, client bundles or documentation. No production project is created or connected by this gate.

## Change flow

```text
Git branch / Pull Request
→ validation
→ Vercel Preview using non-production configuration
→ review
→ Production deployment
```

Production environment changes and migrations require the reviewed release process. Do not add `vercel.json`, install the Vercel CLI or connect this repository to Vercel as part of Gate 3.

## Rules for future configuration code

When application code needs environment access, add a small typed public/server configuration boundary and validate required values at the appropriate server entry point. Do not add an environment library solely for this gate. Privileged Supabase access must later live in explicitly server-only infrastructure modules; a server-capable variable must not be passed through generic configuration objects or browser props.
