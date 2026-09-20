import { CfnOutput, RemovalPolicy, Stack, StackProps } from "aws-cdk-lib";
import { Cors, LambdaIntegration, RestApi } from "aws-cdk-lib/aws-apigateway";
import { Runtime } from "aws-cdk-lib/aws-lambda";
import { NodejsFunction } from "aws-cdk-lib/aws-lambda-nodejs";
import {
  BlockPublicAccess,
  Bucket,
  BucketEncryption,
  HttpMethods,
  IBucket,
} from "aws-cdk-lib/aws-s3";
import { Construct } from "constructs";
import * as path from "path";

export class S3UploadStack extends Stack {
  public readonly bucket: IBucket;
  private presignedUrl: string;

  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    this.bucket = new Bucket(this, "DocumentUploadBucket", {
      encryption: BucketEncryption.S3_MANAGED,
      blockPublicAccess: BlockPublicAccess.BLOCK_ALL,
      removalPolicy: RemovalPolicy.DESTROY, // Change this in production
      autoDeleteObjects: true, // Delete files when stack is destroyed
      cors: [
        {
          allowedMethods: [HttpMethods.PUT],
          allowedOrigins: ["*"],
          allowedHeaders: ["*"],
        },
      ],
    });

    new CfnOutput(this, "DocumentUploadBucket", {
      value: this.bucket.bucketName,
      description: "The name of the S3 bucket for document uploads",
      exportName: "DocumentUploadBucket",
    });

    this.getPresignedUrl();
    this.exportApiUrl();
  }

  private getPresignedUrl() {
    if (!this.bucket) return;

    const getPresignedUrlHandler = new NodejsFunction(
      this,
      "GetPresignedUrlHandler",
      {
        runtime: Runtime.NODEJS_24_X,
        entry: path.join(__dirname, "../src/handlers/get-signed-url.ts"),
        handler: "handler",
        environment: {
          BUCKET_NAME: this.bucket.bucketName,
        },
      },
    );

    this.bucket.grantWrite(getPresignedUrlHandler);

    const api = new RestApi(this, "DocumentUploadApi", {
      restApiName: "Document Upload Service",
      defaultCorsPreflightOptions: {
        allowOrigins: Cors.ALL_ORIGINS,
        allowMethods: Cors.ALL_METHODS,
      },
    });

    const uploadResource = api.root.addResource("request-upload");
    uploadResource.addMethod(
      "POST",
      new LambdaIntegration(getPresignedUrlHandler),
    );

    this.presignedUrl = api.url;
  }

  private exportApiUrl() {
    new CfnOutput(this, "ApiGatewayUrl", {
      value: this.presignedUrl,
      description:
        "The URL of the API Gateway for requesting presigned S3 upload URLs",
      exportName: "ApiGatewayUrl",
    });
  }
}
