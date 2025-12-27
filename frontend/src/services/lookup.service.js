import API from './api';

/**
 * Lookup Service
 * API methods for shared lookup data (dropdowns, filters, etc.)
 * These endpoints return cached data optimized for filter/dropdown usage.
 */
export const lookupService = {
  /**
   * Get all institutions for filters/dropdowns
   * @param {boolean} includeInactive - Include inactive institutions (useful for reports)
   */
  async getInstitutions(includeInactive = false) {
    const url = includeInactive
      ? '/shared/lookup/institutions?includeInactive=true'
      : '/shared/lookup/institutions';
    const response = await API.get(url);
    return response.data;
  },

  /**
   * Get all batches for filters/dropdowns
   */
  async getBatches() {
    const response = await API.get('/shared/lookup/batches');
    return response.data;
  },

  /**
   * Get all approved industries for filters/dropdowns
   */
  async getIndustries() {
    const response = await API.get('/shared/lookup/industries');
    return response.data;
  },

  /**
   * Get available user roles
   */
  async getRoles() {
    const response = await API.get('/shared/lookup/roles');
    return response.data;
  },
};

export default lookupService;
