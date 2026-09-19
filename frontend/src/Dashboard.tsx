import { ConversionList } from "./components/ConversionList";
import { Header } from "./components/Header";
import { UploadPanel } from "./components/UploadPanel";
import { useConversions } from "./hooks/useConversions";
import { useUpload } from "./hooks/useUpload";

export function Dashboard() {
  const { conversions, isLoading, refetch } = useConversions();
  const { status, progress, error, upload, reset } = useUpload(refetch);

  return (
    <div className="min-h-svh bg-paper">
      <Header />
      <main className="mx-auto max-w-xl px-6 py-12 sm:px-10">
        <h1 className="font-display text-2xl font-medium text-ink">
          Add a document
        </h1>
        <p className="mt-1 text-sm text-ink-soft">
          We'll email the audio to you as soon as it's ready.
        </p>

        <div className="mt-6">
          <UploadPanel
            onFileSelected={upload}
            status={status}
            progress={progress}
            error={error}
            onReset={reset}
          />
        </div>

        <ConversionList conversions={conversions} isLoading={isLoading} />
      </main>
    </div>
  );
}
