# Aloud Backend

Aloud is a text-to-audio conversion application. The **Backend** package is an
AWS CDK application that holds the infrastructure and APIs necessary for
intended functionality.

## Architecture

Three CDK stacks, deployed in dependency order from `bin/backend.ts`:

- **`AuthStack`** — a Cognito User Pool federated with Google as an identity
  provider (Hosted UI, Authorization Code + PKCE), plus the app client the
  frontend authenticates against.
- **`DataStack`** — the S3 bucket documents are uploaded to and audio files
  are written to, the DynamoDB table tracking conversion records, and the two
  pipeline Lambdas that react to S3 events:
  - `process-document.ts` — triggered on `uploads/*` object creation. Extracts
    text (PDF via `unpdf`, `.doc` via `word-extractor`, `.docx` via
    `mammoth`, `.txt` raw), synthesizes it to audio with Amazon Polly, and
    writes the result to `audio/*`. Updates the conversion record's `status`
    at each stage (`processing` → `completed`/`failed`).
  - `send-audio.ts` — triggered on `audio/*` object creation. Looks up the
    conversion record and emails the signed-in user via SES.
- **`ApiStack`** — a single API Gateway REST API, authorized end-to-end by a
  shared `CognitoUserPoolsAuthorizer`, fronting three Lambdas:
  - `POST /uploads` — issues a presigned S3 PUT URL and creates the
    conversion record (`get-signed-url.ts`).
  - `GET /conversions` — lists the caller's own conversion records, scoped by
    their Cognito `sub` (`get-conversions.ts`).
  - `GET /conversions/{conversionId}/download` — issues a short-lived
    presigned S3 GET URL for a completed conversion's audio file
    (`get-download-url.ts`). The DynamoDB lookup is keyed by
    `PK = USER#<sub-from-the-authorizer-claims>`, not by anything in the
    request path, so a signed-in user can only ever get a URL for their own
    conversions.

Conversion records live in a single DynamoDB table keyed by
`PK = USER#<sub>`, `SK = CONVERSION#<ulid>` — this makes "list my
conversions, newest first" a single `Query` with no secondary index, since
ULIDs sort lexicographically by creation time.

```text
backend/
  bin/backend.ts           # CDK app entrypoint — env var loading + stack wiring
  config/constants.ts      # Shared enums (ConversionStatus) used across handlers
  lib/
    auth-stack.ts           # Cognito User Pool + Google IdP + app client
    data-stack.ts            # S3 bucket, DynamoDB table, pipeline Lambdas
    api-stack.ts              # REST API, Cognito authorizer, upload/list Lambdas
  src/handlers/
    get-signed-url.ts         # POST /uploads
    get-conversions.ts         # GET /conversions
    get-download-url.ts        # GET /conversions/{conversionId}/download
    process-document.ts         # S3 uploads/* -> extract + synthesize -> audio/*
    send-audio.ts                # S3 audio/* -> email the user via SES
  test/                           # Jest + aws-cdk-lib/assertions + handler unit tests
```

## Key technologies

- **AWS CDK v2** (TypeScript) for infrastructure-as-code.
- **Amazon Cognito** (Hosted UI, federated with Google) for authentication.
- **API Gateway (REST) + Lambda**, authorized via a Cognito JWT authorizer.
- **S3** for document/audio storage, with event notifications driving the
  pipeline.
- **DynamoDB** (single-table design) for conversion records.
- **Amazon Polly** for text-to-speech synthesis, **SES** for the completion
  email.
- **Jest** + `ts-jest` + `aws-cdk-lib/assertions` for infrastructure tests;
  `aws-sdk-client-mock` for handler unit tests.

## Getting started

1. Install dependencies from the repo root (this is an npm workspace):

   ```bash
   npm install
   ```

2. Copy `.env.example` to `.env` and fill in every value:

   | Variable                                    | What it is                                                                                                                                                                    |
   | ------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
   | `CDK_ACCOUNT` / `CDK_REGION`                | Target AWS account and region                                                                                                                                                 |
   | `GOOGLE_CLIENT_ID`                          | OAuth client ID from Google Cloud Console                                                                                                                                     |
   | `GOOGLE_CLIENT_SECRET_PARAM`                | SSM `SecureString` parameter path holding the Google OAuth client secret (create this in SSM yourself — the secret value itself never goes in `.env`)                         |
   | `OAUTH_CALLBACK_URLS` / `OAUTH_LOGOUT_URLS` | Comma-separated URLs the Cognito app client allows redirecting to, e.g. the frontend's dev and prod origins                                                                   |
   | `SES_FROM_EMAIL`                            | The "from" address for completion emails — must be a [verified SES identity](https://docs.aws.amazon.com/ses/latest/dg/creating-identities.html) in the target account/region |
   | `FRONTEND_BASE_URL`                         | The frontend's own URL, linked from the completion email                                                                                                                      |

3. One-time setup in the Google Cloud Console: create an OAuth client, and
   once `AuthStack` is deployed, allow-list its Cognito domain's fixed
   redirect URI (`https://<your-domain>.auth.<region>.amazoncognito.com/oauth2/idpresponse`)
   in the OAuth client's settings.
4. `npx cdk deploy --all` (see commands below).

## Useful commands

- `npm run build` — compile TypeScript to JS
- `npm run watch` — watch for changes and compile
- `npm run test` — run the Jest test suite (infra assertions + handler unit tests)
- `npx cdk deploy` — deploy this stack to your default AWS account/region
- `npx cdk diff` — compare deployed stack with current state
- `npx cdk synth` — emit the synthesized CloudFormation template
