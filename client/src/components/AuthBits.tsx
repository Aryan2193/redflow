import { useAuth, type AuthContextProps } from 'react-oidc-context';
import { authEnabled, rememberReturnTo } from '../lib/auth';

// useAuth only exists inside AuthProvider, which only exists when a client id is configured. authEnabled never
// changes at runtime, so calling the hook conditionally on it is stable.
export function useOptionalAuth(): AuthContextProps | null {
  if (!authEnabled) return null;
  // eslint-disable-next-line react-hooks/rules-of-hooks
  return useAuth();
}

// "Sign in with email" when signed out, "Signed in as ..." with a sign-out link when signed in. Nothing when auth is off.
export default function SignIn({ className = '' }: { className?: string }) {
  const auth = useOptionalAuth();
  if (!auth) return null;
  if (auth.isLoading) return <span className={`text-xs text-muted ${className}`}>Checking sign-in</span>;
  if (auth.isAuthenticated) {
    // Anonymous SpacetimeAuth users carry an opaque id as their username; only a real email is worth showing.
    const who = auth.user?.profile.email || '';
    return (
      <span className={`inline-flex flex-wrap items-center gap-2 text-xs text-ink-2 ${className}`}>
        <span className="inline-block h-1.5 w-1.5 rounded-full bg-ok" aria-hidden />
        {who ? (
          <>
            Signed in as <span className="font-semibold">{who}</span>
          </>
        ) : (
          'Signed in'
        )}
        <button type="button" onClick={() => auth.signoutRedirect()} className="underline">
          Sign out
        </button>
      </span>
    );
  }
  return (
    <button
      type="button"
      onClick={() => {
        rememberReturnTo();
        void auth.signinRedirect();
      }}
      className={`rounded-full border border-line bg-sheet px-3 py-1 text-xs font-semibold text-ink-2 hover:border-ink ${className}`}
    >
      Sign in with email
    </button>
  );
}
