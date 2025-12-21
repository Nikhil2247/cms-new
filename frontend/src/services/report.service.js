import API from './api';

export const reportService = {
  async getCatalog() {
    const response = await API.get('/shared/reports/catalog');
    return response.data;
  },
  async getConfig(type) {
    const response = await API.get(`/shared/reports/config/${type}`);
    return response.data;
  },
  async generateReport(data) {
    const response = await API.post('/shared/reports/generate', data);
    return response.data;
  },
  async getReportStatus(id) {
    const response = await API.get(`/shared/reports/${id}`);
    return response.data;
  },
  async downloadReport(id) {
    const response = await API.get(`/shared/reports/${id}/download`, {
      responseType: 'blob',
    });
    return response.data;
  },
  async getHistory(params) {
    const queryParams = new URLSearchParams(params).toString();
    const url = queryParams ? `/shared/reports/history?${queryParams}` : '/shared/reports/history';
    const response = await API.get(url);
    return response.data;
  },
};

export default reportService;
