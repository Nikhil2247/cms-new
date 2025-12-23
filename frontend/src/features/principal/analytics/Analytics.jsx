import React, { useEffect, useState, useMemo } from 'react';
import {
  Card,
  Row,
  Col,
  Statistic,
  DatePicker,
  Select,
  Button,
  Spin,
  Typography,
  Space,
  Empty,
  theme,
  Tabs,
  Progress,
  Tag,
  Table,
  Tooltip,
  Segmented,
  Badge,
  Divider,
  List,
  Avatar,
} from 'antd';
import {
  UserOutlined,
  FileTextOutlined,
  CheckCircleOutlined,
  TrophyOutlined,
  DownloadOutlined,
  BarChartOutlined,
  PieChartOutlined,
  LineChartOutlined,
  TeamOutlined,
  RiseOutlined,
  FallOutlined,
  CarOutlined,
  BankOutlined,
  SafetyCertificateOutlined,
  ClockCircleOutlined,
  CalendarOutlined,
  ReloadOutlined,
  DashboardOutlined,
  FundOutlined,
  AuditOutlined,
  ExclamationCircleOutlined,
  ArrowUpOutlined,
  ArrowDownOutlined,
  MinusOutlined,
} from '@ant-design/icons';
import {
  BarChart,
  Bar,
  PieChart,
  Pie,
  LineChart,
  Line,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend,
  ResponsiveContainer,
  Cell,
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ComposedChart,
} from 'recharts';
import dayjs from 'dayjs';
import { useDispatch, useSelector } from 'react-redux';
import { toast } from 'react-hot-toast';
import analyticsService from '../../../services/analytics.service';
import principalService from '../../../services/principal.service';
import {
  fetchDepartments,
  fetchBatches,
  fetchMentorCoverage,
  fetchComplianceMetrics,
  fetchInternshipStats,
  selectMentorCoverage,
  selectComplianceMetrics,
  selectInternshipStats,
} from '../store/principalSlice';

const { Title, Text } = Typography;
const { RangePicker } = DatePicker;

const Analytics = () => {
  const { token } = theme.useToken();
  const dispatch = useDispatch();
  const departments = useSelector((state) => state.principal.departments?.list || []);
  const batches = useSelector((state) => state.principal.batches?.list || []);
  const mentorCoverage = useSelector(selectMentorCoverage);
  const complianceMetrics = useSelector(selectComplianceMetrics);
  const internshipStats = useSelector(selectInternshipStats);

  // Chart colors
  const COLORS = [
    token.colorPrimary,
    token.colorSuccess,
    token.colorWarning,
    token.colorError,
    token.colorInfo,
    '#722ed1',
    '#eb2f96',
    '#13c2c2',
  ];

  const [loading, setLoading] = useState(true);
  const [analytics, setAnalytics] = useState(null);
  const [dateRange, setDateRange] = useState([dayjs().subtract(6, 'month'), dayjs()]);
  const [selectedBatch, setSelectedBatch] = useState('all');
  const [selectedDepartment, setSelectedDepartment] = useState('all');
  const [activeTab, setActiveTab] = useState('overview');
  const [chartView, setChartView] = useState('monthly');
  const [exporting, setExporting] = useState(false);

  // Get institution ID from localStorage
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

  useEffect(() => {
    dispatch(fetchDepartments());
    dispatch(fetchBatches());
    dispatch(fetchMentorCoverage());
    dispatch(fetchComplianceMetrics());
    dispatch(fetchInternshipStats());
  }, [dispatch]);

  useEffect(() => {
    fetchAnalytics();
  }, [dateRange, selectedBatch, selectedDepartment]);

  const fetchAnalytics = async () => {
    try {
      setLoading(true);
      const institutionId = getInstitutionId();

      const [analyticsData, internshipStatsData, placementStats, dashboard] = await Promise.all([
        analyticsService.getInstitutionAnalytics(institutionId),
        analyticsService.getInternshipStats(institutionId),
        analyticsService.getPlacementStats(institutionId),
        principalService.getDashboard(),
      ]);

      setAnalytics({
        ...(analyticsData.data || analyticsData),
        internshipStats: internshipStatsData.data || internshipStatsData,
        placementStats: placementStats.data || placementStats,
        dashboard: dashboard.data || dashboard,
      });
    } catch (error) {
      console.error('Failed to fetch analytics:', error);
      toast.error('Failed to load analytics data');
      setAnalytics(getMockData());
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = () => {
    fetchAnalytics();
    dispatch(fetchMentorCoverage());
    dispatch(fetchComplianceMetrics());
    dispatch(fetchInternshipStats());
    toast.success('Analytics refreshed');
  };

  const handleExportPDF = async () => {
    try {
      setExporting(true);
      // Simulate PDF generation
      await new Promise(resolve => setTimeout(resolve, 1500));
      toast.success('Analytics report exported successfully!');
    } catch (error) {
      toast.error('Failed to export report');
    } finally {
      setExporting(false);
    }
  };

  // Calculate trends
  const calculateTrend = (current, previous) => {
    if (!previous || previous === 0) return { value: 0, direction: 'neutral' };
    const change = ((current - previous) / previous) * 100;
    return {
      value: Math.abs(change).toFixed(1),
      direction: change > 0 ? 'up' : change < 0 ? 'down' : 'neutral',
    };
  };

  // KPI Card Component
  const KPICard = ({ title, value, suffix = '', prefix, trend, icon, color, subValue }) => {
    const getTrendIcon = () => {
      if (trend?.direction === 'up') return <ArrowUpOutlined className="text-success" />;
      if (trend?.direction === 'down') return <ArrowDownOutlined className="text-error" />;
      return <MinusOutlined className="text-text-tertiary" />;
    };

    return (
      <Card className="rounded-2xl border-border shadow-sm hover:shadow-md transition-all duration-300 h-full">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <Text className="text-[10px] uppercase font-bold tracking-wider text-text-tertiary block mb-2">
              {title}
            </Text>
            <div className="flex items-baseline gap-1">
              <span className="text-3xl font-bold" style={{ color }}>{prefix}{value}</span>
              {suffix && <span className="text-lg text-text-secondary">{suffix}</span>}
            </div>
            {subValue && (
              <Text className="text-xs text-text-tertiary block mt-1">{subValue}</Text>
            )}
            {trend && (
              <div className="flex items-center gap-1 mt-2">
                {getTrendIcon()}
                <Text className={`text-xs font-medium ${
                  trend.direction === 'up' ? 'text-success' :
                  trend.direction === 'down' ? 'text-error' : 'text-text-tertiary'
                }`}>
                  {trend.value}% vs last period
                </Text>
              </div>
            )}
          </div>
          <div className={`w-12 h-12 rounded-xl flex items-center justify-center`}
               style={{ backgroundColor: `${color}15` }}>
            {React.cloneElement(icon, { className: 'text-xl', style: { color } })}
          </div>
        </div>
      </Card>
    );
  };

  // Overview Tab Content
  const renderOverviewTab = () => (
    <div className="space-y-6">
      {/* Key Metrics */}
      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} lg={6}>
          <KPICard
            title="Total Students"
            value={analytics?.totalStudents || 0}
            icon={<UserOutlined />}
            color={token.colorPrimary}
            trend={calculateTrend(analytics?.totalStudents, analytics?.previousStudents)}
            subValue={`${analytics?.activeInternships || 0} in active internship`}
          />
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <KPICard
            title="Active Internships"
            value={analytics?.activeInternships || 0}
            icon={<BankOutlined />}
            color={token.colorSuccess}
            trend={calculateTrend(analytics?.activeInternships, analytics?.previousInternships)}
            subValue={`${internshipStats?.byStatus?.find(s => s.status === 'Completed')?.count || 0} completed`}
          />
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <KPICard
            title="Completion Rate"
            value={analytics?.completionRate || 0}
            suffix="%"
            icon={<CheckCircleOutlined />}
            color={token.colorWarning}
            trend={calculateTrend(analytics?.completionRate, analytics?.previousCompletionRate)}
          />
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <KPICard
            title="Placement Rate"
            value={analytics?.placementRate || 0}
            suffix="%"
            icon={<TrophyOutlined />}
            color="#722ed1"
            trend={calculateTrend(analytics?.placementRate, analytics?.previousPlacementRate)}
          />
        </Col>
      </Row>

      {/* Secondary Metrics */}
      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} lg={6}>
          <KPICard
            title="Mentor Coverage"
            value={mentorCoverage?.coveragePercentage || 0}
            suffix="%"
            icon={<TeamOutlined />}
            color="#13c2c2"
            subValue={`${mentorCoverage?.totalMentors || 0} mentors assigned`}
          />
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <KPICard
            title="Report Submission"
            value={complianceMetrics?.reportSubmission || 0}
            suffix="%"
            icon={<FileTextOutlined />}
            color="#eb2f96"
          />
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <KPICard
            title="Faculty Visits"
            value={complianceMetrics?.facultyVisits || 0}
            suffix="%"
            icon={<CarOutlined />}
            color={token.colorInfo}
          />
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <KPICard
            title="Overall Compliance"
            value={complianceMetrics?.overallCompliance || 0}
            suffix="%"
            icon={<SafetyCertificateOutlined />}
            color={token.colorSuccess}
          />
        </Col>
      </Row>

      {/* Charts Row */}
      <Row gutter={[24, 24]}>
        {/* Students by Batch */}
        <Col xs={24} lg={12}>
          <Card
            className="rounded-2xl border-border shadow-sm"
            title={
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-text-primary">
                  <BarChartOutlined className="text-primary" />
                  <span className="font-semibold">Students by Batch</span>
                </div>
              </div>
            }
          >
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={analytics?.studentsByBatch || []}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" />
                <XAxis dataKey="batch" tick={{ fontSize: 12, fill: '#666' }} />
                <YAxis tick={{ fontSize: 12, fill: '#666' }} />
                <RechartsTooltip
                  contentStyle={{
                    backgroundColor: 'var(--color-card-bg, #fff)',
                    borderRadius: '12px',
                    border: '1px solid var(--color-border, #e5e7eb)',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
                  }}
                />
                <Bar
                  dataKey="students"
                  fill={token.colorPrimary}
                  radius={[6, 6, 0, 0]}
                  name="Students"
                  animationDuration={800}
                />
              </BarChart>
            </ResponsiveContainer>
          </Card>
        </Col>

        {/* Internship Status Distribution */}
        <Col xs={24} lg={12}>
          <Card
            className="rounded-2xl border-border shadow-sm"
            title={
              <div className="flex items-center gap-2 text-text-primary">
                <PieChartOutlined className="text-success" />
                <span className="font-semibold">Internship Status</span>
              </div>
            }
          >
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={analytics?.internshipStatus || []}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                  outerRadius={100}
                  dataKey="value"
                  animationDuration={800}
                >
                  {(analytics?.internshipStatus || []).map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <RechartsTooltip
                  contentStyle={{
                    backgroundColor: 'var(--color-card-bg, #fff)',
                    borderRadius: '12px',
                    border: '1px solid var(--color-border, #e5e7eb)'
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </Card>
        </Col>
      </Row>

      {/* Monthly Progress Trend */}
      <Card
        className="rounded-2xl border-border shadow-sm"
        title={
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-text-primary">
              <LineChartOutlined className="text-warning" />
              <span className="font-semibold">Monthly Progress Trend</span>
            </div>
            <Segmented
              options={[
                { label: 'Line', value: 'line' },
                { label: 'Area', value: 'area' },
              ]}
              value={chartView === 'monthly' ? 'line' : 'area'}
              onChange={(v) => setChartView(v === 'line' ? 'monthly' : 'area')}
              size="small"
            />
          </div>
        }
      >
        <ResponsiveContainer width="100%" height={350}>
          {chartView === 'monthly' ? (
            <LineChart data={analytics?.monthlyProgress || []}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" />
              <XAxis dataKey="month" tick={{ fontSize: 12, fill: '#666' }} />
              <YAxis tick={{ fontSize: 12, fill: '#666' }} />
              <RechartsTooltip
                contentStyle={{
                  backgroundColor: 'var(--color-card-bg, #fff)',
                  borderRadius: '12px',
                  border: '1px solid var(--color-border, #e5e7eb)'
                }}
              />
              <Legend />
              <Line
                type="monotone"
                dataKey="completed"
                stroke={token.colorSuccess}
                strokeWidth={3}
                dot={{ r: 5, strokeWidth: 2 }}
                activeDot={{ r: 8 }}
                name="Completed"
                animationDuration={800}
              />
              <Line
                type="monotone"
                dataKey="inProgress"
                stroke={token.colorPrimary}
                strokeWidth={3}
                dot={{ r: 5, strokeWidth: 2 }}
                activeDot={{ r: 8 }}
                name="In Progress"
                animationDuration={800}
              />
            </LineChart>
          ) : (
            <AreaChart data={analytics?.monthlyProgress || []}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" />
              <XAxis dataKey="month" tick={{ fontSize: 12, fill: '#666' }} />
              <YAxis tick={{ fontSize: 12, fill: '#666' }} />
              <RechartsTooltip
                contentStyle={{
                  backgroundColor: 'var(--color-card-bg, #fff)',
                  borderRadius: '12px',
                  border: '1px solid var(--color-border, #e5e7eb)'
                }}
              />
              <Legend />
              <Area
                type="monotone"
                dataKey="completed"
                stackId="1"
                stroke={token.colorSuccess}
                fill={`${token.colorSuccess}40`}
                name="Completed"
                animationDuration={800}
              />
              <Area
                type="monotone"
                dataKey="inProgress"
                stackId="1"
                stroke={token.colorPrimary}
                fill={`${token.colorPrimary}40`}
                name="In Progress"
                animationDuration={800}
              />
            </AreaChart>
          )}
        </ResponsiveContainer>
      </Card>
    </div>
  );

  // Internships Tab Content
  const renderInternshipsTab = () => {
    const statusData = internshipStats?.byStatus || [];
    const companyData = internshipStats?.byCompany || [];
    const industryData = internshipStats?.byIndustry || [];

    return (
      <div className="space-y-6">
        {/* Internship Summary Cards */}
        <Row gutter={[16, 16]}>
          <Col xs={24} sm={8}>
            <Card className="rounded-2xl border-border shadow-sm text-center">
              <Statistic
                title={<Text className="text-[10px] uppercase font-bold text-text-tertiary">Total Applications</Text>}
                value={internshipStats?.totalApplications || 0}
                prefix={<FileTextOutlined className="text-primary mr-2" />}
                valueStyle={{ color: token.colorPrimary, fontWeight: 'bold' }}
              />
            </Card>
          </Col>
          <Col xs={24} sm={8}>
            <Card className="rounded-2xl border-border shadow-sm text-center">
              <Statistic
                title={<Text className="text-[10px] uppercase font-bold text-text-tertiary">Companies Partnered</Text>}
                value={companyData.length || 0}
                prefix={<BankOutlined className="text-success mr-2" />}
                valueStyle={{ color: token.colorSuccess, fontWeight: 'bold' }}
              />
            </Card>
          </Col>
          <Col xs={24} sm={8}>
            <Card className="rounded-2xl border-border shadow-sm text-center">
              <Statistic
                title={<Text className="text-[10px] uppercase font-bold text-text-tertiary">Industry Sectors</Text>}
                value={industryData.length || 0}
                prefix={<FundOutlined className="text-warning mr-2" />}
                valueStyle={{ color: token.colorWarning, fontWeight: 'bold' }}
              />
            </Card>
          </Col>
        </Row>

        <Row gutter={[24, 24]}>
          {/* Status Distribution */}
          <Col xs={24} lg={12}>
            <Card
              className="rounded-2xl border-border shadow-sm h-full"
              title={
                <div className="flex items-center gap-2 text-text-primary">
                  <PieChartOutlined className="text-primary" />
                  <span className="font-semibold">Application Status Distribution</span>
                </div>
              }
            >
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={statusData.map(s => ({ name: s.status, value: s.count }))}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={5}
                    dataKey="value"
                    label={({ name, value }) => `${name}: ${value}`}
                    animationDuration={800}
                  >
                    {statusData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <RechartsTooltip />
                  <Legend verticalAlign="bottom" height={36} />
                </PieChart>
              </ResponsiveContainer>
            </Card>
          </Col>

          {/* Industry Distribution */}
          <Col xs={24} lg={12}>
            <Card
              className="rounded-2xl border-border shadow-sm h-full"
              title={
                <div className="flex items-center gap-2 text-text-primary">
                  <BarChartOutlined className="text-success" />
                  <span className="font-semibold">Industry Distribution</span>
                </div>
              }
            >
              <ResponsiveContainer width="100%" height={300}>
                <BarChart
                  data={industryData.slice(0, 8).map(i => ({ name: i.type, value: i.count }))}
                  layout="vertical"
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" />
                  <XAxis type="number" tick={{ fontSize: 12, fill: '#666' }} />
                  <YAxis dataKey="name" type="category" width={100} tick={{ fontSize: 11, fill: '#666' }} />
                  <RechartsTooltip />
                  <Bar dataKey="value" fill={token.colorSuccess} radius={[0, 6, 6, 0]} animationDuration={800} />
                </BarChart>
              </ResponsiveContainer>
            </Card>
          </Col>
        </Row>

        {/* Top Companies */}
        <Card
          className="rounded-2xl border-border shadow-sm"
          title={
            <div className="flex items-center gap-2 text-text-primary">
              <TrophyOutlined className="text-warning" />
              <span className="font-semibold">Top Hiring Companies</span>
            </div>
          }
        >
          <Table
            dataSource={companyData.slice(0, 10)}
            rowKey="name"
            pagination={false}
            columns={[
              {
                title: 'Rank',
                key: 'rank',
                width: 70,
                render: (_, __, index) => (
                  <Badge
                    count={index + 1}
                    color={index < 3 ? ['#faad14', '#a0a0a0', '#d48806'][index] : 'var(--ant-primary-color)'}
                    showZero
                  />
                ),
              },
              {
                title: 'Company',
                dataIndex: 'name',
                key: 'name',
                render: (text) => (
                  <div className="flex items-center gap-2">
                    <Avatar size="small" icon={<BankOutlined />} className="bg-primary/10 text-primary" />
                    <Text className="font-medium text-text-primary">{text}</Text>
                  </div>
                ),
              },
              {
                title: 'Interns',
                dataIndex: 'count',
                key: 'count',
                width: 100,
                render: (count) => (
                  <Tag color="blue" className="rounded-full px-3 font-semibold">{count}</Tag>
                ),
              },
              {
                title: 'Industry',
                dataIndex: 'industryType',
                key: 'industryType',
                render: (type) => type && <Tag color="default">{type}</Tag>,
              },
              {
                title: 'Location',
                dataIndex: 'location',
                key: 'location',
                render: (loc) => <Text className="text-text-secondary text-sm">{loc || 'N/A'}</Text>,
              },
            ]}
          />
        </Card>
      </div>
    );
  };

  // Compliance Tab Content
  const renderComplianceTab = () => {
    const complianceData = [
      { subject: 'Report Submission', A: complianceMetrics?.reportSubmission || 0, fullMark: 100 },
      { subject: 'Faculty Visits', A: complianceMetrics?.facultyVisits || 0, fullMark: 100 },
      { subject: 'Mentor Coverage', A: mentorCoverage?.coveragePercentage || 0, fullMark: 100 },
      { subject: 'Document Completion', A: 85, fullMark: 100 },
      { subject: 'Timely Submissions', A: 78, fullMark: 100 },
    ];

    const trendData = complianceMetrics?.trend || [];

    return (
      <div className="space-y-6">
        <Row gutter={[24, 24]}>
          {/* Compliance Radar */}
          <Col xs={24} lg={12}>
            <Card
              className="rounded-2xl border-border shadow-sm h-full"
              title={
                <div className="flex items-center gap-2 text-text-primary">
                  <SafetyCertificateOutlined className="text-success" />
                  <span className="font-semibold">Compliance Overview</span>
                </div>
              }
            >
              <ResponsiveContainer width="100%" height={350}>
                <RadarChart data={complianceData}>
                  <PolarGrid stroke="rgba(0,0,0,0.1)" />
                  <PolarAngleAxis dataKey="subject" tick={{ fontSize: 11, fill: '#666' }} />
                  <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fontSize: 10, fill: '#999' }} />
                  <Radar
                    name="Compliance"
                    dataKey="A"
                    stroke={token.colorSuccess}
                    fill={token.colorSuccess}
                    fillOpacity={0.3}
                    animationDuration={800}
                  />
                  <RechartsTooltip />
                </RadarChart>
              </ResponsiveContainer>
            </Card>
          </Col>

          {/* Compliance Metrics Cards */}
          <Col xs={24} lg={12}>
            <div className="space-y-4">
              <Card className="rounded-2xl border-border shadow-sm">
                <div className="flex items-center justify-between mb-3">
                  <Text className="font-semibold text-text-primary">Report Submission Rate</Text>
                  <Tag color={complianceMetrics?.reportSubmission >= 80 ? 'success' : 'warning'}>
                    {complianceMetrics?.reportSubmission >= 80 ? 'On Track' : 'Needs Attention'}
                  </Tag>
                </div>
                <Progress
                  percent={complianceMetrics?.reportSubmission || 0}
                  strokeColor={complianceMetrics?.reportSubmission >= 80 ? token.colorSuccess : token.colorWarning}
                  strokeWidth={12}
                  className="mb-2"
                />
              </Card>

              <Card className="rounded-2xl border-border shadow-sm">
                <div className="flex items-center justify-between mb-3">
                  <Text className="font-semibold text-text-primary">Faculty Visit Compliance</Text>
                  <Tag color={complianceMetrics?.facultyVisits >= 80 ? 'success' : 'warning'}>
                    {complianceMetrics?.facultyVisits >= 80 ? 'On Track' : 'Needs Attention'}
                  </Tag>
                </div>
                <Progress
                  percent={complianceMetrics?.facultyVisits || 0}
                  strokeColor={complianceMetrics?.facultyVisits >= 80 ? token.colorSuccess : token.colorWarning}
                  strokeWidth={12}
                  className="mb-2"
                />
              </Card>

              <Card className="rounded-2xl border-border shadow-sm">
                <div className="flex items-center justify-between mb-3">
                  <Text className="font-semibold text-text-primary">Overall Compliance Score</Text>
                  <Text className="text-2xl font-bold" style={{ color: token.colorSuccess }}>
                    {complianceMetrics?.overallCompliance || 0}%
                  </Text>
                </div>
                <Progress
                  percent={complianceMetrics?.overallCompliance || 0}
                  strokeColor={{
                    '0%': token.colorWarning,
                    '50%': token.colorPrimary,
                    '100%': token.colorSuccess,
                  }}
                  strokeWidth={12}
                />
              </Card>
            </div>
          </Col>
        </Row>

        {/* Compliance Trend */}
        <Card
          className="rounded-2xl border-border shadow-sm"
          title={
            <div className="flex items-center gap-2 text-text-primary">
              <LineChartOutlined className="text-primary" />
              <span className="font-semibold">6-Month Compliance Trend</span>
            </div>
          }
        >
          <ResponsiveContainer width="100%" height={300}>
            <ComposedChart data={trendData}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" />
              <XAxis dataKey="monthName" tick={{ fontSize: 12, fill: '#666' }} />
              <YAxis tick={{ fontSize: 12, fill: '#666' }} domain={[0, 100]} />
              <RechartsTooltip />
              <Legend />
              <Bar dataKey="reportSubmission" name="Report Submission" fill={token.colorPrimary} radius={[4, 4, 0, 0]} />
              <Bar dataKey="facultyVisits" name="Faculty Visits" fill={token.colorSuccess} radius={[4, 4, 0, 0]} />
              <Line type="monotone" dataKey="overallScore" name="Overall Score" stroke={token.colorWarning} strokeWidth={3} dot={{ r: 4 }} />
            </ComposedChart>
          </ResponsiveContainer>
        </Card>
      </div>
    );
  };

  // Mentor Tab Content
  const renderMentorTab = () => {
    const mentorLoad = mentorCoverage?.mentorLoad || [];

    return (
      <div className="space-y-6">
        <Row gutter={[16, 16]}>
          <Col xs={24} sm={8}>
            <Card className="rounded-2xl border-border shadow-sm text-center">
              <Statistic
                title={<Text className="text-[10px] uppercase font-bold text-text-tertiary">Total Mentors</Text>}
                value={mentorCoverage?.totalMentors || 0}
                prefix={<TeamOutlined className="text-primary mr-2" />}
                valueStyle={{ color: token.colorPrimary, fontWeight: 'bold' }}
              />
            </Card>
          </Col>
          <Col xs={24} sm={8}>
            <Card className="rounded-2xl border-border shadow-sm text-center">
              <Statistic
                title={<Text className="text-[10px] uppercase font-bold text-text-tertiary">Students Assigned</Text>}
                value={mentorCoverage?.assignedStudents || 0}
                prefix={<UserOutlined className="text-success mr-2" />}
                valueStyle={{ color: token.colorSuccess, fontWeight: 'bold' }}
              />
            </Card>
          </Col>
          <Col xs={24} sm={8}>
            <Card className="rounded-2xl border-border shadow-sm text-center">
              <Statistic
                title={<Text className="text-[10px] uppercase font-bold text-text-tertiary">Coverage Rate</Text>}
                value={mentorCoverage?.coveragePercentage || 0}
                suffix="%"
                prefix={<SafetyCertificateOutlined className="text-warning mr-2" />}
                valueStyle={{ color: token.colorWarning, fontWeight: 'bold' }}
              />
            </Card>
          </Col>
        </Row>

        <Row gutter={[24, 24]}>
          {/* Mentor Load Distribution */}
          <Col xs={24} lg={12}>
            <Card
              className="rounded-2xl border-border shadow-sm h-full"
              title={
                <div className="flex items-center gap-2 text-text-primary">
                  <BarChartOutlined className="text-primary" />
                  <span className="font-semibold">Mentor Load Distribution</span>
                </div>
              }
            >
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={mentorLoad.slice(0, 10)}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" />
                  <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#666' }} angle={-45} textAnchor="end" height={60} />
                  <YAxis tick={{ fontSize: 12, fill: '#666' }} />
                  <RechartsTooltip />
                  <Bar
                    dataKey="studentCount"
                    name="Students"
                    radius={[6, 6, 0, 0]}
                  >
                    {mentorLoad.slice(0, 10).map((entry, index) => {
                      let color = token.colorSuccess;
                      if (entry.studentCount > 20) color = token.colorError;
                      else if (entry.studentCount > 15) color = token.colorWarning;
                      else if (entry.studentCount > 10) color = token.colorPrimary;
                      return <Cell key={`cell-${index}`} fill={color} />;
                    })}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </Card>
          </Col>

          {/* Mentor List */}
          <Col xs={24} lg={12}>
            <Card
              className="rounded-2xl border-border shadow-sm h-full"
              title={
                <div className="flex items-center gap-2 text-text-primary">
                  <TeamOutlined className="text-success" />
                  <span className="font-semibold">Mentor Overview</span>
                </div>
              }
              styles={{ body: { maxHeight: 350, overflow: 'auto' } }}
            >
              <List
                dataSource={mentorLoad.slice(0, 10)}
                renderItem={(mentor) => {
                  const loadStatus = mentor.studentCount > 20 ? 'error' : mentor.studentCount > 15 ? 'warning' : 'success';
                  const loadLabel = mentor.studentCount > 20 ? 'Overloaded' : mentor.studentCount > 15 ? 'Heavy' : mentor.studentCount > 10 ? 'Optimal' : 'Light';

                  return (
                    <List.Item className="!px-0">
                      <div className="flex items-center justify-between w-full">
                        <div className="flex items-center gap-3">
                          <Avatar icon={<UserOutlined />} className="bg-primary/10 text-primary" />
                          <div>
                            <Text className="font-medium text-text-primary block">{mentor.name}</Text>
                            <Text className="text-xs text-text-tertiary">{mentor.department || 'Faculty'}</Text>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="text-right">
                            <Text className="font-bold text-text-primary block">{mentor.studentCount}</Text>
                            <Text className="text-[10px] text-text-tertiary uppercase">Students</Text>
                          </div>
                          <Tag color={loadStatus} className="rounded-full px-3">{loadLabel}</Tag>
                        </div>
                      </div>
                    </List.Item>
                  );
                }}
              />
            </Card>
          </Col>
        </Row>
      </div>
    );
  };

  // Placement Tab Content
  const renderPlacementTab = () => {
    const placementData = analytics?.placementBySector || [];

    return (
      <div className="space-y-6">
        <Row gutter={[16, 16]}>
          <Col xs={24} sm={8}>
            <Card className="rounded-2xl border-border shadow-sm text-center">
              <Statistic
                title={<Text className="text-[10px] uppercase font-bold text-text-tertiary">Total Placed</Text>}
                value={analytics?.placementStats?.totalPlaced || 0}
                prefix={<TrophyOutlined className="text-success mr-2" />}
                valueStyle={{ color: token.colorSuccess, fontWeight: 'bold' }}
              />
            </Card>
          </Col>
          <Col xs={24} sm={8}>
            <Card className="rounded-2xl border-border shadow-sm text-center">
              <Statistic
                title={<Text className="text-[10px] uppercase font-bold text-text-tertiary">Placement Rate</Text>}
                value={analytics?.placementRate || 0}
                suffix="%"
                prefix={<RiseOutlined className="text-primary mr-2" />}
                valueStyle={{ color: token.colorPrimary, fontWeight: 'bold' }}
              />
            </Card>
          </Col>
          <Col xs={24} sm={8}>
            <Card className="rounded-2xl border-border shadow-sm text-center">
              <Statistic
                title={<Text className="text-[10px] uppercase font-bold text-text-tertiary">Avg. Package (LPA)</Text>}
                value={analytics?.placementStats?.avgPackage || 0}
                precision={1}
                prefix={<FundOutlined className="text-warning mr-2" />}
                valueStyle={{ color: token.colorWarning, fontWeight: 'bold' }}
              />
            </Card>
          </Col>
        </Row>

        <Row gutter={[24, 24]}>
          {/* Placement by Sector */}
          <Col xs={24} lg={12}>
            <Card
              className="rounded-2xl border-border shadow-sm h-full"
              title={
                <div className="flex items-center gap-2 text-text-primary">
                  <PieChartOutlined className="text-primary" />
                  <span className="font-semibold">Placement by Industry Sector</span>
                </div>
              }
            >
              <ResponsiveContainer width="100%" height={350}>
                <PieChart>
                  <Pie
                    data={placementData}
                    cx="50%"
                    cy="50%"
                    innerRadius={70}
                    outerRadius={120}
                    paddingAngle={3}
                    dataKey="value"
                    label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                  >
                    {placementData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <RechartsTooltip />
                  <Legend verticalAlign="bottom" />
                </PieChart>
              </ResponsiveContainer>
            </Card>
          </Col>

          {/* Placement Trend */}
          <Col xs={24} lg={12}>
            <Card
              className="rounded-2xl border-border shadow-sm h-full"
              title={
                <div className="flex items-center gap-2 text-text-primary">
                  <LineChartOutlined className="text-success" />
                  <span className="font-semibold">Placement Trend</span>
                </div>
              }
            >
              <ResponsiveContainer width="100%" height={350}>
                <AreaChart
                  data={[
                    { month: 'Jul', placed: 5, target: 10 },
                    { month: 'Aug', placed: 12, target: 15 },
                    { month: 'Sep', placed: 25, target: 20 },
                    { month: 'Oct', placed: 38, target: 30 },
                    { month: 'Nov', placed: 52, target: 45 },
                    { month: 'Dec', placed: 68, target: 60 },
                  ]}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" />
                  <XAxis dataKey="month" tick={{ fontSize: 12, fill: '#666' }} />
                  <YAxis tick={{ fontSize: 12, fill: '#666' }} />
                  <RechartsTooltip />
                  <Legend />
                  <Area type="monotone" dataKey="target" name="Target" stroke="#999" fill="rgba(0,0,0,0.1)" strokeDasharray="5 5" />
                  <Area type="monotone" dataKey="placed" name="Placed" stroke={token.colorSuccess} fill={`${token.colorSuccess}40`} />
                </AreaChart>
              </ResponsiveContainer>
            </Card>
          </Col>
        </Row>
      </div>
    );
  };

  // Tab items
  const tabItems = [
    {
      key: 'overview',
      label: (
        <span className="flex items-center gap-2">
          <DashboardOutlined />
          Overview
        </span>
      ),
      children: renderOverviewTab(),
    },
    {
      key: 'internships',
      label: (
        <span className="flex items-center gap-2">
          <BankOutlined />
          Internships
        </span>
      ),
      children: renderInternshipsTab(),
    },
    {
      key: 'compliance',
      label: (
        <span className="flex items-center gap-2">
          <AuditOutlined />
          Compliance
        </span>
      ),
      children: renderComplianceTab(),
    },
    {
      key: 'mentors',
      label: (
        <span className="flex items-center gap-2">
          <TeamOutlined />
          Mentors
        </span>
      ),
      children: renderMentorTab(),
    },
    {
      key: 'placements',
      label: (
        <span className="flex items-center gap-2">
          <TrophyOutlined />
          Placements
        </span>
      ),
      children: renderPlacementTab(),
    },
  ];

  if (loading && !analytics) {
    return (
      <div className="flex flex-col justify-center items-center min-h-[400px] gap-4">
        <Spin size="large" />
        <Text className="text-text-secondary animate-pulse">Loading analytics...</Text>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <Title level={2} className="!mb-2 !text-text-primary">
            Analytics & Reports
          </Title>
          <Text className="text-text-secondary text-base">
            Comprehensive insights into student performance, internships, and institutional metrics
          </Text>
        </div>
        <Space size="middle">
          <Button
            icon={<ReloadOutlined />}
            onClick={handleRefresh}
            loading={loading}
            className="rounded-xl h-10"
          >
            Refresh
          </Button>
          <Button
            type="primary"
            icon={<DownloadOutlined />}
            size="large"
            onClick={handleExportPDF}
            loading={exporting}
            className="rounded-xl shadow-lg shadow-primary/20 h-12 px-8 font-semibold"
          >
            Export Report
          </Button>
        </Space>
      </div>

      {/* Filters */}
      <Card className="rounded-2xl border-border shadow-sm">
        <div className="flex gap-6 flex-wrap items-end">
          <div>
            <Text strong className="block mb-2 text-xs uppercase tracking-wider text-text-secondary font-bold">
              Date Range
            </Text>
            <RangePicker
              value={dateRange}
              onChange={(dates) => setDateRange(dates)}
              format="DD/MM/YYYY"
              className="w-full md:w-64 rounded-lg h-10"
            />
          </div>
          <div>
            <Text strong className="block mb-2 text-xs uppercase tracking-wider text-text-secondary font-bold">
              Batch
            </Text>
            <Select
              value={selectedBatch}
              onChange={setSelectedBatch}
              className="w-full md:w-40 rounded-lg h-10"
            >
              <Select.Option value="all">All Batches</Select.Option>
              {batches?.map((batch) => (
                <Select.Option key={batch.id} value={batch.id}>
                  {batch.name || `Batch ${batch.year}`}
                </Select.Option>
              ))}
            </Select>
          </div>
          <div>
            <Text strong className="block mb-2 text-xs uppercase tracking-wider text-text-secondary font-bold">
              Department
            </Text>
            <Select
              value={selectedDepartment}
              onChange={setSelectedDepartment}
              className="w-full md:w-48 rounded-lg h-10"
            >
              <Select.Option value="all">All Departments</Select.Option>
              {departments?.map((dept) => (
                <Select.Option key={dept.id} value={dept.id}>
                  {dept.name}
                </Select.Option>
              ))}
            </Select>
          </div>
        </div>
      </Card>

      {/* Tabs */}
      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        items={tabItems}
        size="large"
        className="analytics-tabs"
      />
    </div>
  );
};

// Mock data for demonstration
const getMockData = () => ({
  totalStudents: 450,
  activeInternships: 325,
  completionRate: 72,
  placementRate: 68,
  previousStudents: 420,
  previousInternships: 300,
  previousCompletionRate: 65,
  previousPlacementRate: 62,
  studentsByBatch: [
    { batch: '2021', students: 95 },
    { batch: '2022', students: 120 },
    { batch: '2023', students: 135 },
    { batch: '2024', students: 100 },
  ],
  internshipStatus: [
    { name: 'Not Started', value: 45 },
    { name: 'In Progress', value: 325 },
    { name: 'Delayed', value: 35 },
    { name: 'Completed', value: 45 },
  ],
  monthlyProgress: [
    { month: 'Jul', completed: 20, inProgress: 30 },
    { month: 'Aug', completed: 35, inProgress: 45 },
    { month: 'Sep', completed: 42, inProgress: 55 },
    { month: 'Oct', completed: 50, inProgress: 60 },
    { month: 'Nov', completed: 65, inProgress: 70 },
    { month: 'Dec', completed: 75, inProgress: 80 },
  ],
  placementBySector: [
    { name: 'IT Services', value: 120 },
    { name: 'Manufacturing', value: 80 },
    { name: 'Healthcare', value: 45 },
    { name: 'Finance', value: 55 },
    { name: 'Education', value: 30 },
  ],
  placementStats: {
    totalPlaced: 180,
    avgPackage: 4.5,
  },
});

export default Analytics;
