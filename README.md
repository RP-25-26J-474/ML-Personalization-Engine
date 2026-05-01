# AURA ML Personalization Engine | Minor Release (v1.1.0) (Stable)

AURA ML Personalization Engine is a full-stack demo platform for accessibility-oriented personalization. It combines three core components:

- Temporary User Detector: filters anomalous, low-quality, or unreliable interaction batches before they affect personalization.
- Category-wise Personalization Engine: generates a cold-start profile from onboarding signals.
- User-wise Personalization Engine: continuously updates a user profile from accepted interaction history.

The repository includes a React + Vite frontend for demos and a FastAPI backend that exposes the personalization workflows as APIs.

## Release v1.1.0 Highlights

This minor release builds on the stable v1.0.0 baseline with improved admin visibility, cleaner user-adaptation workflows, deployment fixes, and more reliable category-engine confidence scoring.

- Added admin dashboard screens for browsing users and inspecting individual user profiles.
- Added profile knob change visualization and profile-diff display improvements.
- Added interaction-batch lookup by `user_id` in the user personalization UI.
- Improved the user-engine update flow so kept interaction batches can drive adaptive profile updates more directly.
- Stabilized category-engine KNN confidence calibration for larger training datasets.
- Switched category KNN distance handling to better fit bounded 6D onboarding probability vectors.
- Expanded synthetic category training data coverage to the full API-valid feature range.
- Improved frontend deployment behavior, including Vercel refresh routing and frontend API environment configuration.
- Added support for Dockerized ML artifacts and configurable hosted-frontend CORS origins.

## What the System Does

High-level flow:

1. A new user completes onboarding.
2. The category engine generates an initial profile from impairment probabilities and onboarding metrics.
3. Later interaction batches are scored by the temporary user detector.
4. Accepted batches are used by the user engine to refine the profile over time.
5. The frontend visualizes outputs, traces, histories, and model state.

## Repository Structure

```text
ML-Personalization-Engine/
|- backend/   FastAPI API, orchestration, engines, schemas, storage
|- frontend/  React demo GUI built with Vite
`- AGENTS.md  Local agent instructions for this workspace
```

Important paths:

- `backend/app/main.py`: FastAPI application entrypoint
- `backend/app/api/`: API route modules and dependency wiring
- `backend/app/core/engine/`: temp detector, category engine, user engine, orchestrator
- `backend/app/core/storage/repos/`: in-memory repositories for demo data
- `frontend/src/pages/`: dashboard and engine screens
- `frontend/src/components/sections/`: input, output, console, chart panels
- `frontend/src/layouts/MLPersonalizationEngineLayout.jsx`: main app shell

## Tech Stack

Frontend:

- React 19
- Vite 7
- React Router 7

Backend:

- FastAPI
- Pydantic v2
- NumPy
- scikit-learn
- UMAP
- PyTorch

## Current Architecture

### 1. Temporary User Detector

Purpose:
- Score interaction batches as `keep`, `quarantine`, or `reject`
- Prevent noisy data from polluting personalization updates

Current implementation:
- Feature-based scoring
- Isolation Forest training support
- Heuristic signals and user baseline comparison
- Demo visibility through traces, stored batches, and quarantine history

### 2. Category-wise Personalization Engine

Purpose:
- Produce an initial accessibility profile for cold-start users

Current implementation:
- KNN-style profile generation over synthetic or uploaded training data
- Weighted profile aggregation
- Quality metadata and trace output
- 2D and 3D vector-space projections for visualization

### 3. User-wise Personalization Engine

Purpose:
- Update personalization settings from ongoing interactions

Current implementation:
- Rule-based profile adaptation for usable demo behavior
- Optional GRU autoencoder sequence model training
- Clustering and 2D cluster-map visualization from stored user sequences

## Frontend Setup

Prerequisites:

- Node.js 18+ or newer LTS
- npm

Install and run:

```bash
cd frontend
npm install
npm run dev
```

The frontend runs by default at `http://localhost:5173`.

Frontend environment:

- Create `frontend/.env`
- Or copy values from `frontend/.env.example`

Available variable:

```env
VITE_API_BASE_URL=http://localhost:8000
```

Build commands:

```bash
cd frontend
npm run build
npm run preview
```

Lint:

```bash
cd frontend
npm run lint
```

## Backend Setup

Prerequisites:

- Python 3.11 recommended
- `pip`

Install and run:

```bash
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

The backend runs by default at `http://localhost:8000`.

Configuration lives in `backend/app/core/config.py`.

Key settings:

- `DEBUG`
- `CORS_ALLOW_ORIGINS`
- `ARTIFACTS_DIR`
- `MONGODB_URI`
- `MONGODB_DB_NAME`

Notes:

- Current repositories are in-memory for demo use, so data resets on restart.
- Default frontend CORS origins include localhost ports `5173`, `5174`, and `5175`.

## Docker

The repository includes a backend Dockerfile at `backend/Dockerfile`.

Example build and run:

```bash
cd backend
docker build -t aura-mlpe-backend .
docker run -p 8000:8000 aura-mlpe-backend
```

## API Overview

Base URL:

```text
http://localhost:8000
```

Core endpoints:

### Dashboard

- `GET /health`
- `GET /dashboard/status`

### Temporary User Detector

- `POST /temp-detector/score-batch`
- `POST /temp-detector/score-batches`
- `POST /temp-detector/train-global`
- `POST /temp-detector/train-synth`
- `POST /temp-detector/train-from-batches`
- `GET /temp-detector/status`

### Category Engine

- `POST /category/generate-profile`
- `POST /category/train`
- `POST /category/train-csv`
- `GET /category/vector-space`
- `GET /category/vector-space-3d`

### User Engine

- `POST /user/update-profile`
- `POST /user/update-profile-batch`
- `POST /user/train-seq-model`
- `GET /user/cluster-map`

### Data and History

- `GET /data/profiles`
- `GET /data/traces`
- `GET /data/quarantine`
- `GET /data/profile-diffs`
- `GET /data/current-profile`
- `GET /data/state/current`
- `GET /data/state/transitions`

## Demo Workflow

Typical demo sequence:

1. Start the backend.
2. Start the frontend.
3. Train the category engine and temp detector from synthetic data if needed.
4. Submit onboarding data through the Category Engine page.
5. Score interaction batches in the Temporary User Detector page.
6. Send accepted interactions to the User Engine page.
7. Review traces, diffs, cluster views, and stored profiles from the dashboard/data views.

## Example Data Contracts

### Onboarding Input

```json
{
  "user_id": "u_001",
  "session_id": "onb_001",
  "captured_at": "2025-10-06T11:00:00Z",
  "impairment_probs": {
    "vision": {
      "vision_loss": 0.2,
      "color_blindness": 0.1
    },
    "motor": {
      "delayed_reaction": 0.3,
      "inaccurate_click": 0.2,
      "motor_impairment": 0.34
    },
    "literacy": 0.4
  },
  "onboarding_metrics": {
    "avg_reaction_ms": 720,
    "hit_rate": 0.88
  },
  "device_context": {
    "os": "Windows",
    "browser": "Chrome",
    "screen_w": 1440,
    "screen_h": 900,
    "dpr": 1
  }
}
```

### Interaction Batch Input

```json
{
  "user_id": "u_001",
  "batch_id": "b_001",
  "captured_at": "2025-10-06T11:25:00Z",
  "page_context": {
    "domain": "example.com",
    "route": "/checkout",
    "app_type": "web"
  },
  "events_agg": {
    "click_count": 24,
    "misclick_rate": 0.12,
    "avg_click_interval_ms": 430,
    "avg_dwell_ms": 2100,
    "rage_clicks": 1,
    "zoom_events": 2,
    "scroll_speed_px_s": 260
  }
}
```

## Project Status

This README reflects the repository as a stable whole-project release:

- Product release label: `Minor Release 1`
- Release version: `v1.1.0`
- Stability label: `Stable`

Implementation note:

- The current FastAPI OpenAPI metadata in `backend/app/main.py` still reports application version `0.1.0`. That can be aligned separately if you want the backend metadata to match the release branding.

## Development Notes

- Pydantic v2 is in use; avoid leading underscore fields.
- Import paths should stay under `app.core.*` for backend internals.
- Current storage is demo-oriented and non-persistent unless replaced with a real backing store.
