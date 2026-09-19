import { useCallback, useState } from "react";
import { putToPresignedUrl, requestUploadUrl } from "../api/client";
import { useAuth } from "../auth/useAuth";

export type UploadStatus =
  | "idle"
  | "requesting"
  | "uploading"
  | "done"
  | "error";

/** Orchestrates one upload: ask the API for a presigned URL, then PUT the
 * file straight to S3, tracking progress along the way. */
export function useUpload(onUploaded: () => void) {
  const { idToken } = useAuth();
  const [status, setStatus] = useState<UploadStatus>("idle");
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const upload = useCallback(
    async (file: File) => {
      if (!idToken) return;
      setStatus("requesting");
      setError(null);
      setProgress(0);
      try {
        const { uploadUrl } = await requestUploadUrl(file, idToken);
        setStatus("uploading");
        await putToPresignedUrl(uploadUrl, file, setProgress);
        setStatus("done");
        onUploaded();
      } catch (err) {
        setStatus("error");
        setError(
          err instanceof Error ? err.message : "Something went wrong.",
        );
      }
    },
    [idToken, onUploaded],
  );

  const reset = useCallback(() => {
    setStatus("idle");
    setProgress(0);
    setError(null);
  }, []);

  return { status, progress, error, upload, reset };
}
