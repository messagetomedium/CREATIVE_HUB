import { useEffect, useState } from 'react';
export const ROUTES = ['/', '/login', '/profile', '/avatar', '/factory'] as const;
export type Route = (typeof ROUTES)[number];
export function parseRoute(hash: string): Route | null {
  const path = hash.replace(/^#/, '') || '/';
  return ROUTES.includes(path as Route) ? (path as Route) : null;
}
export function navigate(route: Route, replace = false): void {
  if (replace) {
    window.history.replaceState(null, '', '#' + route);
    window.dispatchEvent(new HashChangeEvent('hashchange'));
  } else window.location.hash = route;
}
export function useRoute(): Route | null {
  const [route, setRoute] = useState(() => parseRoute(window.location.hash));
  useEffect(() => {
    const change = () => setRoute(parseRoute(window.location.hash));
    window.addEventListener('hashchange', change);
    return () => window.removeEventListener('hashchange', change);
  }, []);
  return route;
}
