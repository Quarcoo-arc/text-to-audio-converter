import { mockClient } from "aws-sdk-client-mock";
import { DynamoDBDocumentClient, QueryCommand } from "@aws-sdk/lib-dynamodb";
import type { APIGatewayProxyEvent } from "aws-lambda";

process.env.TABLE_NAME = "test-table";

import { handler } from "../../src/handlers/get-conversions";

const ddbMock = mockClient(DynamoDBDocumentClient);

beforeEach(() => {
  ddbMock.reset();
});

const USER_SUB = "user-abc-123";

function event(): APIGatewayProxyEvent {
  return {
    requestContext: { authorizer: { claims: { sub: USER_SUB } } },
  } as unknown as APIGatewayProxyEvent;
}

describe("get-conversions handler", () => {
  test("queries only the caller's own records, newest first, and returns a bare array", async () => {
    const records = [
      {
        conversionId: "b",
        fileName: "two.pdf",
        status: "completed",
        createdAt: "2026-01-02",
      },
      {
        conversionId: "a",
        fileName: "one.pdf",
        status: "queued",
        createdAt: "2026-01-01",
      },
    ];
    ddbMock.on(QueryCommand).resolves({ Items: records });

    const res = await handler(event());

    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body)).toEqual(records);

    const calls = ddbMock.commandCalls(QueryCommand);
    expect(calls).toHaveLength(1);
    const input = calls[0].args[0].input;
    expect(input.ExpressionAttributeValues).toEqual({
      ":pk": `USER#${USER_SUB}`,
      ":skPrefix": "CONVERSION#",
    });
    expect(input.ScanIndexForward).toBe(false);
  });

  test("returns an empty array, not an error, when the user has no conversions", async () => {
    ddbMock.on(QueryCommand).resolves({});

    const res = await handler(event());

    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body)).toEqual([]);
  });

  test("500s with an error body when the query fails", async () => {
    ddbMock.on(QueryCommand).rejects(new Error("table not found"));

    const res = await handler(event());

    expect(res.statusCode).toBe(500);
    expect(JSON.parse(res.body).message).toBe("table not found");
  });
});
