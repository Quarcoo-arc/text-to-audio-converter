import { CfnOutput, SecretValue, Stack, StackProps } from "aws-cdk-lib";
import {
  ProviderAttribute,
  UserPool,
  UserPoolClient,
  UserPoolClientIdentityProvider,
  UserPoolIdentityProviderGoogle,
} from "aws-cdk-lib/aws-cognito";
import * as cr from "aws-cdk-lib/custom-resources";
import * as iam from "aws-cdk-lib/aws-iam";
import { Construct } from "constructs";

interface AuthStackProps extends StackProps {
  googleClientId: string;
  googleClientSecretParamPath: string;
  oauthCallbackUrls: string[];
  oauthLogoutUrls: string[];
}

export class AuthStack extends Stack {
  public userPool: UserPool;
  public userPoolClient: UserPoolClient;
  private googleProvider: UserPoolIdentityProviderGoogle;

  constructor(scope: Construct, id: string, props: AuthStackProps) {
    super(scope, id, props);

    this.createUserPool();
    this.addProviderDomainToUserPool();
    this.addGoogleProviderToUserPool(
      props.googleClientId,
      props.googleClientSecretParamPath,
    );
    this.createUserPoolClient(props.oauthCallbackUrls, props.oauthLogoutUrls);
  }

  private createUserPool() {
    this.userPool = new UserPool(this, "AloudUserPool", {
      selfSignUpEnabled: true,
      signInAliases: { email: true },
    });

    new CfnOutput(this, "AloudUserPoolId", {
      value: this.userPool.userPoolId,
      description: "The ID of the Aloud Cognito User Pool",
      exportName: "AloudUserPoolId",
    });
  }

  private addProviderDomainToUserPool() {
    const userPoolDomain = this.userPool.addDomain("AloudUserPoolDomain", {
      cognitoDomain: {
        domainPrefix: "aloud-user-pool-domain",
      },
    });
    new CfnOutput(this, "AloudUserPoolDomainUrl", {
      value: userPoolDomain.baseUrl(),
      description: "The domain URL of the Aloud Cognito User Pool",
    });
  }

  private addGoogleProviderToUserPool(
    googleClientId: string,
    googleClientSecretParamPath: string,
  ) {
    // Create custom resource
    const ssmParameter = new cr.AwsCustomResource(this, "SsmSecureSecret", {
      onCreate: {
        service: "SSM",
        action: "getParameter",
        parameters: {
          Name: googleClientSecretParamPath,
          WithDecryption: true,
        },
        physicalResourceId: cr.PhysicalResourceId.of(
          googleClientSecretParamPath,
        ),
        logging: cr.Logging.withDataHidden(),
      },
      policy: cr.AwsCustomResourcePolicy.fromStatements([
        new iam.PolicyStatement({
          actions: ["ssm:GetParameter"],
          resources: [
            `arn:aws:ssm:${this.region}:${this.account}:parameter${googleClientSecretParamPath}`,
          ],
        }),
      ]),
    });

    const googleProvider = new UserPoolIdentityProviderGoogle(
      this,
      "AloudGoogleProvider",
      {
        clientId: googleClientId,
        clientSecretValue: SecretValue.unsafePlainText(
          ssmParameter.getResponseField("Parameter.Value"),
        ),
        userPool: this.userPool,
        scopes: ["profile", "email", "openid"],
        attributeMapping: {
          email: ProviderAttribute.GOOGLE_EMAIL,
          givenName: ProviderAttribute.GOOGLE_GIVEN_NAME,
          profilePicture: ProviderAttribute.GOOGLE_PICTURE,
        },
      },
    );

    this.googleProvider = googleProvider;
  }

  private createUserPoolClient(callbackUrls: string[], logoutUrls: string[]) {
    this.userPoolClient = new UserPoolClient(this, "AloudUserPoolClient", {
      userPool: this.userPool,
      supportedIdentityProviders: [
        UserPoolClientIdentityProvider.GOOGLE,
        UserPoolClientIdentityProvider.COGNITO,
      ],
      oAuth: {
        callbackUrls,
        logoutUrls,
      },
    });

    // Ensure Google IdP is created before the User Pool Client
    this.userPoolClient.node.addDependency(this.googleProvider);

    new CfnOutput(this, "AloudUserPoolClientId", {
      value: this.userPoolClient.userPoolClientId,
      description: "The ID of the Aloud Cognito User Pool Client",
      exportName: "AloudUserPoolClientId",
    });
  }
}
