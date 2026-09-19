interface UploadProgressProps {
  fileName: string;
  fraction: number;
  label: string;
}

export function UploadProgress({
  fileName,
  fraction,
  label,
}: UploadProgressProps) {
  return (
    <div className="w-full text-left">
      <p className="truncate text-sm font-medium text-ink">{fileName}</p>
      <p className="mt-1 text-xs text-ink-soft">{label}</p>
      <div className="mt-3 h-0.75 w-full overflow-hidden rounded-full bg-line">
        <div
          className="h-full rounded-full bg-signal transition-[width] duration-300 ease-out"
          style={{ width: `${Math.max(6, Math.round(fraction * 100))}%` }}
        />
      </div>
    </div>
  );
}
