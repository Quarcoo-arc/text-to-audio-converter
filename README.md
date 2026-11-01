# Aloud

A serverless, event-driven app that converts an uploaded PDF/DOC/DOCX/TXT document into audio, and sends an email notification once the audio is ready.

## Structure

This is an npm workspaces monorepo:

- [`backend/`](backend/README.md) — the AWS CDK app. Auth (Cognito + Google),
  the upload/list API, and the S3-event-driven document → audio pipeline
  (text extraction → Polly synthesis → SES email).
- [`frontend/`](frontend/README.md) — the React + Vite SPA. Runs fully mocked
  with zero setup (`npm run dev`), or against the real deployed backend.

## Quick start

```bash
npm install
```

Then see each workspace's own README for setup:

- `frontend/README.md` — running the UI (mocked, or against a real backend)
- `backend/README.md` — deploying the infrastructure

The frontend works standalone in mock mode with no backend deployed, so it's
the fastest way to see the app running.
