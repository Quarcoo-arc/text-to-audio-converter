import { mockClient } from "aws-sdk-client-mock";
import {
  DynamoDBDocumentClient,
  GetCommand,
  UpdateCommand,
} from "@aws-sdk/lib-dynamodb";
import { SendEmailCommand, SESv2Client } from "@aws-sdk/client-sesv2";
import type { S3Event } from "aws-lambda";

process.env.TABLE_NAME = "test-table";
process.env.SES_FROM_EMAIL = "sender@example.com";
process.env.FRONTEND_BASE_URL = "http://localhost:5173";

// Imported after the env vars above are set, since the handler module reads
// them at import time.
import { handler } from "../../src/handlers/send-audio";

const ddbMock = mockClient(DynamoDBDocumentClient);
const sesMock = mockClient(SESv2Client);

beforeEach(() => {
  ddbMock.reset();
  sesMock.reset();
});

const USER_SUB = "user-abc-123";
const CONVERSION_ID = "01HXYZ0000000000000000CONV";
const TASK_ID = "11111111-2222-3333-4444-555555555555";

function s3Event(objectKey: string): S3Event {
  return {
    Records: [{ s3: { object: { key: objectKey } } } as unknown],
  } as S3Event;
}

describe("send-audio handler", () => {
  test("finds the conversion record and emails the user, for the real key shape Polly actually writes", async () => {
    // A StartSpeechSynthesisTask with an OutputS3KeyPrefix of "audio/<userSub>/<conversionId>"
    // (no trailing slash) produces an output object at "<prefix>.<taskId>.<format>".
    const realPollyOutputKey = `audio/${USER_SUB}/${CONVERSION_ID}.${TASK_ID}.mp3`;

    ddbMock
      .on(GetCommand, {
        TableName: "test-table",
        Key: { PK: `USER#${USER_SUB}`, SK: `CONVERSION#${CONVERSION_ID}` },
      })
      .resolves({
        Item: {
          userEmail: "reader@example.com",
          sourceKey: `uploads/${USER_SUB}/${CONVERSION_ID}/report.pdf`,
        },
      });
    sesMock.on(SendEmailCommand).resolves({ MessageId: "msg-1" });

    await handler(s3Event(realPollyOutputKey));

    const calls = sesMock.commandCalls(SendEmailCommand);
    expect(calls).toHaveLength(1);
    const input = calls[0].args[0].input;
    expect(input.Destination?.ToAddresses).toEqual(["reader@example.com"]);
    expect(input.Content?.Simple?.Body?.Html?.Data).toContain("report.pdf");
    expect(input.Content?.Simple?.Body?.Html?.Data).toContain(
      "http://localhost:5173",
    );
  });

  test("records an errorMessage instead of throwing when no matching conversion record exists", async () => {
    ddbMock.on(GetCommand).resolves({}); // no Item, regardless of key
    ddbMock.on(UpdateCommand).resolves({});

    await handler(s3Event(`audio/${USER_SUB}/${CONVERSION_ID}.${TASK_ID}.mp3`));

    expect(sesMock.commandCalls(SendEmailCommand)).toHaveLength(0);
    const updateCalls = ddbMock.commandCalls(UpdateCommand);
    expect(updateCalls).toHaveLength(1);
    expect(updateCalls[0].args[0].input.ExpressionAttributeValues).toEqual(
      expect.objectContaining({
        ":errorMessage": "Failed to send audio completion email",
      }),
    );
  });

  test("records an errorMessage instead of throwing when the record has no userEmail", async () => {
    ddbMock.on(GetCommand).resolves({
      Item: { sourceKey: `uploads/${USER_SUB}/${CONVERSION_ID}/report.pdf` },
    });
    ddbMock.on(UpdateCommand).resolves({});

    await handler(s3Event(`audio/${USER_SUB}/${CONVERSION_ID}.${TASK_ID}.mp3`));

    expect(sesMock.commandCalls(SendEmailCommand)).toHaveLength(0);
    expect(ddbMock.commandCalls(UpdateCommand)).toHaveLength(1);
  });
});
