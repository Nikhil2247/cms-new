import React, { useEffect, useState, useCallback } from 'react';
import { Row, Col, Spin, Typography, message, Card, Badge, Tag, Progress, Alert, List } from 'antd';
import {
  WarningOutlined,
  ExclamationCircleOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  TeamOutlined,
  FileTextOutlined,
  EyeOutlined,
} from '@ant-design/icons';
import { useDispatch, useSelector } from 'react-redux';
import {
  fetchDashboardStats,
  fetchInstitutionsWithStats,
  fetchTopPerformers,
  fetchMonthlyAnalytics,
  fetchCriticalAlerts,
  fetchActionItems,
  fetchComplianceSummary,
  fetchTopIndustries,
  selectDashboardStats,
  selectDashboardLoading,
  selectInstitutionsWithStats,
  selectInstitutionsWithStatsLoading,
  selectInstitutionsWithStatsMonth,
  selectInstitutionsWithStatsYear,
  selectTopPerformers,
  selectBottomPerformers,
  selectAnalyticsLoading,
  selectMonthlyStats,
  selectCriticalAlerts,
  selectCriticalAlertsLoading,
  selectActionItems,
  selectActionItemsLoading,
  selectComplianceSummary,
  selectComplianceSummaryLoading,
  selectTopIndustries,
} from '../store/stateSlice';
import {
  DashboardHeader,
  StatisticsCards,
  PerformanceMetrics,
  InstitutionsTable,
  TopPerformers,
  JoiningLetterTracker,
  TopIndustriesList,
} from './components';
import { PlacementTrendChart } from '../../../components/charts';
import stateService from '../../../services/state.service';
import { downloadBlob } from '../../../utils/downloadUtils';

const { Text, Title } = Typography;

// Helper to get current user from localStorage
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

const StateDashboard = () => {
  const dispatch = useDispatch();

  // Use Redux selectors for data
  const stats = useSelector(selectDashboardStats);
  const loading = useSelector(selectDashboardLoading);

  // Institutions with comprehensive stats
  const institutionsWithStats = useSelector(selectInstitutionsWithStats);
  const institutionsLoading = useSelector(selectInstitutionsWithStatsLoading);
  const institutionsMonth = useSelector(selectInstitutionsWithStatsMonth);
  const institutionsYear = useSelector(selectInstitutionsWithStatsYear);

  const topPerformersData = useSelector(selectTopPerformers);
  const bottomPerformersData = useSelector(selectBottomPerformers);
  const analyticsLoading = useSelector(selectAnalyticsLoading);
  const monthlyAnalytics = useSelector(selectMonthlyStats);

  // New dashboard enhancements
  const criticalAlerts = useSelector(selectCriticalAlerts);
  const criticalAlertsLoading = useSelector(selectCriticalAlertsLoading);
  const actionItems = useSelector(selectActionItems);
  const actionItemsLoading = useSelector(selectActionItemsLoading);
  const complianceSummary = useSelector(selectComplianceSummary);
  const complianceSummaryLoading = useSelector(selectComplianceSummaryLoading);
  const topIndustries = useSelector(selectTopIndustries);

  const [userName, setUserName] = useState('Administrator');
  const [selectedMonth, setSelectedMonth] = useState(null);
  const [exporting, setExporting] = useState(false);

  // Derived performers from institutions as fallback
  const topPerformers = topPerformersData.length > 0
    ? topPerformersData
    : institutionsWithStats?.length > 0
      ? [...institutionsWithStats]
          .sort((a, b) => {
            const scoreA = calculateComplianceScore(a.stats);
            const scoreB = calculateComplianceScore(b.stats);
            return scoreB - scoreA;
          })
          .slice(0, 5)
      : [];

  const bottomPerformers = bottomPerformersData.length > 0
    ? bottomPerformersData
    : institutionsWithStats?.length > 0
      ? [...institutionsWithStats]
          .sort((a, b) => {
            const scoreA = calculateComplianceScore(a.stats);
            const scoreB = calculateComplianceScore(b.stats);
            return scoreA - scoreB;
          })
          .slice(0, 5)
      : [];

  // Calculate compliance score for sorting
  function calculateComplianceScore(stats) {
    if (!stats) return 0;
    const { studentsWithInternships, assigned, facultyVisits, reportsSubmitted } = stats;
    if (studentsWithInternships === 0) return 100;

    const assignmentScore = (assigned / studentsWithInternships) * 100;
    const visitScore = facultyVisits > 0 ? Math.min((facultyVisits / studentsWithInternships) * 100, 100) : 0;
    const reportScore = (reportsSubmitted / studentsWithInternships) * 100;

    return Math.round((assignmentScore + visitScore + reportScore) / 3);
  }

  // Prepare trend data for chart
  const trendData = monthlyAnalytics?.trend?.map(item => ({
    month: item.month,
    applications: item.applications || 0,
    approved: item.approved || item.placements || Math.floor((item.applications || 0) * 0.6),
  })) || [];

  // Fetch initial data
  useEffect(() => {
    const user = getCurrentUser();
    setUserName(user?.name || 'Administrator');

    dispatch(fetchDashboardStats());
    dispatch(fetchInstitutionsWithStats({ limit: 15 }));
    dispatch(fetchTopPerformers());
    dispatch(fetchMonthlyAnalytics());
    // Fetch new dashboard data
    dispatch(fetchCriticalAlerts());
    dispatch(fetchActionItems());
    dispatch(fetchComplianceSummary());
    dispatch(fetchTopIndustries({ limit: 10 }));
  }, [dispatch]);

  // Refresh handler
  const handleRefresh = useCallback(() => {
    dispatch(fetchDashboardStats({ forceRefresh: true }));
    dispatch(fetchInstitutionsWithStats({ limit: 15, forceRefresh: true }));
    dispatch(fetchTopPerformers({ forceRefresh: true }));
    dispatch(fetchMonthlyAnalytics({ forceRefresh: true }));
    // Refresh new dashboard data
    dispatch(fetchCriticalAlerts({ forceRefresh: true }));
    dispatch(fetchActionItems({ forceRefresh: true }));
    dispatch(fetchComplianceSummary({ forceRefresh: true }));
    dispatch(fetchTopIndustries({ limit: 10, forceRefresh: true }));
    message.success('Dashboard refreshed');
  }, [dispatch]);

  // Export handler
  const handleExport = useCallback(async () => {
    setExporting(true);
    try {
      const exportData = await stateService.exportDashboard({
        format: 'json',
        month: selectedMonth?.getMonth() + 1,
        year: selectedMonth?.getFullYear(),
      });

      const jsonString = JSON.stringify(exportData, null, 2);
      const blob = new Blob([jsonString], { type: 'application/json' });
      const filename = `state_dashboard_report_${new Date().toISOString().split('T')[0]}.json`;

      downloadBlob(blob, filename);
      message.success('Dashboard report exported successfully');
    } catch (error) {
      console.error('Export error:', error);
      message.error('Failed to export dashboard report');
    } finally {
      setExporting(false);
    }
  }, [selectedMonth]);

  // Month filter handler
  const handleMonthChange = useCallback(
    (date) => {
      setSelectedMonth(date);
      if (date) {
        const month = date.getMonth() + 1;
        const year = date.getFullYear();
        dispatch(fetchDashboardStats({ month, year, forceRefresh: true }));
        dispatch(fetchMonthlyAnalytics({ month, year, forceRefresh: true }));
        message.info(`Filtering data for ${date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}`);
      } else {
        dispatch(fetchDashboardStats({ forceRefresh: true }));
        dispatch(fetchMonthlyAnalytics({ forceRefresh: true }));
      }
    },
    [dispatch]
  );

  if (loading && !stats) {
    return (
      <div className="flex flex-col justify-center items-center min-h-screen bg-background-secondary gap-4">
        <Spin size="large" />
        <Text className="text-text-secondary animate-pulse">Loading dashboard...</Text>
      </div>
    );
  }

  return (
    <div className="state-dashboard p-4 md:p-6 bg-background-secondary min-h-screen">
      {/* Header Section */}
      <DashboardHeader
        userName={userName}
        onRefresh={handleRefresh}
        onExport={handleExport}
        selectedMonth={selectedMonth}
        onMonthChange={handleMonthChange}
        exporting={exporting}
      />

      {/* Statistics Cards - Primary metrics and focus areas */}
      <div className="mb-6">
        <StatisticsCards stats={stats} />
      </div>

      {/* Critical Alerts and Compliance Summary Row */}
      <Row gutter={[16, 16]} className="mb-6">
        {/* Critical Alerts */}
        <Col xs={24} lg={12}>
          <Card
            title={
              <div className="flex items-center gap-2">
                <WarningOutlined className="text-red-500" />
                <span>Critical Alerts</span>
                {criticalAlerts?.totalAlerts > 0 && (
                  <Badge count={criticalAlerts.totalAlerts} className="ml-2" />
                )}
              </div>
            }
            className="shadow-sm border-border rounded-xl h-full"
            loading={criticalAlertsLoading}
          >
            {criticalAlerts ? (
              <div className="space-y-3">
                {criticalAlerts.lowComplianceInstitutions?.length > 0 && (
                  <Alert
                    type="error"
                    showIcon
                    icon={<ExclamationCircleOutlined />}
                    message={`${criticalAlerts.lowComplianceInstitutions.length} Low Compliance Institutions`}
                    description={
                      <div className="mt-2">
                        {criticalAlerts.lowComplianceInstitutions.slice(0, 3).map((inst, idx) => (
                          <Tag key={idx} color="red" className="mb-1">
                            {inst.name} ({inst.complianceScore}%)
                          </Tag>
                        ))}
                        {criticalAlerts.lowComplianceInstitutions.length > 3 && (
                          <Tag>+{criticalAlerts.lowComplianceInstitutions.length - 3} more</Tag>
                        )}
                      </div>
                    }
                  />
                )}
                {criticalAlerts.studentsWithoutMentors > 0 && (
                  <Alert
                    type="warning"
                    showIcon
                    icon={<TeamOutlined />}
                    message={`${criticalAlerts.studentsWithoutMentors} Students Without Mentors`}
                    description="Students in active internships without assigned mentors"
                  />
                )}
                {criticalAlerts.missingReports > 0 && (
                  <Alert
                    type="warning"
                    showIcon
                    icon={<FileTextOutlined />}
                    message={`${criticalAlerts.missingReports} Missing Reports`}
                    description="Overdue weekly/monthly reports from students"
                  />
                )}
                {criticalAlerts.visitGaps > 0 && (
                  <Alert
                    type="info"
                    showIcon
                    icon={<EyeOutlined />}
                    message={`${criticalAlerts.visitGaps} Faculty Visit Gaps`}
                    description="Students who haven't had a faculty visit in 30+ days"
                  />
                )}
                {!criticalAlerts.totalAlerts && (
                  <div className="text-center py-8">
                    <CheckCircleOutlined className="text-4xl text-green-500 mb-2" />
                    <Text className="block text-text-secondary">No critical alerts</Text>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-8">
                <Text className="text-text-tertiary">No alerts data available</Text>
              </div>
            )}
          </Card>
        </Col>

        {/* Compliance Summary */}
        <Col xs={24} lg={12}>
          <Card
            title={
              <div className="flex items-center gap-2">
                <CheckCircleOutlined className="text-green-500" />
                <span>Compliance Summary</span>
              </div>
            }
            className="shadow-sm border-border rounded-xl h-full"
            loading={complianceSummaryLoading}
          >
            {complianceSummary?.stateWide ? (
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between mb-1">
                    <Text className="text-text-secondary">Mentor Assignment Rate</Text>
                    <Text strong>{complianceSummary.stateWide.mentorCoverageRate || 0}%</Text>
                  </div>
                  <Progress
                    percent={complianceSummary.stateWide.mentorCoverageRate || 0}
                    strokeColor={complianceSummary.stateWide.mentorCoverageRate >= 80 ? '#52c41a' : complianceSummary.stateWide.mentorCoverageRate >= 50 ? '#faad14' : '#ff4d4f'}
                    showInfo={false}
                  />
                </div>
                <div>
                  <div className="flex justify-between mb-1">
                    <Text className="text-text-secondary">Faculty Visit Compliance</Text>
                    <Text strong>{complianceSummary.stateWide.visitComplianceRate || 0}%</Text>
                  </div>
                  <Progress
                    percent={complianceSummary.stateWide.visitComplianceRate || 0}
                    strokeColor={complianceSummary.stateWide.visitComplianceRate >= 80 ? '#52c41a' : complianceSummary.stateWide.visitComplianceRate >= 50 ? '#faad14' : '#ff4d4f'}
                    showInfo={false}
                  />
                </div>
                <div>
                  <div className="flex justify-between mb-1">
                    <Text className="text-text-secondary">Report Submission Rate</Text>
                    <Text strong>{complianceSummary.stateWide.reportComplianceRate || 0}%</Text>
                  </div>
                  <Progress
                    percent={complianceSummary.stateWide.reportComplianceRate || 0}
                    strokeColor={complianceSummary.stateWide.reportComplianceRate >= 80 ? '#52c41a' : complianceSummary.stateWide.reportComplianceRate >= 50 ? '#faad14' : '#ff4d4f'}
                    showInfo={false}
                  />
                </div>
                <div>
                  <div className="flex justify-between mb-1">
                    <Text className="text-text-secondary">Overall Compliance</Text>
                    <Text strong className="text-lg">{complianceSummary.stateWide.overallComplianceScore || 0}%</Text>
                  </div>
                  <Progress
                    percent={complianceSummary.stateWide.overallComplianceScore || 0}
                    strokeColor={complianceSummary.stateWide.overallComplianceScore >= 80 ? '#52c41a' : complianceSummary.stateWide.overallComplianceScore >= 50 ? '#faad14' : '#ff4d4f'}
                  />
                </div>
              </div>
            ) : (
              <div className="text-center py-8">
                <Text className="text-text-tertiary">No compliance data available</Text>
              </div>
            )}
          </Card>
        </Col>
      </Row>

      {/* Action Items */}
      {actionItems?.items?.length > 0 && (
        <div className="mb-6">
          <Card
            title={
              <div className="flex items-center gap-2">
                <ClockCircleOutlined className="text-blue-500" />
                <span>Action Items</span>
                <Badge count={actionItems.items.length} className="ml-2" />
              </div>
            }
            className="shadow-sm border-border rounded-xl"
            loading={actionItemsLoading}
          >
            <List
              size="small"
              dataSource={actionItems.items.slice(0, 5)}
              renderItem={(item) => (
                <List.Item
                  className="hover:bg-background-tertiary transition-colors rounded-lg px-2"
                >
                  <div className="flex items-center gap-3 w-full">
                    <Badge
                      status={
                        item.priority === 'high' ? 'error' :
                        item.priority === 'medium' ? 'warning' : 'default'
                      }
                    />
                    <div className="flex-1">
                      <Text strong className="block">{item.title}</Text>
                      <Text className="text-text-secondary text-sm">{item.description}</Text>
                    </div>
                    <Tag color={
                      item.priority === 'high' ? 'red' :
                      item.priority === 'medium' ? 'orange' : 'blue'
                    }>
                      {item.priority}
                    </Tag>
                  </div>
                </List.Item>
              )}
            />
          </Card>
        </div>
      )}

      {/* Joining Letter Tracker - State-wide overview */}
      <div className="mb-6">
        <JoiningLetterTracker />
      </div>

      {/* Institution Performance Table - Full width, key focus */}
      <div className="mb-6">
        <InstitutionsTable
          institutions={institutionsWithStats}
          loading={institutionsLoading}
          month={institutionsMonth}
          year={institutionsYear}
        />
      </div>

      {/* Two Column Layout - Performance and Trends */}
      <Row gutter={[16, 16]} className="mb-6">
        {/* Performance Metrics */}
        <Col xs={24} lg={12}>
          <PerformanceMetrics stats={stats} />
        </Col>

        {/* Trend Chart */}
        <Col xs={24} lg={12}>
          <Card
            title="Internship Application Trends"
            className="shadow-sm border-border rounded-xl h-full"
            loading={analyticsLoading}
          >
            {trendData.length > 0 ? (
              <div className="p-2">
                <PlacementTrendChart
                  data={trendData}
                  height={280}
                  showArea={true}
                />
              </div>
            ) : (
              <div className="flex items-center justify-center h-64">
                <div className="text-center">
                  <Text className="text-text-tertiary block">No trend data available</Text>
                  <Text className="text-text-tertiary text-xs">
                    Data will appear as applications are processed
                  </Text>
                </div>
              </div>
            )}
          </Card>
        </Col>
      </Row>

      {/* Top Performers and Industry Partners */}
      <Row gutter={[16, 16]} className="mb-6">
        <Col xs={24} lg={16}>
          <TopPerformers
            topPerformers={topPerformers}
            bottomPerformers={bottomPerformers}
            loading={analyticsLoading}
          />
        </Col>
        <Col xs={24} lg={8}>
          <TopIndustriesList
            industries={topIndustries}
            loading={analyticsLoading}
          />
        </Col>
      </Row>

      {/* Monthly Summary Section */}
      {monthlyAnalytics?.metrics && (
        <Card title="Monthly Summary" className="shadow-sm border-border rounded-xl">
          <Row gutter={[16, 16]}>
            <Col xs={12} sm={8} md={4}>
              <div className="text-center">
                <div className="text-2xl font-bold text-primary">
                  {monthlyAnalytics.metrics.newStudents || 0}
                </div>
                <div className="text-xs text-text-secondary uppercase tracking-wider font-semibold mt-1">New Students</div>
              </div>
            </Col>
            <Col xs={12} sm={8} md={4}>
              <div className="text-center">
                <div className="text-2xl font-bold text-success">
                  {monthlyAnalytics.metrics.newApplications || 0}
                </div>
                <div className="text-xs text-text-secondary uppercase tracking-wider font-semibold mt-1">Applications</div>
              </div>
            </Col>
            <Col xs={12} sm={8} md={4}>
              <div className="text-center">
                <div className="text-2xl font-bold text-secondary">
                  {monthlyAnalytics.metrics.approvedApplications || monthlyAnalytics.metrics.selectedApplications || 0}
                </div>
                <div className="text-xs text-text-secondary uppercase tracking-wider font-semibold mt-1">Approved</div>
              </div>
            </Col>
            <Col xs={12} sm={8} md={4}>
              <div className="text-center">
                <div className="text-2xl font-bold text-warning">
                  {monthlyAnalytics.metrics.newInternships || 0}
                </div>
                <div className="text-xs text-text-secondary uppercase tracking-wider font-semibold mt-1">New Internships</div>
              </div>
            </Col>
            <Col xs={12} sm={8} md={4}>
              <div className="text-center">
                <div className="text-2xl font-bold text-info">
                  {monthlyAnalytics.metrics.facultyVisits || 0}
                </div>
                <div className="text-xs text-text-secondary uppercase tracking-wider font-semibold mt-1">Faculty Visits</div>
              </div>
            </Col>
            <Col xs={12} sm={8} md={4}>
              <div className="text-center">
                <div className="text-2xl font-bold text-pink-500">
                  {monthlyAnalytics.metrics.approvalRate || monthlyAnalytics.metrics.placementRate || 0}%
                </div>
                <div className="text-xs text-text-secondary uppercase tracking-wider font-semibold mt-1">Approval Rate</div>
              </div>
            </Col>
          </Row>
        </Card>
      )}
    </div>
  );
};

export default StateDashboard;
