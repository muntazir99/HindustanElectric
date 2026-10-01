import { createContext, useContext, useState, useEffect } from 'react';
import { jwtDecode } from 'jwt-decode';
import api from '../api.js'; // Ensure this points to your API utility file

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const initializeAuth = () => {
      const token = localStorage.getItem('token');
      if (token) {
        try {
          const decoded = jwtDecode(token);
          // Optional: Check if token is expired
          if (decoded.exp * 1000 > Date.now()) {
            setUser({ token, role: decoded.role });
            // Set the token for all subsequent API requests
            api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
          } else {
            // Token is expired
            localStorage.clear();
            setUser(null);
          }
        } catch (error) {
          console.error('Invalid token');
          localStorage.clear();
          setUser(null);
        }
      }
      setLoading(false);
    };
    initializeAuth();
  }, []);

  const login = (token) => {
    try {
      const decoded = jwtDecode(token);
      localStorage.setItem('token', token);
      localStorage.setItem('role', decoded.role); // Still useful for quick access
      setUser({ token, role: decoded.role });
      api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    } catch (error) {
      console.error('Failed to decode token on login', error);
    }
  };

  const logout = () => {
    localStorage.clear();
    setUser(null);
    delete api.defaults.headers.common['Authorization'];
  };

  const authContextValue = {
    user,
    isAuthenticated: !!user,
    loading,
    login,
    logout,
  };

  return (
    <AuthContext.Provider value={authContextValue}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  return useContext(AuthContext);
};