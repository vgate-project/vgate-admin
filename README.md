# VGate Admin Frontend

Web admin console for **VGate**, built with Vue 3 + Vite + TypeScript. Operators use
it to manage proxy nodes, users, plans, orders, traffic, announcements, and system
config — including per-node, per-plan, and per-user speed limits. It talks to the
manager's REST API under `/api/v1`.

The **System Config → Payment** page configures the gateways (Alipay, WeChat Pay, Stripe)
used when operators or users create paid orders.

## Tech stack

- [Vue 3](https://vuejs.org/) (Composition API, `<script setup>`)
- [Vite](https://vitejs.dev/) — dev server & build tool
- [TypeScript](https://www.typescriptlang.org/)
- [Element Plus](https://element-plus.org/) — UI components (auto-imported)
- [Pinia](https://pinia.vuejs.org/) — state management
- [Vue Router](https://router.vuejs.org/) — routing
- [Axios](https://axios-http.com/) — HTTP client

## Prerequisites

- Node.js **18+**
- A package manager — `npm` (this project ships `package-lock.json`)

## Getting started

```bash
# install dependencies
npm install

# start the dev server (http://localhost:5173)
npm run dev

# type-check without emitting (vue-tsc)
npm run typecheck

# production build → dist/
npm run build

# preview the production build locally
npm run preview
```

### Dev proxy

In development, Vite proxies `/api` to the manager backend at
`http://localhost:8081` (see `server.proxy` in `vite.config.ts`), so the admin talks
to the backend without CORS issues during local development.

## What you can do

- **Nodes**: create/edit proxy nodes, set their listen port, transport (`tcp`/`ws`/`xhttp`),
  TLS/Reality security, and per-node speed limits — all delivered to the node via the manager.
- **Users & plans**: create users, assign subscription plans (quotas, expiry, speed caps),
  revoke credentials, and set per-user speed limits.
- **Orders**: view and manage billing orders.
- **Traffic**: inspect per-user and per-node usage and stats.
- **System config**: tune hot-reloadable settings (JWT TTLs, log level/format, CORS origins,
  timeouts, and Telegram bot toggles) via `PUT /api/v1/admin/system-config`.
- **Announcements**: publish notices to the user portal.
- **Telegram**: link your personal Telegram account from **Settings → Telegram** (to receive
  ticket alerts), and broadcast a message to every linked user from the **Telegram** view
  (optionally also published as an announcement).
- **Tickets**: view and reply to user support tickets and move them through a status machine
  (`open → in_progress → resolved → closed`); the ticket drawer closes automatically when you
  mark a ticket closed.

## Configuring the API address

The API base URL is read at **runtime** from a global variable
(`window.__ENV__.API_BASE_URL`) injected by `public/env.js`. The file is copied
verbatim into `dist/env.js` on build and is **not** bundled, so you can edit the
backend address after deployment **without rebuilding**.

`src/api/http.ts` uses it as the axios `baseURL`, falling back to the relative path
`/api/v1` when it is empty:

```js
// dist/env.js  — edit this file on the deployed server
window.__ENV__ = { API_BASE_URL: '' }   // ''  → relative /api/v1 (reverse-proxy / same-origin)
// window.__ENV__ = { API_BASE_URL: 'http://192.168.1.10:8081/api/v1' }  // separate host:port
```

- Leave `API_BASE_URL` empty when the frontend and backend are served from the same
  origin (e.g. behind an Nginx reverse proxy that routes `/api` to the manager).
- Set the full backend URL (including the `/api/v1` path) when the manager runs on a
  different host/port. In that case the manager must allow the frontend origin via
  its CORS `allowed_origins` system config.

## Deployment

1. `npm run build` produces a static `dist/` directory.
2. Serve `dist/` with any static file server (Nginx, Caddy, etc.).
3. Edit `dist/env.js` to point `API_BASE_URL` at your manager backend.
4. (Recommended) Put a reverse proxy in front so `/api` is forwarded to the manager —
   then `API_BASE_URL` can stay empty and no CORS configuration is needed.
