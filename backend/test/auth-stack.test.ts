import * as cdk from "aws-cdk-lib";
import { Match, Template } from "aws-cdk-lib/assertions";
import { AuthStack } from "../lib/auth-stack";

describe("Auth Stack Infrastructure Tests", () => {
  let template: Template;

  beforeAll(() => {
    const app = new cdk.App();
    const authStack = new AuthStack(app, "TestAuthStack", {
      googleClientId: "test-google-client-id",
      googleClientSecretParamPath: "/aloud-cdk/google-secret",
      oauthCallbackUrls: [
        "http://localhost:5173",
        "https://aloud.example.com",
      ],
      oauthLogoutUrls: ["http://localhost:5173", "https://aloud.example.com"],
    });
    template = Template.fromStack(authStack);
  });

  test("creates exactly one Cognito User Pool with email sign-in", () => {
    template.resourceCountIs("AWS::Cognito::UserPool", 1);
    template.hasResourceProperties("AWS::Cognito::UserPool", {
      UsernameAttributes: ["email"],
    });
  });

  test("creates a Hosted UI domain", () => {
    template.hasResourceProperties("AWS::Cognito::UserPoolDomain", {
      Domain: "aloud-user-pool-domain",
    });
  });

  test("creates a Google identity provider", () => {
    template.hasResourceProperties("AWS::Cognito::UserPoolIdentityProvider", {
      ProviderType: "Google",
      ProviderDetails: Match.objectLike({
        client_id: "test-google-client-id",
      }),
    });
  });

  test("the custom resource that fetches the Google secret decrypts it and hides it from logs", () => {
    template.hasResourceProperties("Custom::AWS", {
      Create: Match.serializedJson(
        Match.objectLike({
          service: "SSM",
          action: "getParameter",
          parameters: Match.objectLike({
            Name: "/aloud-cdk/google-secret",
            WithDecryption: true,
          }),
        }),
      ),
    });
  });

  test("User Pool Client supports both Google and Cognito sign-in, with the configured callback/logout URLs", () => {
    template.hasResourceProperties("AWS::Cognito::UserPoolClient", {
      SupportedIdentityProviders: Match.arrayWith(["Google", "COGNITO"]),
      CallbackURLs: ["http://localhost:5173", "https://aloud.example.com"],
      LogoutURLs: ["http://localhost:5173", "https://aloud.example.com"],
    });
  });
});
