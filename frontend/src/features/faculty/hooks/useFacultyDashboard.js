import { useEffect, useCallback, useMemo } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  fetchFacultyDashboard,
  fetchAssignedStudents,
  fetchVisitLogs,
  fetchProfile,
  fetchApplications,
  fetchMonthlyReports,
  createVisitLog,
  updateVisitLog,
  deleteVisitLog,
  approveApplication,
  rejectApplication,
  submitFeedback,
  reviewMonthlyReport,
  selectDashboard,
  selectStudents,
  selectVisitLogs,
  selectProfile,
  selectApplications,
  selectMonthlyReports,
} from '../store/facultySlice';

/**
 * Custom hook for Faculty Dashboard data management
 * Uses Redux for state management and caching
 */
export const useFacultyDashboard = () => {
  const dispatch = useDispatch();

  // Selectors using new state structure
  const dashboard = useSelector(selectDashboard);
  const students = useSelector(selectStudents);
  const visitLogs = useSelector(selectVisitLogs);
  const profile = useSelector(selectProfile);
  const applications = useSelector(selectApplications);
  const monthlyReports = useSelector(selectMonthlyReports);

  // Derived loading state
  const isLoading = useMemo(() => (
    dashboard.loading ||
    students.loading ||
    visitLogs.loading ||
    monthlyReports.loading
  ), [dashboard.loading, students.loading, visitLogs.loading, monthlyReports.loading]);

  // Fetch all dashboard data
  const fetchDashboardData = useCallback((forceRefresh = false) => {
    dispatch(fetchFacultyDashboard({ forceRefresh }));
    dispatch(fetchAssignedStudents({ forceRefresh }));
    dispatch(fetchVisitLogs({ forceRefresh }));
    dispatch(fetchProfile());
    dispatch(fetchApplications({ forceRefresh }));
    dispatch(fetchMonthlyReports({ forceRefresh }));
  }, [dispatch]);

  // Initial fetch on mount
  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  // Calculate statistics from dashboard data
  const stats = useMemo(() => {
    const dashboardStats = dashboard.stats || {};
    return {
      totalStudents: dashboardStats.totalStudents || students.total || 0,
      activeStudents: dashboardStats.activeInternships || 0,
      totalVisits: dashboardStats.totalVisits || visitLogs.total || 0,
      completedVisits: visitLogs.list.filter(v => new Date(v.visitDate) < new Date()).length,
      pendingReports: dashboardStats.pendingReports || 0,
      pendingApprovals: dashboardStats.pendingApprovals || applications.total || 0,
      totalApplications: applications.total || 0,
      approvedApplications: applications.list.filter(a => a.status === 'APPROVED').length,
    };
  }, [dashboard.stats, students.total, visitLogs.list, visitLogs.total, applications.list, applications.total]);

  // Get pending approvals from applications list
  const pendingApprovals = useMemo(() => {
    return applications.list.filter(app =>
      app.status === 'APPLIED' || app.status === 'PENDING' || app.status === 'UNDER_REVIEW'
    );
  }, [applications.list]);

  // Get upcoming visits from dashboard or visit logs
  const upcomingVisits = useMemo(() => {
    if (dashboard.upcomingVisits && dashboard.upcomingVisits.length > 0) {
      return dashboard.upcomingVisits;
    }
    return visitLogs.list
      .filter(v => new Date(v.visitDate) > new Date())
      .sort((a, b) => new Date(a.visitDate) - new Date(b.visitDate))
      .slice(0, 5);
  }, [dashboard.upcomingVisits, visitLogs.list]);

  // Action handlers
  const handleCreateVisitLog = useCallback(async (data) => {
    return dispatch(createVisitLog(data)).unwrap();
  }, [dispatch]);

  const handleUpdateVisitLog = useCallback(async (id, data) => {
    return dispatch(updateVisitLog({ id, data })).unwrap();
  }, [dispatch]);

  const handleDeleteVisitLog = useCallback(async (id) => {
    return dispatch(deleteVisitLog(id)).unwrap();
  }, [dispatch]);

  const handleApproveApplication = useCallback(async (applicationId, data = {}) => {
    return dispatch(approveApplication({ applicationId, data })).unwrap();
  }, [dispatch]);

  const handleRejectApplication = useCallback(async (applicationId, reason) => {
    return dispatch(rejectApplication({ applicationId, reason })).unwrap();
  }, [dispatch]);

  const handleSubmitFeedback = useCallback(async (applicationId, feedbackData) => {
    return dispatch(submitFeedback({ applicationId, feedbackData })).unwrap();
  }, [dispatch]);

  const handleReviewReport = useCallback(async (reportId, reviewData) => {
    return dispatch(reviewMonthlyReport({ reportId, reviewData })).unwrap();
  }, [dispatch]);

  const refresh = useCallback(() => {
    fetchDashboardData(true);
  }, [fetchDashboardData]);

  return {
    // State
    isLoading,
    dashboard: {
      ...dashboard.stats,
      monthlyReports: monthlyReports.list,
      joiningLetters: [], // Will be populated from backend when available
    },
    students: students.list,
    visitLogs: visitLogs.list,
    monthlyReports: monthlyReports.list,
    mentor: profile.data,
    grievances: [], // Deprecated - use feedbackHistory instead
    applications: applications.list,

    // Computed
    stats,
    pendingApprovals,
    upcomingVisits,
    recentActivities: dashboard.recentActivities || [],

    // Actions
    refresh,
    fetchDashboardData,
    handleCreateVisitLog,
    handleUpdateVisitLog,
    handleDeleteVisitLog,
    handleApproveApplication,
    handleRejectApplication,
    handleSubmitFeedback,
    handleReviewReport,

    // Errors
    error: dashboard.error || students.error || visitLogs.error || monthlyReports.error,
  };
};

export default useFacultyDashboard;
