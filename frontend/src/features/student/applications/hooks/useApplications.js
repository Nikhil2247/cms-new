import { useState, useEffect, useCallback, useRef } from 'react';
import API from '../../../../services/api';
import { toast } from 'react-hot-toast';
import { getStoredLoginResponse } from '../../../../utils/authStorage';

// Utility function to get student ID from localStorage
const getStudentId = () => {
  const loginData = getStoredLoginResponse();
  return loginData.user?.studentId || loginData.studentId || loginData.userId || null;
};

export const useApplications = () => {
  const [applications, setApplications] = useState([]);
  const [selfIdentifiedApplications, setSelfIdentifiedApplications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const hasFetchedRef = useRef(false);

  const fetchAllApplications = useCallback(async () => {
    setLoading(true);
    try {
      const response = await API.get('/student/applications');

      // Handle different response structures
      let allApps = [];
      if (response.data) {
        if (Array.isArray(response.data)) {
          allApps = response.data;
        } else if (response.data.applications) {
          allApps = response.data.applications;
        } else if (response.data.data) {
          allApps = response.data.data;
        }
      }

      // Separate platform and self-identified applications
      const platformApps = allApps.filter(app => !app.isSelfIdentified);
      const selfIdentifiedApps = allApps.filter(app => app.isSelfIdentified);

      setApplications(platformApps);
      setSelfIdentifiedApplications(selfIdentifiedApps);
      setError(null);

      return { platformApps, selfIdentifiedApps };
    } catch (err) {
      console.error('Error fetching applications:', err);
      const errorMsg = err.message || 'Failed to fetch applications';
      setError(errorMsg);
      toast.error(errorMsg);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial fetch on mount
  useEffect(() => {
    if (!hasFetchedRef.current) {
      hasFetchedRef.current = true;
      fetchAllApplications();
    }
  }, [fetchAllApplications]);

  return {
    loading,
    isRevalidating: loading, // For backward compatibility
    error,
    applications,
    selfIdentifiedApplications,
    refetch: fetchAllApplications,
  };
};

export const useCompletionFeedback = () => {
  const [feedback, setFeedback] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchFeedback = useCallback(async (applicationId) => {
    if (!applicationId) return null;
    setLoading(true);
    setError(null);
    try {
      const response = await API.get(`/completion-feedback/application/${applicationId}`);
      const feedbackData = response.data?.data || null;
      setFeedback(feedbackData);
      return feedbackData;
    } catch (err) {
      if (err.response?.status !== 404) {
        console.error('Error fetching feedback:', err);
        setError(err.message || 'Failed to fetch feedback');
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

    try {
      const response = await API.post('/completion-feedback/student', payload);
      toast.success('Feedback submitted successfully!');
      return response.data;
    } catch (err) {
      const message = err.response?.data?.message || 'Failed to submit feedback';
      toast.error(message);
      throw err;
    }
  }, []);

  return {
    feedback,
    loading,
    error,
    fetchFeedback,
    submitFeedback,
    setFeedback,
  };
};

export const useMonthlyReports = () => {
  const [reports, setReports] = useState([]);
  const [progress, setProgress] = useState({
    total: 0,
    approved: 0,
    submitted: 0,
    draft: 0,
    overdue: 0,
    percentage: 0,
  });
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);

  // Fetch reports with status from endpoint
  const fetchReports = useCallback(async (applicationId) => {
    if (!applicationId) return;
    setLoading(true);
    setError(null);
    try {
      const response = await API.get(`/student/applications/${applicationId}/reports`);

      // Response structure: { reports, progress, internship }
      const data = response.data;
      const reportsData = data?.reports || [];
      const progressData = data?.progress || {
        total: 0,
        approved: 0,
        submitted: 0,
        draft: 0,
        overdue: 0,
        percentage: 0,
      };

      // Backend calculates overdue count, but if missing, calculate from submission status
      if (progressData.overdue === 0 && reportsData.length > 0) {
        const overdueCount = reportsData.filter((r) => {
          if (r.status === 'APPROVED') return false;
          return r.submissionStatus?.status === 'OVERDUE';
        }).length;
        progressData.overdue = overdueCount;
      }

      // Calculate percentage if not provided
      if (progressData.percentage === 0 && progressData.total > 0) {
        progressData.percentage = Math.round((progressData.approved / progressData.total) * 100);
      }

      setReports(reportsData);
      setProgress(progressData);
    } catch (err) {
      console.error('Error fetching monthly reports:', err);
      setError(err.message || 'Failed to fetch reports');
      setReports([]);
      setProgress({
        total: 0,
        approved: 0,
        submitted: 0,
        draft: 0,
        overdue: 0,
        percentage: 0,
      });
    } finally {
      setLoading(false);
    }
  }, []);

  // Upload and submit report with auto-approval
  const uploadReport = useCallback(async (applicationId, file, month, year) => {
    setUploading(true);
    try {
      // Upload file first
      const formData = new FormData();
      formData.append('file', file);
      formData.append('applicationId', applicationId);
      formData.append('reportMonth', month.toString());
      formData.append('reportYear', year.toString());

      // Try the upload endpoint first
      let fileUrl = null;
      try {
        const uploadResponse = await API.post('/student/monthly-reports/upload', formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
        fileUrl = uploadResponse.data?.reportFileUrl || uploadResponse.data?.path || uploadResponse.data?.url;
      } catch (uploadErr) {
        // If upload endpoint fails, try shared documents upload
        const genericFormData = new FormData();
        genericFormData.append('file', file);
        const genericUpload = await API.post('/shared/documents/upload', genericFormData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
        fileUrl = genericUpload.data?.url || genericUpload.data?.path;
      }

      // Submit report with file URL (auto-approved)
      const response = await API.post('/student/monthly-reports', {
        applicationId,
        reportMonth: month,
        reportYear: year,
        reportFileUrl: fileUrl,
      });

      // Show auto-approval message
      if (response.data?.autoApproved) {
        toast.success('Report submitted and auto-approved!');
      } else {
        toast.success('Report submitted successfully!');
      }

      return response.data;
    } catch (err) {
      const message = err.response?.data?.message || err.message || 'Failed to submit report';
      toast.error(message);
      throw err;
    } finally {
      setUploading(false);
    }
  }, []);

  const deleteReport = useCallback(async (reportId) => {
    try {
      await API.delete(`/student/monthly-reports/${reportId}`);
      toast.success('Report deleted successfully');
    } catch (err) {
      const message = err.response?.data?.message || 'Failed to delete report';
      toast.error(message);
      throw err;
    }
  }, []);

  // Generate expected reports for an application
  const generateReports = useCallback(async (applicationId) => {
    try {
      const response = await API.post(`/student/applications/${applicationId}/generate-reports`);
      toast.success(`Generated ${response.data?.count || 0} expected reports`);
      return response.data;
    } catch (err) {
      const message = err.response?.data?.message || 'Failed to generate reports';
      toast.error(message);
      throw err;
    }
  }, []);

  return {
    reports,
    progress,
    loading,
    uploading,
    error,
    fetchReports,
    uploadReport,
    deleteReport,
    generateReports,
    setReports,
  };
};

export const useMonthlyFeedback = () => {
  const [feedbacks, setFeedbacks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const fetchFeedbacks = useCallback(async (applicationId) => {
    if (!applicationId) return;
    setLoading(true);
    setError(null);
    try {
      // Monthly feedback is submitted by faculty - students may not have a direct endpoint
      // Try to fetch from faculty feedback endpoint or skip if not available
      const response = await API.get(`/student/applications/${applicationId}/feedback`);
      const feedbackData = response.data?.feedbacks || response.data?.data || [];
      setFeedbacks(feedbackData);
    } catch (err) {
      // 404 is expected if no feedback endpoint exists for students - fail gracefully
      if (err.response?.status !== 404) {
        console.error('Error fetching monthly feedbacks:', err);
        setError(err.message || 'Failed to fetch feedbacks');
      }
      setFeedbacks([]); // Return empty array on error
    } finally {
      setLoading(false);
    }
  }, []);

  const submitFeedback = useCallback(async (applicationId, imageFile) => {
    setSubmitting(true);
    try {
      const studentId = getStudentId();
      if (!studentId) {
        throw new Error('Student ID not found. Please log in again.');
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
    } catch (err) {
      const message = err.response?.data?.message || err.message || 'Failed to upload progress';
      toast.error(message);
      throw err;
    } finally {
      setSubmitting(false);
    }
  }, []);

  return {
    feedbacks,
    loading,
    submitting,
    error,
    fetchFeedbacks,
    submitFeedback,
    setFeedbacks,
  };
};

export const useFacultyVisits = () => {
  const [visits, setVisits] = useState([]);
  const [progress, setProgress] = useState({
    total: 0,
    completed: 0,
    pending: 0,
    overdue: 0,
    percentage: 0,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchVisits = useCallback(async (applicationId) => {
    if (!applicationId) return;
    setLoading(true);
    setError(null);
    try {
      const response = await API.get(`/student/applications/${applicationId}/faculty-visits`);

      // Response structure: { visits, progress }
      // Backend returns visits with: id, visitMonth, visitYear, requiredByDate, status,
      // submissionStatus, statusLabel, statusColor, sublabel, visitDate, isCompleted, isOverdue,
      // faculty, visitType, visitLocation, meetingMinutes
      const data = response.data;
      const visitsData = data?.visits || [];
      const progressData = data?.progress || {
        total: 0,
        completed: 0,
        pending: 0,
        overdue: 0,
        percentage: 0,
      };

      // Backend calculates overdue from isOverdue field if not provided
      if (progressData.overdue === 0 && visitsData.length > 0) {
        const overdueCount = visitsData.filter((v) => v.isOverdue === true).length;
        progressData.overdue = overdueCount;
      }

      // Calculate percentage if not provided
      if (progressData.percentage === 0 && progressData.total > 0) {
        progressData.percentage = Math.round((progressData.completed / progressData.total) * 100);
      }

      setVisits(visitsData);
      setProgress(progressData);
    } catch (err) {
      console.error('Error fetching faculty visits:', err);
      // Fail gracefully - visits may not be available yet
      if (err.response?.status !== 404) {
        setError(err.message || 'Failed to fetch visits');
      }
      setVisits([]);
      setProgress({
        total: 0,
        completed: 0,
        pending: 0,
        overdue: 0,
        percentage: 0,
      });
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    visits,
    progress,
    loading,
    error,
    fetchVisits,
    setVisits,
  };
};
