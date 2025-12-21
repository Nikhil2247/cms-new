// Centralized Token Manager - Single source of truth for auth tokens
// Uses Redux store as the primary source, with localStorage as fallback for initial hydration

import { jwtDecode } from 'jwt-decode';

const TOKEN_KEY = 'auth_token';
const REFRESH_TOKEN_KEY = 'refresh_token';

// Token storage - uses a single localStorage key
export const tokenStorage = {
  getToken: () => {
    try {
      return localStorage.getItem(TOKEN_KEY);
    } catch {
      return null;
    }
  },

  setToken: (token) => {
    try {
      if (token) {
        localStorage.setItem(TOKEN_KEY, token);
      } else {
        localStorage.removeItem(TOKEN_KEY);
      }
    } catch (error) {
      console.error('Failed to set token:', error);
    }
  },

  getRefreshToken: () => {
    try {
      return localStorage.getItem(REFRESH_TOKEN_KEY);
    } catch {
      return null;
    }
  },

  setRefreshToken: (token) => {
    try {
      if (token) {
        localStorage.setItem(REFRESH_TOKEN_KEY, token);
      } else {
        localStorage.removeItem(REFRESH_TOKEN_KEY);
      }
    } catch (error) {
      console.error('Failed to set refresh token:', error);
    }
  },

  clear: () => {
    try {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(REFRESH_TOKEN_KEY);
      // Clean up legacy keys
      localStorage.removeItem('token');
      localStorage.removeItem('access_token');
      localStorage.removeItem('loginResponse');
      localStorage.removeItem('user_data');
    } catch (error) {
      console.error('Failed to clear tokens:', error);
    }
  },
};

// Token utilities
export const isTokenExpired = (token) => {
  if (!token) return true;
  try {
    const decoded = jwtDecode(token);
    // Add 30 second buffer for network latency
    return decoded.exp * 1000 < Date.now() + 30000;
  } catch {
    return true;
  }
};

export const isTokenExpiringSoon = (token, minutesBefore = 5) => {
  if (!token) return true;
  try {
    const decoded = jwtDecode(token);
    const expiresIn = decoded.exp * 1000 - Date.now();
    return expiresIn < minutesBefore * 60 * 1000;
  } catch {
    return true;
  }
};

export const getTokenPayload = (token) => {
  try {
    return jwtDecode(token);
  } catch {
    return null;
  }
};

export const getTokenExpiryTime = (token) => {
  try {
    const decoded = jwtDecode(token);
    return decoded.exp * 1000;
  } catch {
    return null;
  }
};

export default tokenStorage;
