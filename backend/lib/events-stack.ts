import { Stack, StackProps } from "aws-cdk-lib";
import { Construct } from "constructs";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as s3n from "aws-cdk-lib/aws-s3-notifications";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import { NodejsFunction } from "aws-cdk-lib/aws-lambda-nodejs";
import { Runtime } from "aws-cdk-lib/aws-lambda";
import path from "path";

interface EventsStackProps extends StackProps {
  bucket: s3.IBucket;
  table: dynamodb.ITable;
}

export class EventsStack extends Stack {
  constructor(scope: Construct, id: string, props: EventsStackProps) {
    super(scope, id, props);

    const documentProcessingHandler = new NodejsFunction(
      this,
      "AloudDocumentProcessingHandler",
      {
        runtime: Runtime.NODEJS_24_X,
        entry: path.join(__dirname, "../src/handlers/get-signed-url.ts"),
        handler: "handler",
        environment: {
          BUCKET_NAME: props.bucket.bucketName,
          TABLE_NAME: props.table.tableName,
        },
      },
    );

    props.bucket.addObjectCreatedNotification(
      new s3n.LambdaDestination(documentProcessingHandler),
      {
        prefix: "uploads/",
      },
    );
  }
}
