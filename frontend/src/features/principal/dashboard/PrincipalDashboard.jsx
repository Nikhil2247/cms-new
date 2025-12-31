import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import {
  Card,
  Col,
  Row,
  Typography,
  Spin,
  Button,
  Badge,
  Tooltip,
  Alert,
  Tag,
  Modal,
  Table,
} from 'antd';
import {
  ExclamationCircleOutlined,
  FileTextOutlined,
  EyeOutlined,
  TeamOutlined,
  ReloadOutlined,
} from '@ant-design/icons';
import {
  fetchPrincipalDashboard,
  fetchMentorCoverage,
  fetchAlertsEnhanced,
  fetchInternshipStats,
  fetchJoiningLetterStats,
  fetchComplianceMetrics,
  selectDashboardStats,
  selectDashboardLoading,
  selectDashboardError,
  selectMentorCoverage,
  selectMentorCoverageLoading,
  selectAlertsEnhanced,
  selectAlertsEnhancedLoading,
  selectAlertsEnhancedError,
  selectMostRecentFetch,
  selectInternshipStats,
  selectInternshipStatsLoading,
  selectJoiningLetterStats,
  selectJoiningLetterStatsLoading,
  selectComplianceMetrics,
  selectComplianceMetricsLoading,
} from '../store/principalSlice';
import FacultyWorkloadCard from './components/FacultyWorkloadCard';
import { BasicStatisticsGrid, SubmissionStatusGrid } from './components/DashboardStatCards';

const { Title, Text, Paragraph } = Typography;

// Helper functions
const getCurrentUser = () => {
  try {
    const loginData = localStorage.getItem('loginResponse');
    if (loginData) {
      return JSON.parse(loginData)?.user;
    }
    const token = localStorage.getItem('token');
    if (token) {
      return JSON.parse(atob(token.split('.')[1]));
    }
  } catch {
    return null;
  }
  return null;
};

// Section Title Component with colored left border
const SectionTitle = ({ title }) => (
  <div className="flex items-center gap-2 mb-4">
    <div className="w-1 h-5 bg-primary rounded-full" />
    <Title level={5} className="!mb-0 text-gray-800">{title}</Title>
  </div>
);

const PrincipalDashboard = () => {
  const navigate = useNavigate();
  const dispatch = useDispatch();

  const [principalName, setPrincipalName] = useState('Principal');
  const [instituteName, setInstituteName] = useState('');
  const [alertDetailModal, setAlertDetailModal] = useState({ visible: false, type: null, title: '', data: [] });
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [dismissedAlerts, setDismissedAlerts] = useState([]);
  const [studentsModal, setStudentsModal] = useState({ visible: false });
  const [mentorsModal, setMentorsModal] = useState({ visible: false });

  // Redux selectors for dashboard data
  const dashboardStats = useSelector(selectDashboardStats);
  const dashboardLoading = useSelector(selectDashboardLoading);
  const dashboardError = useSelector(selectDashboardError);
  const mentorCoverage = useSelector(selectMentorCoverage);
  const mentorCoverageLoading = useSelector(selectMentorCoverageLoading);
  const alertsEnhanced = useSelector(selectAlertsEnhanced);
  const alertsEnhancedLoading = useSelector(selectAlertsEnhancedLoading);
  const alertsEnhancedError = useSelector(selectAlertsEnhancedError);
  const lastFetched = useSelector(selectMostRecentFetch);
  const internshipStats = useSelector(selectInternshipStats);
  const internshipStatsLoading = useSelector(selectInternshipStatsLoading);
  const joiningLetterStats = useSelector(selectJoiningLetterStats);
  const joiningLetterStatsLoading = useSelector(selectJoiningLetterStatsLoading);
  const complianceMetrics = useSelector(selectComplianceMetrics);
  const complianceMetricsLoading = useSelector(selectComplianceMetricsLoading);

  // Memoized stats derived from Redux data
  const stats = useMemo(() => {
    if (!dashboardStats) return null;

    const studentsData = dashboardStats.students || {};
    const staffData = dashboardStats.staff || {};
    // Support both old format (number) and new format (object with total/active)
    const batchesData = typeof dashboardStats.batches === 'number'
      ? { total: dashboardStats.batches, active: dashboardStats.batches }
      : (dashboardStats.batches || { total: 0, active: 0 });

    return {
      students: {
        total: studentsData.total || 0,
        active: studentsData.active || 0,
        inactive: (studentsData.total || 0) - (studentsData.active || 0),
      },
      staff: {
        total: staffData.total || 0,
        active: staffData.active || 0,
        inactive: (staffData.total || 0) - (staffData.active || 0),
      },
      batches: {
        total: batchesData.total || 0,
        active: batchesData.active || 0,
        inactive: (batchesData.total || 0) - (batchesData.active || 0),
      },
      internships: dashboardStats.internships || {},
      pending: dashboardStats.pending || {},
    };
  }, [dashboardStats]);

  // Calculate total pending items from alertsEnhanced (more accurate than stats.pending)
  const totalPendingItems = useMemo(() => {
    if (!alertsEnhanced?.summary) return 0;
    return (alertsEnhanced.summary.overdueReportsCount || 0) +
           (alertsEnhanced.summary.missingVisitsCount || 0) +
           (alertsEnhanced.summary.urgentGrievancesCount || 0) +
           (alertsEnhanced.summary.pendingJoiningLettersCount || 0);
  }, [alertsEnhanced]);

  useEffect(() => {
    const currentUser = getCurrentUser();
    const userName = currentUser?.name || 'Principal';
    setPrincipalName(userName);

    // Fetch all dashboard data using Redux
    dispatch(fetchPrincipalDashboard());
    dispatch(fetchMentorCoverage());
    dispatch(fetchAlertsEnhanced());
    dispatch(fetchInternshipStats());
    dispatch(fetchJoiningLetterStats());
    dispatch(fetchComplianceMetrics());
  }, [dispatch]);

  // Update institution name from dashboard stats
  useEffect(() => {
    if (dashboardStats) {
      const institutionName = dashboardStats.institution?.name;
      if (institutionName) {
        setInstituteName(institutionName);
      }
    }
  }, [dashboardStats]);

  const refreshData = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await Promise.all([
        dispatch(fetchPrincipalDashboard({ forceRefresh: true })),
        dispatch(fetchMentorCoverage({ forceRefresh: true })),
        dispatch(fetchAlertsEnhanced({ forceRefresh: true })),
        dispatch(fetchInternshipStats({ forceRefresh: true })),
        dispatch(fetchJoiningLetterStats({ forceRefresh: true })),
        dispatch(fetchComplianceMetrics({ forceRefresh: true })),
      ]);
    } finally {
      setIsRefreshing(false);
    }
  }, [dispatch]);

  // Memoized data for BasicStatisticsGrid
  const basicStatsData = useMemo(() => ({
    totalStudents: stats?.students?.total || 0,
    totalMentors: mentorCoverage?.totalMentors || 0,
    unassignedStudents: alertsEnhanced?.summary?.unassignedStudentsCount || 0,
    partnerCompanies: internshipStats?.totalCompanies || internshipStats?.companyStats?.total || 0,
  }), [stats, mentorCoverage, alertsEnhanced, internshipStats]);

  // Memoized data for SubmissionStatusGrid
  const submissionStatusData = useMemo(() => {
    // Get data from complianceMetrics.currentMonth
    const currentMonthData = complianceMetrics?.currentMonth || {};
    const studentsWithInternships = currentMonthData.studentsWithInternships || stats?.internships?.ongoingInternships || 0;
    const totalStudents = stats?.students?.total || 0;

    // Get data from joiningLetterStats.summary
    const joiningStats = joiningLetterStats?.summary || {};
    const joiningTotal = joiningStats.total || totalStudents;
    const joiningVerified = joiningStats.verified || 0;
    const joiningPending = joiningStats.pendingReview || 0;
    const joiningNoLetter = joiningStats.noLetter || 0;
    const joiningUploaded = joiningStats.uploaded || joiningVerified;

    // Calculate pending percentage for joining letters
    const pendingPercent = joiningTotal > 0
      ? Math.round(((joiningNoLetter + joiningPending) / joiningTotal) * 100 * 10) / 10
      : 0;

    // Monthly reports - use dashboardStats.pending as fallback
    const reportsSubmitted = currentMonthData.reportsSubmitted || 0;
    const reportsTotal = studentsWithInternships || totalStudents;
    const reportsPending = stats?.pending?.monthlyReports || Math.max(0, reportsTotal - reportsSubmitted);

    // Faculty visits
    const visitsCompleted = currentMonthData.facultyVisits || 0;
    const visitsTotal = studentsWithInternships || totalStudents;
    const visitsPending = Math.max(0, visitsTotal - visitsCompleted);

    return {
      monthlyReports: {
        submitted: reportsSubmitted,
        total: reportsTotal,
        pending: reportsPending,
      },
      joiningLetters: {
        submitted: joiningUploaded,
        total: joiningTotal,
        pendingPercent: pendingPercent,
      },
      facultyVisits: {
        completed: visitsCompleted,
        total: visitsTotal,
        pending: visitsPending,
      },
      grievances: {
        total: alertsEnhanced?.summary?.totalGrievances || stats?.pending?.grievances || 0,
        unaddressed: alertsEnhanced?.summary?.urgentGrievancesCount || stats?.pending?.grievances || 0,
      },
    };
  }, [stats, joiningLetterStats, complianceMetrics, alertsEnhanced]);

  const currentDate = useMemo(() => new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }), []);

  // Conditional returns - AFTER all hooks
  if (dashboardLoading && !stats) {
    return (
      <div className="flex flex-col justify-center items-center h-screen gap-4">
        <Spin size="large" />
        <Text className="text-text-secondary animate-pulse">Loading dashboard...</Text>
      </div>
    );
  }

  if (!stats && dashboardError) {
    return (
      <div className="p-8 max-w-md mx-auto">
        <Alert
          type="error"
          message="Failed to load dashboard data"
          description={dashboardError}
          showIcon
          action={
            <Button size="small" danger onClick={refreshData}>
              Retry
            </Button>
          }
        />
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="p-8 text-center">
        <Text type="danger">Failed to load dashboard data</Text>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 bg-background-secondary min-h-screen">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header Section - Compact */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <div>
            <div className="flex items-center gap-2">
              <Title level={4} className="!mb-0 text-text-primary">
                Principal Dashboard
              </Title>
              {lastFetched && (
                <span className="text-[10px] text-text-tertiary">
                  Updated {new Date(lastFetched).toLocaleTimeString()}
                </span>
              )}
            </div>
            <Text className="text-text-secondary text-xs">
              Welcome back, <span className="font-medium text-primary">{principalName}</span> • {currentDate}
            </Text>
          </div>

          <Tooltip title="Refresh all dashboard data">
            <Button
              size="small"
              icon={<ReloadOutlined spin={isRefreshing} />}
              onClick={refreshData}
              loading={isRefreshing}
              disabled={dashboardLoading}
            >
              Refresh
            </Button>
          </Tooltip>
        </div>

        {/* Alerts & Action Items - At Top with Closable Alerts */}
        {alertsEnhanced?.summary?.totalAlerts > 0 && (
          <div className="space-y-2">
            {alertsEnhanced.summary.overdueReportsCount > 0 && !dismissedAlerts.includes('reports') && (
              <Alert
                type="warning"
                showIcon
                closable
                onClose={(e) => { e.stopPropagation(); setDismissedAlerts([...dismissedAlerts, 'reports']); }}
                icon={<FileTextOutlined />}
                message={`${alertsEnhanced.summary.overdueReportsCount} Overdue Monthly Reports`}
                description="Students with overdue monthly reports"
                className="cursor-pointer"
                onClick={() => setAlertDetailModal({
                  visible: true,
                  type: 'reports',
                  title: 'Overdue Reports',
                  data: alertsEnhanced.alerts?.overdueReports || []
                })}
              />
            )}
            {alertsEnhanced.summary.missingVisitsCount > 0 && !dismissedAlerts.includes('visits') && (
              <Alert
                type="info"
                showIcon
                closable
                onClose={(e) => { e.stopPropagation(); setDismissedAlerts([...dismissedAlerts, 'visits']); }}
                icon={<EyeOutlined />}
                message={`${alertsEnhanced.summary.missingVisitsCount} Missing Faculty Visits`}
                description="Students without recent faculty visits (30+ days)"
                className="cursor-pointer"
                onClick={() => setAlertDetailModal({
                  visible: true,
                  type: 'visits',
                  title: 'Missing Faculty Visits',
                  data: alertsEnhanced.alerts?.missingVisits || []
                })}
              />
            )}
            {alertsEnhanced.summary.pendingJoiningLettersCount > 0 && !dismissedAlerts.includes('joiningLetters') && (
              <Alert
                type="warning"
                showIcon
                closable
                onClose={(e) => { e.stopPropagation(); setDismissedAlerts([...dismissedAlerts, 'joiningLetters']); }}
                icon={<FileTextOutlined />}
                message={`${alertsEnhanced.summary.pendingJoiningLettersCount} Pending Joining Letters`}
                description="Students with internships awaiting joining letter submission"
                className="cursor-pointer"
                onClick={() => setAlertDetailModal({
                  visible: true,
                  type: 'joiningLetters',
                  title: 'Pending Joining Letters',
                  data: alertsEnhanced.alerts?.pendingJoiningLetters || []
                })}
              />
            )}
            {alertsEnhanced.summary.urgentGrievancesCount > 0 && !dismissedAlerts.includes('grievances') && (
              <Alert
                type="error"
                showIcon
                closable
                onClose={(e) => { e.stopPropagation(); setDismissedAlerts([...dismissedAlerts, 'grievances']); }}
                icon={<ExclamationCircleOutlined />}
                message={`${alertsEnhanced.summary.urgentGrievancesCount} Urgent Grievances`}
                description="Pending grievances that require immediate attention"
                className="cursor-pointer"
                onClick={() => setAlertDetailModal({
                  visible: true,
                  type: 'grievances',
                  title: 'Urgent Grievances',
                  data: alertsEnhanced.alerts?.urgentGrievances || []
                })}
              />
            )}
            {alertsEnhanced.summary.unassignedStudentsCount > 0 && !dismissedAlerts.includes('unassigned') && (
              <Alert
                type="warning"
                showIcon
                closable
                onClose={(e) => { e.stopPropagation(); setDismissedAlerts([...dismissedAlerts, 'unassigned']); }}
                icon={<TeamOutlined />}
                message={`${alertsEnhanced.summary.unassignedStudentsCount} Unassigned Students`}
                description="Active internship students without assigned mentors"
                className="cursor-pointer"
                onClick={() => setAlertDetailModal({
                  visible: true,
                  type: 'unassigned',
                  title: 'Unassigned Students',
                  data: alertsEnhanced.alerts?.unassignedStudents || []
                })}
              />
            )}
          </div>
        )}

        {/* Basic Statistics Section */}
        <div>
          <SectionTitle title="Basic Statistics" />
          <BasicStatisticsGrid
            {...basicStatsData}
            loading={dashboardLoading || mentorCoverageLoading || alertsEnhancedLoading || internshipStatsLoading}
            onViewStudents={() => setStudentsModal({ visible: true })}
            onViewMentors={() => setMentorsModal({ visible: true })}
            onViewUnassigned={() => setAlertDetailModal({
              visible: true,
              type: 'unassigned',
              title: 'Unassigned Students',
              data: alertsEnhanced?.alerts?.unassignedStudents || []
            })}
            onViewCompanies={() => navigate('/principal/internships')}
          />
        </div>

        {/* Submission & Status Overview Section */}
        <div>
          <SectionTitle title="Submission & Status Overview" />
          <SubmissionStatusGrid
            {...submissionStatusData}
            loading={complianceMetricsLoading || joiningLetterStatsLoading || alertsEnhancedLoading}
            onViewReports={() => setAlertDetailModal({
              visible: true,
              type: 'reports',
              title: 'Monthly Reports Overview',
              data: alertsEnhanced?.alerts?.overdueReports || []
            })}
            onViewJoiningLetters={() => setAlertDetailModal({
              visible: true,
              type: 'joiningLetters',
              title: 'Joining Letters Overview',
              data: alertsEnhanced?.alerts?.pendingJoiningLetters || []
            })}
            onViewVisits={() => setAlertDetailModal({
              visible: true,
              type: 'visits',
              title: 'Faculty Visits Overview',
              data: alertsEnhanced?.alerts?.missingVisits || []
            })}
            onViewGrievances={() => setAlertDetailModal({
              visible: true,
              type: 'grievances',
              title: 'Student Grievances',
              data: alertsEnhanced?.alerts?.urgentGrievances || []
            })}
          />
        </div>

        {/* Faculty Workload Row */}
        <Row gutter={[16, 16]} className="mt-6">
          <Col xs={24}>
            <FacultyWorkloadCard />
          </Col>
        </Row>

        {/* Alert Details Modal */}
        <Modal
          title={alertDetailModal.title}
          open={alertDetailModal.visible}
          onCancel={() => setAlertDetailModal({ visible: false, type: null, title: '', data: [] })}
          footer={null}
          width={800}
        >
          <Table
            dataSource={alertDetailModal.data}
            rowKey={(record) => record.studentId || record.grievanceId || record.id || Math.random()}
            pagination={{ pageSize: 10 }}
            size="small"
            columns={
              alertDetailModal.type === 'grievances' ? [
                { title: 'Student', dataIndex: 'studentName', key: 'studentName' },
                { title: 'Roll No', dataIndex: 'rollNumber', key: 'rollNumber' },
                { title: 'Grievance', dataIndex: 'title', key: 'title' },
                { title: 'Status', dataIndex: 'status', key: 'status', render: (s) => <Tag color={s === 'PENDING' ? 'orange' : 'blue'}>{s}</Tag> },
                { title: 'Days Pending', dataIndex: 'daysPending', key: 'daysPending', render: (d) => <Tag color="red">{d} days</Tag> },
              ] : alertDetailModal.type === 'reports' ? [
                { title: 'Student', dataIndex: 'studentName', key: 'studentName' },
                { title: 'Roll No', dataIndex: 'rollNumber', key: 'rollNumber' },
                { title: 'Mentor', dataIndex: 'mentorName', key: 'mentorName', render: (m) => m || <Text type="secondary">Not assigned</Text> },
                { title: 'Days Overdue', dataIndex: 'daysOverdue', key: 'daysOverdue', render: (d) => <Tag color="orange">{d} days</Tag> },
              ] : alertDetailModal.type === 'visits' ? [
                { title: 'Student', dataIndex: 'studentName', key: 'studentName' },
                { title: 'Roll No', dataIndex: 'rollNumber', key: 'rollNumber' },
                { title: 'Last Visit', dataIndex: 'lastVisitDate', key: 'lastVisitDate', render: (d) => d ? new Date(d).toLocaleDateString() : 'Never' },
                { title: 'Days Since Visit', dataIndex: 'daysSinceLastVisit', key: 'daysSinceLastVisit', render: (d) => d ? <Tag color="blue">{d} days</Tag> : <Tag color="red">Never visited</Tag> },
              ] : alertDetailModal.type === 'unassigned' ? [
                { title: 'Student', dataIndex: 'studentName', key: 'studentName' },
                { title: 'Roll No', dataIndex: 'rollNumber', key: 'rollNumber' },
                { title: 'Batch', dataIndex: 'batchName', key: 'batchName' },
                { title: 'Branch', dataIndex: 'branchName', key: 'branchName' },
              ] : alertDetailModal.type === 'joiningLetters' ? [
                { title: 'Student', dataIndex: 'studentName', key: 'studentName' },
                { title: 'Roll No', dataIndex: 'rollNumber', key: 'rollNumber' },
                { title: 'Mentor', dataIndex: 'mentorName', key: 'mentorName', render: (m) => m || <Text type="secondary">Not assigned</Text> },
                { title: 'Branch', dataIndex: 'branchName', key: 'branchName' },
                { title: 'Company', dataIndex: 'companyName', key: 'companyName', render: (c) => c || <Text type="secondary">-</Text> },
                { title: 'Start Date', dataIndex: 'startDate', key: 'startDate', render: (d) => d ? new Date(d).toLocaleDateString() : '-' },
              ] : []
            }
          />
        </Modal>

        {/* Students by Course Modal */}
        <Modal
          title={
            <div className="flex items-center gap-2">
              <TeamOutlined className="text-primary" />
              <span>Students by Course</span>
              <Badge count={stats?.students?.total || 0} style={{ backgroundColor: '#3b82f6' }} />
            </div>
          }
          open={studentsModal.visible}
          onCancel={() => setStudentsModal({ visible: false })}
          footer={
            <Button onClick={() => navigate('/principal/students')}>
              View All Students
            </Button>
          }
          width={700}
        >
          <Table
            dataSource={dashboardStats?.studentsByBranch || dashboardStats?.branchWiseStudents || []}
            rowKey={(record) => record.branchId || record.branch || record.id || Math.random()}
            pagination={false}
            size="small"
            columns={[
              {
                title: 'Course / Branch',
                dataIndex: 'branchName',
                key: 'branchName',
                render: (text, record) => text || record.branch || record.name || 'Unknown',
              },
              {
                title: 'Total Students',
                dataIndex: 'totalStudents',
                key: 'totalStudents',
                align: 'center',
                render: (val, record) => (
                  <Tag color="blue">{val || record.count || record.total || 0}</Tag>
                ),
              },
              {
                title: 'Active',
                dataIndex: 'activeStudents',
                key: 'activeStudents',
                align: 'center',
                render: (val, record) => (
                  <Tag color="green">{val || record.active || 0}</Tag>
                ),
              },
              {
                title: 'With Internship',
                dataIndex: 'withInternship',
                key: 'withInternship',
                align: 'center',
                render: (val) => (
                  <Tag color="purple">{val || 0}</Tag>
                ),
              },
            ]}
            summary={() => (
              <Table.Summary fixed>
                <Table.Summary.Row>
                  <Table.Summary.Cell index={0}>
                    <Text strong>Total</Text>
                  </Table.Summary.Cell>
                  <Table.Summary.Cell index={1} align="center">
                    <Text strong>{stats?.students?.total || 0}</Text>
                  </Table.Summary.Cell>
                  <Table.Summary.Cell index={2} align="center">
                    <Text strong>{stats?.students?.active || 0}</Text>
                  </Table.Summary.Cell>
                  <Table.Summary.Cell index={3} align="center">
                    <Text strong>{stats?.internships?.ongoingInternships || 0}</Text>
                  </Table.Summary.Cell>
                </Table.Summary.Row>
              </Table.Summary>
            )}
          />
        </Modal>

        {/* Mentors Details Modal */}
        <Modal
          title={
            <div className="flex items-center gap-2">
              <TeamOutlined className="text-success" />
              <span>Mentor Details</span>
              <Badge count={mentorCoverage?.totalMentors || 0} style={{ backgroundColor: '#22c55e' }} />
            </div>
          }
          open={mentorsModal.visible}
          onCancel={() => setMentorsModal({ visible: false })}
          footer={
            <Button onClick={() => navigate('/principal/staff')}>
              View All Staff
            </Button>
          }
          width={800}
        >
          <div className="mb-4 grid grid-cols-3 gap-4">
            <div className="text-center p-3 bg-green-50 rounded-lg">
              <div className="text-xl font-bold text-green-600">{mentorCoverage?.totalMentors || 0}</div>
              <div className="text-xs text-gray-500">Total Mentors</div>
            </div>
            <div className="text-center p-3 bg-blue-50 rounded-lg">
              <div className="text-xl font-bold text-blue-600">{mentorCoverage?.studentsWithMentors || 0}</div>
              <div className="text-xs text-gray-500">Students Assigned</div>
            </div>
            <div className="text-center p-3 bg-purple-50 rounded-lg">
              <div className="text-xl font-bold text-purple-600">{mentorCoverage?.coveragePercentage || 0}%</div>
              <div className="text-xs text-gray-500">Coverage Rate</div>
            </div>
          </div>
          <Table
            dataSource={mentorCoverage?.mentorLoadDistribution || []}
            rowKey={(record) => record.mentorId || record.id || Math.random()}
            pagination={{ pageSize: 10 }}
            size="small"
            columns={[
              {
                title: 'Mentor Name',
                dataIndex: 'mentorName',
                key: 'mentorName',
                render: (text, record) => text || record.name || 'Unknown',
              },
              {
                title: 'Department',
                dataIndex: 'department',
                key: 'department',
                render: (text) => text || '-',
              },
              {
                title: 'Assigned Students',
                dataIndex: 'assignedStudents',
                key: 'assignedStudents',
                align: 'center',
                sorter: (a, b) => (a.assignedStudents || 0) - (b.assignedStudents || 0),
                render: (val) => {
                  const count = val || 0;
                  let color = 'green';
                  if (count > 15) color = 'orange';
                  else if (count > 5) color = 'blue';
                  return <Tag color={color}>{count}</Tag>;
                },
              },
              {
                title: 'Load Status',
                key: 'loadStatus',
                align: 'center',
                render: (_, record) => {
                  const count = record.assignedStudents || 0;
                  if (count === 0) return <Tag>No Load</Tag>;
                  if (count <= 5) return <Tag color="green">Light</Tag>;
                  if (count <= 15) return <Tag color="blue">Optimal</Tag>;
                  return <Tag color="orange">Heavy</Tag>;
                },
              },
            ]}
          />
        </Modal>
      </div>
    </div>
  );
};

export default React.memo(PrincipalDashboard);