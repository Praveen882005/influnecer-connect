import React, { createContext, useContext, useEffect, useState } from 'react';
import { api } from '../api/client';
import type { User, UserRole } from '../types';

interface AuthContextType {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (credentials: { email: string; password: string }) => Promise<void>;
  register: (data: {
    email: string;
    password: string;
    full_name: string;
    role: UserRole;
    company_name?: string;
    industry?: string;
    handle?: string;
    primary_niche?: string;
  }) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  demoLogin: (role: UserRole) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(() => {
    try {
      const saved = localStorage.getItem('brand_bridge_user');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const [token, setToken] = useState<string | null>(() => {
    return localStorage.getItem('brand_bridge_token') || localStorage.getItem('access_token');
  });

  const [isLoading, setIsLoading] = useState<boolean>(true);

  const saveSession = (access: string, refresh?: string, userData?: User) => {
    localStorage.setItem('brand_bridge_token', access);
    localStorage.setItem('access_token', access);
    if (refresh) {
      localStorage.setItem('brand_bridge_refresh_token', refresh);
      localStorage.setItem('refresh_token', refresh);
    }
    if (userData) {
      localStorage.setItem('brand_bridge_user', JSON.stringify(userData));
      setUser(userData);
    }
    setToken(access);
  };

  const clearSession = () => {
    localStorage.removeItem('brand_bridge_token');
    localStorage.removeItem('access_token');
    localStorage.removeItem('brand_bridge_refresh_token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('brand_bridge_user');
    setToken(null);
    setUser(null);
  };

  const refreshUser = async () => {
    const storedToken = localStorage.getItem('brand_bridge_token') || localStorage.getItem('access_token');
    if (!storedToken) {
      clearSession();
      setIsLoading(false);
      return;
    }

    try {
      const currentUser = await api.auth.me();
      saveSession(storedToken, undefined, currentUser);
    } catch (err) {
      // Try refresh token if available
      const storedRefresh = localStorage.getItem('brand_bridge_refresh_token') || localStorage.getItem('refresh_token');
      if (storedRefresh) {
        try {
          const authRes = await api.auth.refresh(storedRefresh);
          saveSession(authRes.access_token, authRes.refresh_token, authRes.user);
          return;
        } catch {
          clearSession();
        }
      } else {
        clearSession();
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    refreshUser();
  }, []);

  const login = async (credentials: { email: string; password: string }) => {
    setIsLoading(true);
    try {
      const authRes = await api.auth.login(credentials);
      saveSession(authRes.access_token, authRes.refresh_token, authRes.user);
    } finally {
      setIsLoading(false);
    }
  };

  const register = async (data: {
    email: string;
    password: string;
    full_name: string;
    role: UserRole;
    company_name?: string;
    industry?: string;
    handle?: string;
    primary_niche?: string;
  }) => {
    setIsLoading(true);
    try {
      const authRes = await api.auth.register(data);
      saveSession(authRes.access_token, authRes.refresh_token, authRes.user);
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    const refreshToken = localStorage.getItem('brand_bridge_refresh_token') || localStorage.getItem('refresh_token');
    try {
      await api.auth.logout(refreshToken || undefined);
    } catch {
      // Ignore network errors on logout
    } finally {
      clearSession();
    }
  };

  const demoLogin = async (role: UserRole) => {
    setIsLoading(true);
    try {
      const authRes = await api.auth.demoLogin(role);
      saveSession(authRes.access_token, authRes.refresh_token, authRes.user);
    } catch {
      if (role === 'brand') {
        await login({ email: 'demo.brand@acmecorp.com', password: 'brand12345' });
      } else if (role === 'creator') {
        await login({ email: 'tech_marcus@creatorhub.test', password: 'creator12345' });
      } else if (role === 'admin') {
        await login({ email: 'admin@brandbridge.io', password: 'admin12345' });
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isAuthenticated: !!user && !!token,
        isLoading,
        login,
        register,
        logout,
        refreshUser,
        demoLogin,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
