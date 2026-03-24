'use client';

import * as React from 'react';

interface User {
  creatorId: string;
  username: string;
  address: string;
  family: string;
  network: string;
}

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (sessionToken: string, user: User) => void;
  logout: () => Promise<void>;
  refreshSession: () => Promise<void>;
}

const AuthContext = React.createContext<AuthContextType>({
  user: null,
  isAuthenticated: false,
  isLoading: true,
  login: () => {},
  logout: async () => {},
  refreshSession: async () => {},
});

export function useAuth() {
  return React.useContext(AuthContext);
}

const SESSION_KEY = 'flow_session';
const USER_KEY = 'flow_user';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = React.useState<User | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);

  const getToken = () => {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem(SESSION_KEY);
  };

  const login = React.useCallback((sessionToken: string, userData: User) => {
    localStorage.setItem(SESSION_KEY, sessionToken);
    localStorage.setItem(USER_KEY, JSON.stringify(userData));
    setUser(userData);
  }, []);

  const logout = React.useCallback(async () => {
    const token = getToken();
    if (token) {
      try {
        await fetch('/api/auth/session', {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token}` },
        });
      } catch {
        // ignore
      }
    }
    localStorage.removeItem(SESSION_KEY);
    localStorage.removeItem(USER_KEY);
    setUser(null);
  }, []);

  const refreshSession = React.useCallback(async () => {
    const token = getToken();
    if (!token) {
      setUser(null);
      setIsLoading(false);
      return;
    }
    try {
      const res = await fetch('/api/auth/session', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        const userData: User = {
          creatorId: data.creator_id,
          username: data.username,
          address: data.address,
          family: data.family,
          network: data.network,
        };
        localStorage.setItem(USER_KEY, JSON.stringify(userData));
        setUser(userData);
      } else {
        localStorage.removeItem(SESSION_KEY);
        localStorage.removeItem(USER_KEY);
        setUser(null);
      }
    } catch {
      // Offline — use cached user
      const cached = localStorage.getItem(USER_KEY);
      if (cached) {
        try { setUser(JSON.parse(cached)); } catch { setUser(null); }
      }
    }
    setIsLoading(false);
  }, []);

  React.useEffect(() => {
    refreshSession();
  }, [refreshSession]);

  return (
    <AuthContext.Provider value={{ user, isAuthenticated: !!user, isLoading, login, logout, refreshSession }}>
      {children}
    </AuthContext.Provider>
  );
}
