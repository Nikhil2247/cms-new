import { useEffect, useCallback, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  fetchFacultyDashboard,
  fetchAssignedStudents,
  fetchVisitLogs,
  fetchProfile,
  fetchApplications,
  fetchMonthlyReports,
  fetchJoiningLetters,
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
  selectJoiningLetters,
} from '../store/facultySlice';
import { useSWR } from '../../../hooks/useSWR';

/**
 * Custom hook for Faculty Dashboard data management
 * Uses Redux for state management and SWR pattern for optimal caching
 *
 * SWR Pattern Benefits:
 * - Shows cached data immediately (no loading spinner on subsequent visits)
 * - Fetches fresh data in background
 * - Shows subtle revalidation indicator while fetching
 * - Auto-revalidates on window focus and network reconnect
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
  const joiningLetters = useSelector(selectJoiningLetters);

  // SWR state for tracking background revalidation
  const [isRevalidating, setIsRevalidating] = useState(false);

  // Derived loading state from Redux
  const reduxIsLoading = useMemo(() => (
    dashboard.loading ||
    students.loading ||
    visitLogs.loading ||
    monthlyReports.loading ||
    joiningLetters.loading
  ), [dashboard.loading, students.loading, visitLogs.loading, monthlyReports.loading, joiningLetters.loading]);

  // Fetch all dashboard data
  const fetchDashboardData = useCallback((forceRefresh = false) => {
    dispatch(fetchFacultyDashboard({ forceRefresh }));
    dispatch(fetchAssignedStudents({ forceRefresh }));
    dispatch(fetchVisitLogs({ forceRefresh }));
    dispatch(fetchProfile());
    dispatch(fetchApplications({ forceRefresh }));
    dispatch(fetchMonthlyReports({ forceRefresh }));
    dispatch(fetchJoiningLetters({ forceRefresh }));
  }, [dispatch]);

  // SWR implementation - fetches with stale-while-revalidate pattern
  const { isLoading: swrIsLoading, isRevalidating: swrIsRevalidating, revalidate } = useSWR(
    'faculty-dashboard-data',
    async () => {
      await fetchDashboardData(false);
      return true; // Return success indicator
    },
    {
      revalidateOnFocus: true,
      revalidateOnReconnect: true,
      dedupingInterval: 2000,
      focusThrottleInterval: 5000,
    }
  );

  // Update local revalidation state
  useEffect(() => {
    setIsRevalidating(swrIsRevalidating);
  }, [swrIsRevalidating]);

  // Combined loading state: only show full loading on initial load with no cache
  const isLoading = swrIsLoading || reduxIsLoading;

  // Calculate statistics from dashboard data
  const stats = useMemo(() => {
    const dashboardStats = dashboard.stats || {};

    // FIXED: Only count completed visits that are both:
    // 1. In the past (visitDate < now)
    // 2. After the internship start date (if available)
    const now = new Date();
    const completedVisitsCount = visitLogs.list.filter(visit => {
      const visitDate = new Date(visit.visitDate);

      // Visit must be in the past
      if (visitDate >= now) return false;

      // Check if visit is after internship start date
      const internshipStartDate = visit.application?.internship?.startDate ||
                                   visit.student?.activeInternship?.startDate;

      if (internshipStartDate) {
        const startDate = new Date(internshipStartDate);
        return visitDate >= startDate;
      }

      // If no start date available, count the visit
      return true;
    }).length;

    return {
      totalStudents: dashboardStats.totalStudents || students.total || 0,
      activeStudents: dashboardStats.activeInternships || 0,
      totalVisits: dashboardStats.totalVisits || visitLogs.total || 0,
      completedVisits: completedVisitsCount,
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
    setIsRevalidating(true);
    fetchDashboardData(true);
    revalidate().finally(() => {
      setIsRevalidating(false);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [revalidate]);

  // Get pending joining letters
  const pendingJoiningLetters = useMemo(() => {
    return joiningLetters.list.filter(l => !l.reviewedAt);
  }, [joiningLetters.list]);

  // Get pending monthly reports
  const pendingMonthlyReports = useMemo(() => {
    return monthlyReports.list.filter(r => r.status === 'PENDING' || r.status === 'SUBMITTED');
  }, [monthlyReports.list]);

  return {
    // State
    isLoading,
    isRevalidating, // NEW: Shows subtle indicator during background refresh
    dashboard: {
      ...dashboard.stats,
      monthlyReports: monthlyReports.list,
      joiningLetters: joiningLetters.list,
    },
    students: students.list,
    visitLogs: visitLogs.list,
    monthlyReports: monthlyReports.list,
    joiningLetters: joiningLetters.list,
    mentor: profile.data,
    grievances: [], // Deprecated - use feedbackHistory instead
    applications: applications.list,

    // Computed
    stats: {
      ...stats,
      pendingJoiningLetters: pendingJoiningLetters.length,
      pendingMonthlyReports: pendingMonthlyReports.length,
    },
    pendingApprovals,
    pendingJoiningLetters,
    pendingMonthlyReports,
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
    revalidate, // NEW: Manual revalidation trigger

    // Errors
    error: dashboard.error || students.error || visitLogs.error || monthlyReports.error || joiningLetters.error,
  };
};

export default useFacultyDashboard;
