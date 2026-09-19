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
];
