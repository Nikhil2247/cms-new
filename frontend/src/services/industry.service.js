import API from './api';

/**
 * Industry Service
 * API methods for industry partner operations
 */
export const industryService = {
  // Dashboard
  async getDashboard() {
    const response = await API.get('/industry/dashboard');
    return response.data;
  },

  // Internship Postings
  async getMyPostings(params = {}) {
    const queryParams = new URLSearchParams(params).toString();
    const url = queryParams ? `/industry/postings?${queryParams}` : '/industry/postings';
    const response = await API.get(url);
    return response.data;
  },

  async getPostingById(id) {
    const response = await API.get(`/industry/postings/${id}`);
    return response.data;
  },

  async createPosting(data) {
    const response = await API.post('/industry/postings', data);
    return response.data;
  },

  async updatePosting(id, data) {
    const response = await API.put(`/industry/postings/${id}`, data);
    return response.data;
  },

  async deletePosting(id) {
    const response = await API.delete(`/industry/postings/${id}`);
    return response.data;
  },

  async togglePostingStatus(id, isActive) {
    const response = await API.patch(`/industry/postings/${id}/status`, { isActive });
    return response.data;
  },

  // Applications
  async getMyApplications(params = {}) {
    const queryParams = new URLSearchParams(params).toString();
    const url = queryParams ? `/industry/applications?${queryParams}` : '/industry/applications';
    const response = await API.get(url);
    return response.data;
  },

  async getApplicationById(id) {
    const response = await API.get(`/industry/applications/${id}`);
    return response.data;
  },

  async updateApplicationStatus(id, status, rejectionReason = null) {
    const response = await API.patch(`/industry/applications/${id}/status`, {
      status,
      rejectionReason,
    });
    return response.data;
  },

  async shortlistApplication(id) {
    const response = await API.post(`/industry/applications/${id}/shortlist`);
    return response.data;
  },

  async selectApplication(id, joiningDate = null) {
    const response = await API.post(`/industry/applications/${id}/select`, { joiningDate });
    return response.data;
  },

  async rejectApplication(id, reason) {
    const response = await API.post(`/industry/applications/${id}/reject`, { reason });
    return response.data;
  },

  // Profile
  async getProfile() {
    const response = await API.get('/industry/profile');
    return response.data;
  },

  async updateProfile(data, logo = null) {
    const formData = new FormData();
    Object.entries(data).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        formData.append(key, value);
      }
    });
    if (logo) {
      formData.append('logo', logo);
    }
    const response = await API.put('/industry/profile', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  },

  // Statistics
  async getStatistics() {
    const response = await API.get('/industry/statistics');
    return response.data;
  },
};

export default industryService;
