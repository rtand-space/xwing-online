import { create } from 'zustand';
import { getGuestId } from './identity';
import { SERVER } from './transport';

export interface User {
  id: string;
  name: string;
  picture?: string | null;
}

interface AuthState {
  token: string | null;
  user: User | null;
  login: (provider: 'google' | 'discord') => void;
  logout: () => void;
  init: () => Promise<void>;
}

const KEY = 'xwing:session';

export const useAuth = create<AuthState>((set, get) => ({
  token: localStorage.getItem(KEY),
  user: null,
  login: (provider) => {
    const redirect = encodeURIComponent(location.origin + location.pathname);
    const guest = encodeURIComponent(getGuestId());
    location.href = `${SERVER}/auth/${provider}/login?redirect=${redirect}&guest=${guest}`;
  },
  logout: () => {
    localStorage.removeItem(KEY);
    set({ token: null, user: null });
  },
  init: async () => {
    const m = location.hash.match(/session=([^&]+)/);
    if (m && m[1]) {
      localStorage.setItem(KEY, m[1]);
      history.replaceState(null, '', location.pathname + location.search);
      set({ token: m[1] });
    }
    const token = get().token;
    if (!token) return;
    try {
      const r = await fetch(`${SERVER}/me`, { headers: { authorization: `Bearer ${token}` } });
      if (r.ok) set({ user: (await r.json()) as User });
      else get().logout();
    } catch {
      /* offline — keep the token and retry next load */
    }
  },
}));

/** Authorization header for authenticated requests, or empty when signed out. */
export const authHeader = (): Record<string, string> => {
  const t = useAuth.getState().token;
  return t ? { authorization: `Bearer ${t}` } : {};
};
