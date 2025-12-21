// Cache duration in milliseconds (5 minutes)
export const CACHE_DURATION = 5 * 60 * 1000;

// Check if data is stale
export const isStale = (lastFetched) => {
  if (!lastFetched) return true;
  return Date.now() - lastFetched > CACHE_DURATION;
};

// Cache middleware - prevents redundant API calls
export const cacheMiddleware = (store) => (next) => (action) => {
  // Only intercept fetch actions
  if (action.type?.endsWith('/pending')) {
    const sliceName = action.type.split('/')[0];
    const state = store.getState()[sliceName];

    // If we have cached data and it's not stale, skip the fetch
    if (state?.lastFetched && !isStale(state.lastFetched) && !action.meta?.arg?.force) {
      console.log(`[Cache] Skipping fetch for ${action.type} - data is fresh`);
      return;
    }
  }

  return next(action);
};
