import clsx from "clsx";

const BAR_HEIGHTS = [40, 70, 100, 65, 85, 45, 60];

interface WaveformProps {
  /** Bars breathe when a conversion is actively processing. */
  active?: boolean;
  className?: string;
}

/** The app's one recurring visual motif: a document's text becoming an
 * audio waveform. Used as the wordmark's icon and as the "processing"
 * indicator — never purely decorative. */
export function Waveform({ active = false, className }: WaveformProps) {
  return (
    <span
      className={clsx("inline-flex h-4 items-end gap-0.75", className)}
      aria-hidden="true"
    >
      {BAR_HEIGHTS.map((height, i) => (
        <span
          key={i}
          className={clsx("w-0.75 rounded-full bg-current", {
            "animate-wave": active,
          })}
          style={{
            height: `${height}%`,
            animationDelay: active ? `${i * 90}ms` : undefined,
          }}
        />
      ))}
    </span>
  );
}
