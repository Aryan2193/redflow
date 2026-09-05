import { Component, useEffect, useState, type ReactNode } from 'react';
import { useSpacetimeDB } from 'spacetimedb/react';
import Home from './pages/Home';
import Room from './pages/Room';

class Boundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  render() {
    if (this.state.error) {
      return (
        <main className="mx-auto max-w-md px-5 pt-24 text-center">
          <p className="font-display text-2xl">Something broke on this screen.</p>
          <p className="mt-2 text-sm text-muted">{String(this.state.error.message).slice(0, 200)}</p>
          <button onClick={() => (window.location.href = '/')} className="mt-6 rounded-md bg-ink px-4 py-2 font-semibold text-paper">
            Back to the start
          </button>
        </main>
      );
    }
    return this.props.children;
  }
}

// Works at the domain root and under a base path such as /redflow-web/ on GitHub Pages.
const BASE = (import.meta.env.BASE_URL || '/').replace(/\/$/, '');

function parsePath(path: string): { page: 'home' } | { page: 'room'; code: string } {
  const m = path.match(/\/r\/([A-Za-z0-9]{4,8})\/?$/);
  if (m) return { page: 'room', code: m[1].toUpperCase() };
  return { page: 'home' };
}

export function navigate(path: string) {
  window.history.pushState({}, '', BASE + (path === '/' ? '/' : path));
  window.dispatchEvent(new PopStateEvent('popstate'));
}

export default function App() {
  const [route, setRoute] = useState(() => parsePath(window.location.pathname));
  const { isActive, connectionError } = useSpacetimeDB();

  useEffect(() => {
    const onPop = () => setRoute(parsePath(window.location.pathname));
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  return (
    <div className="min-h-dvh bg-paper text-ink">
      {!isActive && (
        <div className="fixed inset-x-0 top-0 z-50 bg-ink px-4 py-1.5 text-center text-xs text-paper">
          {connectionError ? 'Connection lost. Reconnecting.' : 'Connecting to the room.'}
        </div>
      )}
      <Boundary key={route.page === 'room' ? route.code : 'home'}>{route.page === 'home' ? <Home /> : <Room code={route.code} />}</Boundary>
    </div>
  );
}
