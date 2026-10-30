import { mockClient } from "aws-sdk-client-mock";
import { DynamoDBDocumentClient, PutCommand } from "@aws-sdk/lib-dynamodb";
import type { APIGatewayProxyEvent } from "aws-lambda";

process.env.BUCKET_NAME = "test-bucket";
process.env.TABLE_NAME = "test-table";

jest.mock("@aws-sdk/s3-request-presigner", () => ({
  getSignedUrl: jest
    .fn()
    .mockResolvedValue("https://example-bucket.s3.amazonaws.com/signed"),
}));

import { handler } from "../../src/handlers/get-signed-url";

const ddbMock = mockClient(DynamoDBDocumentClient);

beforeEach(() => {
  ddbMock.reset();
  ddbMock.on(PutCommand).resolves({});
});

const USER_SUB = "user-abc-123";

function event(body: Record<string, unknown> | null): APIGatewayProxyEvent {
  return {
    body: body === null ? null : JSON.stringify(body),
    requestContext: {
      authorizer: {
        claims: { sub: USER_SUB, email: "reader@example.com" },
      },
    },
  } as unknown as APIGatewayProxyEvent;
}

describe("get-signed-url handler", () => {
  test("400s when fileName or contentType is missing", async () => {
    const res = await handler(event({ fileName: "report.pdf" }));
    expect(res.statusCode).toBe(400);
  });

  test("400s for a content type outside the allowlist", async () => {
    const res = await handler(
      event({
        fileName: "report.exe",
        contentType: "application/x-msdownload",
      }),
    );
    expect(res.statusCode).toBe(400);
  });

  test("401s when the request has no authenticated caller", async () => {
    const unauthenticated = {
      body: JSON.stringify({
        fileName: "report.pdf",
        contentType: "application/pdf",
      }),
      requestContext: { authorizer: {} },
    } as unknown as APIGatewayProxyEvent;

    const res = await handler(unauthenticated);
    expect(res.statusCode).toBe(401);
  });

  test("returns a presigned upload URL and conversion ID, and records the conversion as queued", async () => {
    const res = await handler(
      event({ fileName: "report.pdf", contentType: "application/pdf" }),
    );

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.uploadUrl).toBe(
      "https://example-bucket.s3.amazonaws.com/signed",
    );
    expect(typeof body.conversionId).toBe("string");

    const puts = ddbMock.commandCalls(PutCommand);
    expect(puts).toHaveLength(1);
    const item = puts[0].args[0].input.Item as Record<string, unknown>;
    expect(item.PK).toBe(`USER#${USER_SUB}`);
    expect(item.SK).toBe(`CONVERSION#${body.conversionId}`);
    expect(item.status).toBe("queued");
    expect(item.userEmail).toBe("reader@example.com");
    expect(item.sourceKey).toBe(
      `uploads/${USER_SUB}/${body.conversionId}/report.pdf`,
    );
  });

  test("sanitizes every slash in fileName, not just the first", async () => {
    const res = await handler(
      event({ fileName: "a/b/report.pdf", contentType: "application/pdf" }),
    );
    const body = JSON.parse(res.body);
    const item = ddbMock.commandCalls(PutCommand)[0].args[0].input
      .Item as Record<string, unknown>;

    const sanitizedFileNameSegment = (item.sourceKey as string).slice(
      `uploads/${USER_SUB}/${body.conversionId}/`.length,
    );
    expect(sanitizedFileNameSegment).not.toContain("/");
  });
});
