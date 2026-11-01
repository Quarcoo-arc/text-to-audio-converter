import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand } from "@aws-sdk/lib-dynamodb";
import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import * as s3 from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const s3Client = new s3.S3Client({});
const BUCKET_NAME = process.env.BUCKET_NAME!;
const TABLE_NAME = process.env.TABLE_NAME!;

const dynamoDbClient = new DynamoDBClient({});
const dynamoDocClient = DynamoDBDocumentClient.from(dynamoDbClient);

export const handler = async (
  event: APIGatewayProxyEvent,
): Promise<APIGatewayProxyResult> => {
  try {
    const userSub: string = event.requestContext.authorizer?.claims?.sub!;
    const conversionId: string = event.pathParameters?.conversionId!;

    const getItemCommand = new GetCommand({
      TableName: TABLE_NAME,
      Key: {
        PK: `USER#${userSub}`,
        SK: `CONVERSION#${conversionId}`,
      },
      ProjectionExpression: "audioKey, #status, createdAt, updatedAt",
      ExpressionAttributeNames: {
        "#status": "status",
      },
    });

    const getItemResult = await dynamoDocClient.send(getItemCommand);

    if (!getItemResult.Item?.audioKey) {
      return {
        statusCode: 404,
        headers: { "Access-Control-Allow-Origin": "*" },
        body: JSON.stringify({
          error: "File not found",
        }),
      };
    }
    const getObjectCommand = new s3.GetObjectCommand({
      Bucket: BUCKET_NAME,
      Key: getItemResult.Item.audioKey,
    });

    const downloadUrl = await getSignedUrl(s3Client, getObjectCommand, {
      expiresIn: 3600,
    });

    return {
      statusCode: 200,
      headers: { "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({
        downloadUrl,
      }),
    };
  } catch (error: any) {
    console.log("Error generating download link: ", error);
    return {
      statusCode: 500,
      headers: { "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({
        error: "Internal Server Error",
        message: error.message,
      }),
    };
  }
};
