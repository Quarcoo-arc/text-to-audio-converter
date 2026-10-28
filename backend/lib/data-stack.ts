import {
  CfnOutput,
  Duration,
  RemovalPolicy,
  Stack,
  StackProps,
} from "aws-cdk-lib";
import { Construct } from "constructs";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as s3n from "aws-cdk-lib/aws-s3-notifications";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import { NodejsFunction } from "aws-cdk-lib/aws-lambda-nodejs";
import { Runtime } from "aws-cdk-lib/aws-lambda";
import path from "path";
import { PolicyStatement } from "aws-cdk-lib/aws-iam";

interface DataStackProps extends StackProps {
  sesFromEmail: string;
  frontendBaseUrl: string;
}

export class DataStack extends Stack {
  public readonly bucket: s3.IBucket;
  public readonly table: dynamodb.ITable;

  constructor(scope: Construct, id: string, props: DataStackProps) {
    super(scope, id, props);

    this.bucket = new s3.Bucket(this, "AloudDocumentUploadBucket", {
      encryption: s3.BucketEncryption.S3_MANAGED,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      removalPolicy: RemovalPolicy.DESTROY, // Change this in production
      autoDeleteObjects: true, // Delete files when stack is destroyed
      cors: [
        {
          allowedMethods: [s3.HttpMethods.PUT],
          allowedOrigins: ["*"],
          allowedHeaders: ["*"],
        },
      ],
    });

    new CfnOutput(this, "AloudDocumentUploadBucketName", {
      value: this.bucket.bucketName,
      description: "The name of the S3 bucket for document uploads",
    });

    // DynamoDB table
    this.table = new dynamodb.Table(this, "AloudDocumentTable", {
      partitionKey: { name: "PK", type: dynamodb.AttributeType.STRING },
      sortKey: { name: "SK", type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: RemovalPolicy.DESTROY, // Change this in production
    });

    new CfnOutput(this, "AloudDocumentTableName", {
      value: this.table.tableName,
      description: "The name of the DynamoDB table for document storage",
    });

    this.createDocumentProcessingHandler(this.table, this.bucket);
    this.createAudioDispatchHandler(
      this.table,
      this.bucket,
      props.sesFromEmail,
      props.frontendBaseUrl,
    );
  }

  private createDocumentProcessingHandler(
    table: dynamodb.ITable,
    bucket: s3.IBucket,
  ) {
    const documentProcessingHandler = new NodejsFunction(
      this,
      "AloudDocumentProcessingHandler",
      {
        runtime: Runtime.NODEJS_24_X,
        entry: path.join(__dirname, "../src/handlers/process-document.ts"),
        handler: "handler",
        environment: {
          BUCKET_NAME: bucket.bucketName,
          TABLE_NAME: table.tableName,
        },
        timeout: Duration.minutes(3),
        memorySize: 216,
      },
    );

    documentProcessingHandler.addToRolePolicy(
      new PolicyStatement({
        actions: ["polly:StartSpeechSynthesisTask"],
        resources: ["*"],
      }),
    );

    table.grantReadWriteData(documentProcessingHandler);
    bucket.grantReadWrite(documentProcessingHandler);

    bucket.addObjectCreatedNotification(
      new s3n.LambdaDestination(documentProcessingHandler),
      {
        prefix: "uploads/",
      },
    );
  }

  private createAudioDispatchHandler(
    table: dynamodb.ITable,
    bucket: s3.IBucket,
    sesFromEmail: string,
    frontendBaseUrl: string,
  ) {
    // Add event handler for emailing audios after creation.
    const audioDispatchHandler = new NodejsFunction(
      this,
      "AloudAudioDispatchHandler",
      {
        runtime: Runtime.NODEJS_24_X,
        entry: path.join(__dirname, "../src/handlers/send-audio.ts"),
        handler: "handler",
        environment: {
          TABLE_NAME: table.tableName,
          SES_FROM_EMAIL: sesFromEmail,
          FRONTEND_BASE_URL: frontendBaseUrl,
        },
        timeout: Duration.minutes(2),
      },
    );

    audioDispatchHandler.addToRolePolicy(
      new PolicyStatement({
        actions: ["ses:SendEmail"],
        resources: ["*"],
      }),
    );

    table.grantReadData(audioDispatchHandler);

    bucket.addObjectCreatedNotification(
      new s3n.LambdaDestination(audioDispatchHandler),
      {
        prefix: "audio/",
      },
    );
  }
}
