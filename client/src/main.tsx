import { StrictMode, useMemo } from 'react';
import { createRoot } from 'react-dom/client';
import { AuthProvider } from 'react-oidc-context';
import { SpacetimeDBProvider } from 'spacetimedb/react';
import './index.css';
import App from './App';
import { useOptionalAuth } from './components/AuthBits';
import { authEnabled, oidcConfig, onSigninCallback } from './lib/auth';
import { buildConnection } from './lib/stdb';

// The SpacetimeDB connection presents the SpacetimeAuth ID token when there is one. Keying the provider on the
// token makes a sign-in or sign-out reconnect as the new identity.
function Root() {
  const auth = useOptionalAuth();
  const token = auth?.isAuthenticated ? auth.user?.id_token : undefined;
  const builder = useMemo(() => buildConnection(token), [token]);
  if (auth?.isLoading) return <div className="px-5 pt-24 text-center text-sm text-muted">Checking your sign-in.</div>;
  return (
    <SpacetimeDBProvider key={token ?? 'anon'} connectionBuilder={builder}>
      <App />
    </SpacetimeDBProvider>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {authEnabled ? (
      <AuthProvider {...oidcConfig} onSigninCallback={onSigninCallback}>
        <Root />
      </AuthProvider>
    ) : (
      <Root />
    )}
  </StrictMode>
);
