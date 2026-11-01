import { mockClient } from "aws-sdk-client-mock";
import { DynamoDBDocumentClient, GetCommand } from "@aws-sdk/lib-dynamodb";
import type { APIGatewayProxyEvent } from "aws-lambda";

process.env.BUCKET_NAME = "test-bucket";
process.env.TABLE_NAME = "test-table";

const getSignedUrlMock = jest
  .fn()
  .mockResolvedValue("https://example-bucket.s3.amazonaws.com/signed-get");

jest.mock("@aws-sdk/s3-request-presigner", () => ({
  getSignedUrl: getSignedUrlMock,
}));

import { handler } from "../../src/handlers/get-download-url";

const ddbMock = mockClient(DynamoDBDocumentClient);

beforeEach(() => {
  ddbMock.reset();
  getSignedUrlMock.mockClear();
});

const USER_SUB = "user-abc-123";
const CONVERSION_ID = "01HXYZ0000000000000000CONV";
const AUDIO_KEY = `audio/${USER_SUB}/${CONVERSION_ID}.task-id.mp3`;

function event(
  conversionId: string | undefined,
  sub: string | undefined = USER_SUB,
): APIGatewayProxyEvent {
  return {
    pathParameters: conversionId ? { conversionId } : {},
    requestContext: {
      authorizer: sub ? { claims: { sub } } : {},
    },
  } as unknown as APIGatewayProxyEvent;
}

describe("get-download-url handler", () => {
  test("returns a presigned GET URL scoped to the audioKey on the caller's own conversion record", async () => {
    ddbMock.on(GetCommand).resolves({
      Item: { audioKey: AUDIO_KEY, status: "completed" },
    });

    const res = await handler(event(CONVERSION_ID));

    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body)).toEqual({
      downloadUrl: "https://example-bucket.s3.amazonaws.com/signed-get",
    });

    const getCalls = ddbMock.commandCalls(GetCommand);
    expect(getCalls).toHaveLength(1);
    expect(getCalls[0].args[0].input.Key).toEqual({
      PK: `USER#${USER_SUB}`,
      SK: `CONVERSION#${CONVERSION_ID}`,
    });

    const presignedCall = getSignedUrlMock.mock.calls[0];
    expect(presignedCall[1].input).toEqual({
      Bucket: "test-bucket",
      Key: AUDIO_KEY,
    });
  });

  test("looks up the record under the authenticated caller's own PK, not a caller-supplied one", async () => {
    // The partition key comes from the Cognito authorizer claims, so a
    // signed-in user can never fetch another user's audioKey by guessing or
    // passing someone else's conversionId in the path.
    ddbMock.on(GetCommand).resolves({});

    await handler(event(CONVERSION_ID, "attacker-sub"));

    const getCalls = ddbMock.commandCalls(GetCommand);
    expect(getCalls[0].args[0].input.Key).toEqual({
      PK: "USER#attacker-sub",
      SK: `CONVERSION#${CONVERSION_ID}`,
    });
  });

  test("404s when the conversion record has no audioKey yet", async () => {
    ddbMock.on(GetCommand).resolves({ Item: { status: "processing" } });

    const res = await handler(event(CONVERSION_ID));

    expect(res.statusCode).toBe(404);
    expect(getSignedUrlMock).not.toHaveBeenCalled();
  });

  test("404s when no conversion record exists for that PK/SK pair", async () => {
    ddbMock.on(GetCommand).resolves({});

    const res = await handler(event(CONVERSION_ID));

    expect(res.statusCode).toBe(404);
    expect(getSignedUrlMock).not.toHaveBeenCalled();
  });

  test("500s when DynamoDB fails", async () => {
    ddbMock.on(GetCommand).rejects(new Error("DynamoDB is down"));

    const res = await handler(event(CONVERSION_ID));

    expect(res.statusCode).toBe(500);
  });
});
