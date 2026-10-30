import { useEffect, useRef, useState } from 'react';
export const ROUTES = [
  '/',
  '/login',
  '/menu',
  '/profile',
  '/avatar',
  '/factory',
  '/island',
  '/house',
] as const;
export type Route = (typeof ROUTES)[number];
export function parseRoute(hash: string): Route | null {
  const path = hash.replace(/^#/, '') || '/';
  return ROUTES.includes(path as Route) ? (path as Route) : null;
}
let guard: (() => boolean) | undefined;
let approvedHash: string | undefined;
export function confirmNavigation(): boolean {
  return guard?.() ?? true;
}
export function navigate(route: Route, replace = false, force = false): boolean {
  const hash = '#' + route;
  if (window.location.hash !== hash && !force && !confirmNavigation()) return false;
  approvedHash = hash;
  if (replace) {
    window.history.replaceState(null, '', hash);
    window.dispatchEvent(new HashChangeEvent('hashchange'));
  } else window.location.hash = route;
  return true;
}
export function useUnsavedChanges(dirty: boolean): void {
  useEffect(() => {
    if (!dirty) return;
    const ask = () =>
      window.confirm('Есть несохранённые изменения персонажа. Уйти без сохранения?');
    guard = ask;
    const unload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', unload);
    return () => {
      if (guard === ask) guard = undefined;
      window.removeEventListener('beforeunload', unload);
    };
  }, [dirty]);
}
export function useRoute(): Route | null {
  const [route, setRoute] = useState(() => parseRoute(window.location.hash));
  const accepted = useRef(window.location.hash);
  useEffect(() => {
    const change = () => {
      const next = window.location.hash;
      const approved = next === approvedHash;
      approvedHash = undefined;
      if (next !== accepted.current && !approved && !confirmNavigation()) {
        window.history.replaceState(null, '', accepted.current || '#/');
        return;
      }
      accepted.current = next;
      setRoute(parseRoute(next));
    };
    const click = (event: MouseEvent) => {
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      )
        return;
      const anchor = (event.target as Element).closest?.('a');
      if (!anchor || anchor.target === '_blank' || anchor.hasAttribute('download')) return;
      const url = new URL(anchor.href);
      if (
        url.origin !== location.origin ||
        url.pathname !== location.pathname ||
        url.search !== location.search ||
        !parseRoute(url.hash) ||
        url.hash === location.hash
      )
        return;
      if (!confirmNavigation()) {
        event.preventDefault();
        return;
      }
      approvedHash = url.hash;
    };
    document.addEventListener('click', click, true);
    window.addEventListener('hashchange', change);
    return () => {
      document.removeEventListener('click', click, true);
      window.removeEventListener('hashchange', change);
    };
  }, []);
  return route;
}
