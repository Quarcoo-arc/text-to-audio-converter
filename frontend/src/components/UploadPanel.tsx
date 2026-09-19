import clsx from "clsx";
import { useRef, useState } from "react";
import { upload } from "../config";
import type { UploadStatus } from "../hooks/useUpload";
import { validateUpload } from "../lib/validateUpload";
import { UploadProgress } from "./UploadProgress";
import { Waveform } from "./Waveform";

interface UploadPanelProps {
  onFileSelected: (file: File) => void;
  status: UploadStatus;
  progress: number;
  error: string | null;
  onReset: () => void;
}

export function UploadPanel({
  onFileSelected,
  status,
  progress,
  error,
  onReset,
}: UploadPanelProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [fileName, setFileName] = useState("");

  function handleFiles(files: FileList | null) {
    const file = files?.[0];
    if (!file) return;

    const validationError = validateUpload(file);
    if (validationError) {
      setLocalError(validationError);
      return;
    }

    setLocalError(null);
    setFileName(file.name);
    onFileSelected(file);
  }

  const isBusy = status === "requesting" || status === "uploading";

  if (isBusy) {
    return (
      <div className="rounded-lg border border-line px-8 py-10">
        <UploadProgress
          fileName={fileName}
          fraction={progress}
          label={
            status === "requesting" ? "Preparing upload…" : "Uploading…"
          }
        />
      </div>
    );
  }

  if (status === "done") {
    return (
      <div className="rounded-lg border border-line px-8 py-10 text-left">
        <p className="text-sm font-medium text-ink">{fileName}</p>
        <p className="mt-1 text-sm text-ink-soft">
          Uploaded. We'll email the audio to you when it's ready.
        </p>
        <button
          type="button"
          onClick={onReset}
          className="mt-4 text-sm font-medium text-signal underline underline-offset-4"
        >
          Convert another document
        </button>
      </div>
    );
  }

  const displayError = error ?? localError;

  return (
    <div>
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setIsDragging(false);
          handleFiles(e.dataTransfer.files);
        }}
        className={clsx(
          "flex w-full flex-col items-center gap-2 rounded-lg border border-dashed px-8 py-12 text-center transition-colors",
          isDragging
            ? "border-signal bg-signal/5"
            : "border-line hover:border-ink-soft",
        )}
      >
        <Waveform className="text-ink-soft" />
        <p className="mt-2 text-sm text-ink">
          Drop a document here, or{" "}
          <span className="text-signal">choose a file</span>
        </p>
        <p className="text-xs text-ink-soft">PDF, DOCX, or TXT — up to 20MB</p>
      </button>
      <input
        ref={inputRef}
        type="file"
        accept={upload.acceptedExtensions.join(",")}
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />
      {displayError && (
        <p className="mt-3 text-sm text-error">{displayError}</p>
      )}
    </div>
  );
}
