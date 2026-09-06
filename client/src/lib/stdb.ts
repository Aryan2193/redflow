import { DbConnection } from '../module_bindings';

export const STDB_URI = (import.meta.env.VITE_STDB_URI as string | undefined) ?? 'ws://127.0.0.1:3000';
export const STDB_DB = (import.meta.env.VITE_STDB_DB as string | undefined) ?? 'redflow';

// Tokens are issued per server. A local-server token presented to Maincloud is rejected with 401 forever.
const TOKEN_KEY = `redflow.token.${STDB_URI}.${STDB_DB}`;
const NAME_KEY = 'redflow.name';

export function savedName(): string {
  try {
    return localStorage.getItem(NAME_KEY) ?? '';
  } catch {
    return '';
  }
}

// An email typed at the door travels with the person into the room, where the room link is sent to it once.
const PENDING_EMAIL_KEY = 'redflow.pendingEmail';
export function rememberPendingEmail(email: string) {
  try {
    if (email) localStorage.setItem(PENDING_EMAIL_KEY, email);
    else localStorage.removeItem(PENDING_EMAIL_KEY);
  } catch {
    // storage unavailable
  }
}
export function takePendingEmail(): string {
  try {
    const v = localStorage.getItem(PENDING_EMAIL_KEY) ?? '';
    if (v) localStorage.removeItem(PENDING_EMAIL_KEY);
    return v;
  } catch {
    return '';
  }
}

export function rememberName(name: string) {
  try {
    localStorage.setItem(NAME_KEY, name);
  } catch {
    // storage unavailable, the name simply is not remembered
  }
}

function savedToken(): string | undefined {
  try {
    return localStorage.getItem(TOKEN_KEY) ?? undefined;
  } catch {
    return undefined;
  }
}

// With a SpacetimeAuth ID token the person is the same identity on every device; without one the server issues an
// anonymous identity that is remembered on this device only.
export function buildConnection(authToken?: string) {
  let builder = DbConnection.builder()
    .withUri(STDB_URI)
    .withDatabaseName(STDB_DB)
    .onConnect((_conn, _identity, token) => {
      try {
        if (!authToken) localStorage.setItem(TOKEN_KEY, token);
        sessionStorage.removeItem('redflow.reloaded');
      } catch {
        // fine
      }
    })
    .onConnectError((_ctx, err) => {
      const msg = String((err as Error)?.message ?? err);
      if (/401|unauthori|token|identity/i.test(msg)) {
        try {
          localStorage.removeItem(TOKEN_KEY);
          if (!sessionStorage.getItem('redflow.reloaded')) {
            sessionStorage.setItem('redflow.reloaded', '1');
            window.location.reload();
          }
        } catch {
          // fine
        }
      }
    });
  const token = authToken ?? savedToken();
  if (token) builder = builder.withToken(token);
  return builder;
}

export function idHex(x: { toHexString(): string } | undefined | null): string {
  return x ? x.toHexString() : '';
}

export function toDate(ts: { microsSinceUnixEpoch: bigint }): Date {
  return new Date(Number(ts.microsSinceUnixEpoch / 1000n));
}

export function timeAgo(ts: { microsSinceUnixEpoch: bigint }, now = Date.now()): string {
  const s = Math.max(0, Math.round((now - toDate(ts).getTime()) / 1000));
  if (s < 5) return 'just now';
  if (s < 60) return `${s}s ago`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  return `${h}h ago`;
}
