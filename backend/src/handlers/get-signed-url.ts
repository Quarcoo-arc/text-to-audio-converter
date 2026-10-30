import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { DynamoDBDocumentClient, PutCommand } from "@aws-sdk/lib-dynamodb";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { ulid } from "ulid";
import { ConversionStatus } from "../../config/constants";

const s3Client = new S3Client({});
const BUCKET_NAME = process.env.BUCKET_NAME!;
const TABLE_NAME = process.env.TABLE_NAME!;

const dynamoDbClient = new DynamoDBClient({});
const dynamoDocClient = DynamoDBDocumentClient.from(dynamoDbClient);

export const handler = async (
  event: APIGatewayProxyEvent,
): Promise<APIGatewayProxyResult> => {
  try {
    let body;

    try {
      body = event.body ? JSON.parse(event.body) : {};
    } catch (error) {
      console.error("Error parsing request body:", error);
      return {
        statusCode: 400,
        headers: { "Access-Control-Allow-Origin": "*" },
        body: JSON.stringify({
          error: "Invalid JSON in request body",
        }),
      };
    }

    if (!body.fileName || !body.contentType) {
      return {
        statusCode: 400,
        headers: { "Access-Control-Allow-Origin": "*" },
        body: JSON.stringify({
          error: "Missing required fields: fileName or contentType",
        }),
      };
    }

    const allowedContentTypes = [
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "text/plain",
    ];

    if (!allowedContentTypes.includes(body.contentType)) {
      return {
        statusCode: 400,
        headers: { "Access-Control-Allow-Origin": "*" },
        body: JSON.stringify({
          error: `Invalid content type. Allowed types are: ${allowedContentTypes.join(
            ", ",
          )}`,
        }),
      };
    }

    if (!event.requestContext.authorizer?.claims?.sub) {
      return {
        statusCode: 401,
        headers: { "Access-Control-Allow-Origin": "*" },
        body: JSON.stringify({
          error: "Unauthorized",
        }),
      };
    }

    const fileName: string = body.fileName.replaceAll("/", "-");
    const contentType: string = body.contentType;
    const userSub: string = event.requestContext.authorizer?.claims?.sub!;
    const id = ulid();

    if (!BUCKET_NAME) {
      throw new Error("S3 Bucket name missing from environment variables.");
    }

    const command = new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: `uploads/${userSub}/${id}/${fileName}`,
      ContentType: contentType,
    });

    const putCommand = new PutCommand({
      TableName: TABLE_NAME,
      Item: {
        PK: `USER#${userSub}`,
        SK: `CONVERSION#${id}`,
        conversionId: id,
        userSub,
        userEmail: event.requestContext.authorizer?.claims?.email,
        fileName,
        sourceKey: `uploads/${userSub}/${id}/${fileName}`,
        status: ConversionStatus.QUEUED,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    });

    // Generate a temporary URL valid for 5 minutes (300 seconds)
    const uploadUrl = await getSignedUrl(s3Client, command, { expiresIn: 300 });

    // Store the metadata in DynamoDB
    await dynamoDocClient.send(putCommand);

    return {
      statusCode: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ uploadUrl, conversionId: id }),
    };
  } catch (error: any) {
    console.error("Error generating presigned URL:", error);
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
