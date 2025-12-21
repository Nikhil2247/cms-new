import axios from 'axios';
import toast from 'react-hot-toast';
import { tokenStorage, isTokenExpired, isTokenExpiringSoon } from '../utils/tokenManager';

// Store reference for dispatching actions
let storeRef = null;
let refreshPromise = null;

export const setStore = (store) => {
  storeRef = store;
};

const getBaseURL = () => {
  const raw = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:3000';
  const baseUrl = raw
    .replace('http://localhost', 'http://127.0.0.1')
    .replace('https://localhost', 'https://127.0.0.1');
  return `${baseUrl}/api`;
};

const API = axios.create({
  baseURL: getBaseURL(),
  withCredentials: true,
  timeout: 30000,
});

// Refresh token function
const refreshAuthToken = async () => {
  // Prevent multiple simultaneous refresh attempts
  if (refreshPromise) {
    return refreshPromise;
  }

  const refreshToken = tokenStorage.getRefreshToken();
  if (!refreshToken) {
    throw new Error('No refresh token available');
  }

  // Backend expects snake_case: { refresh_token: string }
  refreshPromise = API.post('/auth/refresh', { refresh_token: refreshToken })
    .then((response) => {
      const newToken = response.data?.access_token || response.data?.accessToken || response.data?.token;
      const newRefreshToken = response.data?.refresh_token || response.data?.refreshToken;

      if (newToken) {
        tokenStorage.setToken(newToken);
      }
      if (newRefreshToken) {
        tokenStorage.setRefreshToken(newRefreshToken);
      }

      return newToken;
    })
    .finally(() => {
      refreshPromise = null;
    });

  return refreshPromise;
};

// Logout and redirect
const handleLogout = (message) => {
  tokenStorage.clear();

  // Clear Redux persist
  localStorage.removeItem('persist:root');

  if (message) {
    toast.error(message);
  }

  // Redirect to login
  window.location.href = '/login';
};

// Request interceptor
API.interceptors.request.use(
  async (config) => {
    // Skip token handling for auth endpoints
    if (config.url?.includes('/auth/login') || config.url?.includes('/auth/refresh')) {
      return config;
    }

    let token = tokenStorage.getToken();

    // Check if token is expired
    if (token && isTokenExpired(token)) {
      try {
        token = await refreshAuthToken();
      } catch (error) {
        handleLogout('Session expired. Please login again.');
        return Promise.reject(new Error('Token expired'));
      }
    }
    // Proactively refresh if expiring soon (within 5 minutes)
    else if (token && isTokenExpiringSoon(token, 5)) {
      // Refresh in background, don't block the request
      refreshAuthToken().catch(() => {
        // Silently fail - will retry on next request
      });
    }

    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor
API.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // Handle 401 - attempt token refresh once
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        const newToken = await refreshAuthToken();
        originalRequest.headers.Authorization = `Bearer ${newToken}`;
        return API(originalRequest);
      } catch (refreshError) {
        handleLogout('Session expired. Please login again.');
        return Promise.reject(refreshError);
      }
    }

    // Handle other errors
    if (error.response?.status === 403) {
      toast.error("Access denied. You don't have permission.");
    } else if (error.response?.status === 429) {
      toast.error('Too many requests. Please slow down.');
    } else if (!error.response) {
      toast.error('Network error. Please check your connection.');
    }

    return Promise.reject(error);
  }
);

export const apiClient = API;
export default API;
