"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";

import type { AuthUser } from "@/types/auth";

type LoginPayload = {
  loginId: string;
  password: string;
};

type AuthContextValue = {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (payload: LoginPayload) => Promise<void>;
  logout: () => Promise<void>;
  refreshSession: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

async function parseJson<T>(response: Response): Promise<T | null> {
  try {
    return (await response.json()) as T;
  } catch {
    return null;
  }
}

export function AuthProvider({
  children,
  initialUser,
}: {
  children: React.ReactNode;
  initialUser: AuthUser | null;
}) {
  const [user, setUser] = useState<AuthUser | null>(initialUser);
  const [isLoading, setIsLoading] = useState(false);

  const refreshSession = useCallback(async () => {
    setIsLoading(true);
    const response = await fetch("/api/auth/me", {
      method: "GET",
      credentials: "include",
      cache: "no-store",
    });

    if (!response.ok) {
      setUser(null);
      setIsLoading(false);
      return;
    }

    const data = await parseJson<{ user: AuthUser }>(response);
    setUser(data?.user ?? null);
    setIsLoading(false);
  }, []);

  const login = useCallback(async (payload: LoginPayload) => {
    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "include",
      body: JSON.stringify({
        login_id: payload.loginId,
        password: payload.password,
      }),
    });

    if (!response.ok) {
      throw new Error("로그인에 실패했습니다.");
    }

    const data = await parseJson<{ user: AuthUser }>(response);
    setUser(data?.user ?? null);
  }, []);

  const logout = useCallback(async () => {
    await fetch("/api/auth/logout", {
      method: "POST",
      credentials: "include",
    });
    setUser(null);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isAuthenticated: user !== null,
      isLoading,
      login,
      logout,
      refreshSession,
    }),
    [user, isLoading, login, logout, refreshSession],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider.");
  }
  return context;
}
