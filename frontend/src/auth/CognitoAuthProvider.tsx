import { useMemo, type ReactNode } from "react";
import {
  AuthProvider as OidcProvider,
  useAuth as useOidcAuth,
  type AuthProviderProps,
} from "react-oidc-context";
import { cognitoConfig } from "../config";
import { AuthContext, type AuthContextValue } from "./context";

const oidcConfig: AuthProviderProps = {
  authority: cognitoConfig.authority,
  client_id: cognitoConfig.clientId,
  redirect_uri: cognitoConfig.redirectUri,
  response_type: "code",
  scope: "openid email profile",
  // Cognito Hosted UI appends the auth code as a query param; drop it from
  // the URL once the sign-in round trip completes.
  onSigninCallback: () => {
    window.history.replaceState({}, document.title, window.location.pathname);
  },
};

/** Translates react-oidc-context's state into our app-wide AuthContext shape. */
function CognitoAuthBridge({ children }: { children: ReactNode }) {
  const oidc = useOidcAuth();

  const value = useMemo<AuthContextValue>(() => {
    const profile = oidc.user?.profile;
    return {
      isAuthenticated: oidc.isAuthenticated,
      isLoading: oidc.isLoading,
      user: profile
        ? {
            name:
              (profile.name as string | undefined) ??
              (profile.email as string | undefined) ??
              "Signed in",
            email: (profile.email as string | undefined) ?? "",
            picture: profile.picture as string | undefined,
          }
        : null,
      idToken: oidc.user?.id_token ?? null,
      signIn: () => void oidc.signinRedirect(),
      // Cognito's Hosted UI /logout endpoint ignores the OIDC-standard
      // post_logout_redirect_uri param (it wants its own logout_uri instead),
      // and also needs client_id - which SignoutRedirectArgs won't let us
      // pass directly, and which oidc-client-ts only auto-fills when
      // id_token_hint is absent. Since react-oidc-context auto-attaches
      // id_token_hint from the active session, that auto-fill never runs, so
      // client_id must be set explicitly via extraQueryParams instead.
      signOut: () =>
        void oidc.signoutRedirect({
          extraQueryParams: {
            client_id: cognitoConfig.clientId ?? "",
            logout_uri: cognitoConfig.logoutUri,
          },
        }),
    };
  }, [oidc]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/**
 * Real auth: Cognito Hosted UI federated with Google, via Authorization
 * Code + PKCE. Requires the backend to have provisioned a Cognito User
 * Pool with a Google identity provider — this component only consumes
 * it through standard OIDC endpoints.
 */
export function CognitoAuthProvider({ children }: { children: ReactNode }) {
  return (
    <OidcProvider {...oidcConfig}>
      <CognitoAuthBridge>{children}</CognitoAuthBridge>
    </OidcProvider>
  );
}
