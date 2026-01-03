import { useEffect, useCallback, useMemo, useRef, useTransition } from 'react';
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
  selectDashboard,
  selectStudents,
  selectVisitLogs,
  selectProfile,
  selectApplications,
  selectMonthlyReports,
  selectJoiningLetters,
  selectMostRecentFetch,
} from '../store/facultySlice';

/**
 * Custom hook for Faculty Dashboard data management
 * Uses Redux for state management with optimized data fetching
 */
export const useFacultyDashboard = () => {
  const dispatch = useDispatch();
  const hasFetchedRef = useRef(false);
  const [isPending, startTransition] = useTransition();

  // Selectors
  const dashboard = useSelector(selectDashboard);
  const students = useSelector(selectStudents);
  const visitLogs = useSelector(selectVisitLogs);
  const profile = useSelector(selectProfile);
  const applications = useSelector(selectApplications);
  const monthlyReports = useSelector(selectMonthlyReports);
  const joiningLetters = useSelector(selectJoiningLetters);
  const mostRecentFetch = useSelector(selectMostRecentFetch);

  // Derived loading state from Redux
  const isLoading = useMemo(() => (
    dashboard.loading ||
    students.loading ||
    visitLogs.loading ||
    monthlyReports.loading ||
    joiningLetters.loading
  ), [dashboard.loading, students.loading, visitLogs.loading, monthlyReports.loading, joiningLetters.loading]);

  // Fetch all dashboard data - using startTransition for non-blocking updates
  const fetchDashboardData = useCallback((forceRefresh = false) => {
    startTransition(() => {
      dispatch(fetchFacultyDashboard({ forceRefresh }));
      dispatch(fetchAssignedStudents({ forceRefresh }));
      dispatch(fetchVisitLogs({ forceRefresh }));
      dispatch(fetchProfile());
      dispatch(fetchApplications({ forceRefresh }));
      dispatch(fetchMonthlyReports({ forceRefresh }));
      dispatch(fetchJoiningLetters({ forceRefresh }));
    });
  }, [dispatch, startTransition]);

  // Initial data fetch on mount
  useEffect(() => {
    if (!hasFetchedRef.current) {
      hasFetchedRef.current = true;
      fetchDashboardData(false);
    }
  }, [fetchDashboardData]);

  // Revalidate on window focus (throttled + deferred)
  useEffect(() => {
    let lastFocusTime = 0;
    const THROTTLE_MS = 120000; // 2 minutes

    const handleFocus = () => {
      const now = Date.now();
      if (now - lastFocusTime > THROTTLE_MS) {
        lastFocusTime = now;
        // Defer to avoid blocking the focus event
        requestAnimationFrame(() => {
          fetchDashboardData(false);
        });
      }
    };

    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [fetchDashboardData]);

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
      activeInternships: dashboardStats.activeInternships || 0,
      totalVisits: dashboardStats.totalVisits || visitLogs.total || 0,
      completedVisits: completedVisitsCount,
      pendingReports: dashboardStats.pendingReports || 0,
      pendingApprovals: dashboardStats.pendingApprovals || applications.total || 0,
      totalApplications: applications.total || 0,
      approvedApplications: applications.list.filter(a => a.status === 'APPROVED').length,
      pendingGrievances: dashboardStats.pendingGrievances || 0,
      totalGrievances: dashboardStats.totalGrievances || 0,
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

  // Note: reviewMonthlyReport removed - auto-approval implemented
  // This function is kept for backwards compatibility but is a no-op
  const handleReviewReport = useCallback(async (reportId, reviewData) => {
    console.warn('handleReviewReport is deprecated - auto-approval is now implemented');
    return Promise.resolve();
  }, []);

  const refresh = useCallback(() => {
    return fetchDashboardData(true);
  }, [fetchDashboardData]);

  // Get pending joining letters
  const pendingJoiningLetters = useMemo(() => {
    return joiningLetters.list.filter(l => !l.reviewedAt);
  }, [joiningLetters.list]);

  // Get pending monthly reports
  // With auto-approval, only DRAFT reports are considered pending
  const pendingMonthlyReports = useMemo(() => {
    return monthlyReports.list.filter(r => r.status === 'DRAFT');
  }, [monthlyReports.list]);

  // Grievance stats from dashboard API
  const grievanceStats = useMemo(() => ({
    pending: dashboard.stats?.pendingGrievances || 0,
    total: dashboard.stats?.totalGrievances || 0,
  }), [dashboard.stats]);

  return {
    // State
    isLoading: isLoading || isPending,
    isRevalidating: isPending, // Shows during background transitions
    lastFetched: mostRecentFetch,
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
    grievances: [],
    grievanceStats,
    applications: applications.list,

    // Computed
    stats: {
      ...stats,
      pendingJoiningLetters: dashboard.stats?.pendingJoiningLetters ?? pendingJoiningLetters.length,
      totalJoiningLetters: dashboard.stats?.totalJoiningLetters ?? joiningLetters.list.length,
      pendingMonthlyReports: pendingMonthlyReports.length,
      pendingGrievances: grievanceStats.pending,
      totalGrievances: grievanceStats.total,
    },
    pendingApprovals,
    pendingJoiningLetters,
    pendingMonthlyReports,
    upcomingVisits,

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
    error: dashboard.error || students.error || visitLogs.error || monthlyReports.error || joiningLetters.error,
  };
};

export default useFacultyDashboard;
