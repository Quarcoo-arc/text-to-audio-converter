import { S3Event } from "aws-lambda";
import * as dynamodb from "@aws-sdk/client-dynamodb";
import { GetCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { SendEmailCommand, SESv2Client } from "@aws-sdk/client-sesv2";

const TABLE_NAME = process.env.TABLE_NAME!;
const SES_FROM_EMAIL = process.env.SES_FROM_EMAIL!;
const FRONTEND_BASE_URL = process.env.FRONTEND_BASE_URL!;

const dynamodbClient = new dynamodb.DynamoDBClient({});
const dynamodbDocClient = DynamoDBDocumentClient.from(dynamodbClient);

const sesClient = new SESv2Client({});

export const handler = async (event: S3Event) => {
  const objectKey = event.Records[0].s3.object.key;
  const objectKeyParts = objectKey.split("/");
  const userSub = objectKeyParts[1];
  const fileName = objectKeyParts[2];
  const [ulid, ..._] = fileName.split(".");

  try {
    const dynamodbGetCommand = new GetCommand({
      TableName: TABLE_NAME,
      Key: {
        PK: `USER#${userSub}`,
        SK: `CONVERSION#${ulid}`,
      },
      ProjectionExpression:
        "userEmail, sourceKey, #status, createdAt, updatedAt",
      ExpressionAttributeNames: {
        "#status": "status",
      },
    });

    const dynamodbGetResponse =
      await dynamodbDocClient.send(dynamodbGetCommand);

    if (!dynamodbGetResponse.Item) {
      throw new Error("Conversion record not found");
    }

    if (!dynamodbGetResponse.Item.userEmail) {
      throw new Error("User email not found");
    }

    const documentName = dynamodbGetResponse.Item.sourceKey.split("/").at(-1);

    // Send email
    const sendEmailCommand = new SendEmailCommand({
      FromEmailAddress: SES_FROM_EMAIL,
      Destination: {
        ToAddresses: [dynamodbGetResponse.Item.userEmail],
      },
      Content: {
        Simple: {
          Subject: {
            Data: "Your Aloud Audio File Is Ready For Download",
            Charset: "UTF-8",
          },
          Body: {
            Html: {
              Data: `
                <h1>Hi there 👋</h1>
                <br/>
                <br/>
                <p>Your document named <strong>${documentName}</strong> was successfully converted into audio ♪♪♪</p>
                <br/>
                <a href="${FRONTEND_BASE_URL}/${ulid}">Check it out on Aloud</a>
                `,
              Charset: "UTF-8",
            },
          },
        },
      },
    });

    await sesClient.send(sendEmailCommand);
  } catch (error) {
    console.error("Failed to send audio completion email: ", error);

    const updateCommand = new UpdateCommand({
      TableName: TABLE_NAME,
      Key: {
        PK: `USER#${userSub}`,
        SK: `CONVERSION#${ulid}`,
      },
      UpdateExpression:
        "SET #errorMessage = :errorMessage, #updatedAt = :updatedAt",
      ExpressionAttributeNames: {
        "#errorMessage": "errorMessage",
        "#updatedAt": "updatedAt",
      },
      ExpressionAttributeValues: {
        ":errorMessage": "Failed to send audio completion email",
        ":updatedAt": new Date().toISOString(),
      },
    });

    await dynamodbDocClient.send(updateCommand);
  }
};
