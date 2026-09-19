import { useAuth } from "../auth/useAuth";
import { Waveform } from "./Waveform";

export function Header() {
  const { user, signOut } = useAuth();

  return (
    <header className="flex items-center justify-between border-b border-line px-6 py-4 sm:px-10">
      <div className="flex items-center gap-2.5 text-ink">
        <Waveform className="text-signal" />
        <span className="font-display text-lg font-medium">Aloud</span>
      </div>

      {user && (
        <div className="flex items-center gap-4">
          <span className="hidden text-sm text-ink-soft sm:inline">
            {user.name}
          </span>
          <button
            type="button"
            onClick={signOut}
            className="text-sm text-ink-soft underline decoration-line underline-offset-4 transition-colors hover:text-ink"
          >
            Sign out
          </button>
        </div>
      )}
    </header>
  );
}
