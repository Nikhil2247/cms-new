import { useState, useEffect, useCallback } from 'react';
import { apiClient } from '../services/api';
import toast from 'react-hot-toast';

/**
 * Smart fetch hook with automatic data fetching, caching, and error handling
 * @param {string} url - API endpoint URL
 * @param {object} options - Configuration options
 * @returns {object} - Data, loading state, error, and refetch function
 */
export const useSmartFetch = (url, options = {}) => {
  const {
    method = 'GET',
    body = null,
    dependencies = [],
    enabled = true,
    onSuccess,
    onError,
    showToast = true,
  } = options;

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchData = useCallback(async () => {
    if (!enabled || !url) return;

    setLoading(true);
    setError(null);

    try {
      let response;

      switch (method.toUpperCase()) {
        case 'GET':
          response = await apiClient.get(url);
          break;
        case 'POST':
          response = await apiClient.post(url, body);
          break;
        case 'PUT':
          response = await apiClient.put(url, body);
          break;
        case 'PATCH':
          response = await apiClient.patch(url, body);
          break;
        case 'DELETE':
          response = await apiClient.delete(url);
          break;
        default:
          response = await apiClient.get(url);
      }

      setData(response.data || response);

      if (onSuccess) {
        onSuccess(response.data || response);
      }

      if (showToast && method !== 'GET') {
        toast.success(response.message || 'Operation successful');
      }
    } catch (err) {
      const errorMessage = err.response?.data?.message || err.message || 'An error occurred';
      setError(errorMessage);

      if (onError) {
        onError(err);
      }

      if (showToast) {
        toast.error(errorMessage);
      }
    } finally {
      setLoading(false);
    }
  }, [url, method, body, enabled, onSuccess, onError, showToast]);

  useEffect(() => {
    fetchData();
  }, [fetchData, ...dependencies]);

  const refetch = useCallback(() => {
    fetchData();
  }, [fetchData]);

  return {
    data,
    loading,
    error,
    refetch,
  };
};

export default useSmartFetch;
