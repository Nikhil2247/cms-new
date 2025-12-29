import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { Row, Col, Spin, Typography, message, Card, Badge, Tag, Progress, Alert, Button } from 'antd';
import {
  WarningOutlined,
  ExclamationCircleOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  TeamOutlined,
  FileTextOutlined,
  EyeOutlined,
  ReloadOutlined,
  BankOutlined,
  InboxOutlined,
  FolderOpenOutlined,
  SolutionOutlined,
  AlertOutlined,
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
  CriticalAlertsModal,
} from './components';
import stateService from '../../../services/state.service';
import { downloadBlob } from '../../../utils/downloadUtils';

const { Text, Title, Paragraph } = Typography;

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

// Get compliance score from stats (use backend-calculated score for consistency)
const calculateComplianceScore = (stats) => {
  if (!stats) return 0;
  // Use backend-calculated complianceScore for consistency with Institution Overview
  return stats.complianceScore ?? 0;
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
  const [alertsModalOpen, setAlertsModalOpen] = useState(false);
  const [selectedAlertTab, setSelectedAlertTab] = useState('lowCompliance');

  // Derived performers from institutions as fallback (memoized)
  const topPerformers = useMemo(() => {
    if (topPerformersData.length > 0) return topPerformersData;
    if (!institutionsWithStats?.length) return [];
    return [...institutionsWithStats]
      .sort((a, b) => calculateComplianceScore(b.stats) - calculateComplianceScore(a.stats))
      .slice(0, 5);
  }, [topPerformersData, institutionsWithStats]);

  const bottomPerformers = useMemo(() => {
    if (bottomPerformersData.length > 0) return bottomPerformersData;
    if (!institutionsWithStats?.length) return [];
    return [...institutionsWithStats]
      .sort((a, b) => calculateComplianceScore(a.stats) - calculateComplianceScore(b.stats))
      .slice(0, 5);
  }, [bottomPerformersData, institutionsWithStats]);


  // Derive action items list from backend structure (memoized)
  const actionItemsList = useMemo(() => {
    if (!actionItems?.actions) return [];
    const items = [];

    // Pending industry approvals
    actionItems.actions.pendingIndustryApprovals?.forEach(approval => {
      items.push({
        title: `Approve Industry: ${approval.name || approval.companyName || 'Unknown'}`,
        description: 'Industry partner awaiting approval',
        priority: 'high',
        type: 'approval'
      });
    });

    // Institutions requiring intervention
    actionItems.actions.institutionsRequiringIntervention?.forEach(inst => {
      items.push({
        title: `Intervention: ${inst.institutionName || inst.name || 'Institution'}`,
        description: inst.reason || 'Requires administrative intervention',
        priority: 'high',
        type: 'intervention'
      });
    });

    // Overdue compliance items
    actionItems.actions.overdueComplianceItems?.forEach(item => {
      items.push({
        title: item.title || 'Overdue Compliance',
        description: item.description || 'Compliance item overdue',
        priority: 'medium',
        type: 'compliance'
      });
    });

    return items;
  }, [actionItems]);

  // Fetch initial data
  useEffect(() => {
    const user = getCurrentUser();
    setUserName(user?.name || 'Administrator');

    dispatch(fetchDashboardStats());
    dispatch(fetchInstitutionsWithStats({}));
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
    dispatch(fetchInstitutionsWithStats({ forceRefresh: true }));
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
        dispatch(fetchInstitutionsWithStats({ month, year, forceRefresh: true }));
        dispatch(fetchMonthlyAnalytics({ month, year, forceRefresh: true }));
        message.info(`Filtering data for ${date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}`);
      } else {
        dispatch(fetchDashboardStats({ forceRefresh: true }));
        dispatch(fetchInstitutionsWithStats({ forceRefresh: true }));
        dispatch(fetchMonthlyAnalytics({ forceRefresh: true }));
      }
    },
    [dispatch]
  );

  // Handler to open alerts modal with specific tab
  const handleOpenAlertsModal = useCallback((tab = 'lowCompliance') => {
    setSelectedAlertTab(tab);
    setAlertsModalOpen(true);
  }, []);

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
      <Row gutter={[24, 24]} className="mb-6">
        {/* Critical Alerts */}
        <Col xs={24} lg={12}>
          <Card
            title={
              <div className="flex items-center gap-3 w-full">
                <div className="w-8 h-8 rounded-lg bg-error/10 flex items-center justify-center shrink-0">
                  <WarningOutlined className="text-error text-lg" />
                </div>
                <span className="font-bold text-text-primary text-lg">Critical Alerts</span>
                {criticalAlerts?.summary?.totalAlerts > 0 && (
                  <Badge count={criticalAlerts.summary.totalAlerts} />
                )}
                <Button
                  type="link"
                  size="small"
                  onClick={() => handleOpenAlertsModal('lowCompliance')}
                  className="ml-auto text-primary font-medium"
                >
                  View All
                </Button>
              </div>
            }
            className="shadow-sm border-border rounded-2xl h-full bg-surface"
            loading={criticalAlertsLoading}
            styles={{ header: { borderBottom: '1px solid var(--color-border)', padding: '20px 24px' }, body: { padding: '24px' } }}
          >
            {criticalAlerts ? (
              <div className="space-y-4">
                {criticalAlerts.alerts?.lowComplianceInstitutions?.length > 0 && (
                  <div
                    onClick={() => handleOpenAlertsModal('lowCompliance')}
                    className="cursor-pointer transition-all hover:scale-[1.01]"
                  >
                    <Alert
                      type="error"
                      showIcon
                      icon={<ExclamationCircleOutlined />}
                      title={
                        <div className="flex items-center justify-between">
                          <span className="font-bold">Low Compliance Institutions ({criticalAlerts.alerts?.lowComplianceInstitutions.length})</span>
                          <Button type="link" size="small" className="text-error p-0 h-auto">View Details →</Button>
                        </div>
                      }
                      description={
                        <div className="mt-2 flex flex-wrap gap-2">
                          {criticalAlerts.alerts?.lowComplianceInstitutions.slice(0, 3).map((inst, idx) => (
                            <Tag key={idx} color="red" className="m-0 px-2 py-0.5 rounded-md border-0 font-medium">
                              {inst.institutionName} ({inst.complianceScore}%)
                            </Tag>
                          ))}
                          {criticalAlerts.alerts?.lowComplianceInstitutions.length > 3 && (
                            <Tag className="m-0 px-2 py-0.5 rounded-md border-0 bg-background-tertiary text-text-secondary">+{criticalAlerts.alerts?.lowComplianceInstitutions.length - 3} more</Tag>
                          )}
                        </div>
                      }
                      className="rounded-xl border-error/20 bg-error/5"
                    />
                  </div>
                )}
                {criticalAlerts.summary?.studentsWithoutMentorsCount > 0 && (
                  <div
                    onClick={() => handleOpenAlertsModal('studentsWithoutMentors')}
                    className="flex items-start gap-3 p-3 rounded-xl bg-warning/5 border border-warning/20 cursor-pointer transition-all hover:scale-[1.01] hover:border-warning/40"
                  >
                    <TeamOutlined className="text-warning text-lg mt-0.5" />
                    <div className="flex-1">
                      <Text strong className="text-text-primary block">Students Without Mentors</Text>
                      <Text className="text-text-secondary text-sm">{criticalAlerts.summary?.studentsWithoutMentorsCount} students need mentor assignment</Text>
                    </div>
                    <Button type="link" size="small" className="text-warning p-0 h-auto shrink-0">View →</Button>
                  </div>
                )}
                {criticalAlerts.summary?.missingReportsCount > 0 && (
                  <div
                    onClick={() => handleOpenAlertsModal('missingReports')}
                    className="flex items-start gap-3 p-3 rounded-xl bg-warning/5 border border-warning/20 cursor-pointer transition-all hover:scale-[1.01] hover:border-warning/40"
                  >
                    <FileTextOutlined className="text-warning text-lg mt-0.5" />
                    <div className="flex-1">
                      <Text strong className="text-text-primary block">Missing Reports</Text>
                      <Text className="text-text-secondary text-sm">{criticalAlerts.summary?.missingReportsCount} overdue weekly/monthly reports</Text>
                    </div>
                    <Button type="link" size="small" className="text-warning p-0 h-auto shrink-0">View →</Button>
                  </div>
                )}
                {criticalAlerts.summary?.visitGapsCount > 0 && (
                  <div
                    onClick={() => handleOpenAlertsModal('visitGaps')}
                    className="flex items-start gap-3 p-3 rounded-xl bg-info/5 border border-info/20 cursor-pointer transition-all hover:scale-[1.01] hover:border-info/40"
                  >
                    <EyeOutlined className="text-info text-lg mt-0.5" />
                    <div className="flex-1">
                      <Text strong className="text-text-primary block">Faculty Visit Gaps</Text>
                      <Text className="text-text-secondary text-sm">{criticalAlerts.summary?.visitGapsCount} institutions haven't had a visit in 30+ days</Text>
                    </div>
                    <Button type="link" size="small" className="text-info p-0 h-auto shrink-0">View →</Button>
                  </div>
                )}
                {!criticalAlerts.summary.totalAlerts && (
                  <div className="text-center py-12 bg-success/5 rounded-xl border border-success/10 border-dashed">
                    <CheckCircleOutlined className="text-4xl text-success mb-3" />
                    <Text className="block text-text-primary font-medium">All systems normal</Text>
                    <Text className="text-text-tertiary text-sm">No critical alerts requiring attention</Text>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-12">
                <Text className="text-text-tertiary">No alerts data available</Text>
              </div>
            )}
          </Card>
        </Col>

        {/* Compliance Summary */}
        <Col xs={24} lg={12}>
          <Card
            title={
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-success/10 flex items-center justify-center shrink-0">
                  <CheckCircleOutlined className="text-success text-lg" />
                </div>
                <span className="font-bold text-text-primary text-lg">Compliance Summary</span>
              </div>
            }
            className="shadow-sm border-border rounded-2xl h-full bg-surface"
            loading={complianceSummaryLoading}
            styles={{ header: { borderBottom: '1px solid var(--color-border)', padding: '20px 24px' }, body: { padding: '24px' } }}
          >
            {complianceSummary?.stateWide ? (
              <div className="space-y-6">
                <div>
                  <div className="flex justify-between mb-2">
                    <Text className="text-text-secondary font-medium">Mentor Assignment Rate</Text>
                    <Text strong className="text-text-primary">{complianceSummary.stateWide.mentorCoverageRate || 0}%</Text>
                  </div>
                  <Progress
                    percent={complianceSummary.stateWide.mentorCoverageRate || 0}
                    strokeColor={complianceSummary.stateWide.mentorCoverageRate >= 80 ? 'rgb(var(--color-success))' : complianceSummary.stateWide.mentorCoverageRate >= 50 ? 'rgb(var(--color-warning))' : 'rgb(var(--color-error))'}
                    showInfo={false}
                    className="!m-0"
                    size="small"
                  />
                </div>
                <div>
                  <div className="flex justify-between mb-2">
                    <Text className="text-text-secondary font-medium">Faculty Visit Compliance</Text>
                    <Text strong className="text-text-primary">{complianceSummary.stateWide.visitComplianceRate || 0}%</Text>
                  </div>
                  <Progress
                    percent={complianceSummary.stateWide.visitComplianceRate || 0}
                    strokeColor={complianceSummary.stateWide.visitComplianceRate >= 80 ? 'rgb(var(--color-success))' : complianceSummary.stateWide.visitComplianceRate >= 50 ? 'rgb(var(--color-warning))' : 'rgb(var(--color-error))'}
                    showInfo={false}
                    className="!m-0"
                    size="small"
                  />
                </div>
                <div>
                  <div className="flex justify-between mb-2">
                    <Text className="text-text-secondary font-medium">Report Submission Rate</Text>
                    <Text strong className="text-text-primary">{complianceSummary.stateWide.reportComplianceRate || 0}%</Text>
                  </div>
                  <Progress
                    percent={complianceSummary.stateWide.reportComplianceRate || 0}
                    strokeColor={complianceSummary.stateWide.reportComplianceRate >= 80 ? 'rgb(var(--color-success))' : complianceSummary.stateWide.reportComplianceRate >= 50 ? 'rgb(var(--color-warning))' : 'rgb(var(--color-error))'}
                    showInfo={false}
                    className="!m-0"
                    size="small"
                  />
                </div>
                <div className="pt-6 border-t border-border mt-2">
                  <div className="flex justify-between items-center mb-2">
                    <Text className="text-text-primary font-bold text-lg">Overall Compliance Score</Text>
                    <Text className="text-2xl font-black text-primary">{complianceSummary.stateWide.overallComplianceScore || 0}%</Text>
                  </div>
                  <Progress
                    percent={complianceSummary.stateWide.overallComplianceScore || 0}
                    strokeColor={complianceSummary.stateWide.overallComplianceScore >= 80 ? 'rgb(var(--color-success))' : complianceSummary.stateWide.overallComplianceScore >= 50 ? 'rgb(var(--color-warning))' : 'rgb(var(--color-error))'}
                    showInfo={false}
                    className="!m-0"
                  />
                </div>
              </div>
            ) : (
              <div className="text-center py-12">
                <Text className="text-text-tertiary">No compliance data available</Text>
              </div>
            )}
          </Card>
        </Col>
      </Row>

      {/* Action Items */}
      {actionItemsList.length > 0 && (
        <div className="mb-6">
          <Card
            title={
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  <ClockCircleOutlined className="text-primary text-lg" />
                </div>
                <span className="font-bold text-text-primary text-lg">Action Items</span>
                <Badge count={actionItemsList.length} className="ml-auto" style={{ backgroundColor: 'rgb(var(--color-primary))' }} />
              </div>
            }
            className="shadow-sm border-border rounded-2xl bg-surface"
            loading={actionItemsLoading}
            styles={{ header: { borderBottom: '1px solid var(--color-border)', padding: '20px 24px' }, body: { padding: '0' } }}
          >
            <div className="flex flex-col">
              {actionItemsList.slice(0, 5).map((item, index) => (
                <div
                  key={item.id || index}
                  className={`
                    hover:bg-background-tertiary transition-colors px-6 py-4 flex items-start gap-4 w-full
                    ${index !== actionItemsList.slice(0, 5).length - 1 ? 'border-b border-border/50' : ''}
                  `}
                >
                  <div className={`w-2 h-2 rounded-full mt-2 shrink-0 ${
                    item.priority === 'high' ? 'bg-error' :
                    item.priority === 'medium' ? 'bg-warning' : 'bg-primary'
                  }`} />
                  <div className="flex-1">
                    <Text strong className="block text-text-primary text-base mb-1">{item.title}</Text>
                    <Text className="text-text-secondary text-sm block">{item.description}</Text>
                  </div>
                  <Tag className="m-0 rounded-md border-0 px-2 py-0.5 font-bold uppercase tracking-wider text-[10px]" color={
                    item.priority === 'high' ? 'red' :
                    item.priority === 'medium' ? 'orange' : 'blue'
                  }>
                    {item.priority}
                  </Tag>
                </div>
              ))}
            </div>
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

      {/* Performance Metrics */}
      <div className="mb-6">
        <PerformanceMetrics stats={stats} />
      </div>

      {/* Top Performers and Industry Partners */}
      <Row gutter={[24, 24]} className="mb-6">
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
        <Card 
          title={
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-indigo-500/10 flex items-center justify-center shrink-0">
                <ClockCircleOutlined className="text-indigo-500 text-lg" />
              </div>
              <span className="font-bold text-text-primary text-lg">Monthly Summary</span>
            </div>
          }
          className="shadow-sm border-border rounded-2xl bg-surface"
          styles={{ header: { borderBottom: '1px solid var(--color-border)', padding: '20px 24px' }, body: { padding: '24px' } }}
        >
          <Row gutter={[24, 24]}>
            <Col xs={12} sm={8} md={4}>
              <div className="text-center p-4 rounded-xl bg-background-tertiary/30 border border-border/50">
                <div className="text-2xl font-black text-primary mb-1">
                  {monthlyAnalytics.metrics.newStudents || 0}
                </div>
                <div className="text-[10px] text-text-tertiary uppercase tracking-widest font-bold">New Students</div>
              </div>
            </Col>
            <Col xs={12} sm={8} md={4}>
              <div className="text-center p-4 rounded-xl bg-background-tertiary/30 border border-border/50">
                <div className="text-2xl font-black text-success mb-1">
                  {monthlyAnalytics.metrics.newApplications || 0}
                </div>
                <div className="text-[10px] text-text-tertiary uppercase tracking-widest font-bold">Applications</div>
              </div>
            </Col>
            <Col xs={12} sm={8} md={4}>
              <div className="text-center p-4 rounded-xl bg-background-tertiary/30 border border-border/50">
                <div className="text-2xl font-black text-info mb-1">
                  {monthlyAnalytics.metrics.approvedApplications || monthlyAnalytics.metrics.selectedApplications || 0}
                </div>
                <div className="text-[10px] text-text-tertiary uppercase tracking-widest font-bold">Approved</div>
              </div>
            </Col>
            <Col xs={12} sm={8} md={4}>
              <div className="text-center p-4 rounded-xl bg-background-tertiary/30 border border-border/50">
                <div className="text-2xl font-black text-warning mb-1">
                  {monthlyAnalytics.metrics.newInternships || 0}
                </div>
                <div className="text-[10px] text-text-tertiary uppercase tracking-widest font-bold">New Internships</div>
              </div>
            </Col>
            <Col xs={12} sm={8} md={4}>
              <div className="text-center p-4 rounded-xl bg-background-tertiary/30 border border-border/50">
                <div className="text-2xl font-black text-purple-500 mb-1">
                  {monthlyAnalytics.metrics.facultyVisits || 0}
                </div>
                <div className="text-[10px] text-text-tertiary uppercase tracking-widest font-bold">Faculty Visits</div>
              </div>
            </Col>
            <Col xs={12} sm={8} md={4}>
              <div className="text-center p-4 rounded-xl bg-background-tertiary/30 border border-border/50">
                <div className="text-2xl font-black text-text-secondary mb-1">
                  {monthlyAnalytics.metrics.approvalRate || monthlyAnalytics.metrics.placementRate || 0}%
                </div>
                <div className="text-[10px] text-text-tertiary uppercase tracking-widest font-bold">Approval Rate</div>
              </div>
            </Col>
          </Row>
        </Card>
      )}

      {/* Critical Alerts Modal */}
      <CriticalAlertsModal
        open={alertsModalOpen}
        onClose={() => setAlertsModalOpen(false)}
        alerts={criticalAlerts}
        defaultTab={selectedAlertTab}
      />
    </div>
  );
};

export default StateDashboard;