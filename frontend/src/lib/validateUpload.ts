import { upload } from "../config";

export function validateUpload(file: File): string | null {
  const hasAcceptedExtension = upload.acceptedExtensions.some((ext) =>
    file.name.toLowerCase().endsWith(ext),
  );
  const hasAcceptedType = upload.acceptedTypes.includes(file.type);

  if (!hasAcceptedExtension && !hasAcceptedType) {
    return `Aloud reads PDF, DOCX, and TXT files. "${file.name}" isn't one of those.`;
  }

  if (file.size > upload.maxSizeBytes) {
    const limitMb = Math.round(upload.maxSizeBytes / (1024 * 1024));
    return `"${file.name}" is too large. Keep documents under ${limitMb}MB.`;
  }

  return null;
}
