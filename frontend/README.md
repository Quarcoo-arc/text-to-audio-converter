# Aloud — frontend

React + Vite app for the text-to-audio converter. Upload a document, sign
in with Google, and get an email when the audio is ready.

## Running locally

```bash
npm run dev --workspace=frontend   # or: cd frontend && npm run dev
```

With no environment variables set, the app runs in **mock mode**: sign-in
is a fake Google user and the API is mocked in-browser with
[MSW](https://mswjs.io/), so the whole upload → convert → done flow is
demoable without any backend deployed yet.

## Connecting to the real backend

Copy `.env.example` to `.env` and fill in:

| Variable | What it is |
| --- | --- |
| `VITE_COGNITO_AUTHORITY` | Cognito User Pool issuer URL |
| `VITE_COGNITO_CLIENT_ID` | Cognito app client ID for this SPA |
| `VITE_COGNITO_DOMAIN` | Cognito Hosted UI domain |
| `VITE_COGNITO_REDIRECT_URI` | Where Hosted UI redirects back to (defaults to the app's own origin) |
| `VITE_API_BASE_URL` | Base URL of the backend API |

Once `VITE_COGNITO_AUTHORITY`/`VITE_COGNITO_CLIENT_ID` are set, sign-in goes
through Cognito Hosted UI (federated with Google) for real. Once
`VITE_API_BASE_URL` is set, requests go to the real API instead of the mock.

## API contract the frontend expects

- `POST /uploads` `{ fileName, contentType }` → `{ conversionId, uploadUrl }`
  — `uploadUrl` is a presigned S3 PUT URL the browser uploads the file
  bytes to directly.
- `GET /conversions` → the signed-in user's conversion records:
  `{ conversionId, fileName, status, createdAt, completedAt? }[]`, where
  `status` is `"queued" | "processing" | "completed" | "failed"`.
- Both are called with `Authorization: Bearer <id_token>`.

See `src/mocks/handlers.ts` for the reference mock implementation of this
contract.

## Build

```bash
npm run build --workspace=frontend
```
