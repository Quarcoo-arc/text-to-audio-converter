import { apiBaseUrl } from "../config";
import type { ConversionRecord, RequestUploadResponse } from "./types";

const base = apiBaseUrl ?? "";

class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

async function request<T>(
  path: string,
  token: string,
  init?: RequestInit,
): Promise<T> {
  const res = await fetch(`${base}${path}`, {
    ...init,
    headers: {
      ...init?.headers,
      Authorization: `Bearer ${token}`,
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
    },
  });

  if (!res.ok) {
    throw new ApiError(
      `${init?.method ?? "GET"} ${path} failed with ${res.status}`,
      res.status,
    );
  }

  return (await res.json()) as T;
}

export function requestUploadUrl(
  file: File,
  token: string,
): Promise<RequestUploadResponse> {
  return request<RequestUploadResponse>("/uploads", token, {
    method: "POST",
    body: JSON.stringify({ fileName: file.name, contentType: file.type }),
  });
}

export function listConversions(token: string): Promise<ConversionRecord[]> {
  return request<ConversionRecord[]>("/conversions", token);
}

/**
 * Uploads the file bytes directly to the presigned S3 URL returned by
 * `requestUploadUrl`. Uses XHR (not fetch) so upload progress can be
 * reported back to the caller.
 */
export function putToPresignedUrl(
  uploadUrl: string,
  file: File,
  onProgress: (fraction: number) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", uploadUrl);
    xhr.setRequestHeader("Content-Type", file.type);
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        onProgress(event.loaded / event.total);
      }
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve();
      } else {
        reject(new ApiError(`Upload failed with ${xhr.status}`, xhr.status));
      }
    };
    xhr.onerror = () => reject(new ApiError("Upload failed", 0));
    xhr.send(file);
  });
}

export { ApiError };
