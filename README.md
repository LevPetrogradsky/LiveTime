# LiveTime

Focus sessions, presets, and history. This is a runnable service-first extraction of [LiveHub](https://github.com/LevPetrogradsky/LiveHub) at commit `5af32d5`. The service opens directly to its workspace.

Shared support code remains while the services are split safely. Internal `lifeos.v1` storage identifiers and version 1 backup formats stay in place for compatibility.

## Ownership and permitted use

**Copyright 2026 LevPetrogradsky.** The original LiveOS Portable code and assets are provided under the [PolyForm Noncommercial License 1.0.0](LICENSE.md). You may use, change, and share them for personal or other noncommercial purposes under that license. Commercial use requires separate written permission. Third-party components retain their own licenses. A public repository does not transfer ownership.

**Русский:** LiveOS Portable принадлежит правообладателю LevPetrogradsky. Личное и иное некоммерческое использование разрешено на условиях [лицензии](LICENSE.md); коммерческое использование требует отдельного письменного разрешения.

## Run locally

Requires Node.js 22 or newer and npm.

```bash
npm ci
npm run dev
```

Run `npm test` for the data model checks and `npm run build` for a production build.

## Data and configuration

The app can keep data in the browser. Journal cloud sync and account sign-in require separately configured services and are disabled without their environment settings. See `.env.example` for the public configuration names. Keep database credentials and other secrets out of this repository and out of `VITE_` variables.

Some internal identifiers still use `lifeos` so existing browser data and backups remain readable after the visible rename. The existing Ko-fi address also retains its original handle.

The three service repositories initially share this app's data model and support code. Each opens its own service first. Browser storage remains tied to each site's origin; use Settings → Export and Import to move a backup between sites. The existing `lifeos.v1` key and backup formats are retained for compatibility.

This repository contains source code, not personal journal entries or production credentials. No independent Vercel deployment is connected yet.

## Guest history cloud

Configure a Neon database for LiveTime and apply db/livetime-history.sql. Set the
server-only LIVETIME_HISTORY_DATABASE_URL in the LiveTime project. After the
schema is ready, set VITE_LIVETIME_HISTORY_ENABLED=true and rebuild. The guest
vault uses a service-specific recovery code and stores completed sessions only.
Existing Journal configuration is independent.
