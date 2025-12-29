import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  Card,
  Col,
  Row,
  Typography,
  Spin,
  Button,
  Badge,
  Empty,
  Tooltip,
  Progress,
  Alert,
  Tag,
  Modal,
  Table,
} from 'antd';
import {
  UserOutlined,
  TeamOutlined,
  ReadOutlined,
  NotificationOutlined,
  EditOutlined,
  ClockCircleOutlined,
  PlusOutlined,
  BankOutlined,
  WarningOutlined,
  ExclamationCircleOutlined,
  CheckCircleOutlined,
  FileTextOutlined,
  EyeOutlined,
  SolutionOutlined,
  AuditOutlined,
  AlertOutlined,
  ReloadOutlined,
} from '@ant-design/icons';
import NoticeFormModal from '../../../components/modals/NoticeFormModal';
import {
  fetchPrincipalDashboard,
  fetchMentorCoverage,
  fetchComplianceMetrics,
  fetchAlertsEnhanced,
  selectDashboardStats,
  selectDashboardLoading,
  selectDashboardError,
  selectMentorCoverage,
  selectMentorCoverageLoading,
  selectMentorCoverageError,
  selectComplianceMetrics,
  selectComplianceMetricsLoading,
  selectComplianceMetricsError,
  selectAlertsEnhanced,
  selectAlertsEnhancedLoading,
  selectAlertsEnhancedError,
  selectMostRecentFetch,
} from '../store/principalSlice';
import InternshipCompaniesCard from './components/InternshipCompaniesCard';
import FacultyWorkloadCard from './components/FacultyWorkloadCard';

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

const getInstitutionId = () => {
  try {
    const loginData = localStorage.getItem('loginResponse');
    if (loginData) {
      return JSON.parse(loginData)?.user?.institutionId;
    }
  } catch {
    return null;
  }
  return null;
};

// Stat Card Component - Clean Style
const StatCard = ({ title, total, icon, bgClass, colorClass }) => (
  <Card
    className="h-full border-border shadow-sm hover:shadow-md transition-all duration-300 rounded-xl"
    styles={{ body: { padding: '16px' } }}
  >
    <div className="flex items-center gap-4">
      <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${bgClass} ${colorClass}`}>
        {React.cloneElement(icon, { className: 'text-xl' })}
      </div>
      <div>
        <div className="text-2xl font-bold text-text-primary mb-0 leading-none">{total}</div>
        <div className="text-xs uppercase font-bold text-text-tertiary mt-1 tracking-wide">
          Total {title}
        </div>
      </div>
    </div>
  </Card>
);

const PrincipalDashboard = () => {
  const dispatch = useDispatch();

  const [principalName, setPrincipalName] = useState('Principal');
  const [notices, setNotices] = useState([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingNotice, setEditingNotice] = useState(null);
  const [instituteName, setInstituteName] = useState('');
  const [alertDetailModal, setAlertDetailModal] = useState({ visible: false, type: null, title: '', data: [] });
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Redux selectors for dashboard data
  const dashboardStats = useSelector(selectDashboardStats);
  const dashboardLoading = useSelector(selectDashboardLoading);
  const dashboardError = useSelector(selectDashboardError);
  const mentorCoverage = useSelector(selectMentorCoverage);
  const mentorCoverageLoading = useSelector(selectMentorCoverageLoading);
  const mentorCoverageError = useSelector(selectMentorCoverageError);
  const complianceMetrics = useSelector(selectComplianceMetrics);
  const complianceMetricsLoading = useSelector(selectComplianceMetricsLoading);
  const complianceMetricsError = useSelector(selectComplianceMetricsError);
  const alertsEnhanced = useSelector(selectAlertsEnhanced);
  const alertsEnhancedLoading = useSelector(selectAlertsEnhancedLoading);
  const alertsEnhancedError = useSelector(selectAlertsEnhancedError);
  const lastFetched = useSelector(selectMostRecentFetch);

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
    dispatch(fetchComplianceMetrics());
    dispatch(fetchAlertsEnhanced());
  }, [dispatch]);

  // Update institution name and notices from dashboard stats
  useEffect(() => {
    if (dashboardStats) {
      const institutionName = dashboardStats.institution?.name;
      const dashboardNotices = dashboardStats.notices;

      if (institutionName) {
        setInstituteName(institutionName);
      }
      // Use notices from dashboard if available
      if (dashboardNotices) {
        setNotices(Array.isArray(dashboardNotices) ? dashboardNotices : []);
      }
    }
  }, [dashboardStats]);

  const handleEdit = useCallback((notice) => {
    setEditingNotice(notice);
    setModalVisible(true);
  }, []);

  const refreshData = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await Promise.all([
        dispatch(fetchPrincipalDashboard({ forceRefresh: true })),
        dispatch(fetchMentorCoverage({ forceRefresh: true })),
        dispatch(fetchComplianceMetrics({ forceRefresh: true })),
        dispatch(fetchAlertsEnhanced({ forceRefresh: true })),
      ]);
    } finally {
      setIsRefreshing(false);
    }
  }, [dispatch]);

  // Memoized values - must be called before any conditional returns to follow Rules of Hooks
  const summaryCards = useMemo(() => {
    if (!stats) return [];
    return [
    {
      title: 'Students',
      ...stats.students,
      icon: <ReadOutlined />,
      bgClass: 'bg-primary/10',
      colorClass: 'text-primary',
    },
    {
      title: 'Staff',
      ...stats.staff,
      icon: <TeamOutlined />,
      bgClass: 'bg-success/10',
      colorClass: 'text-success',
    },
    {
      title: 'Mentors',
      total: mentorCoverage?.totalMentors || 0,
      icon: <SolutionOutlined />,
      bgClass: 'bg-info/10',
      colorClass: 'text-info',
    },
  ];
  }, [stats, mentorCoverage]);

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
        {/* Header Section */}
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
          <div className="flex items-center">
            <div className="w-10 h-10 flex items-center justify-center rounded-xl bg-surface border border-border text-primary shadow-sm mr-3">
              <BankOutlined className="text-lg" />
            </div>
            <div>
              <div className="flex items-center gap-3">
                <Title level={2} className="mb-0 text-text-primary text-2xl">
                  Principal Dashboard
                </Title>
                {lastFetched && (
                  <span className="text-xs text-text-tertiary">
                    Updated {new Date(lastFetched).toLocaleTimeString()}
                  </span>
                )}
              </div>
              <Paragraph className="text-text-secondary text-sm mb-0">
                Welcome back, <span className="font-semibold text-primary">{principalName}</span> • {currentDate}
              </Paragraph>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Tooltip title="Refresh all dashboard data">
              <Button
                icon={<ReloadOutlined spin={isRefreshing} />}
                onClick={refreshData}
                loading={isRefreshing}
                disabled={dashboardLoading}
              >
                Refresh
              </Button>
            </Tooltip>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => setModalVisible(true)}
              className="h-10 rounded-xl font-bold shadow-lg shadow-primary/20"
            >
              Create Notice
            </Button>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {dashboardLoading ? (
            Array.from({ length: 4 }).map((_, idx) => (
              <Card key={idx} className="h-full border-border shadow-sm rounded-xl" loading />
            ))
          ) : (
            summaryCards.map((card, idx) => (
              <StatCard key={idx} {...card} />
            ))
          )}
        </div>

        {/* Pending Items Row */}
        <Row gutter={[16, 16]} className="mt-6">
          {/* Pending Items */}
          <Col xs={24}>
            <Card
              title={
                <div className="flex items-center justify-between w-full">
                  <div className="flex items-center gap-2">
                    <AuditOutlined className="text-warning" />
                    <span>Pending Items</span>
                  </div>
                  {totalPendingItems > 0 && (
                    <Badge count={totalPendingItems} className="[&_.ant-badge-count]:bg-warning" />
                  )}
                </div>
              }
              className="border-border shadow-sm rounded-xl h-full"
              loading={alertsEnhancedLoading}
              styles={{ body: { padding: '20px' } }}
            >
              {!alertsEnhancedLoading && (
              <div className="space-y-4">
                <div className="grid grid-cols-4 gap-3">
                  <Tooltip title="Click to view overdue reports">
                    <div
                      className="text-center p-3 bg-warning/10 rounded-lg cursor-pointer hover:bg-warning/20 transition-colors"
                      onClick={() => alertsEnhanced?.alerts?.overdueReports?.length > 0 && setAlertDetailModal({
                        visible: true,
                        type: 'reports',
                        title: 'Overdue Reports',
                        data: alertsEnhanced.alerts.overdueReports
                      })}
                    >
                      <div className="text-2xl font-bold text-warning">
                        {alertsEnhanced?.summary?.overdueReportsCount || 0}
                      </div>
                      <div className="text-xs text-text-secondary uppercase font-semibold">Reports</div>
                    </div>
                  </Tooltip>
                  <Tooltip title="Click to view students needing visits">
                    <div
                      className="text-center p-3 bg-info/10 rounded-lg cursor-pointer hover:bg-info/20 transition-colors"
                      onClick={() => alertsEnhanced?.alerts?.missingVisits?.length > 0 && setAlertDetailModal({
                        visible: true,
                        type: 'visits',
                        title: 'Missing Faculty Visits',
                        data: alertsEnhanced.alerts.missingVisits
                      })}
                    >
                      <div className="text-2xl font-bold text-info">
                        {alertsEnhanced?.summary?.missingVisitsCount || 0}
                      </div>
                      <div className="text-xs text-text-secondary uppercase font-semibold">Visits Due</div>
                    </div>
                  </Tooltip>
                  <Tooltip title="Click to view urgent grievances">
                    <div
                      className="text-center p-3 bg-error/10 rounded-lg cursor-pointer hover:bg-error/20 transition-colors"
                      onClick={() => alertsEnhanced?.alerts?.urgentGrievances?.length > 0 && setAlertDetailModal({
                        visible: true,
                        type: 'grievances',
                        title: 'Urgent Grievances',
                        data: alertsEnhanced.alerts.urgentGrievances
                      })}
                    >
                      <div className="text-2xl font-bold text-error">
                        {alertsEnhanced?.summary?.urgentGrievancesCount || 0}
                      </div>
                      <div className="text-xs text-text-secondary uppercase font-semibold">Grievances</div>
                    </div>
                  </Tooltip>
                  <Tooltip title="Click to view students with pending joining letters">
                    <div
                      className="text-center p-3 bg-purple-500/10 rounded-lg cursor-pointer hover:bg-purple-500/20 transition-colors"
                      onClick={() => alertsEnhanced?.alerts?.pendingJoiningLetters?.length > 0 && setAlertDetailModal({
                        visible: true,
                        type: 'joiningLetters',
                        title: 'Pending Joining Letters',
                        data: alertsEnhanced.alerts.pendingJoiningLetters
                      })}
                    >
                      <div className="text-2xl font-bold text-purple-600">
                        {alertsEnhanced?.summary?.pendingJoiningLettersCount || 0}
                      </div>
                      <div className="text-xs text-text-secondary uppercase font-semibold">Joining Letters</div>
                    </div>
                  </Tooltip>
                </div>
                {totalPendingItems === 0 ? (
                  <div className="text-center py-4">
                    <CheckCircleOutlined className="text-4xl text-success mb-2" />
                    <div className="text-text-secondary text-sm">All items processed!</div>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-sm">
                    <AlertOutlined className="text-warning" />
                    <span className="text-text-secondary">
                      {totalPendingItems} item{totalPendingItems !== 1 ? 's' : ''} require{totalPendingItems === 1 ? 's' : ''} attention
                    </span>
                  </div>
                )}
              </div>
              )}
            </Card>
          </Col>
        </Row>

        {/* Mentor Coverage Row */}
        <Row gutter={[16, 16]} className="mt-6">
          {/* Mentor Coverage */}
          <Col xs={24}>
            <Card
              title={
                <div className="flex items-center gap-2">
                  <TeamOutlined className="text-primary" />
                  <span>Mentor Coverage</span>
                </div>
              }
              className="border-border shadow-sm rounded-xl h-full"
              loading={mentorCoverageLoading}
              styles={{ body: { padding: '20px' } }}
            >
              {mentorCoverageError ? (
                <Alert
                  type="error"
                  message="Failed to load mentor coverage"
                  description={mentorCoverageError}
                  showIcon
                  action={
                    <Button size="small" onClick={() => dispatch(fetchMentorCoverage({ forceRefresh: true }))}>
                      Retry
                    </Button>
                  }
                />
              ) : mentorCoverage ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="text-center p-3 bg-primary/10 rounded-lg">
                      <div className="text-2xl font-bold text-primary">
                        {mentorCoverage.totalMentors || 0}
                      </div>
                      <div className="text-xs text-text-secondary uppercase font-semibold">Total Mentors</div>
                    </div>
                    <div className="text-center p-3 bg-success/10 rounded-lg">
                      <div className="text-2xl font-bold text-success">
                        {mentorCoverage.studentsWithMentors || 0}
                      </div>
                      <div className="text-xs text-text-secondary uppercase font-semibold">Students Assigned</div>
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between mb-1">
                      <Text className="text-text-secondary">Coverage Rate</Text>
                      <Text strong>{mentorCoverage.coveragePercentage || 0}%</Text>
                    </div>
                    <Progress
                      percent={mentorCoverage.coveragePercentage || 0}
                      strokeColor={mentorCoverage.coveragePercentage >= 80 ? '#52c41a' : mentorCoverage.coveragePercentage >= 50 ? '#faad14' : '#ff4d4f'}
                      showInfo={false}
                    />
                  </div>
                  {mentorCoverage.mentorLoadDistribution && mentorCoverage.mentorLoadDistribution.length > 0 && (
                    <div>
                      <Text className="text-text-secondary text-sm block mb-2">Load Distribution</Text>
                      <div className="flex gap-2 flex-wrap">
                        <Tag color="green">Light: {mentorCoverage.mentorLoadDistribution.filter(m => m.assignedStudents <= 5).length}</Tag>
                        <Tag color="blue">Optimal: {mentorCoverage.mentorLoadDistribution.filter(m => m.assignedStudents > 5 && m.assignedStudents <= 15).length}</Tag>
                        <Tag color="orange">Heavy: {mentorCoverage.mentorLoadDistribution.filter(m => m.assignedStudents > 15).length}</Tag>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-8">
                  <Text className="text-text-tertiary">No mentor coverage data available</Text>
                </div>
              )}
            </Card>
          </Col>
        </Row>

        {/* Internship Companies and Faculty Workload Row */}
        <Row gutter={[16, 16]} className="mt-6">
          <Col xs={24} lg={12}>
            <InternshipCompaniesCard />
          </Col>
          <Col xs={24} lg={12}>
            <FacultyWorkloadCard />
          </Col>
        </Row>

        {/* Enhanced Alerts */}
        {alertsEnhanced?.summary?.totalAlerts > 0 && (
          <div className="mt-6">
            <Card
              title={
                <div className="flex items-center gap-2">
                  <WarningOutlined className="text-red-500" />
                  <span>Alerts & Action Items</span>
                  <Badge count={alertsEnhanced.summary.totalAlerts} className="[&_.ant-badge-count]:bg-error" />
                </div>
              }
              className="border-border shadow-sm rounded-xl"
              loading={alertsEnhancedLoading}
              styles={{ body: { padding: '20px' } }}
            >
              <div className="space-y-3">
                {alertsEnhanced.summary.urgentGrievancesCount > 0 && (
                  <Alert
                    type="error"
                    showIcon
                    icon={<ExclamationCircleOutlined />}
                    message={`${alertsEnhanced.summary.urgentGrievancesCount} Urgent Grievances`}
                    description="Pending grievances that require immediate attention"
                    className="cursor-pointer hover:shadow-md transition-shadow"
                    onClick={() => setAlertDetailModal({
                      visible: true,
                      type: 'grievances',
                      title: 'Urgent Grievances',
                      data: alertsEnhanced.alerts?.urgentGrievances || []
                    })}
                    action={<Button type="link" size="small">View Details →</Button>}
                  />
                )}
                {alertsEnhanced.summary.overdueReportsCount > 0 && (
                  <Alert
                    type="warning"
                    showIcon
                    icon={<FileTextOutlined />}
                    message={`${alertsEnhanced.summary.overdueReportsCount} Overdue Reports`}
                    description="Students with overdue monthly reports"
                    className="cursor-pointer hover:shadow-md transition-shadow"
                    onClick={() => setAlertDetailModal({
                      visible: true,
                      type: 'reports',
                      title: 'Overdue Reports',
                      data: alertsEnhanced.alerts?.overdueReports || []
                    })}
                    action={<Button type="link" size="small">View Details →</Button>}
                  />
                )}
                {alertsEnhanced.summary.missingVisitsCount > 0 && (
                  <Alert
                    type="info"
                    showIcon
                    icon={<EyeOutlined />}
                    message={`${alertsEnhanced.summary.missingVisitsCount} Missing Faculty Visits`}
                    description="Students without recent faculty visits (30+ days)"
                    className="cursor-pointer hover:shadow-md transition-shadow"
                    onClick={() => setAlertDetailModal({
                      visible: true,
                      type: 'visits',
                      title: 'Missing Faculty Visits',
                      data: alertsEnhanced.alerts?.missingVisits || []
                    })}
                    action={<Button type="link" size="small">View Details →</Button>}
                  />
                )}
                {alertsEnhanced.summary.unassignedStudentsCount > 0 && (
                  <Alert
                    type="warning"
                    showIcon
                    icon={<TeamOutlined />}
                    message={`${alertsEnhanced.summary.unassignedStudentsCount} Unassigned Students`}
                    description="Active internship students without assigned mentors"
                    className="cursor-pointer hover:shadow-md transition-shadow"
                    onClick={() => setAlertDetailModal({
                      visible: true,
                      type: 'unassigned',
                      title: 'Unassigned Students',
                      data: alertsEnhanced.alerts?.unassignedStudents || []
                    })}
                    action={<Button type="link" size="small">View Details →</Button>}
                  />
                )}
                {alertsEnhanced.summary.pendingJoiningLettersCount > 0 && (
                  <Alert
                    type="warning"
                    showIcon
                    icon={<FileTextOutlined />}
                    message={`${alertsEnhanced.summary.pendingJoiningLettersCount} Pending Joining Letters`}
                    description="Students with internships awaiting joining letter submission"
                    className="cursor-pointer hover:shadow-md transition-shadow"
                    onClick={() => setAlertDetailModal({
                      visible: true,
                      type: 'joiningLetters',
                      title: 'Pending Joining Letters',
                      data: alertsEnhanced.alerts?.pendingJoiningLetters || []
                    })}
                    action={<Button type="link" size="small">View Details →</Button>}
                  />
                )}
              </div>
            </Card>
          </div>
        )}

        {/* Modals */}
        <NoticeFormModal
          open={modalVisible}
          onClose={() => {
            setModalVisible(false);
            setEditingNotice(null);
          }}
          onSuccess={refreshData}
          editingNotice={editingNotice}
        />

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
      </div>
    </div>
  );
};

export default React.memo(PrincipalDashboard);