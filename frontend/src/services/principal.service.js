import API from './api';

/**
 * Principal Service
 * API methods for principal operations
 */
export const principalService = {
  // Dashboard
  async getDashboard() {
    const response = await API.get('/principal/dashboard');
    return response.data;
  },

  // Students
  async getStudents(params = {}) {
    const queryParams = new URLSearchParams(params).toString();
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
};

export default principalService;
