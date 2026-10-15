// Central place for reading build-time configuration. Every value the app
// needs from the environment is resolved here, once, so the rest of the
// app never touches `import.meta.env` directly.

const env = import.meta.env;

export const cognitoConfig = {
  authority: env.VITE_COGNITO_AUTHORITY as string | undefined,
  clientId: env.VITE_COGNITO_CLIENT_ID as string | undefined,
  domain: env.VITE_COGNITO_DOMAIN as string | undefined,
  redirectUri:
    (env.VITE_COGNITO_REDIRECT_URI as string | undefined) ??
    window.location.origin,
  logoutUri:
    (env.VITE_COGNITO_LOGOUT_URI as string | undefined) ??
    window.location.origin,
};

export const apiBaseUrl = env.VITE_API_BASE_URL as string | undefined;

// The app runs fully "against itself" when it has nowhere real to talk to:
// no Cognito user pool configured means auth is mocked, no API base URL
// means network calls are mocked. This is what makes `npm run dev` work
// with zero setup before the backend exists.
export const isMockAuth = !cognitoConfig.authority || !cognitoConfig.clientId;
export const isMockApi = !apiBaseUrl;

export const upload = {
  acceptedTypes: [
    "application/pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "text/plain",
  ],
  acceptedExtensions: [".pdf", ".docx", ".txt"],
  maxSizeBytes: 20 * 1024 * 1024, // 20MB
};
