import * as cdk from "aws-cdk-lib";
import { Match, Template } from "aws-cdk-lib/assertions";
import { DataStack } from "../lib/data-stack";

describe("Data Stack Infrastructure Tests", () => {
  let template: Template;

  beforeAll(() => {
    const app = new cdk.App();
    const dataStack = new DataStack(app, "TestDataStack", {
      sesFromEmail: "sender@example.com",
      frontendBaseUrl: "http://localhost:5173",
    });
    template = Template.fromStack(dataStack);
  });

  test("creates exactly one private, encrypted S3 bucket", () => {
    template.resourceCountIs("AWS::S3::Bucket", 1);
    template.hasResourceProperties("AWS::S3::Bucket", {
      BucketEncryption: Match.objectLike({
        ServerSideEncryptionConfiguration: Match.arrayWith([
          Match.objectLike({
            ServerSideEncryptionByDefault: { SSEAlgorithm: "AES256" },
          }),
        ]),
      }),
      PublicAccessBlockConfiguration: {
        BlockPublicAcls: true,
        BlockPublicPolicy: true,
        IgnorePublicAcls: true,
        RestrictPublicBuckets: true,
      },
    });
  });

  test("creates exactly one DynamoDB table keyed by PK/SK, pay-per-request", () => {
    template.resourceCountIs("AWS::DynamoDB::Table", 1);
    template.hasResourceProperties("AWS::DynamoDB::Table", {
      KeySchema: [
        { AttributeName: "PK", KeyType: "HASH" },
        { AttributeName: "SK", KeyType: "RANGE" },
      ],
      BillingMode: "PAY_PER_REQUEST",
    });
  });

  test("document processing handler is triggered on uploads/* and can call Polly", () => {
    template.hasResourceProperties("Custom::S3BucketNotifications", {
      NotificationConfiguration: Match.objectLike({
        LambdaFunctionConfigurations: Match.arrayWith([
          Match.objectLike({
            Events: Match.arrayWith(["s3:ObjectCreated:*"]),
            Filter: {
              Key: {
                FilterRules: Match.arrayWith([
                  { Name: "prefix", Value: "uploads/" },
                ]),
              },
            },
          }),
        ]),
      }),
    });

    template.hasResourceProperties("AWS::IAM::Policy", {
      PolicyDocument: Match.objectLike({
        Statement: Match.arrayWith([
          Match.objectLike({
            Effect: "Allow",
            Action: "polly:StartSpeechSynthesisTask",
          }),
        ]),
      }),
    });
  });

  test("audio dispatch handler is triggered on audio/* and can send email", () => {
    template.hasResourceProperties("Custom::S3BucketNotifications", {
      NotificationConfiguration: Match.objectLike({
        LambdaFunctionConfigurations: Match.arrayWith([
          Match.objectLike({
            Events: Match.arrayWith(["s3:ObjectCreated:*"]),
            Filter: {
              Key: {
                FilterRules: Match.arrayWith([
                  { Name: "prefix", Value: "audio/" },
                ]),
              },
            },
          }),
        ]),
      }),
    });

    template.hasResourceProperties("AWS::IAM::Policy", {
      PolicyDocument: Match.objectLike({
        Statement: Match.arrayWith([
          Match.objectLike({
            Effect: "Allow",
            Action: "ses:SendEmail",
          }),
        ]),
      }),
    });
  });

  test("document processing handler has a timeout long enough for real documents", () => {
    const functions = template.findResources("AWS::Lambda::Function", {
      Properties: {
        Environment: {
          Variables: Match.objectLike({ BUCKET_NAME: Match.anyValue() }),
        },
      },
    });
    const timeouts = Object.values(functions).map(
      (fn: any) => fn.Properties.Timeout ?? 3, // 3s is the Lambda default when unset
    );
    expect(Math.max(...timeouts)).toBeGreaterThan(3);
  });
});
