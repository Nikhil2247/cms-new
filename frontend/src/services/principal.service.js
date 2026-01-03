import API from './api';

/**
 * Principal Service
 * API methods for principal operations
 * Note: Response unwrapping is handled centrally in api.js interceptor
 */
export const principalService = {
  // Dashboard
  async getDashboard() {
    const response = await API.get('/principal/dashboard');
    return response.data;
  },

  // Dashboard - Mentor Coverage
  async getMentorCoverage() {
    const response = await API.get('/principal/dashboard/mentor-coverage');
    return response.data;
  },

  // Dashboard - Compliance Metrics
  async getComplianceMetrics() {
    const response = await API.get('/principal/dashboard/compliance');
    return response.data;
  },

  // Dashboard - Enhanced Alerts
  async getAlertsEnhanced() {
    const response = await API.get('/principal/dashboard/alerts-enhanced');
    return response.data;
  },

  // Students
  async getStudents(params = {}) {
    // Filter out empty/undefined values to avoid sending "undefined" strings
    const cleanParams = Object.fromEntries(
      Object.entries(params).filter(([, v]) => v != null && v !== '')
    );
    const queryParams = new URLSearchParams(cleanParams).toString();
    const url = queryParams ? `/principal/students?${queryParams}` : '/principal/students';
    const response = await API.get(url);
    return response.data;
  },

  async getStudentById(id) {
    const response = await API.get(`/principal/students/${id}`);
    return response.data;
  },

  async createStudent(data, profileImage = null) {
    const formData = new FormData();
    Object.entries(data).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        formData.append(key, value);
      }
    });
    if (profileImage) {
      formData.append('profileImage', profileImage);
    }
    const response = await API.post('/principal/students', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  },

  async updateStudent(id, data, profileImage = null) {
    // Only use FormData if there's a profile image, otherwise send JSON
    if (profileImage) {
      const formData = new FormData();
      Object.entries(data).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          // Convert booleans to strings for FormData
          formData.append(key, typeof value === 'boolean' ? String(value) : value);
        }
      });
      formData.append('profileImage', profileImage);
      const response = await API.put(`/principal/students/${id}`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      return response.data;
    }

    // Send JSON for regular updates (preserves boolean types)
    const response = await API.put(`/principal/students/${id}`, data);
    return response.data;
  },

  async deleteStudent(id) {
    const response = await API.delete(`/principal/students/${id}`);
    return response.data;
  },

  async bulkUploadStudents(file) {
    const formData = new FormData();
    formData.append('file', file);
    const response = await API.post('/principal/students/bulk-upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  },

  async bulkUploadStaff(file) {
    const formData = new FormData();
    formData.append('file', file);
    const response = await API.post('/principal/staff/bulk-upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  },

  // Note: downloadTemplate moved to bulk.service.js

  // Staff
  async getStaff(params = {}) {
    const queryParams = new URLSearchParams(params).toString();
    const url = queryParams ? `/principal/staff?${queryParams}` : '/principal/staff';
    const response = await API.get(url);
    return response.data;
  },

  async getStaffById(id) {
    const response = await API.get(`/principal/staff/${id}`);
    return response.data;
  },

  async createStaff(data) {
    const response = await API.post('/principal/staff', data);
    return response.data;
  },

  async updateStaff(id, data) {
    const response = await API.put(`/principal/staff/${id}`, data);
    return response.data;
  },

  async deleteStaff(id) {
    const response = await API.delete(`/principal/staff/${id}`);
    return response.data;
  },

  // Mentors
  async getMentors(params = {}) {
    const queryParams = new URLSearchParams(params).toString();
    const url = queryParams ? `/principal/mentors?${queryParams}` : '/principal/mentors';
    const response = await API.get(url);
    return response.data;
  },

  async assignMentor(data) {
    // data should contain: { mentorId, studentIds, academicYear, semester?, reason?, notes? }
    const response = await API.post('/principal/mentors/assign', data);
    return response.data;
  },

  async getMentorAssignments(params = {}) {
    const queryParams = new URLSearchParams(params).toString();
    const url = queryParams ? `/principal/mentors/assignments?${queryParams}` : '/principal/mentors/assignments';
    const response = await API.get(url);
    return response.data;
  },

  async getExternalMentorAssignments(params = {}) {
    const queryParams = new URLSearchParams(params).toString();
    const url = queryParams ? `/principal/mentors/external-assignments?${queryParams}` : '/principal/mentors/external-assignments';
    const response = await API.get(url);
    return response.data;
  },

  async getMentorStats() {
    const response = await API.get('/principal/mentors/stats');
    return response.data;
  },

  // Joining Letters
  async getJoiningLetterStats() {
    const response = await API.get('/principal/joining-letters/stats');
    return response.data;
  },

  async getJoiningLetters(params = {}) {
    const cleanParams = Object.fromEntries(
      Object.entries(params).filter(([, v]) => v != null && v !== '')
    );
    const queryParams = new URLSearchParams(cleanParams).toString();
    const url = queryParams ? `/principal/joining-letters?${queryParams}` : '/principal/joining-letters';
    const response = await API.get(url);
    return response.data;
  },

  async getJoiningLetterActivity(limit = 10) {
    const response = await API.get(`/principal/joining-letters/activity?limit=${limit}`);
    return response.data;
  },

  async verifyJoiningLetter(applicationId, data = {}) {
    const response = await API.put(`/principal/joining-letters/${applicationId}/verify`, data);
    return response.data;
  },

  async rejectJoiningLetter(applicationId, remarks) {
    const response = await API.put(`/principal/joining-letters/${applicationId}/reject`, { remarks });
    return response.data;
  },

  // Internship Stats with Company Details
  async getInternshipStats() {
    const response = await API.get('/principal/internships/stats');
    return response.data;
  },

  // Faculty Workload
  async getFacultyProgress(params = {}) {
    const queryParams = new URLSearchParams(params).toString();
    const url = queryParams ? `/principal/faculty/progress?${queryParams}` : '/principal/faculty/progress';
    const response = await API.get(url);
    return response.data;
  },

  async getFacultyProgressDetails(facultyId) {
    const response = await API.get(`/principal/faculty/progress/${facultyId}`);
    return response.data;
  },

  // Internship Management
  async getInternshipById(applicationId) {
    const response = await API.get(`/principal/internships/${applicationId}`);
    return response.data;
  },

  async updateInternship(applicationId, data) {
    const response = await API.put(`/principal/internships/${applicationId}`, data);
    return response.data;
  },

  async bulkUpdateInternshipStatus(applicationIds, status, remarks = '') {
    const response = await API.post('/principal/internships/bulk-status', {
      applicationIds,
      status,
      remarks,
    });
    return response.data;
  },

  // Remove mentor from student
  async removeMentor(studentId) {
    const response = await API.delete(`/principal/students/${studentId}/mentor`);
    return response.data;
  },

  // Bulk unassign mentors
  async bulkUnassignMentors(studentIds) {
    const response = await API.post('/principal/mentors/bulk-unassign', { studentIds });
    return response.data;
  },

  // Auto-assign mentors
  async autoAssignMentors() {
    const response = await API.post('/principal/mentors/auto-assign');
    return response.data;
  },

  // Note: resetUserPassword moved to credentialsService
  // Use credentialsService.resetUserPassword(userId) instead
};

export default principalService;
