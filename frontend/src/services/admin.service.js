import API from './api';

/**
 * Admin Service
 * API methods for system admin operations
 */
export const adminService = {
  // ==================== HEALTH & METRICS ====================

  async getDetailedHealth() {
    const response = await API.get('/system-admin/health/detailed');
    return response.data;
  },

  async getRealtimeMetrics() {
    const response = await API.get('/system-admin/metrics/realtime');
    return response.data;
  },

  // ==================== BACKUP MANAGEMENT ====================

  async createBackup(data) {
    const response = await API.post('/system-admin/backup/create', data);
    return response.data;
  },

  async listBackups(params = {}) {
    const cleanParams = Object.fromEntries(
      Object.entries(params).filter(([, v]) => v != null && v !== '')
    );
    const queryParams = new URLSearchParams(cleanParams).toString();
    const url = queryParams ? `/system-admin/backup/list?${queryParams}` : '/system-admin/backup/list';
    const response = await API.get(url);
    return response.data;
  },

  async getBackupDownloadUrl(id) {
    const response = await API.get(`/system-admin/backup/download/${id}`);
    return response.data;
  },

  async restoreBackup(id, confirmRestore = true) {
    const response = await API.post(`/system-admin/backup/restore/${id}`, { confirmRestore });
    return response.data;
  },

  async uploadBackup(file, onProgress) {
    const formData = new FormData();
    formData.append('file', file);
    const response = await API.post('/system-admin/backup/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      onUploadProgress: onProgress,
    });
    return response.data;
  },

  async deleteBackup(id) {
    const response = await API.delete(`/system-admin/backup/${id}`);
    return response.data;
  },

  // ==================== USER MANAGEMENT ====================

  async getUsers(params = {}) {
    const cleanParams = Object.fromEntries(
      Object.entries(params).filter(([, v]) => v != null && v !== '')
    );
    const queryParams = new URLSearchParams(cleanParams).toString();
    const url = queryParams ? `/system-admin/users?${queryParams}` : '/system-admin/users';
    const response = await API.get(url);
    return response.data;
  },

  async getUserById(id) {
    const response = await API.get(`/system-admin/users/${id}`);
    return response.data;
  },

  async createUser(data) {
    const response = await API.post('/system-admin/users', data);
    return response.data;
  },

  async updateUser(id, data) {
    const response = await API.put(`/system-admin/users/${id}`, data);
    return response.data;
  },

  async deleteUser(id, permanent = false) {
    const response = await API.delete(`/system-admin/users/${id}?permanent=${permanent}`);
    return response.data;
  },

  async bulkUserAction(data) {
    const response = await API.post('/system-admin/users/bulk', data);
    return response.data;
  },

  async resetUserPassword(id) {
    const response = await API.post(`/system-admin/users/${id}/reset-password`);
    return response.data;
  },

  // ==================== SESSION MANAGEMENT ====================

  async getActiveSessions(params = {}) {
    const cleanParams = Object.fromEntries(
      Object.entries(params).filter(([, v]) => v != null && v !== '')
    );
    const queryParams = new URLSearchParams(cleanParams).toString();
    const url = queryParams ? `/system-admin/sessions?${queryParams}` : '/system-admin/sessions';
    const response = await API.get(url);
    return response.data;
  },

  async getSessionStats() {
    const response = await API.get('/system-admin/sessions/stats');
    return response.data;
  },

  async terminateSession(id) {
    const response = await API.delete(`/system-admin/sessions/${id}`);
    return response.data;
  },

  async terminateAllSessions(options = {}) {
    const response = await API.post('/system-admin/sessions/terminate-all', options);
    return response.data;
  },

  async terminateUserSessions(userId) {
    const response = await API.post(`/system-admin/sessions/terminate-user/${userId}`);
    return response.data;
  },
};

export default adminService;
