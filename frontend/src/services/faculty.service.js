import API from './api';

/**
 * Faculty Service
 * API methods for faculty operations
 */
export const facultyService = {
  // Dashboard
  async getDashboard() {
    const response = await API.get('/faculty/dashboard');
    return response.data;
  },

  // Profile
  async getProfile() {
    const response = await API.get('/faculty/profile');
    return response.data;
  },

  // Assigned Students - Fixed endpoint to match backend
  async getAssignedStudents(params = {}) {
    const queryParams = new URLSearchParams();
    if (params.page) queryParams.append('page', params.page);
    if (params.limit) queryParams.append('limit', params.limit);
    if (params.search) queryParams.append('search', params.search);

    const queryString = queryParams.toString();
    const url = queryString ? `/faculty/students?${queryString}` : '/faculty/students';
    const response = await API.get(url);
    return response.data;
  },

  async getStudentDetails(studentId) {
    const response = await API.get(`/faculty/students/${studentId}`);
    return response.data;
  },

  async getStudentProgress(studentId) {
    const response = await API.get(`/faculty/students/${studentId}/progress`);
    return response.data;
  },

  // Visit Logs
  async getVisitLogs(params = {}) {
    const queryParams = new URLSearchParams();
    if (params.page) queryParams.append('page', params.page);
    if (params.limit) queryParams.append('limit', params.limit);
    if (params.studentId) queryParams.append('studentId', params.studentId);

    const queryString = queryParams.toString();
    const url = queryString ? `/faculty/visit-logs?${queryString}` : '/faculty/visit-logs';
    const response = await API.get(url);
    return response.data;
  },

  async getVisitLogById(id) {
    const response = await API.get(`/faculty/visit-logs/${id}`);
    return response.data;
  },

  async createVisitLog(data) {
    const response = await API.post('/faculty/visit-logs', data);
    return response.data;
  },

  async updateVisitLog(id, data) {
    const response = await API.put(`/faculty/visit-logs/${id}`, data);
    return response.data;
  },

  async deleteVisitLog(id) {
    const response = await API.delete(`/faculty/visit-logs/${id}`);
    return response.data;
  },

  // Monthly Reports
  async getMonthlyReports(params = {}) {
    const queryParams = new URLSearchParams();
    if (params.page) queryParams.append('page', params.page);
    if (params.limit) queryParams.append('limit', params.limit);
    if (params.status) queryParams.append('status', params.status);

    const queryString = queryParams.toString();
    const url = queryString ? `/faculty/monthly-reports?${queryString}` : '/faculty/monthly-reports';
    const response = await API.get(url);
    return response.data;
  },

  async reviewMonthlyReport(id, reviewData) {
    const response = await API.put(`/faculty/monthly-reports/${id}/review`, reviewData);
    return response.data;
  },

  // Self-Identified Approvals
  async getSelfIdentifiedApprovals(params = {}) {
    const queryParams = new URLSearchParams();
    if (params.page) queryParams.append('page', params.page);
    if (params.limit) queryParams.append('limit', params.limit);
    if (params.status) queryParams.append('status', params.status);

    const queryString = queryParams.toString();
    const url = queryString ? `/faculty/approvals/self-identified?${queryString}` : '/faculty/approvals/self-identified';
    const response = await API.get(url);
    return response.data;
  },

  async updateSelfIdentifiedApproval(id, data) {
    const response = await API.put(`/faculty/approvals/self-identified/${id}`, data);
    return response.data;
  },

  // Feedback
  async submitMonthlyFeedback(data) {
    const response = await API.post('/faculty/feedback/monthly', data);
    return response.data;
  },

  async getFeedbackHistory(params = {}) {
    const queryParams = new URLSearchParams();
    if (params.page) queryParams.append('page', params.page);
    if (params.limit) queryParams.append('limit', params.limit);
    if (params.studentId) queryParams.append('studentId', params.studentId);

    const queryString = queryParams.toString();
    const url = queryString ? `/faculty/feedback/history?${queryString}` : '/faculty/feedback/history';
    const response = await API.get(url);
    return response.data;
  },
};

export default facultyService;
