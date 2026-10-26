import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import type { AvatarConfig, ProfileInput, PublicProfile } from '@creative-factory/contracts';
import { safeAccountError, type AccountData, type AuthConfig, type Identity } from './service';

interface AccountContextValue {
  config: AuthConfig;
  user: Identity | null;
  data: AccountData;
  status: 'loading' | 'anonymous' | 'ready' | 'error';
  error: string;
  refresh(): Promise<void>;
  saveProfile(input: ProfileInput, revision: number): Promise<PublicProfile>;
  saveAvatar(config: AvatarConfig): Promise<AvatarConfig>;
  logout(): Promise<void>;
}
const Context = createContext<AccountContextValue | null>(null);
const empty: AccountData = { profile: null, avatar: null };
export function AccountProvider({ config, children }: { config: AuthConfig; children: ReactNode }) {
  const [user, setUser] = useState<Identity | null>(null);
  const [data, setData] = useState<AccountData>(empty);
  const [status, setStatus] = useState<AccountContextValue['status']>(
    config.service ? 'loading' : 'anonymous',
  );
  const [error, setError] = useState('');
  const currentUser = useRef<string | null>(null);
  const generation = useRef(0);
  const refresh = useCallback(async () => {
    const id = currentUser.current,
      request = ++generation.current;
    if (!id || !config.service) return;
    setStatus('loading');
    setError('');
    try {
      const loaded = await config.service.load(id);
      if (request === generation.current && id === currentUser.current) {
        setData(loaded);
        setStatus('ready');
      }
    } catch (e) {
      if (request === generation.current && id === currentUser.current) {
        setError(safeAccountError(e).message);
        setStatus('error');
      }
    }
  }, [config.service]);
  useEffect(() => {
    const service = config.service;
    if (!service) return;
    let active = true,
      receivedEvent = false;
    const accept = (next: Identity | null) => {
      if (!active) return;
      const changed = currentUser.current !== (next?.userId ?? null);
      setUser(next);
      if (!changed && next) return; // TOKEN_REFRESHED must not reset an open form or game.
      currentUser.current = next?.userId ?? null;
      generation.current++;
      setData(empty);
      setError('');
      if (next) void refresh();
      else setStatus('anonymous');
    };
    const off = service.subscribe((next) => {
      receivedEvent = true;
      accept(next);
    });
    void service
      .session()
      .then((next) => {
        if (!receivedEvent) accept(next);
      })
      .catch((e) => {
        if (active && !receivedEvent) {
          setError(safeAccountError(e).message);
          setStatus('error');
        }
      });
    return () => {
      active = false;
      currentUser.current = null;
      generation.current++;
      off();
    };
  }, [config.service, refresh]);
  const value: AccountContextValue = {
    config,
    user,
    data,
    status,
    error,
    refresh,
    async saveProfile(input, revision) {
      const id = currentUser.current;
      const request = generation.current;
      if (!id || !config.service) throw new Error('Authentication required');
      const saved = await config.service.saveProfile(input, revision);
      if (id === currentUser.current && request === generation.current)
        setData((old) => ({ ...old, profile: saved }));
      return saved;
    },
    async saveAvatar(avatar) {
      const id = currentUser.current;
      const request = generation.current;
      if (!id || !config.service) throw new Error('Authentication required');
      const saved = await config.service.saveAvatar(avatar);
      if (id === currentUser.current && request === generation.current)
        setData((old) => ({ ...old, avatar: saved }));
      return saved;
    },
    async logout() {
      // Clear UI immediately, which unmounts the factory before the network request.
      generation.current++;
      currentUser.current = null;
      setUser(null);
      setData(empty);
      setStatus('anonymous');
      setError('');
      await config.service?.logout();
    },
  };
  return <Context.Provider value={value}>{children}</Context.Provider>;
}
export function useAccount(): AccountContextValue {
  const context = useContext(Context);
  if (!context) throw new Error('AccountProvider missing');
  return context;
}
