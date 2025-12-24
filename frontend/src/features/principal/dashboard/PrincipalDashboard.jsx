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
  Avatar,
  Empty,
  Tooltip,
  Progress,
  Alert,
  Tag,
  Statistic,
} from 'antd';
import {
  UserOutlined,
  TeamOutlined,
  BookOutlined,
  ReadOutlined,
  NotificationOutlined,
  EditOutlined,
  ScheduleOutlined,
  RightOutlined,
  ClockCircleOutlined,
  PlusOutlined,
  BankOutlined,
  WarningOutlined,
  ExclamationCircleOutlined,
  CheckCircleOutlined,
  FileTextOutlined,
  EyeOutlined,
  RiseOutlined,
  SolutionOutlined,
  AuditOutlined,
  AlertOutlined,
} from '@ant-design/icons';
import NoticeFormModal from '../../../components/modals/NoticeFormModal';
import MixedStudentChart from '../../../components/charts/MixedStudentChart';
import UserRolesPieChart from '../../../components/charts/UserRolesPieChart';
import {
  fetchPrincipalDashboard,
  fetchMentorCoverage,
  fetchComplianceMetrics,
  fetchAlertsEnhanced,
  selectDashboardStats,
  selectDashboardLoading,
  selectMentorCoverage,
  selectMentorCoverageLoading,
  selectComplianceMetrics,
  selectComplianceMetricsLoading,
  selectAlertsEnhanced,
  selectAlertsEnhancedLoading,
} from '../store/principalSlice';
import JoiningLetterPanel from './components/JoiningLetterPanel';
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
        {React.cloneElement(icon, { style: { fontSize: '20px' } })}
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

  // Redux selectors for dashboard data
  const dashboardStats = useSelector(selectDashboardStats);
  const dashboardLoading = useSelector(selectDashboardLoading);
  const mentorCoverage = useSelector(selectMentorCoverage);
  const mentorCoverageLoading = useSelector(selectMentorCoverageLoading);
  const complianceMetrics = useSelector(selectComplianceMetrics);
  const complianceMetricsLoading = useSelector(selectComplianceMetricsLoading);
  const alertsEnhanced = useSelector(selectAlertsEnhanced);
  const alertsEnhancedLoading = useSelector(selectAlertsEnhancedLoading);

  // Memoized stats derived from Redux data
  const stats = useMemo(() => {
    if (!dashboardStats) return null;

    const studentsData = dashboardStats.students || {};
    const staffData = dashboardStats.staff || {};
    const batchesCount = typeof dashboardStats.batches === 'number'
      ? dashboardStats.batches
      : (dashboardStats.batches?.length || 0);

    return {
      students: {
        total: studentsData.total || 0,
        active: studentsData.active || 0,
        inactive: (studentsData.total || 0) - (studentsData.active || 0),
      },
      teachers: {
        total: staffData.total || 0,
        active: staffData.active || 0,
        inactive: (staffData.total || 0) - (staffData.active || 0),
      },
      staff: {
        total: staffData.total || 0,
        active: staffData.active || 0,
        inactive: (staffData.total || 0) - (staffData.active || 0),
      },
      batches: {
        total: batchesCount,
        active: batchesCount,
        inactive: 0,
      },
      internships: dashboardStats.internships || {},
      pending: dashboardStats.pending || {},
      assignments: dashboardStats.classAssignments || [],
    };
  }, [dashboardStats]);

  // Calculate total pending items (self-identified internships are auto-approved)
  const totalPendingItems = useMemo(() => {
    if (!stats?.pending) return 0;
    return (stats.pending.monthlyReports || 0) +
           (stats.pending.grievances || 0);
  }, [stats?.pending]);

  useEffect(() => {
    const currentUser = getCurrentUser();
    setPrincipalName(currentUser?.name || 'Principal');

    // Fetch all dashboard data using Redux
    dispatch(fetchPrincipalDashboard());
    dispatch(fetchMentorCoverage());
    dispatch(fetchComplianceMetrics());
    dispatch(fetchAlertsEnhanced());
  }, [dispatch]);

  // Update institution name and notices from dashboard stats
  useEffect(() => {
    if (dashboardStats) {
      if (dashboardStats.institution?.name) {
        setInstituteName(dashboardStats.institution.name);
      }
      // Use notices from dashboard if available
      if (dashboardStats.notices) {
        setNotices(Array.isArray(dashboardStats.notices) ? dashboardStats.notices : []);
      }
    }
  }, [dashboardStats]);

  const handleEdit = (notice) => {
    setEditingNotice(notice);
    setModalVisible(true);
  };

  const refreshData = useCallback(() => {
    dispatch(fetchPrincipalDashboard({ forceRefresh: true }));
    dispatch(fetchMentorCoverage({ forceRefresh: true }));
    dispatch(fetchComplianceMetrics({ forceRefresh: true }));
    dispatch(fetchAlertsEnhanced({ forceRefresh: true }));
  }, [dispatch]);

  if (dashboardLoading && !stats) {
    return (
      <div className="flex flex-col justify-center items-center h-screen gap-4">
        <Spin size="large" />
        <Text className="text-text-secondary animate-pulse">Loading dashboard...</Text>
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

  const summaryCards = [
    {
      title: 'Students',
      ...stats.students,
      icon: <ReadOutlined />,
      bgClass: 'bg-primary/10',
      colorClass: 'text-primary',
    },
    {
      title: 'Teachers',
      ...stats.teachers,
      icon: <UserOutlined />,
      bgClass: 'bg-success/10',
      colorClass: 'text-success',
    },
    {
      title: 'Staff',
      ...stats.staff,
      icon: <TeamOutlined />,
      bgClass: 'bg-warning/10',
      colorClass: 'text-warning',
    },
    {
      title: 'Batches',
      total: stats.batches.total,
      active: stats.batches.active,
      inactive: stats.batches.inactive,
      icon: <BookOutlined />,
      bgClass: 'bg-error/10',
      colorClass: 'text-error',
    },
  ];

  const currentDate = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

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
              <Title level={2} className="mb-0 text-text-primary text-2xl">
                Principal Dashboard
              </Title>
              <Paragraph className="text-text-secondary text-sm mb-0">
                Welcome back, <span className="font-semibold text-primary">{principalName}</span> • {currentDate}
              </Paragraph>
            </div>
          </div>

          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => setModalVisible(true)}
            className="h-10 rounded-xl font-bold shadow-lg shadow-primary/20"
          >
            Create Notice
          </Button>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {summaryCards.map((card, idx) => (
            <StatCard key={idx} {...card} />
          ))}
        </div>

        {/* Internship Statistics & Pending Items Row */}
        <Row gutter={[16, 16]} className="mt-6">
          {/* Internship Statistics */}
          <Col xs={24} lg={12}>
            <Card
              title={
                <div className="flex items-center gap-2">
                  <SolutionOutlined className="text-primary" />
                  <span>Self-Identified Internships</span>
                </div>
              }
              className="border-border shadow-sm rounded-xl h-full"
              styles={{ body: { padding: '20px' } }}
            >
              <div className="space-y-4">
                <div className="grid grid-cols-3 gap-3">
                  <div className="text-center p-3 bg-primary/10 rounded-lg">
                    <div className="text-2xl font-bold text-primary">
                      {stats.internships?.totalApplications || 0}
                    </div>
                    <div className="text-xs text-text-secondary uppercase font-semibold">Total</div>
                  </div>
                  <div className="text-center p-3 bg-info/10 rounded-lg">
                    <div className="text-2xl font-bold text-info">
                      {stats.internships?.ongoingInternships || 0}
                    </div>
                    <div className="text-xs text-text-secondary uppercase font-semibold">Ongoing</div>
                  </div>
                  <div className="text-center p-3 bg-success/10 rounded-lg">
                    <div className="text-2xl font-bold text-success">
                      {stats.internships?.completedInternships || 0}
                    </div>
                    <div className="text-xs text-text-secondary uppercase font-semibold">Completed</div>
                  </div>
                </div>
                <div>
                  <div className="flex justify-between mb-1">
                    <Text className="text-text-secondary">Completion Progress</Text>
                    <Text strong className="text-success">
                      {stats.internships?.completedInternships || 0} / {stats.internships?.totalApplications || 0}
                    </Text>
                  </div>
                  <Progress
                    percent={stats.internships?.completionRate || 0}
                    strokeColor={{
                      '0%': 'rgb(var(--color-primary))',
                      '100%': 'rgb(var(--color-success))',
                    }}
                    showInfo={false}
                  />
                </div>
                {stats.internships?.totalApplications > 0 && (
                  <div className="flex items-center gap-2 text-sm text-text-secondary">
                    <CheckCircleOutlined className="text-success" />
                    <span>Auto-approved on submission</span>
                  </div>
                )}
              </div>
            </Card>
          </Col>

          {/* Pending Items */}
          <Col xs={24} lg={12}>
            <Card
              title={
                <div className="flex items-center justify-between w-full">
                  <div className="flex items-center gap-2">
                    <AuditOutlined className="text-warning" />
                    <span>Pending Items</span>
                  </div>
                  {totalPendingItems > 0 && (
                    <Badge count={totalPendingItems} style={{ backgroundColor: 'rgb(var(--color-warning))' }} />
                  )}
                </div>
              }
              className="border-border shadow-sm rounded-xl h-full"
              styles={{ body: { padding: '20px' } }}
            >
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <Tooltip title="Monthly reports awaiting review">
                    <div className="text-center p-3 bg-warning/10 rounded-lg cursor-help">
                      <div className="text-2xl font-bold text-warning">
                        {stats.pending?.monthlyReports || 0}
                      </div>
                      <div className="text-xs text-text-secondary uppercase font-semibold">Reports</div>
                    </div>
                  </Tooltip>
                  <Tooltip title="Student grievances requiring attention">
                    <div className="text-center p-3 bg-error/10 rounded-lg cursor-help">
                      <div className="text-2xl font-bold text-error">
                        {stats.pending?.grievances || 0}
                      </div>
                      <div className="text-xs text-text-secondary uppercase font-semibold">Grievances</div>
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
            </Card>
          </Col>
        </Row>

        {/* Mentor Coverage and Compliance Row */}
        <Row gutter={[16, 16]} className="mt-6">
          {/* Mentor Coverage */}
          <Col xs={24} lg={12}>
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
              {mentorCoverage ? (
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

          {/* Compliance Metrics */}
          <Col xs={24} lg={12}>
            <Card
              title={
                <div className="flex items-center gap-2">
                  <CheckCircleOutlined className="text-success" />
                  <span>Compliance Metrics</span>
                </div>
              }
              className="border-border shadow-sm rounded-xl h-full"
              loading={complianceMetricsLoading}
              styles={{ body: { padding: '20px' } }}
            >
              {complianceMetrics ? (
                <div className="space-y-4">
                  <div>
                    <div className="flex justify-between mb-1">
                      <Text className="text-text-secondary">Report Submission</Text>
                      <Text strong>{complianceMetrics.currentMonth?.reportComplianceRate || 0}%</Text>
                    </div>
                    <Progress
                      percent={complianceMetrics.currentMonth?.reportComplianceRate || 0}
                      strokeColor={complianceMetrics.currentMonth?.reportComplianceRate >= 80 ? '#52c41a' : complianceMetrics.currentMonth?.reportComplianceRate >= 50 ? '#faad14' : '#ff4d4f'}
                      showInfo={false}
                    />
                  </div>
                  <div>
                    <div className="flex justify-between mb-1">
                      <Text className="text-text-secondary">Faculty Visits</Text>
                      <Text strong>{complianceMetrics.currentMonth?.visitComplianceRate || 0}%</Text>
                    </div>
                    <Progress
                      percent={complianceMetrics.currentMonth?.visitComplianceRate || 0}
                      strokeColor={complianceMetrics.currentMonth?.visitComplianceRate >= 80 ? '#52c41a' : complianceMetrics.currentMonth?.visitComplianceRate >= 50 ? '#faad14' : '#ff4d4f'}
                      showInfo={false}
                    />
                  </div>
                  <div>
                    <div className="flex justify-between mb-1">
                      <Text className="text-text-secondary">Overall Compliance</Text>
                      <Text strong className="text-lg">{complianceMetrics.currentMonth?.overallScore || 0}%</Text>
                    </div>
                    <Progress
                      percent={complianceMetrics.currentMonth?.overallScore || 0}
                      strokeColor={complianceMetrics.currentMonth?.overallScore >= 80 ? '#52c41a' : complianceMetrics.currentMonth?.overallScore >= 50 ? '#faad14' : '#ff4d4f'}
                    />
                  </div>
                  {complianceMetrics.trend && complianceMetrics.trend.length > 0 && (
                    <div className="text-sm text-text-secondary">
                      <Text>6-month trend: </Text>
                      {complianceMetrics.trend.slice(-3).map((item, idx) => {
                        // Handle case where monthName might be a number or missing
                        const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
                        const displayMonth = typeof item.monthName === 'string' && item.monthName.length > 0
                          ? item.monthName
                          : (typeof item.month === 'number' ? monthNames[item.month - 1] || item.month : 'N/A');
                        const score = typeof item.overallScore === 'number' ? item.overallScore : 0;
                        return (
                          <Tag key={idx} color={score >= 80 ? 'green' : score >= 50 ? 'orange' : 'red'} className="mr-1">
                            {displayMonth}: {score}%
                          </Tag>
                        );
                      })}
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-8">
                  <Text className="text-text-tertiary">No compliance data available</Text>
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
                  <Badge count={alertsEnhanced.summary.totalAlerts} style={{ backgroundColor: '#ff4d4f' }} />
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
                  />
                )}
                {alertsEnhanced.summary.overdueReportsCount > 0 && (
                  <Alert
                    type="warning"
                    showIcon
                    icon={<FileTextOutlined />}
                    message={`${alertsEnhanced.summary.overdueReportsCount} Overdue Reports`}
                    description="Students with overdue weekly/monthly reports"
                  />
                )}
                {alertsEnhanced.summary.missingVisitsCount > 0 && (
                  <Alert
                    type="info"
                    showIcon
                    icon={<EyeOutlined />}
                    message={`${alertsEnhanced.summary.missingVisitsCount} Missing Faculty Visits`}
                    description="Students without recent faculty visits"
                  />
                )}
                {alertsEnhanced.summary.unassignedStudentsCount > 0 && (
                  <Alert
                    type="warning"
                    showIcon
                    icon={<TeamOutlined />}
                    message={`${alertsEnhanced.summary.unassignedStudentsCount} Unassigned Students`}
                    description="Active internship students without assigned mentors"
                  />
                )}
              </div>
            </Card>
          </div>
        )}

        {/* Joining Letter Management Panel */}
        <div className="mt-6">
          <JoiningLetterPanel />
        </div>

        {/* Two Column Layout */}
        <Row gutter={[16, 16]}>
          {/* Left Column - Notices & Assignments */}
          <Col xs={24} lg={12}>
            {/* Notices Card */}
            <Card
              className="border-border shadow-sm rounded-xl mb-4"
              styles={{ body: { padding: '20px' } }}
            >
              <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-primary/10">
                    <NotificationOutlined className="text-lg text-primary" />
                  </div>
                  <Title level={4} className="!mb-0 !text-text-primary text-lg">
                    Important Notices
                  </Title>
                </div>
                <Button
                  type="text"
                  icon={<PlusOutlined />}
                  onClick={() => setModalVisible(true)}
                  className="text-primary hover:text-primary-600 hover:bg-primary/5 font-medium rounded-lg"
                >
                  Add
                </Button>
              </div>

              <div className="space-y-3">
                {notices.length > 0 ? (
                  notices.slice(0, 4).map((notice, index) => (
                    <div
                      key={notice.id || index}
                      className="
                        p-4 rounded-xl bg-surface border border-border/50
                        hover:border-primary/30
                        transition-all duration-200 group
                      "
                    >
                      <div className="flex justify-between items-start gap-3">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <Badge
                              status={index % 2 === 0 ? 'processing' : 'warning'}
                            />
                            <Text strong className="text-text-primary">
                              {notice.title}
                            </Text>
                          </div>
                          <Text className="text-text-secondary text-sm line-clamp-2 block mb-2">
                            {notice.message || notice.content}
                          </Text>
                          <div className="flex items-center gap-4 text-xs text-text-tertiary">
                            <span className="flex items-center gap-1">
                              <ClockCircleOutlined />
                              {new Date(notice.createdAt).toLocaleDateString()}
                            </span>
                            <span className="px-2 py-0.5 rounded-md bg-background-tertiary text-text-secondary">
                              {notice.category || 'General'}
                            </span>
                          </div>
                        </div>
                        <Button
                          type="text"
                          size="small"
                          icon={<EditOutlined />}
                          onClick={() => handleEdit(notice)}
                          className="
                            opacity-0 group-hover:opacity-100
                            text-primary hover:bg-primary/10
                            transition-all duration-200
                          "
                        />
                      </div>
                    </div>
                  ))
                ) : (
                  <Empty
                    image={Empty.PRESENTED_IMAGE_SIMPLE}
                    description={
                      <div className="text-center py-4">
                        <Text className="text-text-secondary block mb-2">No notices available</Text>
                        <Button type="link" onClick={() => setModalVisible(true)}>
                          Create your first notice
                        </Button>
                      </div>
                    }
                  />
                )}
              </div>
            </Card>

            {/* Class Assignments Card */}
            <Card
              className="border-border shadow-sm rounded-xl"
              styles={{ body: { padding: '20px' } }}
            >
              <div className="flex items-center gap-3 mb-5">
                <div className="p-2 rounded-lg bg-emerald-500/10">
                  <ScheduleOutlined className="text-lg text-emerald-500" />
                </div>
                <Title level={4} className="!mb-0 !text-text-primary text-lg">
                  Class Assignments
                </Title>
              </div>

              <div className="space-y-3">
                {stats.assignments && stats.assignments.length > 0 ? (
                  stats.assignments.slice(0, 5).map((assign, i) => (
                    <div
                      key={i}
                      className="
                        flex items-center gap-4 p-3 rounded-xl
                        bg-surface border border-border/50
                        hover:bg-background-tertiary transition-colors duration-200
                      "
                    >
                      <Avatar
                        size={40}
                        className={`${i % 2 === 0 ? 'bg-primary' : 'bg-emerald-500'} shrink-0`}
                        icon={<UserOutlined />}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <Text strong className="text-text-primary truncate">
                            {assign.teacher?.name || assign.teacherName || 'Teacher'}
                          </Text>
                          <RightOutlined className="text-xs text-text-tertiary" />
                          <Text className="text-text-secondary truncate">
                            {assign.Batch?.name || assign.batchName || 'N/A'}
                          </Text>
                        </div>
                        <Text className="text-text-tertiary text-sm">
                          Academic Year: {assign.academicYear || 'Current'}
                        </Text>
                      </div>
                    </div>
                  ))
                ) : (
                  <Empty
                    image={Empty.PRESENTED_IMAGE_SIMPLE}
                    description={
                      <Text className="text-text-tertiary">No class assignments found</Text>
                    }
                  />
                )}
              </div>
            </Card>
          </Col>

          {/* Right Column - Charts */}
          <Col xs={24} lg={12} className="space-y-4">
             <Card
                className="border-border shadow-sm rounded-xl"
                styles={{ body: { padding: '20px' } }}
              >
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2 rounded-lg bg-primary/10">
                    <BookOutlined className="text-lg text-primary" />
                  </div>
                  <Title level={4} className="!mb-0 !text-text-primary text-lg">
                    Student Distribution
                  </Title>
                </div>
                <div className="h-80">
                  <MixedStudentChart />
                </div>
              </Card>

              <Card
                className="border-border shadow-sm rounded-xl"
                styles={{ body: { padding: '20px' } }}
              >
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2 rounded-lg bg-success/10">
                    <TeamOutlined className="text-lg text-success" />
                  </div>
                  <Title level={4} className="!mb-0 !text-text-primary text-lg">
                    Staff Distribution
                  </Title>
                </div>
                <div className="h-80">
                  <UserRolesPieChart />
                </div>
              </Card>
          </Col>
        </Row>

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
      </div>
    </div>
  );
};

export default React.memo(PrincipalDashboard);