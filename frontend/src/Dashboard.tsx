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
      <main className="mx-auto max-w-4xl px-6 py-12 sm:px-10">
        <div className="lg:grid lg:grid-cols-[23rem_1px_1fr] lg:gap-x-12">
          <div>
            <h1 className="font-display text-2xl font-medium text-ink">
              Add a document
            </h1>
            <p className="mt-1 text-sm text-ink-soft">
              We'll email you once the audio is ready.
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
          </div>

          <div className="hidden bg-line lg:block" />

          <div className="mt-12 lg:mt-0">
            <ConversionList conversions={conversions} isLoading={isLoading} />
          </div>
        </div>
      </main>
    </div>
  );
}
