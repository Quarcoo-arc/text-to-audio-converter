import { useMemo, useState, type ReactNode } from "react";
import { AuthContext, type AppUser, type AuthContextValue } from "./context";

const MOCK_USER: AppUser = {
  name: "Jordan Kim",
  email: "jordan.kim@example.com",
};

const SIGN_IN_DELAY_MS = 600;

/**
 * Stands in for Cognito + Google sign-in when no Cognito user pool is
 * configured (see `isMockAuth` in config.ts) — lets the app be developed
 * and demoed end-to-end before the backend exists.
 */
export function MockAuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AppUser | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const value = useMemo<AuthContextValue>(
    () => ({
      isAuthenticated: user !== null,
      isLoading,
      user,
      idToken: user ? "mock-id-token" : null,
      signIn: () => {
        setIsLoading(true);
        setTimeout(() => {
          setUser(MOCK_USER);
          setIsLoading(false);
        }, SIGN_IN_DELAY_MS);
      },
      signOut: () => setUser(null),
    }),
    [user, isLoading],
  );

  return (
    <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
  );
}
