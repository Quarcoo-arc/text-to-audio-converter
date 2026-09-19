import { SignInScreen } from "./auth/SignInScreen";
import { useAuth } from "./auth/useAuth";
import { Dashboard } from "./Dashboard";

export function App() {
  const { isAuthenticated } = useAuth();
  return isAuthenticated ? <Dashboard /> : <SignInScreen />;
}
