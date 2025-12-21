import API from './api';

/**
 * Student Service
 * API methods for student operations
 */
export const studentService = {
  // Dashboard
  async getDashboard() {
    const response = await API.get('/student/dashboard');
    return response.data;
  },

  // Profile
  async getProfile() {
    const response = await API.get('/student/profile');
    return response.data;
  },

  async updateProfile(data, profileImage = null) {
    const formData = new FormData();
    Object.entries(data).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        formData.append(key, value);
      }
    });
    if (profileImage) {
      formData.append('profileImage', profileImage);
    }
    const response = await API.put('/student/profile', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  },

  // Internships
  async getMyInternships(params = {}) {
    const queryParams = new URLSearchParams(params).toString();
    const url = queryParams ? `/student/internships?${queryParams}` : '/student/internships';
    const response = await API.get(url);
    return response.data;
  },

  async getAvailableInternships(params = {}) {
    const queryParams = new URLSearchParams(params).toString();
    const url = queryParams ? `/student/internships/available?${queryParams}` : '/student/internships/available';
    const response = await API.get(url);
    return response.data;
  },

  async applyForInternship(internshipId, data, resume = null) {
    const formData = new FormData();
    formData.append('internshipId', internshipId);
    Object.entries(data).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        formData.append(key, value);
      }
    });
    if (resume) {
      formData.append('resume', resume);
    }
    const response = await API.post('/student/applications', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  },

  async withdrawApplication(applicationId) {
    const response = await API.post(`/student/applications/${applicationId}/withdraw`);
    return response.data;
  },

  // Applications
  async getApplications(params = {}) {
    const queryParams = new URLSearchParams(params).toString();
    const url = queryParams ? `/student/applications?${queryParams}` : '/student/applications';
    const response = await API.get(url);
    return response.data;
  },

  // Reports
  async getMyReports(params = {}) {
    const queryParams = new URLSearchParams(params).toString();
    const url = queryParams ? `/student/reports?${queryParams}` : '/student/reports';
    const response = await API.get(url);
    return response.data;
  },

  async getReportById(id) {
    const response = await API.get(`/student/reports/${id}`);
    return response.data;
  },

  async createReport(data, attachments = []) {
    const formData = new FormData();
    Object.entries(data).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        formData.append(key, value);
      }
    });
    attachments.forEach((file) => {
      formData.append('attachments', file);
    });
    const response = await API.post('/student/reports', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  },

  async updateReport(id, data) {
    const response = await API.put(`/student/reports/${id}`, data);
    return response.data;
  },

  // Enrollments
  async getEnrollments() {
    const response = await API.get('/student/enrollments');
    return response.data;
  },

  async enrollInCourse(courseId) {
    const response = await API.post('/student/enrollments', { courseId });
    return response.data;
  },

  // Assignments
  async getAssignments(params = {}) {
    const queryParams = new URLSearchParams(params).toString();
    const url = queryParams ? `/student/assignments?${queryParams}` : '/student/assignments';
    const response = await API.get(url);
    return response.data;
  },

  async submitAssignment(assignmentId, data, files = []) {
    const formData = new FormData();
    Object.entries(data).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        formData.append(key, value);
      }
    });
    files.forEach((file) => {
      formData.append('files', file);
    });
    const response = await API.post(`/student/assignments/${assignmentId}/submit`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  },
};

export default studentService;
