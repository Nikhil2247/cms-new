import API from './api';

/**
 * Helper to unwrap response if it has TransformInterceptor wrapper structure.
 * The wrapper has: { data: T, statusCode: number, message: string, timestamp: string }
 */
const unwrapIfWrapped = (data) => {
  if (
    data &&
    typeof data === 'object' &&
    'statusCode' in data &&
    'message' in data &&
    'timestamp' in data &&
    'data' in data
  ) {
    return data.data;
  }
  return data;
};

/**
 * Principal Service
 * API methods for principal operations
 */
export const principalService = {
  // Dashboard
  async getDashboard() {
    const response = await API.get('/principal/dashboard');
    return unwrapIfWrapped(response.data);
  },

  // Dashboard - Mentor Coverage
  async getMentorCoverage() {
    const response = await API.get('/principal/dashboard/mentor-coverage');
    return unwrapIfWrapped(response.data);
  },

  // Dashboard - Compliance Metrics
  async getComplianceMetrics() {
    const response = await API.get('/principal/dashboard/compliance');
    return unwrapIfWrapped(response.data);
  },

  // Dashboard - Enhanced Alerts
  async getAlertsEnhanced() {
    const response = await API.get('/principal/dashboard/alerts-enhanced');
    return unwrapIfWrapped(response.data);
  },

  // Students
  async getStudents(params = {}) {
    const queryParams = new URLSearchParams(params).toString();
    const url = queryParams ? `/principal/students?${queryParams}` : '/principal/students';
    const response = await API.get(url);
    return unwrapIfWrapped(response.data);
  },

  async getStudentById(id) {
    const response = await API.get(`/principal/students/${id}`);
    return unwrapIfWrapped(response.data);
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
    return unwrapIfWrapped(response.data);
  },

  async updateStudent(id, data, profileImage = null) {
    const formData = new FormData();
    Object.entries(data).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        formData.append(key, value);
      }
    });
    if (profileImage) {
      formData.append('profileImage', profileImage);
    }
    const response = await API.put(`/principal/students/${id}`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return unwrapIfWrapped(response.data);
  },

  async deleteStudent(id) {
    const response = await API.delete(`/principal/students/${id}`);
    return unwrapIfWrapped(response.data);
  },

  async bulkUploadStudents(file) {
    const formData = new FormData();
    formData.append('file', file);
    const response = await API.post('/principal/students/bulk-upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return unwrapIfWrapped(response.data);
  },

  async bulkUploadStaff(file) {
    const formData = new FormData();
    formData.append('file', file);
    const response = await API.post('/principal/staff/bulk-upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return unwrapIfWrapped(response.data);
  },

  async downloadTemplate(type) {
    const response = await API.get(`/bulk/templates/${type}`, {
      responseType: 'blob',
    });
    // Create download link
    const url = window.URL.createObjectURL(new Blob([response.data]));
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `${type}-template.xlsx`);
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
    return response.data;
  },

  // Staff
  async getStaff(params = {}) {
    const queryParams = new URLSearchParams(params).toString();
    const url = queryParams ? `/principal/staff?${queryParams}` : '/principal/staff';
    const response = await API.get(url);
    return unwrapIfWrapped(response.data);
  },

  async getStaffById(id) {
    const response = await API.get(`/principal/staff/${id}`);
    return unwrapIfWrapped(response.data);
  },

  async createStaff(data) {
    const response = await API.post('/principal/staff', data);
    return unwrapIfWrapped(response.data);
  },

  async updateStaff(id, data) {
    const response = await API.put(`/principal/staff/${id}`, data);
    return unwrapIfWrapped(response.data);
  },

  async deleteStaff(id) {
    const response = await API.delete(`/principal/staff/${id}`);
    return unwrapIfWrapped(response.data);
  },

  // Mentors
  async getMentors(params = {}) {
    const queryParams = new URLSearchParams(params).toString();
    const url = queryParams ? `/principal/mentors?${queryParams}` : '/principal/mentors';
    const response = await API.get(url);
    return unwrapIfWrapped(response.data);
  },

  async assignMentor(data) {
    // data should contain: { mentorId, studentIds, academicYear, semester?, reason?, notes? }
    const response = await API.post('/principal/mentors/assign', data);
    return unwrapIfWrapped(response.data);
  },

  async getMentorAssignments(params = {}) {
    const queryParams = new URLSearchParams(params).toString();
    const url = queryParams ? `/principal/mentors/assignments?${queryParams}` : '/principal/mentors/assignments';
    const response = await API.get(url);
    return unwrapIfWrapped(response.data);
  },

  // Joining Letters
  async getJoiningLetterStats() {
    const response = await API.get('/principal/joining-letters/stats');
    return unwrapIfWrapped(response.data);
  },

  async getJoiningLetters(params = {}) {
    const cleanParams = Object.fromEntries(
      Object.entries(params).filter(([, v]) => v != null && v !== '')
    );
    const queryParams = new URLSearchParams(cleanParams).toString();
    const url = queryParams ? `/principal/joining-letters?${queryParams}` : '/principal/joining-letters';
    const response = await API.get(url);
    return unwrapIfWrapped(response.data);
  },

  async getJoiningLetterActivity(limit = 10) {
    const response = await API.get(`/principal/joining-letters/activity?limit=${limit}`);
    return unwrapIfWrapped(response.data);
  },

  async verifyJoiningLetter(applicationId, data = {}) {
    const response = await API.put(`/principal/joining-letters/${applicationId}/verify`, data);
    return unwrapIfWrapped(response.data);
  },

  async rejectJoiningLetter(applicationId, remarks) {
    const response = await API.put(`/principal/joining-letters/${applicationId}/reject`, { remarks });
    return unwrapIfWrapped(response.data);
  },

  // Internship Stats with Company Details
  async getInternshipStats() {
    const response = await API.get('/principal/internships/stats');
    return unwrapIfWrapped(response.data);
  },

  // Faculty Workload
  async getFacultyProgress(params = {}) {
    const queryParams = new URLSearchParams(params).toString();
    const url = queryParams ? `/principal/faculty/progress?${queryParams}` : '/principal/faculty/progress';
    const response = await API.get(url);
    return unwrapIfWrapped(response.data);
  },

  async getFacultyProgressDetails(facultyId) {
    const response = await API.get(`/principal/faculty/progress/${facultyId}`);
    return unwrapIfWrapped(response.data);
  },

  // Internship Management
  async getInternshipById(applicationId) {
    const response = await API.get(`/principal/internships/${applicationId}`);
    return unwrapIfWrapped(response.data);
  },

  async updateInternship(applicationId, data) {
    const response = await API.put(`/principal/internships/${applicationId}`, data);
    return unwrapIfWrapped(response.data);
  },

  async bulkUpdateInternshipStatus(applicationIds, status, remarks = '') {
    const response = await API.post('/principal/internships/bulk-status', {
      applicationIds,
      status,
      remarks,
    });
    return unwrapIfWrapped(response.data);
  },

  // Remove mentor from student
  async removeMentor(studentId) {
    const response = await API.delete(`/principal/students/${studentId}/mentor`);
    return unwrapIfWrapped(response.data);
  },

  // Bulk unassign mentors
  async bulkUnassignMentors(studentIds) {
    const response = await API.post('/principal/mentors/bulk-unassign', { studentIds });
    return unwrapIfWrapped(response.data);
  },

  // Auto-assign mentors
  async autoAssignMentors() {
    const response = await API.post('/principal/mentors/auto-assign');
    return unwrapIfWrapped(response.data);
  },
};

export default principalService;
