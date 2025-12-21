import React, { useEffect, useState, useCallback } from 'react';
import { Row, Col, Spin, Typography, message, Card, Modal } from 'antd';
import { useDispatch, useSelector } from 'react-redux';
import {
  fetchDashboardStats,
  fetchInstitutions,
  fetchTopPerformers,
  fetchTopIndustries,
  fetchMonthlyAnalytics,
  selectDashboardStats,
  selectDashboardLoading,
  selectInstitutions,
  selectInstitutionsLoading,
  selectTopPerformers,
  selectBottomPerformers,
  selectTopIndustries,
  selectAnalyticsLoading,
  selectMonthlyStats,
} from '../store/stateSlice';
import {
  DashboardHeader,
  StatisticsCards,
  PerformanceMetrics,
  InstitutionsTable,
  TopPerformers,
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
  const institutions = useSelector(selectInstitutions);
  const institutionsLoading = useSelector(selectInstitutionsLoading);
  const topPerformersData = useSelector(selectTopPerformers);
  const bottomPerformersData = useSelector(selectBottomPerformers);
  const topIndustriesData = useSelector(selectTopIndustries);
  const analyticsLoading = useSelector(selectAnalyticsLoading);
  const monthlyAnalytics = useSelector(selectMonthlyStats);

  const [userName, setUserName] = useState('Administrator');
  const [selectedMonth, setSelectedMonth] = useState(null);
  const [exporting, setExporting] = useState(false);

  // Derived performers from institutions as fallback
  const topPerformers = topPerformersData.length > 0
    ? topPerformersData
    : institutions?.length > 0
      ? [...institutions].sort((a, b) => (b.placementRate || 0) - (a.placementRate || 0)).slice(0, 5)
      : [];

  const bottomPerformers = bottomPerformersData.length > 0
    ? bottomPerformersData
    : institutions?.length > 0
      ? [...institutions].sort((a, b) => (a.placementRate || 0) - (b.placementRate || 0)).slice(0, 5)
      : [];

  // Prepare trend data for chart
  const trendData = monthlyAnalytics?.trend?.map(item => ({
    month: item.month,
    applications: item.applications || 0,
    placements: item.placements || Math.floor((item.applications || 0) * 0.6),
  })) || [];

  // Fetch initial data
  useEffect(() => {
    const user = getCurrentUser();
    setUserName(user?.name || 'Administrator');

    dispatch(fetchDashboardStats());
    dispatch(fetchInstitutions({ limit: 10 }));
    dispatch(fetchTopPerformers());
    dispatch(fetchTopIndustries({ limit: 10 }));
    dispatch(fetchMonthlyAnalytics());
  }, [dispatch]);

  // Refresh handler
  const handleRefresh = useCallback(() => {
    dispatch(fetchDashboardStats({ forceRefresh: true }));
    dispatch(fetchInstitutions({ limit: 10, forceRefresh: true }));
    dispatch(fetchTopPerformers({ forceRefresh: true }));
    dispatch(fetchTopIndustries({ limit: 10, forceRefresh: true }));
    dispatch(fetchMonthlyAnalytics({ forceRefresh: true }));
    message.success('Dashboard refreshed');
  }, [dispatch]);

  // Export handler - Fully implemented
  const handleExport = useCallback(async () => {
    setExporting(true);
    try {
      const exportData = await stateService.exportDashboard({
        format: 'json',
        month: selectedMonth?.getMonth() + 1,
        year: selectedMonth?.getFullYear(),
      });

      // Create formatted JSON for download
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

      {/* Statistics Cards */}
      <div className="mb-6">
        <StatisticsCards stats={stats} />
      </div>

      {/* Two Column Layout */}
      <Row gutter={[16, 16]}>
        {/* Left Column - Institutions Table */}
        <Col xs={24} lg={12}>
          <InstitutionsTable
            institutions={institutions}
            loading={institutionsLoading}
          />
        </Col>

        {/* Right Column - Performance Metrics */}
        <Col xs={24} lg={12}>
          <PerformanceMetrics stats={stats} />
        </Col>
      </Row>

      {/* Performers Section */}
      <div className="mt-6">
        <TopPerformers
          topPerformers={topPerformers}
          bottomPerformers={bottomPerformers}
          loading={analyticsLoading}
        />
      </div>

      {/* Bottom Section - Industries and Trends */}
      <Row gutter={[16, 16]} className="mt-6">
        <Col xs={24} lg={12}>
          <TopIndustriesList
            industries={topIndustriesData}
            loading={analyticsLoading}
          />
        </Col>
        <Col xs={24} lg={12}>
          <Card
            title="Application & Placement Trends"
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

      {/* Monthly Summary Section */}
      {monthlyAnalytics?.metrics && (
        <div className="mt-6">
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
                    {monthlyAnalytics.metrics.selectedApplications || 0}
                  </div>
                  <div className="text-xs text-text-secondary uppercase tracking-wider font-semibold mt-1">Placements</div>
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
                    {monthlyAnalytics.metrics.placementRate || 0}%
                  </div>
                  <div className="text-xs text-text-secondary uppercase tracking-wider font-semibold mt-1">Placement Rate</div>
                </div>
              </Col>
            </Row>
          </Card>
        </div>
      )}
    </div>
  );
};

export default StateDashboard;
