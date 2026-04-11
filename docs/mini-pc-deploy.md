# Mini PC Deployment

This guide assumes:

- the backend runs on an always-on mini PC
- the frontend is served separately, for example from GitHub Pages
- the same Cloudflare account already exposes `n8n.maumph.uk`

## 1. Start Postgres + pgvector

From the project root:

```bash
docker compose -f docker-compose.pgvector.yml up -d
docker compose -f docker-compose.pgvector.yml ps
```

The compose file starts:

- database: `ltc_rag`
- user: `ltc_rag`
- port: `5432`

Change the default password in `docker-compose.pgvector.yml` before exposing the machine outside your LAN.

## 2. Configure `.env`

Use the backend in `postgres` mode once the database is ready:

```env
PORT=3000
GEMINI_API_KEY=replace-with-a-fresh-key
RAG_STORAGE_MODE=postgres
DATABASE_URL=postgres://ltc_rag:change-this-password@127.0.0.1:5432/ltc_rag
RAG_FRONTEND_ORIGIN=https://maumph.github.io/ltc-assistant
RAG_EMBEDDING_MAX_CHUNKS_PER_PASS=100
RAG_EMBEDDING_REFRESH_INTERVAL_MS=1800000
RAG_EMBEDDING_QUOTA_COOLDOWN_MS=21600000
```

Notes:

- `RAG_FRONTEND_ORIGIN` must be the real frontend origin, not the GitHub repository URL.
- rotate any Gemini API key that was pasted into chat or terminal history.

## 3. Pre-index into Postgres

Run the indexer from the project root:

```bash
npm run rag:index
```

What the indexer does:

- loads all documents under `knowledge/`
- restores any saved embeddings from `.rag-cache/embeddings.json`
- asks Gemini only for still-missing chunk embeddings
- writes the rows into Postgres when `DATABASE_URL` is present

If quota is tight, run the command again later. Successful embeddings are reused on the next run, so the index warms up incrementally instead of restarting from zero.

## 4. Start the backend

```bash
PORT=3000 npm run dev
```

Local health check:

```bash
curl http://localhost:3000/api/health
```

Expected result:

- `"ok": true`
- `"storageMode": "postgres"` once the database-backed store is active

## 5. Add a Cloudflare Tunnel hostname

If the current tunnel is remotely managed in the Cloudflare dashboard:

1. Open `Cloudflare One`
2. Go to `Networks`
3. Open `Connectors`
4. Open `Cloudflare Tunnels`
5. Select the existing tunnel that already serves `n8n.maumph.uk`
6. Open `Public hostnames` or `Published applications`
7. Add a new hostname:

- subdomain: `rag`
- domain: `maumph.uk`
- service type: `HTTP`
- URL: `http://localhost:3000`

After saving, test the public route:

```bash
curl https://rag.maumph.uk/api/health
```

If the tunnel is locally managed instead of dashboard-managed, add another ingress rule to the `cloudflared` config:

```yaml
ingress:
  - hostname: n8n.maumph.uk
    service: http://localhost:5678
  - hostname: rag.maumph.uk
    service: http://localhost:3000
  - service: http_status:404
```

Then restart `cloudflared`.

## 6. Recommended warm-up order

Use this order to reduce quota waste:

1. run the backend in `memory` mode long enough to build `.rag-cache/embeddings.json`
2. switch to `postgres` mode
3. run `npm run rag:index` until Postgres contains the cached embeddings
4. keep the backend on `postgres` mode for normal serving

## 7. Daily operations

Useful commands:

```bash
git pull
npm install
npm run rag:index
PORT=3000 npm run dev
```

For production, replace `npm run dev` with a process manager such as `pm2`, Docker, or a systemd service.
