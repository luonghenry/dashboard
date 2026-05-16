# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

A static web dashboard designed for Kindle e-ink devices (Kindle 8, WebKit 531–534). No build system — pure HTML/CSS/JavaScript deployed directly to GitHub Pages on every push to `main`.

## Deployment

Push to `main` → GitHub Actions (`.github/workflows/build-deploy.yml`) → GitHub Pages. No build step; the entire repo root is uploaded as the artifact.

## Critical Constraint: ES5 Only

**All JavaScript must be ES5-compatible.** The Kindle's old WebKit engine does not support modern JS:
- Use `var`, never `let` or `const`
- No arrow functions — use `function` expressions
- No template literals — use string concatenation
- No `fetch` — use `XMLHttpRequest`
- No `Promise`, `async/await`, destructuring, spread/rest, or `class`
- No `Array.from`, `Object.assign`, or other ES6+ builtins

## Architecture

### Tabs (switched via `switchTab(idx)` in `app.js`)
- **0 – Info**: Clock, JPY→VND rate, Tokyo weather, monthly calendar, JP+VN holidays, random quote
- **1 – Big Clock**: Large clock display, mini calendar, quote
- **2 – Timer**: Stopwatch + countdown timer
- **3 – Calculator**
- **4 – Pomodoro**: Focus/break timer with SVG ring progress, session log

### Data & Caching
All external data is stored in `localStorage` via `lsSet`/`lsGet` wrappers. `CACHE_VERSION` in `app.js` gates invalidation — bump it (and the version comment in `offline.appcache`) whenever localStorage data shapes change. Cache keys: `fx_data`, `weather_data`, `holiday_data`, `cache_version`.

### External APIs (free, no auth)
- **Exchange rate**: `https://api.exchangerate-api.com/v4/latest/JPY` → VND
- **Weather**: `https://api.open-meteo.com/v1/forecast` (Tokyo: lat 35.6762, lon 139.6503)
- **JP holidays**: `https://holidays-jp.github.io/api/v1/{year}/date.json`
- **VN holidays**: `https://date.nager.at/api/v3/PublicHolidays/{year}/VN`

API data refreshes on load then every 30 min (`apiIntervalId`). Network reachability is checked every 2 min (`pingIntervalId`) via HEAD to `http://captive.apple.com/`.

### Offline Modes
Two distinct states:
- **Auto-offline** (`IS_ONLINE = false`): detected by failed ping; falls back to `navigator.onLine`
- **Manual offline** (`MANUAL_OFFLINE = true`): user-toggled to save battery; skips all network calls entirely

Cached data renders with a `⚡` suffix when offline. `offline.appcache` (HTML5 AppCache) caches the four static files for full offline load on Kindle.

### Version Bumping
When modifying any cached static file, update both:
1. `var CACHE_VERSION = '...'` in `app.js`
2. The version comment in `offline.appcache`

This forces Kindle to re-fetch updated files and clears stale localStorage caches.

## Adding Quotes

Edit `quotes.js` only. Format:
```js
["Quote text.", "Author Name"],
```