import * as cdk from "aws-cdk-lib";
import { Match, Template } from "aws-cdk-lib/assertions";
import { ApiStack } from "../lib/api-stack";
import { DataStack } from "../lib/data-stack";
import { AuthStack } from "../lib/auth-stack";

describe("API Stack Infrastructure Tests", () => {
  let template: Template;

  beforeAll(() => {
    const app = new cdk.App();
    const dataStack = new DataStack(app, "TestDataStack", {
      frontendBaseUrl: "http://localhost:3000",
      sesFromEmail: "test@email.com",
    });
    const authStack = new AuthStack(app, "TestAuthStack", {
      googleClientId: "1234",
      googleClientSecretParamPath: "googleSecret",
      oauthCallbackUrls: ["http://localhost:3000"],
      oauthLogoutUrls: ["http://localhost:3000"],
    });
    const apiStack = new ApiStack(app, "TestApiStack", {
      bucket: dataStack.bucket,
      table: dataStack.table,
      userPool: authStack.userPool,
    });
    template = Template.fromStack(apiStack);
  });

  test("Lambda functions contain required architectural environment variables", () => {
    // NodejsFunction bundles the handler to a single `index.js` and the
    // synthesized CFN Handler is always "index.handler" - "Entry" is a CDK
    // construct prop, not a CloudFormation property, so it never appears
    // here. Environment variables are nested under `Variables`.
    template.hasResourceProperties("AWS::Lambda::Function", {
      Runtime: "nodejs24.x",
      Handler: "index.handler",
      Environment: {
        Variables: Match.objectLike({
          TABLE_NAME: Match.anyValue(),
        }),
      },
    });
  });

  test("API stack uses one RestApi", () => {
    template.resourceCountIs("AWS::ApiGateway::RestApi", 1);
  });

  test("Endpoints require Cognito Authorization", () => {
    template.hasResourceProperties("AWS::ApiGateway::Method", {
      HttpMethod: "POST",
      AuthorizationType: "COGNITO_USER_POOLS",
      AuthorizerId: Match.anyValue(),
    });
  });

  test("API Gateway has permission to invoke the Lambda functions", () => {
    template.hasResourceProperties("AWS::Lambda::Permission", {
      Action: "lambda:InvokeFunction",
      Principal: "apigateway.amazonaws.com",
      SourceArn: {
        // Fn::Join is [delimiter, parts[]] - the regexp has to match inside
        // the nested parts array, not the two-element Join tuple itself.
        "Fn::Join": [
          "",
          Match.arrayWith([
            Match.stringLikeRegexp("execute-api"), // Verifies source is API Gateway
          ]),
        ],
      },
    });
  });

  test("GET /conversions/{conversionId}/download exists, nested under /conversions, and requires Cognito auth", () => {
    const resources = template.findResources("AWS::ApiGateway::Resource", {
      Properties: { PathPart: "{conversionId}" },
    });
    const conversionIdResourceIds = Object.keys(resources);
    expect(conversionIdResourceIds).toHaveLength(1);

    const downloadResources = template.findResources(
      "AWS::ApiGateway::Resource",
      {
        Properties: {
          PathPart: "download",
          ParentId: { Ref: conversionIdResourceIds[0] },
        },
      },
    );
    const downloadResourceIds = Object.keys(downloadResources);
    expect(downloadResourceIds).toHaveLength(1);

    template.hasResourceProperties("AWS::ApiGateway::Method", {
      HttpMethod: "GET",
      ResourceId: { Ref: downloadResourceIds[0] },
      AuthorizationType: "COGNITO_USER_POOLS",
      AuthorizerId: Match.anyValue(),
    });
  });

  test("download handler can read the audio object from the bucket and the conversion record from the table", () => {
    template.hasResourceProperties("AWS::IAM::Policy", {
      PolicyDocument: Match.objectLike({
        Statement: Match.arrayWith([
          Match.objectLike({
            Effect: "Allow",
            Action: Match.arrayWith(["s3:GetObject*"]),
          }),
          Match.objectLike({
            Effect: "Allow",
            Action: Match.arrayWith(["dynamodb:GetItem"]),
          }),
        ]),
      }),
    });
  });
});
