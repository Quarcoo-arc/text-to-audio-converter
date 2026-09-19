export type ConversionStatus = "queued" | "processing" | "completed" | "failed";

export interface ConversionRecord {
  conversionId: string;
  fileName: string;
  status: ConversionStatus;
  createdAt: string; // ISO 8601
  completedAt?: string; // ISO 8601
}

export interface RequestUploadResponse {
  conversionId: string;
  uploadUrl: string;
}
