import React, { createContext, useContext, useState, useEffect } from 'react';
import { API_URL } from '../config/api';

interface User {
  id: number;
  email: string;
  name: string;
  subscription_tier?: string;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string, name: string) => Promise<void>;
  logout: () => void;
  refreshUser: () => Promise<User | null>;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  console.log('AuthProvider rendering');
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Check for stored token on mount
    const storedToken = localStorage.getItem('token');
    if (storedToken) {
      setToken(storedToken);
      fetchUser(storedToken);
    } else {
      setIsLoading(false);
    }
  }, []);

  const fetchUser = async (authToken: string, skipLoadingUpdate = false) => {
    try {
      console.log('Fetching user with token...');
      const response = await fetch(`${API_URL}/api/auth/me`, {
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      });
      console.log('User fetch response:', response.status);

      if (response.ok) {
        const userData = await response.json();
        setUser(userData);
        return userData;
      } else {
        // Token is invalid, clear it
        localStorage.removeItem('token');
        setToken(null);
      }
    } catch (error) {
      console.error('Failed to fetch user:', error);
      // In case of network error, still set loading to false
      localStorage.removeItem('token');
      setToken(null);
    } finally {
      if (!skipLoadingUpdate) {
        console.log('Setting isLoading to false');
        setIsLoading(false);
      }
    }
  };
  
  // Add a refresh function that can be called anytime
  const refreshUser = async () => {
    if (token) {
      const userData = await fetchUser(token, true);
      return userData;
    }
    return null;
  };

  const login = async (email: string, password: string) => {
    try {
      const response = await fetch(`${API_URL}/api/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ email, password })
      });

      if (!response.ok) {
        let errorMessage = 'Login failed';
        try {
          const errorData = await response.json();
          errorMessage = errorData.error || errorMessage;
        } catch (parseError) {
          // If JSON parsing fails, use status text or generic message
          errorMessage = response.statusText || `Login failed (${response.status})`;
        }
        throw new Error(errorMessage);
      }

      const data = await response.json();
      localStorage.setItem('token', data.token);
      setToken(data.token);
      setUser(data.user);
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error('Network error - please check your connection');
    }
  };

  const signup = async (email: string, password: string, name: string) => {
    try {
      const response = await fetch(`${API_URL}/api/auth/signup`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ email, password, name })
      });

      if (!response.ok) {
        let errorMessage = 'Signup failed';
        try {
          const errorData = await response.json();
          errorMessage = errorData.error || errorMessage;
        } catch (parseError) {
          // If JSON parsing fails, use status text or generic message
          errorMessage = response.statusText || `Signup failed (${response.status})`;
        }
        throw new Error(errorMessage);
      }

      const data = await response.json();
      localStorage.setItem('token', data.token);
      setToken(data.token);
      setUser(data.user);
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error('Network error - please check your connection');
    }
  };

  const logout = () => {
    localStorage.removeItem('token');
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, token, login, signup, logout, refreshUser, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
};