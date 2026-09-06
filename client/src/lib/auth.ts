// Sign in with SpacetimeAuth, SpacetimeDB's own hosted OIDC provider. It sends the magic-link email itself; the
// ID token it returns is what the SpacetimeDB connection presents, so the same person is the same identity on
// every device. Everything here is inert until VITE_AUTH_CLIENT_ID is set.
import { WebStorageStateStore } from 'oidc-client-ts';

export const AUTH_CLIENT_ID = ((import.meta.env.VITE_AUTH_CLIENT_ID as string | undefined) ?? '').trim();
export const authEnabled = AUTH_CLIENT_ID.length > 0;

const BASE = (import.meta.env.BASE_URL || '/').replace(/\/$/, '');
const RETURN_KEY = 'redflow.returnTo';

export const oidcConfig = {
  authority: 'https://auth.spacetimedb.com/oidc',
  client_id: AUTH_CLIENT_ID,
  redirect_uri: `${window.location.origin}${BASE}/callback`,
  post_logout_redirect_uri: `${window.location.origin}${BASE}/`,
  scope: 'openid profile email',
  response_type: 'code',
  automaticSilentRenew: true,
  // Keep the session in localStorage so a reload, or a second tab, stays signed in.
  userStore: new WebStorageStateStore({ store: window.localStorage }),
};

// Where to come back to after the login round trip.
export function rememberReturnTo() {
  try {
    sessionStorage.setItem(RETURN_KEY, window.location.pathname + window.location.search);
  } catch {
    // storage unavailable
  }
}

export function onSigninCallback() {
  let to = BASE + '/';
  try {
    to = sessionStorage.getItem(RETURN_KEY) || to;
    sessionStorage.removeItem(RETURN_KEY);
  } catch {
    // storage unavailable
  }
  window.history.replaceState({}, document.title, to);
  window.dispatchEvent(new PopStateEvent('popstate'));
}

// A display name from the ID token claims, for prefilling the name field.
export function nameFromProfile(profile: { preferred_username?: string; name?: string; email?: string } | undefined): string {
  if (!profile) return '';
  return (profile.preferred_username || profile.name || (profile.email ? profile.email.split('@')[0] : '') || '').slice(0, 32);
}
