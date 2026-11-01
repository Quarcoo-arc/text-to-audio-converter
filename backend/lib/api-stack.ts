import { CfnOutput, Stack, StackProps } from "aws-cdk-lib";
import {
  CognitoUserPoolsAuthorizer,
  Cors,
  LambdaIntegration,
  Resource,
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
  private authorizer: CognitoUserPoolsAuthorizer;
  private restApi: RestApi;
  private conversionsResource: Resource;

  constructor(scope: Construct, id: string, props: ApiStackProps) {
    super(scope, id, props);

    this.bucket = props.bucket;
    this.table = props.table;

    this.createCognitoAuthorizer(props.userPool);
    this.createRestApi();
    this.createUploadApi();
    this.createConversionsRetrievalApi();
    this.createDownloadApi();
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

  private createRestApi() {
    const api = new RestApi(this, "AloudRestApi", {
      restApiName: "Aloud Rest API",
      defaultCorsPreflightOptions: {
        allowOrigins: Cors.ALL_ORIGINS,
        allowMethods: Cors.ALL_METHODS,
      },
    });
    this.restApi = api;

    new CfnOutput(this, "AloudRestApiUrl", {
      value: this.restApi.url,
      description: "Base URL for Aloud Rest APIs",
    });
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
    this.table.grantReadWriteData(getPresignedUrlHandler);

    const uploadResource = this.restApi.root.addResource("uploads");
    uploadResource.addMethod(
      "POST",
      new LambdaIntegration(getPresignedUrlHandler),
      {
        authorizer: this.authorizer,
      },
    );
  }

  private createConversionsRetrievalApi() {
    const getConversionsHandler = new NodejsFunction(
      this,
      "GetConversionsHandler",
      {
        runtime: Runtime.NODEJS_24_X,
        entry: path.join(__dirname, "../src/handlers/get-conversions.ts"),
        handler: "handler",
        environment: {
          TABLE_NAME: this.table.tableName,
        },
      },
    );

    this.table.grantReadData(getConversionsHandler);

    this.conversionsResource = this.restApi.root.addResource("conversions");
    this.conversionsResource.addMethod(
      "GET",
      new LambdaIntegration(getConversionsHandler),
      {
        authorizer: this.authorizer,
      },
    );
  }

  private createDownloadApi() {
    const getDownloadUrlHandler = new NodejsFunction(
      this,
      "GetDownloadUrlHandler",
      {
        runtime: Runtime.NODEJS_24_X,
        entry: path.join(__dirname, "../src/handlers/get-download-url.ts"),
        handler: "handler",
        environment: {
          BUCKET_NAME: this.bucket.bucketName,
          TABLE_NAME: this.table.tableName,
        },
      },
    );

    this.bucket.grantRead(getDownloadUrlHandler);
    this.table.grantReadData(getDownloadUrlHandler);

    const downloadSingleConversionResource = this.conversionsResource
      .addResource("{conversionId}")
      .addResource("download");

    downloadSingleConversionResource.addMethod(
      "GET",
      new LambdaIntegration(getDownloadUrlHandler),
      {
        authorizer: this.authorizer,
      },
    );
  }
}
