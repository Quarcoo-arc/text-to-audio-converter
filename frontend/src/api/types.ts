export type ConversionStatus = "queued" | "processing" | "completed" | "failed";

export interface ConversionRecord {
  conversionId: string;
  fileName: string;
  status: ConversionStatus;
  createdAt: string; // ISO 8601
  completedAt?: string; // ISO 8601
  errorMessage?: string;
}

export interface RequestUploadResponse {
  conversionId: string;
  uploadUrl: string;
}

export interface DownloadUrlResponse {
  downloadUrl: string;
}
