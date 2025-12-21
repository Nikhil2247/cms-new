import { useState, useEffect, useCallback } from 'react';
import API from '../../../../services/api';
import { toast } from 'react-hot-toast';

export const useApplications = () => {
  const [loading, setLoading] = useState(true);
  const [applications, setApplications] = useState([]);
  const [selfIdentifiedApplications, setSelfIdentifiedApplications] = useState([]);

  const fetchMyApplications = useCallback(async () => {
    try {
      const response = await API.get('/internship-applications/my-applications');
      if (response.data?.data) {
        const platformApps = (response.data.data || []).filter(
          (app) => !app.isSelfIdentified
        );
        setApplications(platformApps);
      }
    } catch (error) {
      console.error('Error fetching applications:', error);
      toast.error('Failed to fetch applications');
    }
  }, []);

  const fetchSelfIdentifiedApplications = useCallback(async () => {
    try {
      const response = await API.get('/internship-applications/self-identified');
      if (response.data?.data) {
        setSelfIdentifiedApplications(response.data.data);
      }
    } catch (error) {
      console.error('Error fetching self-identified applications:', error);
    }
  }, []);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      await Promise.all([
        fetchMyApplications(),
        fetchSelfIdentifiedApplications(),
      ]);
    } finally {
      setLoading(false);
    }
  }, [fetchMyApplications, fetchSelfIdentifiedApplications]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  return {
    loading,
    applications,
    selfIdentifiedApplications,
    refetch: fetchAll,
  };
};

export const useCompletionFeedback = () => {
  const [feedback, setFeedback] = useState(null);
  const [loading, setLoading] = useState(false);

  const fetchFeedback = useCallback(async (applicationId) => {
    if (!applicationId) return null;
    setLoading(true);
    try {
      const response = await API.get(`/completion-feedback/application/${applicationId}`);
      const feedbackData = response.data?.data || null;
      setFeedback(feedbackData);
      return feedbackData;
    } catch (error) {
      if (error.response?.status !== 404) {
        console.error('Error fetching feedback:', error);
      }
      setFeedback(null);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const submitFeedback = useCallback(async (applicationId, values) => {
    const payload = {
      applicationId,
      studentRating: values.studentRating,
      studentFeedback: values.studentFeedback,
      skillsLearned: values.skillsLearned,
      careerImpact: values.careerImpact,
      wouldRecommend: values.wouldRecommend || false,
    };

    const response = await API.post('/completion-feedback/student', payload);
    return response.data;
  }, []);

  return {
    feedback,
    loading,
    fetchFeedback,
    submitFeedback,
    setFeedback,
  };
};

export const useMonthlyReports = () => {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [missingReports, setMissingReports] = useState([]);

  const fetchReports = useCallback(async (applicationId) => {
    if (!applicationId) return;
    setLoading(true);
    try {
      const response = await API.get(`/monthly-reports/application/${applicationId}`);
      if (response.data?.data) {
        setReports(response.data.data);
        // Calculate missing reports
        const existing = new Set(
          response.data.data.map((r) => `${r.reportMonth}-${r.reportYear}`)
        );
        const now = new Date();
        const missing = [];
        for (let i = 0; i < 6; i++) {
          const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
          const key = `${date.getMonth() + 1}-${date.getFullYear()}`;
          if (!existing.has(key)) {
            missing.push({
              month: date.getMonth() + 1,
              year: date.getFullYear(),
            });
          }
        }
        setMissingReports(missing);
      }
    } catch (error) {
      console.error('Error fetching monthly reports:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  const uploadReport = useCallback(async (applicationId, file, month, year) => {
    setUploading(true);
    try {
      const loginData = localStorage.getItem('loginResponse');
      let studentId = null;
      if (loginData) {
        const parsed = JSON.parse(loginData);
        studentId = parsed.userId || parsed.user?.id;
      }

      if (!studentId) {
        throw new Error('Student ID not found');
      }

      const formData = new FormData();
      formData.append('file', file);
      formData.append('applicationId', applicationId);
      formData.append('studentId', studentId);
      formData.append('reportMonth', month);
      formData.append('reportYear', year);

      const response = await API.post('/monthly-reports/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      toast.success('Report uploaded successfully!');
      return response.data;
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to upload report');
      throw error;
    } finally {
      setUploading(false);
    }
  }, []);

  const submitReport = useCallback(async (reportId) => {
    try {
      const loginData = localStorage.getItem('loginResponse');
      let studentId = null;
      if (loginData) {
        const parsed = JSON.parse(loginData);
        studentId = parsed.userId || parsed.user?.id;
      }

      const response = await API.patch(`/monthly-reports/${reportId}/submit`, {
        studentId,
      });
      toast.success('Report submitted for review!');
      return response.data;
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to submit report');
      throw error;
    }
  }, []);

  const deleteReport = useCallback(async (reportId) => {
    try {
      await API.delete(`/monthly-reports/${reportId}`);
      toast.success('Report deleted successfully');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to delete report');
      throw error;
    }
  }, []);

  return {
    reports,
    loading,
    uploading,
    missingReports,
    fetchReports,
    uploadReport,
    submitReport,
    deleteReport,
    setReports,
  };
};

export const useMonthlyFeedback = () => {
  const [feedbacks, setFeedbacks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const fetchFeedbacks = useCallback(async (applicationId) => {
    if (!applicationId) return;
    setLoading(true);
    try {
      const response = await API.get(`/monthly-feedback/application/${applicationId}`);
      if (response.data?.data) {
        setFeedbacks(response.data.data);
      }
    } catch (error) {
      console.error('Error fetching monthly feedbacks:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  const submitFeedback = useCallback(async (applicationId, imageFile) => {
    setSubmitting(true);
    try {
      const loginData = localStorage.getItem('loginResponse');
      let studentId = null;
      if (loginData) {
        const parsed = JSON.parse(loginData);
        studentId = parsed.userId || parsed.user?.id;
      }

      if (!studentId) {
        throw new Error('Student ID not found');
      }

      const formData = new FormData();
      formData.append('applicationId', applicationId);
      formData.append('studentId', studentId);
      formData.append('progressImage', imageFile);

      const response = await API.post('/monthly-feedback', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      toast.success('Monthly progress uploaded successfully!');
      return response.data;
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to upload progress');
      throw error;
    } finally {
      setSubmitting(false);
    }
  }, []);

  return {
    feedbacks,
    loading,
    submitting,
    fetchFeedbacks,
    submitFeedback,
    setFeedbacks,
  };
};
