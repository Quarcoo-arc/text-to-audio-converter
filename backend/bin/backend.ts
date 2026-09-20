import * as cdk from "aws-cdk-lib/core";
import { BackendStack } from "../lib/backend-stack";
import { S3UploadStack } from "../lib/s3-upload-stack";

const app = new cdk.App();
const env = {
  account: process.env.CDK_ACCOUNT!,
  region: process.env.CDK_REGION!,
};

new BackendStack(app, "BackendStack", {
  env,
});

new S3UploadStack(app, "S3UploadStack", {
  env,
});
