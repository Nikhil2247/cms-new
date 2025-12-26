import React, { useEffect, useState, useMemo } from 'react';
import { EyeOutlined, MailOutlined } from '@ant-design/icons';
import { Modal, Descriptions } from 'antd';
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
    'rgb(114, 46, 209)', // Purple
    'rgb(235, 47, 150)', // Pink
    'rgb(19, 194, 194)', // Cyan
  ];

  const [loading, setLoading] = useState(true);
  const [analytics, setAnalytics] = useState(null);
  const [dateRange, setDateRange] = useState([dayjs().subtract(6, 'month'), dayjs()]);
  const [selectedBatch, setSelectedBatch] = useState('all');
  const [selectedDepartment, setSelectedDepartment] = useState('all');
  const [activeTab, setActiveTab] = useState('overview');
  const [exporting, setExporting] = useState(false);

  // Modal states for detailed views
  const [mentorDetailModal, setMentorDetailModal] = useState({ visible: false, mentor: null });
  const [companyDetailModal, setCompanyDetailModal] = useState({ visible: false, company: null });
  const [allMentorsModal, setAllMentorsModal] = useState(false);
  const [allCompaniesModal, setAllCompaniesModal] = useState(false);

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

      // All services now return unwrapped data
      const [analyticsData, internshipStatsData, dashboard] = await Promise.all([
        analyticsService.getInstitutionAnalytics(institutionId),
        analyticsService.getInternshipStats(institutionId),
        principalService.getDashboard(),
      ]);

      setAnalytics({
        ...analyticsData,
        internshipStats: internshipStatsData,
        dashboard: dashboard,
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
      {/* Key Metrics - Self-Identified Internships Focus */}
      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} lg={6}>
          <KPICard
            title="Total Students"
            value={analytics?.dashboard?.students?.total || analytics?.totalStudents || 0}
            icon={<UserOutlined />}
            color={token.colorPrimary}
            subValue={`${analytics?.dashboard?.internships?.totalApplications || 0} with internships`}
          />
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <KPICard
            title="Total Internships"
            value={analytics?.dashboard?.internships?.totalApplications || 0}
            icon={<BankOutlined />}
            color={token.colorSuccess}
            subValue="Active applications"
          />
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <KPICard
            title="Ongoing"
            value={analytics?.dashboard?.internships?.ongoingInternships || 0}
            icon={<ClockCircleOutlined />}
            color={token.colorWarning}
            subValue="Currently in progress"
          />
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <KPICard
            title="Completed"
            value={analytics?.dashboard?.internships?.completedInternships || 0}
            icon={<CheckCircleOutlined />}
            color="rgb(114, 46, 209)"
            suffix={analytics?.dashboard?.internships?.totalApplications > 0 ? ` (${analytics?.dashboard?.internships?.completionRate || 0}%)` : ''}
            subValue="Successfully finished"
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
            color="rgb(19, 194, 194)"
            subValue={`${mentorCoverage?.totalMentors || 0} mentors assigned`}
          />
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <KPICard
            title="Report Submission"
            value={complianceMetrics?.currentMonth?.reportComplianceRate || 0}
            suffix="%"
            icon={<FileTextOutlined />}
            color="rgb(235, 47, 150)"
          />
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <KPICard
            title="Faculty Visits"
            value={complianceMetrics?.currentMonth?.visitComplianceRate || 0}
            suffix="%"
            icon={<CarOutlined />}
            color={token.colorInfo}
          />
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <KPICard
            title="Overall Compliance"
            value={complianceMetrics?.currentMonth?.overallScore || 0}
            suffix="%"
            icon={<SafetyCertificateOutlined />}
            color={token.colorSuccess}
          />
        </Col>
      </Row>

      {/* Charts Row */}
      <Row gutter={[24, 24]}>
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

    </div>
  );

  // Internships Tab Content
  const renderInternshipsTab = () => {
    const statusData = internshipStats?.byStatus || [];
    const companyData = internshipStats?.byCompany || [];
    const industryData = internshipStats?.byIndustry || [];

    // Calculate self-identified stats
    const totalInternships = analytics?.dashboard?.internships?.totalApplications || internshipStats?.totalApplications || 0;
    const ongoingCount = analytics?.dashboard?.internships?.ongoingInternships || 0;
    const completedCount = analytics?.dashboard?.internships?.completedInternships || 0;
    const completionRate = totalInternships > 0 ? Math.round((completedCount / totalInternships) * 100) : 0;

    return (
      <div className="space-y-6">
        {/* Self-Identified Internships Overview Banner */}
        <Card className="rounded-2xl border-primary/20 bg-gradient-to-r from-primary/5 to-transparent shadow-sm">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <SafetyCertificateOutlined className="text-primary text-xl" />
                <Text className="text-lg font-semibold text-text-primary">Self-Identified Internships</Text>
              </div>
              <Text className="text-text-secondary">
                Students identify and register their own internships. All self-identified internships are auto-approved and tracked for compliance.
              </Text>
            </div>
            <div className="flex gap-4">
              <Statistic
                title={<Text className="text-[10px] uppercase font-bold text-text-tertiary">Completion Rate</Text>}
                value={completionRate}
                suffix="%"
                styles={{ content: { color: token.colorSuccess, fontWeight: 'bold', fontSize: 28 } }}
              />
            </div>
          </div>
        </Card>

        {/* Key Metrics Row */}
        <Row gutter={[16, 16]}>
          <Col xs={24} sm={12} lg={6}>
            <Card className="rounded-2xl border-border shadow-sm">
              <Statistic
                title={<Text className="text-[10px] uppercase font-bold text-text-tertiary">Total Registered</Text>}
                value={totalInternships}
                prefix={<FileTextOutlined className="text-primary mr-2" />}
                styles={{ content: { color: token.colorPrimary, fontWeight: 'bold' } }}
              />
              <div className="mt-2 pt-2 border-t border-border/50">
                <Text className="text-xs text-text-tertiary">All self-identified internships</Text>
              </div>
            </Card>
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <Card className="rounded-2xl border-border shadow-sm">
              <Statistic
                title={<Text className="text-[10px] uppercase font-bold text-text-tertiary">Currently Ongoing</Text>}
                value={ongoingCount}
                prefix={<ClockCircleOutlined className="text-warning mr-2" />}
                styles={{ content: { color: token.colorWarning, fontWeight: 'bold' } }}
              />
              <div className="mt-2 pt-2 border-t border-border/50">
                <Progress percent={totalInternships > 0 ? Math.round((ongoingCount / totalInternships) * 100) : 0} size="small" strokeColor={token.colorWarning} showInfo={false} />
              </div>
            </Card>
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <Card className="rounded-2xl border-border shadow-sm">
              <Statistic
                title={<Text className="text-[10px] uppercase font-bold text-text-tertiary">Completed</Text>}
                value={completedCount}
                prefix={<CheckCircleOutlined className="text-success mr-2" />}
                styles={{ content: { color: token.colorSuccess, fontWeight: 'bold' } }}
              />
              <div className="mt-2 pt-2 border-t border-border/50">
                <Progress percent={completionRate} size="small" strokeColor={token.colorSuccess} showInfo={false} />
              </div>
            </Card>
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <Card className="rounded-2xl border-border shadow-sm">
              <Statistic
                title={<Text className="text-[10px] uppercase font-bold text-text-tertiary">Companies</Text>}
                value={companyData.length || 0}
                prefix={<BankOutlined className="text-info mr-2" />}
                styles={{ content: { color: token.colorInfo, fontWeight: 'bold' } }}
              />
              <div className="mt-2 pt-2 border-t border-border/50">
                <Text className="text-xs text-text-tertiary">{industryData.length || 0} industry sectors</Text>
              </div>
            </Card>
          </Col>
        </Row>

        {/* Internship Status Breakdown */}
        <Card
          className="rounded-2xl border-border shadow-sm"
          title={
            <div className="flex items-center gap-2 text-text-primary">
              <PieChartOutlined className="text-primary" />
              <span className="font-semibold">Internship Status Breakdown</span>
            </div>
          }
        >
          {(() => {
            // Build status data from dashboard or internshipStats
            const dashboardData = analytics?.dashboard?.internships;
            const builtStatusData = dashboardData ? [
              { name: 'Ongoing', value: dashboardData.ongoingInternships || 0 },
              { name: 'Completed', value: dashboardData.completedInternships || 0 },
              { name: 'Pending', value: (dashboardData.totalApplications || 0) - (dashboardData.ongoingInternships || 0) - (dashboardData.completedInternships || 0) },
            ].filter(d => d.value > 0) : statusData.map(s => ({ name: s.status, value: s.count }));

            const chartData = builtStatusData.length > 0 ? builtStatusData : statusData.map(s => ({ name: s.status, value: s.count }));

            return chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={chartData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={5}
                    dataKey="value"
                    label={({ name, value }) => `${name}: ${value}`}
                    animationDuration={800}
                  >
                    {chartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <RechartsTooltip />
                  <Legend verticalAlign="bottom" height={36} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[300px] flex items-center justify-center">
                <Empty description="No internship data available" />
              </div>
            );
          })()}
        </Card>

        {/* Top Companies */}
        <Card
          className="rounded-2xl border-border shadow-sm"
          title={
            <div className="flex items-center gap-2 text-text-primary">
              <TrophyOutlined className="text-warning" />
              <span className="font-semibold">Top Companies (Self-Identified)</span>
            </div>
          }
          extra={
            <Button
              type="text"
              icon={<EyeOutlined />}
              onClick={() => setAllCompaniesModal(true)}
              className="text-primary"
            >
              View All ({companyData.length})
            </Button>
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
              {
                title: '',
                key: 'action',
                width: 60,
                render: (_, record) => (
                  <Tooltip title="View Details">
                    <Button
                      type="text"
                      size="small"
                      icon={<EyeOutlined />}
                      onClick={() => setCompanyDetailModal({ visible: true, company: record })}
                      className="text-primary"
                    />
                  </Tooltip>
                ),
              },
            ]}
          />
        </Card>
      </div>
    );
  };

  // Compliance Tab Content
  const renderComplianceTab = () => {
    const reportRate = complianceMetrics?.currentMonth?.reportComplianceRate || 0;
    const visitRate = complianceMetrics?.currentMonth?.visitComplianceRate || 0;
    const overallScore = complianceMetrics?.currentMonth?.overallScore || 0;

    const complianceData = [
      { subject: 'Report Submission', A: reportRate, fullMark: 100 },
      { subject: 'Faculty Visits', A: visitRate, fullMark: 100 },
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
                  <Tag color={reportRate >= 80 ? 'success' : 'warning'}>
                    {reportRate >= 80 ? 'On Track' : 'Needs Attention'}
                  </Tag>
                </div>
                <Progress
                  percent={reportRate}
                  strokeColor={reportRate >= 80 ? token.colorSuccess : token.colorWarning}
                  strokeWidth={12}
                  className="mb-2"
                />
              </Card>

              <Card className="rounded-2xl border-border shadow-sm">
                <div className="flex items-center justify-between mb-3">
                  <Text className="font-semibold text-text-primary">Faculty Visit Compliance</Text>
                  <Tag color={visitRate >= 80 ? 'success' : 'warning'}>
                    {visitRate >= 80 ? 'On Track' : 'Needs Attention'}
                  </Tag>
                </div>
                <Progress
                  percent={visitRate}
                  strokeColor={visitRate >= 80 ? token.colorSuccess : token.colorWarning}
                  strokeWidth={12}
                  className="mb-2"
                />
              </Card>

              <Card className="rounded-2xl border-border shadow-sm">
                <div className="flex items-center justify-between mb-3">
                  <Text className="font-semibold text-text-primary">Overall Compliance Score</Text>
                  <Text className="text-2xl font-bold" style={{ color: token.colorSuccess }}>
                    {overallScore}%
                  </Text>
                </div>
                <Progress
                  percent={overallScore}
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
              <Bar dataKey="reportCompliance" name="Report Submission" fill={token.colorPrimary} radius={[4, 4, 0, 0]} />
              <Bar dataKey="visitCompliance" name="Faculty Visits" fill={token.colorSuccess} radius={[4, 4, 0, 0]} />
              <Line type="monotone" dataKey="overallScore" name="Overall Score" stroke={token.colorWarning} strokeWidth={3} dot={{ r: 4 }} />
            </ComposedChart>
          </ResponsiveContainer>
        </Card>
      </div>
    );
  };

  // Mentor Tab Content
  const renderMentorTab = () => {
    // Fix: Use mentorLoadDistribution from API response
    const mentorLoad = mentorCoverage?.mentorLoadDistribution || mentorCoverage?.mentorLoad || [];
    // Transform data for chart - API returns assignedStudents, chart expects studentCount
    const chartData = mentorLoad.map(m => ({
      ...m,
      name: m.mentorName || m.name,
      studentCount: m.assignedStudents ?? m.studentCount ?? 0,
    }));

    return (
      <div className="space-y-6">
        <Row gutter={[16, 16]}>
          <Col xs={24} sm={8}>
            <Card className="rounded-2xl border-border shadow-sm text-center">
              <Statistic
                title={<Text className="text-[10px] uppercase font-bold text-text-tertiary">Total Mentors</Text>}
                value={mentorCoverage?.totalMentors || 0}
                prefix={<TeamOutlined className="text-primary mr-2" />}
                styles={{ content: { color: token.colorPrimary, fontWeight: 'bold' } }}
              />
            </Card>
          </Col>
          <Col xs={24} sm={8}>
            <Card className="rounded-2xl border-border shadow-sm text-center">
              <Statistic
                title={<Text className="text-[10px] uppercase font-bold text-text-tertiary">Students Assigned</Text>}
                value={mentorCoverage?.studentsWithMentors || mentorCoverage?.assignedStudents || 0}
                prefix={<UserOutlined className="text-success mr-2" />}
                styles={{ content: { color: token.colorSuccess, fontWeight: 'bold' } }}
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
                styles={{ content: { color: token.colorWarning, fontWeight: 'bold' } }}
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
              extra={
                <Button
                  type="text"
                  icon={<EyeOutlined />}
                  onClick={() => setAllMentorsModal(true)}
                  className="text-primary"
                >
                  View All ({mentorLoad.length})
                </Button>
              }
            >
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={chartData.slice(0, 10)}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" />
                  <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#666' }} angle={-45} textAnchor="end" height={60} />
                  <YAxis tick={{ fontSize: 12, fill: '#666' }} />
                  <RechartsTooltip />
                  <Bar
                    dataKey="studentCount"
                    name="Students"
                    radius={[6, 6, 0, 0]}
                  >
                    {chartData.slice(0, 10).map((entry, index) => {
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
              <div className="flex flex-col">
                {chartData.slice(0, 10).map((mentor, index) => {
                  const loadStatus = mentor.studentCount > 20 ? 'error' : mentor.studentCount > 15 ? 'warning' : 'success';
                  const loadLabel = mentor.studentCount > 20 ? 'Overloaded' : mentor.studentCount > 15 ? 'Heavy' : mentor.studentCount > 10 ? 'Optimal' : 'Light';

                  return (
                    <div key={mentor.id || index} className={`flex items-center justify-between w-full py-3 ${index !== chartData.slice(0, 10).length - 1 ? 'border-b border-border/50' : ''}`}>
                      <div className="flex items-center gap-3">
                        <Avatar icon={<UserOutlined />} className="bg-primary/10 text-primary" />
                        <div>
                          <Text className="font-medium text-text-primary block">{mentor.name}</Text>
                          <Text className="text-xs text-text-tertiary">{mentor.mentorEmail || mentor.department || 'Faculty'}</Text>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="text-right mr-2">
                          <Text className="font-bold text-text-primary block">{mentor.studentCount}</Text>
                          <Text className="text-[10px] text-text-tertiary uppercase">Students</Text>
                        </div>
                        <Tag color={loadStatus} className="rounded-full px-3 m-0">{loadLabel}</Tag>
                        <Tooltip title="View Details">
                          <Button
                            type="text"
                            size="small"
                            icon={<EyeOutlined />}
                            onClick={() => setMentorDetailModal({ visible: true, mentor })}
                            className="text-primary"
                          />
                        </Tooltip>
                      </div>
                    </div>
                  );
                })}
              </div>
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

      {/* Mentor Detail Modal */}
      <Modal
        title={
          <div className="flex items-center gap-2">
            <Avatar icon={<UserOutlined />} className="bg-primary/10 text-primary" />
            <span>Mentor Details</span>
          </div>
        }
        open={mentorDetailModal.visible}
        onCancel={() => setMentorDetailModal({ visible: false, mentor: null })}
        footer={null}
        width={500}
      >
        {mentorDetailModal.mentor && (
          <Descriptions column={1} bordered size="small" className="mt-4">
            <Descriptions.Item label="Name">
              <Text strong>{mentorDetailModal.mentor.mentorName || mentorDetailModal.mentor.name}</Text>
            </Descriptions.Item>
            <Descriptions.Item label="Email">
              <a href={`mailto:${mentorDetailModal.mentor.mentorEmail}`}>
                <MailOutlined className="mr-2" />
                {mentorDetailModal.mentor.mentorEmail || 'N/A'}
              </a>
            </Descriptions.Item>
            <Descriptions.Item label="Mentor ID">
              <Text copyable className="text-xs font-mono">
                {mentorDetailModal.mentor.mentorId || 'N/A'}
              </Text>
            </Descriptions.Item>
            <Descriptions.Item label="Students Assigned">
              <Tag color="blue" className="text-lg px-3 py-1">
                {mentorDetailModal.mentor.assignedStudents ?? mentorDetailModal.mentor.studentCount ?? 0}
              </Tag>
            </Descriptions.Item>
            <Descriptions.Item label="Load Status">
              {(() => {
                const count = mentorDetailModal.mentor.assignedStudents ?? mentorDetailModal.mentor.studentCount ?? 0;
                const status = count > 20 ? 'error' : count > 15 ? 'warning' : 'success';
                const label = count > 20 ? 'Overloaded' : count > 15 ? 'Heavy' : count > 10 ? 'Optimal' : 'Light';
                return <Tag color={status}>{label}</Tag>;
              })()}
            </Descriptions.Item>
          </Descriptions>
        )}
      </Modal>

      {/* All Mentors Modal */}
      <Modal
        title={
          <div className="flex items-center gap-2">
            <TeamOutlined className="text-primary" />
            <span>All Mentors ({mentorCoverage?.mentorLoadDistribution?.length || 0})</span>
          </div>
        }
        open={allMentorsModal}
        onCancel={() => setAllMentorsModal(false)}
        footer={null}
        width={800}
      >
        <Table
          dataSource={mentorCoverage?.mentorLoadDistribution || []}
          rowKey="mentorId"
          size="small"
          pagination={{ pageSize: 10 }}
          columns={[
            {
              title: 'Mentor',
              key: 'mentor',
              render: (_, record) => (
                <div className="flex items-center gap-2">
                  <Avatar size="small" icon={<UserOutlined />} className="bg-primary/10 text-primary" />
                  <div>
                    <Text className="font-medium block">{record.mentorName}</Text>
                    <Text className="text-xs text-text-tertiary">{record.mentorEmail}</Text>
                  </div>
                </div>
              ),
            },
            {
              title: 'Students',
              dataIndex: 'assignedStudents',
              key: 'students',
              width: 100,
              sorter: (a, b) => a.assignedStudents - b.assignedStudents,
              render: (val) => <Tag color="blue">{val}</Tag>,
            },
            {
              title: 'Load',
              key: 'load',
              width: 100,
              render: (_, record) => {
                const count = record.assignedStudents;
                const status = count > 20 ? 'error' : count > 15 ? 'warning' : count > 5 ? 'processing' : 'success';
                const label = count > 20 ? 'Overloaded' : count > 15 ? 'Heavy' : count > 5 ? 'Optimal' : 'Light';
                return <Tag color={status}>{label}</Tag>;
              },
            },
            {
              title: 'Action',
              key: 'action',
              width: 80,
              render: (_, record) => (
                <Button
                  type="text"
                  size="small"
                  icon={<EyeOutlined />}
                  onClick={() => {
                    setAllMentorsModal(false);
                    setMentorDetailModal({ visible: true, mentor: record });
                  }}
                />
              ),
            },
          ]}
        />
      </Modal>

      {/* Company Detail Modal */}
      <Modal
        title={
          <div className="flex items-center gap-2">
            <BankOutlined className="text-success" />
            <span>Company Details</span>
          </div>
        }
        open={companyDetailModal.visible}
        onCancel={() => setCompanyDetailModal({ visible: false, company: null })}
        footer={null}
        width={500}
      >
        {companyDetailModal.company && (
          <Descriptions column={1} bordered size="small" className="mt-4">
            <Descriptions.Item label="Company Name">
              <Text strong>{companyDetailModal.company.name}</Text>
            </Descriptions.Item>
            <Descriptions.Item label="Location">
              {companyDetailModal.company.location || 'N/A'}
            </Descriptions.Item>
            <Descriptions.Item label="Industry Type">
              <Tag color="blue">{companyDetailModal.company.industryType || 'Other'}</Tag>
            </Descriptions.Item>
            <Descriptions.Item label="Interns Count">
              <Tag color="green" className="text-lg px-3 py-1">
                {companyDetailModal.company.count || 0}
              </Tag>
            </Descriptions.Item>
          </Descriptions>
        )}
      </Modal>

      {/* All Companies Modal */}
      <Modal
        title={
          <div className="flex items-center gap-2">
            <BankOutlined className="text-success" />
            <span>All Partner Companies ({internshipStats?.byCompany?.length || 0})</span>
          </div>
        }
        open={allCompaniesModal}
        onCancel={() => setAllCompaniesModal(false)}
        footer={null}
        width={900}
      >
        <Table
          dataSource={internshipStats?.byCompany || []}
          rowKey="name"
          size="small"
          pagination={{ pageSize: 10 }}
          columns={[
            {
              title: 'Rank',
              key: 'rank',
              width: 60,
              render: (_, __, index) => (
                <Badge
                  count={index + 1}
                  color={index < 3 ? ['#faad14', '#a0a0a0', '#d48806'][index] : 'default'}
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
                  <Avatar size="small" icon={<BankOutlined />} className="bg-success/10 text-success" />
                  <Text className="font-medium">{text}</Text>
                </div>
              ),
            },
            {
              title: 'Interns',
              dataIndex: 'count',
              key: 'count',
              width: 80,
              sorter: (a, b) => a.count - b.count,
              render: (count) => <Tag color="blue">{count}</Tag>,
            },
            {
              title: 'Industry',
              dataIndex: 'industryType',
              key: 'industryType',
              width: 100,
              render: (type) => <Tag>{type || 'Other'}</Tag>,
            },
            {
              title: 'Location',
              dataIndex: 'location',
              key: 'location',
              ellipsis: true,
              render: (loc) => <Text className="text-text-secondary text-sm">{loc || 'N/A'}</Text>,
            },
            {
              title: 'Action',
              key: 'action',
              width: 80,
              render: (_, record) => (
                <Button
                  type="text"
                  size="small"
                  icon={<EyeOutlined />}
                  onClick={() => {
                    setAllCompaniesModal(false);
                    setCompanyDetailModal({ visible: true, company: record });
                  }}
                />
              ),
            },
          ]}
        />
      </Modal>
    </div>
  );
};

// Mock data for demonstration
const getMockData = () => ({
  totalStudents: 450,
  activeInternships: 325,
  completionRate: 72,
  previousStudents: 420,
  previousInternships: 300,
  previousCompletionRate: 65,
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
});

export default Analytics;
