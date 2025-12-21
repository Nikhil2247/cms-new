import API from './api';

export const grievanceService = {
  /**
   * Get all grievances with optional filtering
   * @param {Object} params - Query parameters (status, category, priority, etc.)
   * @returns {Promise} - List of grievances
   */
  async getAll(params = {}) {
    const queryParams = new URLSearchParams(params).toString();
    const response = await API.get(`/grievances?${queryParams}`);
    return response.data;
  },

  /**
   * Get grievances by institution ID
   * @param {string} institutionId - Institution ID
   * @returns {Promise} - List of grievances for the institution
   */
  async getByInstitution(institutionId) {
    const response = await API.get(`/grievances/institution/${institutionId}`);
    return response.data;
  },

  /**
   * Get grievances by user ID
   * @param {string} userId - User ID
   * @returns {Promise} - List of user's grievances
   */
  async getByUser(userId) {
    const response = await API.get(`/grievances/user/${userId}`);
    return response.data;
  },

  /**
   * Get a single grievance by ID
   * @param {string} id - Grievance ID
   * @returns {Promise} - Grievance details
   */
  async getById(id) {
    const response = await API.get(`/grievances/${id}`);
    return response.data;
  },

  /**
   * Submit a new grievance
   * @param {Object} data - Grievance data (category, subject, description, priority, etc.)
   * @returns {Promise} - Created grievance
   */
  async submit(data) {
    const response = await API.post('/grievances', data);
    return response.data;
  },

  /**
   * Respond to a grievance
   * @param {string} id - Grievance ID
   * @param {string} response - Response text
   * @param {string[]} attachments - Optional attachments
   * @returns {Promise} - Updated grievance
   */
  async respond(id, response, attachments = []) {
    const res = await API.post(`/grievances/${id}/respond`, { response, attachments });
    return res.data;
  },

  /**
   * Escalate a grievance
   * @param {string} id - Grievance ID
   * @returns {Promise} - Updated grievance
   */
  async escalate(id) {
    const response = await API.post(`/grievances/${id}/escalate`);
    return response.data;
  },

  /**
   * Update grievance status
   * @param {string} id - Grievance ID
   * @param {string} status - New status (SUBMITTED, IN_REVIEW, ESCALATED, RESOLVED, CLOSED)
   * @returns {Promise} - Updated grievance
   */
  async updateStatus(id, status) {
    const response = await API.patch(`/grievances/${id}/status`, { status });
    return response.data;
  },

  /**
   * Assign grievance to a user
   * @param {string} id - Grievance ID
   * @param {string} assigneeId - User ID to assign to
   * @returns {Promise} - Updated grievance
   */
  async assign(id, assigneeId) {
    const response = await API.patch(`/grievances/${id}/assign`, { assigneeId });
    return response.data;
  },

  /**
   * Get grievance statistics
   * @param {string} institutionId - Optional institution ID
   * @returns {Promise} - Statistics object
   */
  async getStatistics(institutionId = null) {
    const params = institutionId ? `?institutionId=${institutionId}` : '';
    const response = await API.get(`/grievances/statistics${params}`);
    return response.data;
  },

  /**
   * Close a grievance
   * @param {string} id - Grievance ID
   * @returns {Promise} - Updated grievance
   */
  async close(id) {
    const response = await API.patch(`/grievances/${id}/close`);
    return response.data;
  },
};

export default grievanceService;
