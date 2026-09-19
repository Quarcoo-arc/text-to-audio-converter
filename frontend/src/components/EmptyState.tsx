import { Waveform } from "./Waveform";

export function EmptyState() {
  return (
    <div className="flex flex-col items-start gap-2 py-6">
      <Waveform className="text-line" />
      <p className="text-sm text-ink-soft">
        Nothing here yet. Upload a document above to hear it read aloud.
      </p>
    </div>
  );
}
