import React, { createContext, useContext, useState, useEffect } from "react";
import { getSession, clearSession, setSession } from "../services/session";

interface User {
  id: string;
  username: string;
}

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  login: (user: User) => void;
  logout: () => void;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};

interface AuthProviderProps {
  children: React.ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  useEffect(() => {
    // Check session for existing user session on app start
    const checkAuthStatus = () => {
      try {
        const session = getSession();

        if (session && session.user_id) {
          setUser({
            id: session.user_id.toString(),
            username: session.username || "",
          });
        }
      } catch (error) {
        console.error("Error checking auth status:", error);
        // Clear potentially corrupted data
        clearSession();
      } finally {
        setIsLoading(false);
      }
    };

    checkAuthStatus();
  }, []);
  const login = (userData: User) => {
    try {
      setSession(parseInt(userData.id), userData.username);
      setUser(userData);
    } catch (error) {
      console.error("Error saving user data:", error);
    }
  };

  const logout = () => {
    try {
      clearSession();
      setUser(null);
    } catch (error) {
      console.error("Error during logout:", error);
    }
  };

  const value: AuthContextType = {
    user,
    isAuthenticated: !!user,
    login,
    logout,
    isLoading,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export default AuthProvider;
