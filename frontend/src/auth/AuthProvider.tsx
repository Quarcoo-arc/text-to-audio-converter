import type { ReactNode } from "react";
import { isMockAuth } from "../config";
import { CognitoAuthProvider } from "./CognitoAuthProvider";
import { MockAuthProvider } from "./MockAuthProvider";

export function AuthProvider({ children }: { children: ReactNode }) {
  return isMockAuth ? (
    <MockAuthProvider>{children}</MockAuthProvider>
  ) : (
    <CognitoAuthProvider>{children}</CognitoAuthProvider>
  );
}
