# Deploy

Two pieces: the **server** (Cloudflare Worker + Durable Object + D1) and the
**client** (static SPA on Cloudflare Pages). SQLite-backed Durable Objects run on
the Workers **free plan** — no paid plan needed. All commands run from the repo root.

## Server (`@xwing/server`)

1. Authenticate once:
   ```
   pnpm --filter @xwing/server exec wrangler login
   ```
2. Create the D1 database and copy the printed `database_id` into
   `packages/server/wrangler.jsonc` (the `d1_databases[0].database_id` field):
   ```
   pnpm --filter @xwing/server exec wrangler d1 create xwing
   ```
3. Apply the schema to the remote DB:
   ```
   pnpm --filter @xwing/server exec wrangler d1 migrations apply xwing --remote
   ```
4. Deploy:
   ```
   pnpm --filter @xwing/server exec wrangler deploy
   ```
   Note the printed URL, e.g. `https://xwing-server.<subdomain>.workers.dev`.
5. Smoke test: `curl <url>/games/nope` → `{"error":"No such game"}` (404).

Current deployment: **https://xwing-server.synrg116.workers.dev**

### Web push (VAPID)

The public key + subject live in `wrangler.jsonc` `vars`; the client public key is
in `packages/client/.env.production`. Set the private key as a secret, then redeploy:
```
pnpm --filter @xwing/server exec wrangler secret put VAPID_PRIVATE_KEY
pnpm --filter @xwing/server exec wrangler deploy
```
Generate a fresh pair with the snippet in commit history if rotating; the public key
must match in both `wrangler.jsonc` and `.env.production`.

## Client (`@xwing/client` → Cloudflare Pages)

The production server URL is baked in at build time from
`packages/client/.env.production` (`VITE_SERVER_URL`). Update that file if the
Worker URL changes.

```
pnpm --filter @xwing/client run deploy
```

This builds and runs `wrangler pages deploy dist --project-name xwing-online`.
The first run creates the Pages project (accept the prompts). It prints the live
client URL, e.g. `https://xwing-online.pages.dev`.

The deploy script sets `CLOUDFLARE_ACCOUNT_ID` inline — wrangler's OAuth token
can't enumerate `/memberships`, so the account id is provided directly. Account
ids aren't secret.

## Local development (no account needed)

```
pnpm --filter @xwing/server dev    # Worker + DO + D1 in miniflare on :8787
pnpm --filter @xwing/client dev    # client on :5173 (defaults to the local server)
```
