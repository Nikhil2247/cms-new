import { useState, useEffect, useCallback, useRef } from 'react';
import toast from 'react-hot-toast';

/**
 * Infinite scroll hook for paginated lists with intersection observer support
 * @param {Function} fetchFn - Function to fetch data, receives (page, pageSize) as params
 * @param {object} options - Configuration options
 * @param {number} options.pageSize - Number of items per page (default: 10)
 * @param {number} options.initialPage - Starting page number (default: 1)
 * @param {boolean} options.enabled - Whether to enable auto-fetching (default: true)
 * @param {boolean} options.showToast - Show error toasts (default: true)
 * @param {Function} options.onSuccess - Success callback
 * @param {Function} options.onError - Error callback
 * @returns {object} - Data, loading state, hasMore flag, loadMore, reset, and observerRef
 *
 * @example
 * const fetchItems = async (page, pageSize) => {
 *   const response = await apiClient.get(`/items?page=${page}&limit=${pageSize}`);
 *   return response.data;
 * };
 *
 * const { data, loading, hasMore, loadMore, reset, observerRef } = useInfiniteScroll(
 *   fetchItems,
 *   { pageSize: 20 }
 * );
 *
 * // Use observerRef for automatic loading
 * <div ref={observerRef}>Load more...</div>
 */
export const useInfiniteScroll = (fetchFn, options = {}) => {
  const {
    pageSize = 10,
    initialPage = 1,
    enabled = true,
    showToast = true,
    onSuccess,
    onError,
  } = options;

  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(initialPage);
  const [hasMore, setHasMore] = useState(true);
  const observerRef = useRef(null);
  const observerTarget = useRef(null);

  /**
   * Load more data
   */
  const loadMore = useCallback(async () => {
    if (loading || !hasMore || !enabled) return;

    setLoading(true);
    setError(null);

    try {
      const result = await fetchFn(page, pageSize);

      // Handle different response formats
      let newItems = [];
      let total = null;

      if (Array.isArray(result)) {
        newItems = result;
      } else if (result.data || result.items) {
        newItems = result.data || result.items;
        total = result.total || result.totalCount;
      } else {
        newItems = [];
      }

      // Update data
      setData((prevData) => [...prevData, ...newItems]);

      // Determine if there are more items
      if (newItems.length < pageSize) {
        setHasMore(false);
      } else if (total !== null) {
        const totalLoaded = data.length + newItems.length;
        setHasMore(totalLoaded < total);
      }

      // Increment page for next fetch
      if (newItems.length > 0) {
        setPage((prevPage) => prevPage + 1);
      }

      if (onSuccess) {
        onSuccess(newItems);
      }
    } catch (err) {
      const errorMessage = err.response?.data?.message || err.message || 'Failed to load more items';
      setError(errorMessage);
      setHasMore(false);

      if (onError) {
        onError(err);
      }

      if (showToast) {
        toast.error(errorMessage);
      }
    } finally {
      setLoading(false);
    }
  }, [fetchFn, page, pageSize, loading, hasMore, enabled, data.length, onSuccess, onError, showToast]);

  /**
   * Reset to initial state
   */
  const reset = useCallback(() => {
    setData([]);
    setPage(initialPage);
    setHasMore(true);
    setError(null);
    setLoading(false);
  }, [initialPage]);

  /**
   * Set up intersection observer for automatic loading
   */
  useEffect(() => {
    if (!enabled || !hasMore) return;

    const options = {
      root: null,
      rootMargin: '100px',
      threshold: 0.1,
    };

    const handleIntersect = (entries) => {
      const [entry] = entries;
      if (entry.isIntersecting && !loading && hasMore) {
        loadMore();
      }
    };

    observerRef.current = new IntersectionObserver(handleIntersect, options);

    if (observerTarget.current) {
      observerRef.current.observe(observerTarget.current);
    }

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, [enabled, hasMore, loading, loadMore]);

  /**
   * Initial load
   */
  useEffect(() => {
    if (enabled && data.length === 0 && page === initialPage) {
      loadMore();
    }
  }, [enabled, initialPage]); // Only run on mount and when enabled changes

  /**
   * Observer ref setter for the target element
   */
  const setObserverTarget = useCallback((node) => {
    observerTarget.current = node;
  }, []);

  return {
    data,
    loading,
    error,
    hasMore,
    loadMore,
    reset,
    observerRef: setObserverTarget,
  };
};

export default useInfiniteScroll;
