import { CfnOutput, Stack, StackProps } from "aws-cdk-lib";
import {
  CognitoUserPoolsAuthorizer,
  Cors,
  LambdaIntegration,
  RestApi,
} from "aws-cdk-lib/aws-apigateway";
import { Runtime } from "aws-cdk-lib/aws-lambda";
import { NodejsFunction } from "aws-cdk-lib/aws-lambda-nodejs";
import { IBucket } from "aws-cdk-lib/aws-s3";
import { Construct } from "constructs";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as cognito from "aws-cdk-lib/aws-cognito";
import * as path from "path";

interface ApiStackProps extends StackProps {
  bucket: IBucket;
  table: dynamodb.ITable;
  userPool: cognito.IUserPool;
}

export class ApiStack extends Stack {
  private bucket: IBucket;
  private table: dynamodb.ITable;
  private uploadApiUrl: string;
  private authorizer: CognitoUserPoolsAuthorizer;

  constructor(scope: Construct, id: string, props: ApiStackProps) {
    super(scope, id, props);

    this.bucket = props.bucket;
    this.table = props.table;

    this.createCognitoAuthorizer(props.userPool);
    this.createUploadApi();
    this.exportApiUrl();
  }

  private createCognitoAuthorizer(userPool: cognito.IUserPool) {
    const authorizer = new CognitoUserPoolsAuthorizer(
      this,
      "CognitoAuthorizer",
      {
        cognitoUserPools: [userPool],
      },
    );
    this.authorizer = authorizer;
  }

  private createUploadApi() {
    const getPresignedUrlHandler = new NodejsFunction(
      this,
      "GetPresignedUrlHandler",
      {
        runtime: Runtime.NODEJS_24_X,
        entry: path.join(__dirname, "../src/handlers/get-signed-url.ts"),
        handler: "handler",
        environment: {
          BUCKET_NAME: this.bucket.bucketName,
          TABLE_NAME: this.table.tableName,
        },
      },
    );

    this.bucket.grantPut(getPresignedUrlHandler);

    const api = new RestApi(this, "DocumentUploadApi", {
      restApiName: "Document Upload Service",
      defaultCorsPreflightOptions: {
        allowOrigins: Cors.ALL_ORIGINS,
        allowMethods: Cors.ALL_METHODS,
      },
    });

    const uploadResource = api.root.addResource("uploads");
    uploadResource.addMethod(
      "POST",
      new LambdaIntegration(getPresignedUrlHandler),
      {
        authorizer: this.authorizer,
      },
    );

    this.uploadApiUrl = api.url;
  }

  private exportApiUrl() {
    new CfnOutput(this, "ApiGatewayUrl", {
      value: this.uploadApiUrl,
      description:
        "The URL of the API Gateway for requesting presigned S3 upload URLs",
      exportName: "ApiGatewayUrl",
    });
  }
}
