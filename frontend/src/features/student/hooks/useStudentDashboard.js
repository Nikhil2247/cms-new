import { useEffect, useCallback, useMemo } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  fetchStudentDashboard,
  fetchStudentProfile,
  fetchMyInternships,
  fetchApplications,
  fetchMyReports,
  fetchMentor,
  fetchGrievances,
  withdrawApplication,
  updateApplication,
  submitMonthlyReport,
} from '../store/studentSlice';

/**
 * Custom hook for Student Dashboard data management
 * Uses Redux for state management and caching
 */
export const useStudentDashboard = () => {
  const dispatch = useDispatch();

  // Selectors
  const dashboard = useSelector((state) => state.student.dashboard);
  const profile = useSelector((state) => state.student.profile);
  const internships = useSelector((state) => state.student.internships);
  const applications = useSelector((state) => state.student.applications);
  const reports = useSelector((state) => state.student.reports);
  const mentor = useSelector((state) => state.student.mentor);
  const grievances = useSelector((state) => state.student.grievances);

  // Derived loading state
  const isLoading = useMemo(() => (
    dashboard.loading ||
    profile.loading ||
    internships.loading ||
    applications.loading
  ), [dashboard.loading, profile.loading, internships.loading, applications.loading]);

  // Fetch all dashboard data
  const fetchDashboardData = useCallback((forceRefresh = false) => {
    dispatch(fetchStudentDashboard({ forceRefresh }));
    dispatch(fetchStudentProfile({ forceRefresh }));
    dispatch(fetchMyInternships({ forceRefresh }));
    dispatch(fetchApplications({ forceRefresh }));
    dispatch(fetchMyReports({ forceRefresh }));
    dispatch(fetchMentor());
    dispatch(fetchGrievances());
  }, [dispatch]);

  // Initial fetch on mount
  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  // Calculate statistics from data
  const stats = useMemo(() => {
    const apps = applications.list || [];
    return {
      totalApplications: apps.length,
      activeApplications: apps.filter(app =>
        ['APPLIED', 'SHORTLISTED', 'UNDER_REVIEW'].includes(app.status)
      ).length,
      selectedApplications: apps.filter(app => app.status === 'SELECTED').length,
      completedInternships: apps.filter(app => app.status === 'COMPLETED').length,
      totalInternships: (internships.list || []).length,
      grievances: (grievances.list || []).length,
    };
  }, [applications.list, internships.list, grievances.list]);

  // Get active internship(s)
  const activeInternships = useMemo(() => {
    return (applications.list || []).filter(app =>
      app.status === 'SELECTED' || app.status === 'ACTIVE'
    );
  }, [applications.list]);

  // Get recent applications
  const recentApplications = useMemo(() => {
    return [...(applications.list || [])]
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, 5);
  }, [applications.list]);

  // Get monthly reports with internship info
  const monthlyReports = useMemo(() => {
    return (applications.list || []).flatMap(app =>
      (app.monthlyReports || []).map(report => ({
        ...report,
        applicationId: app.id,
        internshipTitle: app.internship?.title,
        companyName: app.internship?.industry?.companyName,
      }))
    );
  }, [applications.list]);

  // Action handlers
  const handleWithdrawApplication = useCallback((applicationId) => {
    return dispatch(withdrawApplication(applicationId));
  }, [dispatch]);

  const handleUpdateApplication = useCallback((id, data) => {
    return dispatch(updateApplication({ id, data }));
  }, [dispatch]);

  const handleSubmitReport = useCallback((reportId, data) => {
    return dispatch(submitMonthlyReport({ reportId, data }));
  }, [dispatch]);

  const refresh = useCallback(() => {
    fetchDashboardData(true);
  }, [fetchDashboardData]);

  return {
    // State
    isLoading,
    dashboard: dashboard.stats,
    profile: profile.data,
    mentor: mentor.data,
    grievances: grievances.list || [],
    applications: applications.list || [],
    internships: internships.list || [],
    reports: reports.list || [],

    // Computed
    stats,
    activeInternships,
    recentApplications,
    monthlyReports,

    // Actions
    refresh,
    fetchDashboardData,
    handleWithdrawApplication,
    handleUpdateApplication,
    handleSubmitReport,

    // Errors
    error: dashboard.error || profile.error || applications.error,
  };
};

export default useStudentDashboard;
