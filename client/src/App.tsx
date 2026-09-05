import { useEffect, useState } from 'react';
import { useSpacetimeDB } from 'spacetimedb/react';
import Home from './pages/Home';
import Room from './pages/Room';

function parsePath(path: string): { page: 'home' } | { page: 'room'; code: string } {
  const m = path.match(/^\/r\/([A-Za-z0-9]{4,8})\/?$/);
  if (m) return { page: 'room', code: m[1].toUpperCase() };
  return { page: 'home' };
}

export function navigate(path: string) {
  window.history.pushState({}, '', path);
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
      {route.page === 'home' ? <Home /> : <Room code={route.code} />}
    </div>
  );
}
