import {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from "react";
import {
  registerUser,
  logoutUser,
} from "./api";

interface User {
  id?: string;
  email: string;
  email_verified?: boolean;
  name?: string;
}

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  register: (email: string, name: string) => Promise<boolean>;
  login: (email: string) => Promise<boolean>;
  logout: () => void;
  getAuthTokens: () => {
    accessToken: string | null;
    tokenType: string | null;
    refreshToken: string | null;
    creatorId: string | null;
  };
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Check for authentication status on app load
  useEffect(() => {
    const checkAuth = async () => {
      try {
        console.log("🔍 Checking authentication status via API...");
        const response = await fetch(
          `${import.meta.env.VITE_ENDPOINT || "https://dev.dedi.global"}/dedi/auth/me`,
          {
            method: "GET",
            credentials: "include",
            headers: {
              "Content-Type": "application/json",
            },
          }
        );

        if (response.ok) {
          const userData = await response.json() as {
            id: string;
            email: string;
            email_verified?: boolean;
            name?: string;
          };
          console.log("✅ User data received:", userData);
          setUser({
            id: userData.id,
            email: userData.email,
            email_verified: userData.email_verified || true,
            name: userData.name,
          });
        } else {
          console.log("❌ No active session found - response not ok");
        }
      } catch (error) {
        console.log("❌ No active session found:", error);
      } finally {
        setIsLoading(false);
      }
    };

    checkAuth();
  }, []);

  // Registration function using simplified API
  const register = async (email: string, name: string): Promise<boolean> => {
    setIsLoading(true);
    try {
      await registerUser(email, name, "register");

      // If registerUser doesn't throw an error, the registration was successful
      // (registerUser already handles HTTP status codes including 201)
      return true;
    } finally {
      setIsLoading(false);
    }
  };

  // Login function using the same API as register (email only)
  const login = async (email: string): Promise<boolean> => {
    setIsLoading(true);
    try {
      await registerUser(email, "", "login"); // Use empty string for name since login doesn't need it

      // If registerUser doesn't throw an error, the login was successful
      return true;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    try {
      await logoutUser();
    } catch (error) {
      console.error("Logout error:", error);
    } finally {
      setUser(null);
      console.log("User logged out");
    }
  };

  const getAuthTokens = () => {
    // Since we're using cookie-based authentication, we don't store tokens in localStorage
    // This method is kept for compatibility but returns null values
    return {
      accessToken: null,
      tokenType: null,
      refreshToken: null,
      creatorId: null,
    };
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isLoading,
        register,
        login,
        logout,
        getAuthTokens,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
