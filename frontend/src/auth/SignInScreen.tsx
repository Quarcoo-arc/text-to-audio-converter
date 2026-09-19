import { GoogleIcon } from "../components/GoogleIcon";
import { Waveform } from "../components/Waveform";
import { useAuth } from "./useAuth";

export function SignInScreen() {
  const { signIn, isLoading } = useAuth();

  return (
    <div className="flex min-h-svh flex-col bg-paper px-6 sm:px-10">
      <div className="flex items-center gap-2.5 py-8 text-ink">
        <Waveform className="text-signal" />
        <span className="font-display text-lg font-medium">Aloud</span>
      </div>

      <div className="flex flex-1 items-center">
        <div className="max-w-md">
          <Waveform active className="mb-8 h-8 text-signal" />
          <h1 className="font-display text-4xl font-medium leading-[1.1] text-ink sm:text-5xl">
            Turn documents into something you can listen to.
          </h1>
          <p className="mt-5 max-w-sm text-[15px] leading-relaxed text-ink-soft">
            Upload a PDF, Word document, or text file. We read it aloud and
            email you the audio when it's ready.
          </p>

          <button
            type="button"
            onClick={signIn}
            disabled={isLoading}
            className="mt-9 inline-flex items-center gap-3 rounded-md border border-line bg-paper px-5 py-3 text-sm font-medium text-ink transition-colors hover:border-ink disabled:opacity-60"
          >
            <GoogleIcon className="h-[18px] w-[18px]" />
            {isLoading ? "Signing in…" : "Sign in with Google"}
          </button>
        </div>
      </div>
    </div>
  );
}
