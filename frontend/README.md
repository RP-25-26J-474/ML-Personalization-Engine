# ML Personalization Engine Frontend

Web UI for the ML Personalization Engine. Built with React, Vite, and React Router.

## Prerequisites

- Node.js 18+ (or a recent LTS)
- npm

## Setup

```bash
cd frontend
npm install
```

## Environment

Create or update `frontend/.env` (you can copy values from `frontend/.env.example`).

Available variables:

- `VITE_API_BASE_URL`: Backend API base URL (default local: `http://localhost:8000`)
- `EXT_BACKEND_BASE_URL`: External product backend base URL (default local: `http://localhost:3000`)
- `EXT_BACKEND_USERS_PATH`: External users endpoint path (default: `/api/users`)

## Development

```bash
npm run dev
```

## Production Build

```bash
npm run build
npm run preview
```

## Vercel

If this app is deployed to Vercel with React Router and `BrowserRouter`, configure the Vercel project `Root Directory` as `frontend/` and keep `frontend/vercel.json` in place so route refreshes rewrite to `index.html`.

## Linting

```bash
npm run lint
```

## Project Structure

- `src/layouts/MLPersonalizationEngineLayout.jsx`: App shell (sidebar + top bar)
- `src/pages`: Route-level screens
- `src/App.jsx`: Route definitions
- `src/index.css`: Global styles and theme configuration
