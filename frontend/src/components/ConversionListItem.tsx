import type { ConversionRecord } from "../api/types";
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

export function ConversionListItem({ record }: { record: ConversionRecord }) {
  const isProcessing = record.status === "processing";
  const isFailed = record.status === "failed";
  const isCompleted = record.status === "completed";

  return (
    <li className="flex items-center justify-between gap-4 border-t border-line py-4 first:border-t-0">
      <div className="min-w-0">
        <p className="truncate text-sm text-ink">{record.fileName}</p>
        <p className="mt-0.5 text-xs text-ink-soft">
          {formatDate(record.createdAt)}
        </p>
      </div>

      <div
        className={
          "flex shrink-0 items-center gap-2 text-sm " +
          (isFailed
            ? "text-error"
            : isCompleted
              ? "text-signal"
              : "text-ink-soft")
        }
      >
        {isProcessing && <Waveform active className="h-3" />}
        {STATUS_COPY[record.status]}
      </div>
    </li>
  );
}
