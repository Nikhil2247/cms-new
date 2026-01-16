import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { Row, Col, Spin, Typography, Card, Badge, Tag } from 'antd';
import { toast } from 'react-hot-toast';
import {
  ClockCircleOutlined,
  WarningOutlined,
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
  InstitutionsTable,
  TopPerformers,
  JoiningLetterTracker,
  TopIndustriesList,
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
    toast.success('Dashboard refreshed');
  }, [dispatch]);

  // Export handler
  const handleExport = useCallback(async () => {
    setExporting(true);
    try {
      const exportData = await stateService.exportDashboard({
        format: 'json',
        // dayjs uses .month() (0-indexed) and .year()
        month: selectedMonth ? selectedMonth.month() + 1 : undefined,
        year: selectedMonth ? selectedMonth.year() : undefined,
      });

      const jsonString = JSON.stringify(exportData, null, 2);
      const blob = new Blob([jsonString], { type: 'application/json' });
      const filename = `state_dashboard_report_${new Date().toISOString().split('T')[0]}.json`;

      downloadBlob(blob, filename);
      toast.success('Dashboard report exported successfully');
    } catch (error) {
      toast.error('Failed to export dashboard report');
    } finally {
      setExporting(false);
    }
  }, [selectedMonth]);

  // Month filter handler - filters ALL dashboard data
  // Note: Ant Design DatePicker returns dayjs objects, not native Date objects
  const handleMonthChange = useCallback(
    (date) => {
      setSelectedMonth(date);
      if (date) {
        // dayjs uses .month() (0-indexed) and .year()
        const month = date.month() + 1;
        const year = date.year();
        const filterParams = { month, year, forceRefresh: true };

        // Refresh ALL dashboard sections with the month filter
        dispatch(fetchDashboardStats(filterParams));
        dispatch(fetchInstitutionsWithStats(filterParams));
        dispatch(fetchMonthlyAnalytics(filterParams));
        dispatch(fetchTopPerformers(filterParams));
        dispatch(fetchTopIndustries({ ...filterParams, limit: 10 }));

        toast(`Filtering data for ${date.format('MMMM YYYY')}`);
      } else {
        // Clear filter - fetch current/all-time data
        const refreshParams = { forceRefresh: true };
        dispatch(fetchDashboardStats(refreshParams));
        dispatch(fetchInstitutionsWithStats(refreshParams));
        dispatch(fetchMonthlyAnalytics(refreshParams));
        dispatch(fetchTopPerformers(refreshParams));
        dispatch(fetchTopIndustries({ ...refreshParams, limit: 10 }));

        toast('Showing all-time data');
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

      {/* Statistics Cards - Primary metrics */}
      <div className="mb-6">
        <StatisticsCards stats={stats} selectedMonth={selectedMonth} />
      </div>

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


    </div>
  );
};

export default StateDashboard;