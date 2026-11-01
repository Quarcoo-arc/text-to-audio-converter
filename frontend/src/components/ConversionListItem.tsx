import { useState } from "react";
import type { ConversionRecord } from "../api/types";
import { getDownloadUrl } from "../api/client";
import { useAuth } from "../auth/useAuth";
import { Waveform } from "./Waveform";

const STATUS_COPY: Record<ConversionRecord["status"], string> = {
  queued: "Queued",
  processing: "Converting…",
  completed: "Emailed",
  failed: "Couldn't convert",
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

/** Triggers a browser download/save from a URL without navigating away. */
function triggerDownload(url: string, suggestedName: string) {
  const link = document.createElement("a");
  link.href = url;
  link.download = suggestedName;
  link.rel = "noopener";
  document.body.appendChild(link);
  link.click();
  link.remove();
}

function audioFileName(sourceFileName: string) {
  return sourceFileName.replace(/\.[^.]+$/, ".mp3");
}

export function ConversionListItem({ record }: { record: ConversionRecord }) {
  const { idToken } = useAuth();
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState(false);

  const isProcessing = record.status === "processing";
  const isFailed = record.status === "failed";
  const isCompleted = record.status === "completed";

  async function handleDownload() {
    if (!idToken || isDownloading) return;
    setIsDownloading(true);
    setDownloadError(false);
    try {
      const { downloadUrl } = await getDownloadUrl(
        record.conversionId,
        idToken,
      );

      const audioResponse = await fetch(downloadUrl);
      if (!audioResponse.ok) {
        throw new Error(`Download link failed with ${audioResponse.status}`);
      }

      const blob = await audioResponse.blob();
      const objectUrl = URL.createObjectURL(blob);
      triggerDownload(objectUrl, audioFileName(record.fileName));
      setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
    } catch {
      setDownloadError(true);
    } finally {
      setIsDownloading(false);
    }
  }

  return (
    <li className="flex items-center justify-between gap-4 border-t border-line py-4 first:border-t-0">
      <div className="min-w-0">
        <p className="truncate text-sm text-ink">{record.fileName}</p>
        <p className="mt-0.5 text-xs text-ink-soft">
          {formatDate(record.createdAt)}
        </p>
      </div>

      {isCompleted ? (
        <div className="flex shrink-0 flex-col items-end gap-1">
          <button
            type="button"
            onClick={handleDownload}
            disabled={isDownloading}
            className="text-sm font-medium text-signal underline-offset-2 hover:underline disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isDownloading ? "Preparing…" : "Download"}
          </button>
          {downloadError && (
            <p className="text-xs text-error">Couldn't get the file</p>
          )}
        </div>
      ) : (
        <div
          className={
            "flex shrink-0 items-center gap-2 text-sm " +
            (isFailed ? "text-error" : "text-ink-soft")
          }
        >
          {isProcessing && <Waveform active className="h-3" />}
          {STATUS_COPY[record.status]}
        </div>
      )}
    </li>
  );
}
