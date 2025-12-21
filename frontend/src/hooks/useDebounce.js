import { useState, useEffect } from 'react';

/**
 * Debounce hook for optimizing search and filter inputs
 * @param {*} value - The value to debounce
 * @param {number} delay - The delay in milliseconds (default: 300ms)
 * @param {object} options - Configuration options
 * @param {boolean} options.immediate - Execute immediately on first call (default: false)
 * @returns {*} - The debounced value
 *
 * @example
 * const [searchTerm, setSearchTerm] = useState('');
 * const debouncedSearchTerm = useDebounce(searchTerm, 500);
 *
 * useEffect(() => {
 *   if (debouncedSearchTerm) {
 *     performSearch(debouncedSearchTerm);
 *   }
 * }, [debouncedSearchTerm]);
 */
export const useDebounce = (value, delay = 300, options = {}) => {
  const { immediate = false } = options;
  const [debouncedValue, setDebouncedValue] = useState(value);
  const [isFirstRun, setIsFirstRun] = useState(true);

  useEffect(() => {
    // Handle immediate execution on first run
    if (immediate && isFirstRun) {
      setDebouncedValue(value);
      setIsFirstRun(false);
      return;
    }

    setIsFirstRun(false);

    // Set up debounce timer
    const timer = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    // Clean up timer on value change or unmount
    return () => {
      clearTimeout(timer);
    };
  }, [value, delay, immediate, isFirstRun]);

  return debouncedValue;
};

export default useDebounce;
