/**
 * useAuth — PocketBase auth hook for PGMS
 * ------------------------------------------------------------------
 * Subscribes to pb.authStore so any component re-renders on
 * login/logout. Persists across page reloads automatically.
 *
 * Usage:
 *   const { user, login, register, logout, loading } = useAuth();
 * ------------------------------------------------------------------
 */
import { useEffect, useState, useCallback } from "react";
import { pb } from "@/lib/pocketbase";

export type AppRole = "citizen" | "department" | "admin";

type AuthUser = {
  id: string;
  email: string;
  name?: string;
  role?: AppRole;
  [key: string]: any;
} | null;

export function getRoleHomePath(role?: AppRole) {
  switch (role) {
    case "admin":
      return "/admin";
    case "department":
      return "/dashboard";
    case "citizen":
    default:
      return "/submit";
  }
}

export function getUserRole(value: unknown): AppRole {
  if (value === "admin" || value === "department" || value === "citizen") {
    return value;
  }

  return "citizen";
}

export function useAuth() {
  // Always start with null on server AND first client render to avoid SSR hydration mismatch.
  const [user, setUser] = useState<AuthUser>(null);
  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setUser(pb.authStore.isValid ? ((pb.authStore.model as AuthUser) ?? null) : null);
    setMounted(true);
    const unsub = pb.authStore.onChange(() => {
      setUser(pb.authStore.isValid ? ((pb.authStore.model as AuthUser) ?? null) : null);
    });
    return () => unsub();
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    setLoading(true);
    try {
      await pb.collection("users").authWithPassword(email, password);
    } finally {
      setLoading(false);
    }
  }, []);

  const register = useCallback(
    async (data: { email: string; password: string; name: string; phone?: string }) => {
      setLoading(true);
      try {
        await pb.collection("users").create({
          email: data.email,
          password: data.password,
          passwordConfirm: data.password,
          name: data.name,
          phone: data.phone ?? "",
          role: "citizen",
        });
        await pb.collection("users").authWithPassword(data.email, data.password);
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  const logout = useCallback(() => {
    pb.authStore.clear();
    // Force a state update to immediately clear user from navbar
    setUser(null);
  }, []);

  return {
    user,
    loading,
    mounted,
    login,
    register,
    logout,
    isAuthenticated: !!user,
    role: getUserRole(user?.role),
  };
}
