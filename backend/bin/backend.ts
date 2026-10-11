import * as cdk from "aws-cdk-lib/core";
import { ApiStack } from "../lib/api-stack";
import { AuthStack } from "../lib/auth-stack";
import * as dotenv from "dotenv";
import { DataStack } from "../lib/data-stack";

dotenv.config();

const app = new cdk.App();
const env = {
  account: process.env.CDK_ACCOUNT!,
  region: process.env.CDK_REGION!,
};
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID!;
const GOOGLE_CLIENT_SECRET_PARAM = process.env.GOOGLE_CLIENT_SECRET_PARAM!;

if (!env.account || !env.region) {
  throw new Error(
    "CDK_ACCOUNT and CDK_REGION must be provided in the environment variables.",
  );
}

if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET_PARAM) {
  throw new Error(
    "Google Client ID and Secret Parameter must be provided in the environment variables.",
  );
}

const authStack = new AuthStack(app, "AuthStack", {
  env,
  googleClientId: GOOGLE_CLIENT_ID,
  googleClientSecretParamPath: GOOGLE_CLIENT_SECRET_PARAM,
});

const dataStack = new DataStack(app, "DataStack", {
  env,
});

const apiStack = new ApiStack(app, "ApiStack", {
  env,
  bucket: dataStack.bucket,
  table: dataStack.table,
  userPool: authStack.userPool,
});
