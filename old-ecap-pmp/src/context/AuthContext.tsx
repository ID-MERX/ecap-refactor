import {
  createContext,
  type ReactNode,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { clearStoredToken, getStoredToken, setStoredToken } from "@/lib/auth";
import { getDirectusBaseUrl } from "@/lib/env";

export type AuthUser = {
  id: string;
  email: string;
  first_name?: string;
  last_name?: string;
  role?: string | { id: string; name?: string };
  location?: string;
  avatar?: string;
  description?: string;
  title?: string;
  password_change_required?: boolean;
};

type AuthContextValue = {
  user: AuthUser | null;
  isLoading: boolean;
  error: string | null;
  login: (email: string, password: string) => Promise<AuthUser | null>;
  logout: () => void;
  refreshProfile: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const safeJson = async (response: Response) => {
  try {
    return await response.json();
  } catch {
    return null;
  }
};

const requireDirectusUrl = () => {
  const directusUrl = getDirectusBaseUrl();
  if (!directusUrl) {
    throw new Error("REACT_APP_BASE_URL is not set");
  }
  return directusUrl;
};

const fetchProfile = async (token: string) => {
  const response = await fetch(
    `${requireDirectusUrl()}/users/me?fields=id,email,first_name,last_name,role.id,role.name,location,avatar,description,title,password_change_required`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  );

  const data = await safeJson(response);

  if (!response.ok) {
    throw new Error(data?.errors?.[0]?.message ?? "Failed to load profile");
  }

  return data?.data ?? null;
};

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refreshProfile = async () => {
    const token = getStoredToken();
    if (!token) {
      setUser(null);
      return;
    }

    const profile = await fetchProfile(token);
    setUser(profile);
  };

  useEffect(() => {
    const bootstrap = async () => {
      const token = getStoredToken();
      if (!token) {
        setIsLoading(false);
        return;
      }

      try {
        const profile = await fetchProfile(token);
        setUser(profile);
      } catch (err) {
        clearStoredToken();
        setUser(null);
      } finally {
        setIsLoading(false);
      }
    };

    bootstrap();
  }, []);

  const login = async (email: string, password: string) => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`${requireDirectusUrl()}/auth/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, password }),
      });

      const data = await safeJson(response);

      if (!response.ok) {
        throw new Error(data?.errors?.[0]?.message ?? "Login failed");
      }

      const token = data?.data?.access_token ?? data?.access_token;
      if (!token) {
        throw new Error("No access token returned from Directus");
      }

      setStoredToken(token);
      const profile = await fetchProfile(token);
      setUser(profile);
      return profile;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Login failed";
      setError(message);
      clearStoredToken();
      setUser(null);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = () => {
    clearStoredToken();
    setUser(null);
  };

  const value = useMemo(
    () => ({
      user,
      isLoading,
      error,
      login,
      logout,
      refreshProfile,
    }),
    [user, isLoading, error],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
};
