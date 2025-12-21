import API from './api';

export const bulkService = {
  // Institution bulk upload
  async uploadInstitutions(file, onProgress) {
    const formData = new FormData();
    formData.append('file', file);
    const response = await API.post('/bulk/institutions/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      onUploadProgress: onProgress,
    });
    return response.data;
  },
  async validateInstitutions(file) {
    const formData = new FormData();
    formData.append('file', file);
    const response = await API.post('/bulk/institutions/validate', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  },
  async downloadInstitutionTemplate() {
    const response = await API.get('/bulk/institutions/template', { responseType: 'blob' });
    return response.data;
  },

  // User bulk upload
  async uploadUsers(file, onProgress) {
    const formData = new FormData();
    formData.append('file', file);
    const response = await API.post('/bulk/users/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      onUploadProgress: onProgress,
    });
    return response.data;
  },
  async validateUsers(file) {
    const formData = new FormData();
    formData.append('file', file);
    const response = await API.post('/bulk/users/validate', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  },
  async downloadUserTemplate() {
    const response = await API.get('/bulk/users/template', { responseType: 'blob' });
    return response.data;
  },
};
