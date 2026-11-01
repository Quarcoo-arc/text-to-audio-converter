import { http, HttpResponse, delay } from "msw";
import type { ConversionRecord } from "../api/types";

// In-memory stand-in for the DynamoDB conversion records the real backend
// would track. Reset on every page load.
let conversions: ConversionRecord[] = [];

const PROCESSING_AFTER_MS = 1200;
const COMPLETED_AFTER_MS = 4000;

function scheduleProgress(conversionId: string) {
  setTimeout(() => {
    const record = conversions.find((c) => c.conversionId === conversionId);
    if (record) record.status = "processing";
  }, PROCESSING_AFTER_MS);

  setTimeout(() => {
    const record = conversions.find((c) => c.conversionId === conversionId);
    if (record) {
      record.status = "completed";
      record.completedAt = new Date().toISOString();
    }
  }, COMPLETED_AFTER_MS);
}

export const handlers = [
  http.post("/uploads", async ({ request }) => {
    const body = (await request.json()) as {
      fileName: string;
      contentType: string;
    };
    await delay(300);

    const conversionId = crypto.randomUUID();
    conversions = [
      {
        conversionId,
        fileName: body.fileName,
        status: "queued",
        createdAt: new Date().toISOString(),
      },
      ...conversions,
    ];

    return HttpResponse.json({
      conversionId,
      uploadUrl: `/mock-upload/${conversionId}`,
    });
  }),

  // Stands in for a presigned S3 PUT URL.
  http.put("/mock-upload/:conversionId", async ({ params }) => {
    await delay(600);
    scheduleProgress(params.conversionId as string);
    return new HttpResponse(null, { status: 200 });
  }),

  http.get("/conversions", async () => {
    await delay(200);
    return HttpResponse.json(conversions);
  }),

  // Stands in for a backend endpoint that checks the caller's own
  // Cognito sub against the conversion record's owner, then hand back a
  // short-lived presigned S3 GET URL. See frontend/README.md.
  http.get("/conversions/:conversionId/download", async ({ params }) => {
    await delay(250);
    return HttpResponse.json({
      downloadUrl: `/mock-audio/${params.conversionId}.mp3`,
    });
  }),

  // Stands in for the presigned S3 URL itself - a tiny placeholder "audio"
  // file so the download button has something real to save in mock mode.
  http.get("/mock-audio/:file", async () => {
    await delay(150);
    return new HttpResponse(new Uint8Array([0x49, 0x44, 0x33, 0x03]), {
      headers: { "Content-Type": "audio/mpeg" },
    });
  }),
];
