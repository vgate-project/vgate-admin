# VGate Admin Frontend

Web admin console for **VGate**, built with Vue 3 + Vite + TypeScript. Operators use
it to manage proxy nodes, users, plans, orders, traffic, announcements, and system
config — including per-node, per-plan, and per-user speed limits. It talks to the
manager's REST API under `/api/v1`.

The **System Config → Payment** page configures the gateways (**Alipay, WeChat Pay, Stripe,
PayPal, Apple (App Store IAP)**) used when operators or users create paid orders.

## Tech stack

- [Vue 3](https://vuejs.org/) (Composition API, `<script setup>`)
- [Vite](https://vitejs.dev/) — dev server and build tool
- [TypeScript](https://www.typescriptlang.org/)
- [Element Plus](https://element-plus.org/) — UI components (auto-imported)
- [Pinia](https://pinia.vuejs.org/) — state management
- [Vue Router](https://router.vuejs.org/) — routing
- [Axios](https://axios-http.com/) — HTTP client
- [qrcode](https://github.com/soldair/node-qrcode) — payment QR codes
- [@element-plus/icons-vue](https://element-plus.org/) — icon set

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

- **Dashboard**: the landing page with stat cards, day-over-day trends, a 24-hour traffic chart,
  node status, and health lists (expiring plans, quota-exhausted and unverified users).
- **Nodes**: create/edit proxy nodes, set their listen port, transport (`tcp`/`ws`/`xhttp`),
  TLS/Reality security, VLESS v2 AEAD (decryption) settings, and per-node speed limits — all
  delivered to the node via the manager. Also supports **virtual (multi-IP child) nodes** that
  inherit their parent's settings.
- **Users & products**: create users, assign subscription **plans** (quotas, expiry, speed caps),
  manage **traffic packages** (one-off traffic add-ons), revoke credentials, set per-user speed
  limits, and bulk **clean up zombie users** (inactive accounts over a configurable threshold).
- **Orders**: view and manage billing orders, and **create orders on behalf of a user** (with a
  QR/copy payment dialog).
- **Traffic**: inspect per-user and per-node usage and stats.
- **System config**: tune hot-reloadable settings via `PUT /api/v1/admin/system-config`, including
  JWT TTLs, log level/format, CORS origins, timeouts, **Captcha / Cloudflare Turnstile**,
  registration modes (open / invite-gated / email-suffix allowlist), password policy, **trial
  accounts**, traffic reminders, **subscription base URLs**, the **Telegram** bot toggles, and the
  **Payment** gateways.
- **Invites**: create and manage invite codes that gate or credit new registrations.
- **Redemption codes**: issue and track redemption codes that users apply from the portal (`/redeem`) to claim plans or credit.
- **Messaging**: a single page with three tabs — **Announcements** (publish notices to the user
  portal), **Email** (broadcast an email to all/active/selected users, optionally also creating an
  announcement), and **Telegram** (broadcast a message to every linked user). From **Settings →
  Telegram** you can also link your own operator account to receive ticket alerts, and **Settings**
  holds the signed-in admin's own password change.
- **Email config**: configure the outbound mail backend under **System Config → Email**. The
  **General** tab holds the provider (`smtp` / `resend`), the enabled switch, the shared **From**
  address, and an optional **From Name**. Use the **Test Email** button on that tab to send a probe
  and verify connectivity without broadcasting. (Verified-domain rules for Resend still apply.)
- **Tickets**: view and reply to user support tickets and move them through a status machine
  (`open → in_progress → resolved → closed`); the ticket drawer closes automatically when you
  mark a ticket closed.
- **Admins** (super-admin only): create and manage operator accounts. Change an admin's password
  from inside the **Edit** dialog — enter a new password there, or leave it empty to keep the
  current one.

## Authentication

- The admin console uses **JWT access + refresh**. Login returns both tokens.
- On a `401`, the Axios interceptor performs **one automatic silent refresh**, then retries.
- The **login form** renders a Cloudflare Turnstile widget when the manager has Turnstile enabled,
  sending `cf_turnstile_response` with the login request.

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
  origin (e.g., behind an Nginx reverse proxy that routes `/api` to the manager).
- Set the full backend URL (including the `/api/v1` path) when the manager runs on a
  different host/port. In that case the manager must allow the frontend origin via
  its CORS `allowed_origins` system config.

## Deployment

1. `npm run build` produces a static `dist/` directory.
2. Serve `dist/` with any static file server (Nginx, Caddy, etc.).
3. Edit `dist/env.js` to point `API_BASE_URL` at your manager backend.
4. (Recommended) Put a reverse proxy in front so `/api` is forwarded to the manager —
   then `API_BASE_URL` can stay empty and no CORS configuration is needed.
