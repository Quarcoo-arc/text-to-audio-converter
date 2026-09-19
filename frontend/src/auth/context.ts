import { createContext } from "react";

export interface AppUser {
  name: string;
  email: string;
  picture?: string;
}

export interface AuthContextValue {
  isAuthenticated: boolean;
  isLoading: boolean;
  user: AppUser | null;
  /** Bearer token to send to the API. Null until signed in. */
  idToken: string | null;
  signIn: () => void;
  signOut: () => void;
}

export const AuthContext = createContext<AuthContextValue | undefined>(
  undefined,
);
