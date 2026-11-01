import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";

const TABLE_NAME = process.env.TABLE_NAME!;

const dynamoDbClient = new DynamoDBClient({});
const dynamoDocClient = DynamoDBDocumentClient.from(dynamoDbClient);

export const handler = async (
  event: APIGatewayProxyEvent,
): Promise<APIGatewayProxyResult> => {
  try {
    const userSub: string = event.requestContext.authorizer?.claims?.sub!;

    if (!TABLE_NAME) {
      throw new Error(
        "DynamoDB Table name missing from environment variables.",
      );
    }

    const getCommand = new QueryCommand({
      TableName: TABLE_NAME,
      KeyConditionExpression: "PK = :pk AND begins_with(SK, :skPrefix)",
      ExpressionAttributeValues: {
        ":pk": `USER#${userSub}`,
        ":skPrefix": "CONVERSION#",
      },
      ScanIndexForward: false, // newest first / descending order
      ProjectionExpression:
        "conversionId, fileName, #status, createdAt, completedAt, errorMessage",
      ExpressionAttributeNames: {
        "#status": "status",
      },
    });

    const result = await dynamoDocClient.send(getCommand);

    return {
      statusCode: 200,
      headers: { "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify(result.Items || []),
    };
  } catch (error: any) {
    console.error("Error retrieving conversions:", error);
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
