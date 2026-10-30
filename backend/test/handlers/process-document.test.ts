import { Readable } from "stream";
import { mockClient } from "aws-sdk-client-mock";
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import {
  PollyClient,
  StartSpeechSynthesisTaskCommand,
} from "@aws-sdk/client-polly";
import { DynamoDBDocumentClient, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import type { S3Event } from "aws-lambda";

process.env.BUCKET_NAME = "test-bucket";
process.env.TABLE_NAME = "test-table";

import { handler } from "../../src/handlers/process-document";

const s3Mock = mockClient(S3Client);
const pollyMock = mockClient(PollyClient);
const ddbMock = mockClient(DynamoDBDocumentClient);

beforeEach(() => {
  s3Mock.reset();
  pollyMock.reset();
  ddbMock.reset();
  ddbMock.on(UpdateCommand).resolves({});
});

const USER_SUB = "user-abc-123";
const CONVERSION_ID = "01HXYZ0000000000000000CONV";
const TASK_ID = "11111111-2222-3333-4444-555555555555";

function s3Event(key: string): S3Event {
  return {
    Records: [{ s3: { object: { key } } } as unknown],
  } as S3Event;
}

describe("process-document handler", () => {
  test("marks the conversion processing, then completed, for a plain-text document", async () => {
    s3Mock.on(GetObjectCommand).resolves({
      ContentType: "text/plain",
      Body: Readable.from([Buffer.from("hello world")]) as never,
    });
    pollyMock.on(StartSpeechSynthesisTaskCommand).resolves({
      SynthesisTask: { TaskId: TASK_ID },
    });

    await handler(s3Event(`uploads/${USER_SUB}/${CONVERSION_ID}/notes.txt`));

    const updates = ddbMock.commandCalls(UpdateCommand);
    expect(updates.length).toBeGreaterThanOrEqual(2);

    const firstUpdate = updates[0].args[0].input.ExpressionAttributeValues!;
    expect(firstUpdate[":status"]).toBe("processing");

    const lastUpdate =
      updates[updates.length - 1].args[0].input.ExpressionAttributeValues!;
    expect(lastUpdate[":status"]).toBe("completed");

    expect(lastUpdate[":audioKey"]).toBe(
      `audio/${USER_SUB}/${CONVERSION_ID}.${TASK_ID}.mp3`,
    );

    const pollyCalls = pollyMock.commandCalls(StartSpeechSynthesisTaskCommand);
    expect(pollyCalls).toHaveLength(1);
    expect(pollyCalls[0].args[0].input.Text).toBe("hello world");
  });

  test("marks the conversion failed for an unsupported content type", async () => {
    s3Mock.on(GetObjectCommand).resolves({
      ContentType: "image/png",
      Body: Readable.from([Buffer.from("not a document")]) as never,
    });

    await handler(s3Event(`uploads/${USER_SUB}/${CONVERSION_ID}/photo.png`));

    expect(
      pollyMock.commandCalls(StartSpeechSynthesisTaskCommand),
    ).toHaveLength(0);

    const updates = ddbMock.commandCalls(UpdateCommand);
    const lastUpdate =
      updates[updates.length - 1].args[0].input.ExpressionAttributeValues!;
    expect(lastUpdate[":status"]).toBe("failed");
  });

  test("marks the conversion failed when Polly synthesis fails", async () => {
    s3Mock.on(GetObjectCommand).resolves({
      ContentType: "text/plain",
      Body: Readable.from([Buffer.from("hello world")]) as never,
    });
    pollyMock
      .on(StartSpeechSynthesisTaskCommand)
      .rejects(new Error("Polly is down"));

    await handler(s3Event(`uploads/${USER_SUB}/${CONVERSION_ID}/notes.txt`));

    const updates = ddbMock.commandCalls(UpdateCommand);
    const lastUpdate =
      updates[updates.length - 1].args[0].input.ExpressionAttributeValues!;
    expect(lastUpdate[":status"]).toBe("failed");
  });
});
