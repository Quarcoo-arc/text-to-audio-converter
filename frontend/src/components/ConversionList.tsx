import type { ConversionRecord } from "../api/types";
import { ConversionListItem } from "./ConversionListItem";
import { EmptyState } from "./EmptyState";

interface ConversionListProps {
  conversions: ConversionRecord[];
  isLoading: boolean;
}

export function ConversionList({
  conversions,
  isLoading,
}: ConversionListProps) {
  return (
    <section className="mt-12">
      <h2 className="font-display text-lg font-medium text-ink">
        Your conversions
      </h2>

      {isLoading ? (
        <p className="mt-4 text-sm text-ink-soft">Loading…</p>
      ) : conversions.length === 0 ? (
        <EmptyState />
      ) : (
        <ul className="mt-2">
          {conversions.map((record) => (
            <ConversionListItem key={record.conversionId} record={record} />
          ))}
        </ul>
      )}
    </section>
  );
}
