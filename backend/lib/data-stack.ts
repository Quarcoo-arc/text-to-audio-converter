import { CfnOutput, RemovalPolicy, Stack, StackProps } from "aws-cdk-lib";
import { Construct } from "constructs";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";

export class DataStack extends Stack {
  public readonly bucket: s3.IBucket;
  public readonly table: dynamodb.ITable;

  constructor(scope: Construct, id: string, props?: StackProps) {
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
      removalPolicy: RemovalPolicy.DESTROY, // Change this in production
    });

    new CfnOutput(this, "AloudDocumentTableName", {
      value: this.table.tableName,
      description: "The name of the DynamoDB table for document storage",
    });
  }
}
