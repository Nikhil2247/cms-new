import React, { useEffect, useState } from 'react';
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
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import dayjs from 'dayjs';
import { useDispatch, useSelector } from 'react-redux';
import { toast } from 'react-hot-toast';
import analyticsService from '../../../services/analytics.service';
import { fetchDepartments, fetchBatches } from '../store/principalSlice';

const { Title, Text } = Typography;
const { RangePicker } = DatePicker;
const { Option } = Select;

const Analytics = () => {
  const { token } = theme.useToken();
  const dispatch = useDispatch();
  const departments = useSelector((state) => state.principal.departments.list);
  const batches = useSelector((state) => state.principal.batches.list);

  // Chart colors
  const COLORS = [token.colorPrimary, token.colorSuccess, token.colorWarning, token.colorError, token.colorInfo, token.colorLink];

  const [loading, setLoading] = useState(true);
  const [analytics, setAnalytics] = useState(null);
  const [dateRange, setDateRange] = useState([dayjs().subtract(6, 'month'), dayjs()]);
  const [selectedBatch, setSelectedBatch] = useState('all');
  const [selectedDepartment, setSelectedDepartment] = useState('all');

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
  }, [dispatch]);

  useEffect(() => {
    fetchAnalytics();
  }, [dateRange, selectedBatch, selectedDepartment]);

  const fetchAnalytics = async () => {
    try {
      setLoading(true);
      const institutionId = getInstitutionId();

      // Fetch multiple analytics data
      const [analyticsData, internshipStats, placementStats] = await Promise.all([
        analyticsService.getInstitutionAnalytics(institutionId),
        analyticsService.getInternshipStats(institutionId),
        analyticsService.getPlacementStats(institutionId),
      ]);

      // Combine data
      setAnalytics({
        ...analyticsData.data || analyticsData,
        internshipStats: internshipStats.data || internshipStats,
        placementStats: placementStats.data || placementStats,
      });
    } catch (error) {
      console.error('Failed to fetch analytics:', error);
      toast.error('Failed to load analytics data');
      // Set mock data for demonstration
      setAnalytics(getMockData());
    } finally {
      setLoading(false);
    }
  };

  const handleExportPDF = () => {
    toast.success('PDF export feature coming soon!');
  };

  if (loading) {
    return (
      <div className="flex flex-col justify-center items-center min-h-[400px] gap-4">
        <Spin size="large" />
        <Text className="text-text-secondary animate-pulse">Loading analytics...</Text>
      </div>
    );
  }

  if (!analytics) {
    return (
      <div className="text-center p-12 bg-background-tertiary rounded-2xl border border-border/50">
        <Empty description="No analytics data available" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <Title level={2} className="mb-2 text-text-primary">
            Analytics & Reports
          </Title>
          <Text className="text-text-secondary text-base">
            Comprehensive insights into student performance and institutional metrics
          </Text>
        </div>
        <Button
          type="primary"
          icon={<DownloadOutlined />}
          size="large"
          onClick={handleExportPDF}
          className="rounded-xl shadow-lg shadow-primary/20 h-12 px-8 font-semibold"
        >
          Export as PDF
        </Button>
      </div>

      {/* Filters */}
      <Card className="rounded-xl border-border shadow-sm">
        <div className="flex gap-6 flex-wrap items-end">
          <div>
            <Text strong className="block mb-2 text-xs uppercase tracking-wider text-text-secondary font-bold">Date Range</Text>
            <RangePicker
              value={dateRange}
              onChange={(dates) => setDateRange(dates)}
              format="DD/MM/YYYY"
              className="w-full md:w-64 rounded-lg h-10"
            />
          </div>
          <div>
            <Text strong className="block mb-2 text-xs uppercase tracking-wider text-text-secondary font-bold">Batch</Text>
            <Select
              value={selectedBatch}
              onChange={setSelectedBatch}
              className="w-full md:w-40 rounded-lg h-10"
            >
              <Option value="all">All Batches</Option>
              {batches?.map(batch => (
                <Option key={batch.id} value={batch.id}>{batch.name || `Batch ${batch.year}`}</Option>
              ))}
            </Select>
          </div>
          <div>
            <Text strong className="block mb-2 text-xs uppercase tracking-wider text-text-secondary font-bold">Department</Text>
            <Select
              value={selectedDepartment}
              onChange={setSelectedDepartment}
              className="w-full md:w-48 rounded-lg h-10"
            >
              <Option value="all">All Departments</Option>
              {departments?.map(dept => (
                <Option key={dept.id} value={dept.id}>{dept.name}</Option>
              ))}
            </Select>
          </div>
        </div>
      </Card>

      {/* Key Metrics Cards */}
      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} lg={6}>
          <Card className="rounded-xl border-border shadow-sm hover:shadow-md transition-all">
            <Statistic
              title={<Text className="text-[10px] uppercase font-bold text-text-tertiary">Total Students</Text>}
              value={analytics.totalStudents || 0}
              prefix={<UserOutlined className="text-primary" />}
              valueStyle={{ fontWeight: 'bold', color: 'var(--ant-primary-color)' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card className="rounded-xl border-border shadow-sm hover:shadow-md transition-all">
            <Statistic
              title={<Text className="text-[10px] uppercase font-bold text-text-tertiary">Active Internships</Text>}
              value={analytics.activeInternships || 0}
              prefix={<FileTextOutlined className="text-success" />}
              valueStyle={{ fontWeight: 'bold', color: 'var(--ant-success-color)' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card className="rounded-xl border-border shadow-sm hover:shadow-md transition-all">
            <Statistic
              title={<Text className="text-[10px] uppercase font-bold text-text-tertiary">Completion Rate</Text>}
              value={analytics.completionRate || 0}
              suffix="%"
              prefix={<CheckCircleOutlined className="text-warning" />}
              valueStyle={{ fontWeight: 'bold', color: 'var(--ant-warning-color)' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card className="rounded-xl border-border shadow-sm hover:shadow-md transition-all">
            <Statistic
              title={<Text className="text-[10px] uppercase font-bold text-text-tertiary">Placement Rate</Text>}
              value={analytics.placementRate || 0}
              suffix="%"
              prefix={<TrophyOutlined className="text-secondary" />}
              valueStyle={{ fontWeight: 'bold', color: 'var(--ant-secondary-color)' }}
            />
          </Card>
        </Col>
      </Row>

      {/* Charts Section */}
      <Row gutter={[24, 24]}>
        {/* Students by Batch */}
        <Col xs={24} lg={12}>
          <Card
            className="rounded-xl border-border shadow-sm"
            title={
              <div className="flex items-center gap-2 text-text-primary">
                <BarChartOutlined className="text-primary" />
                <span>Students by Batch/Year</span>
              </div>
            }
          >
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={analytics.studentsByBatch || []}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="batch" tick={{ fontSize: 12, fill: '#666' }} />
                <YAxis tick={{ fontSize: 12, fill: '#666' }} />
                <Tooltip 
                  contentStyle={{ backgroundColor: 'rgb(var(--color-card-bg))', borderRadius: '12px', border: '1px solid rgb(var(--color-border))' }}
                  itemStyle={{ color: 'rgb(var(--color-text-primary))' }}
                />
                <Legend />
                <Bar dataKey="students" fill="var(--ant-primary-color)" radius={[4, 4, 0, 0]} name="Students" />
              </BarChart>
            </ResponsiveContainer>
          </Card>
        </Col>

        {/* Internship Status Distribution */}
        <Col xs={24} lg={12}>
          <Card
            className="rounded-xl border-border shadow-sm"
            title={
              <div className="flex items-center gap-2 text-text-primary">
                <PieChartOutlined className="text-success" />
                <span>Internship Status Distribution</span>
              </div>
            }
          >
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={analytics.internshipStatus || []}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                  outerRadius={100}
                  dataKey="value"
                >
                  {(analytics.internshipStatus || []).map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{ backgroundColor: 'rgb(var(--color-card-bg))', borderRadius: '12px', border: '1px solid rgb(var(--color-border))' }}
                />
              </PieChart>
            </ResponsiveContainer>
          </Card>
        </Col>

        {/* Monthly Progress Trend */}
        <Col xs={24} lg={12}>
          <Card
            className="rounded-xl border-border shadow-sm"
            title={
              <div className="flex items-center gap-2 text-text-primary">
                <LineChartOutlined className="text-warning" />
                <span>Monthly Progress Trend</span>
              </div>
            }
          >
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={analytics.monthlyProgress || []}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="month" tick={{ fontSize: 12, fill: '#666' }} />
                <YAxis tick={{ fontSize: 12, fill: '#666' }} />
                <Tooltip 
                  contentStyle={{ backgroundColor: 'rgb(var(--color-card-bg))', borderRadius: '12px', border: '1px solid rgb(var(--color-border))' }}
                />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="completed"
                  stroke="var(--ant-success-color)"
                  strokeWidth={3}
                  dot={{ r: 4 }}
                  name="Completed"
                />
                <Line
                  type="monotone"
                  dataKey="inProgress"
                  stroke="var(--ant-primary-color)"
                  strokeWidth={3}
                  dot={{ r: 4 }}
                  name="In Progress"
                />
              </LineChart>
            </ResponsiveContainer>
          </Card>
        </Col>

        {/* Placement by Industry Sector */}
        <Col xs={24} lg={12}>
          <Card
            className="rounded-xl border-border shadow-sm"
            title={
              <div className="flex items-center gap-2 text-text-primary">
                <PieChartOutlined className="text-secondary" />
                <span>Placement by Industry Sector</span>
              </div>
            }
          >
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={analytics.placementBySector || []}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  fill="#8884d8"
                  paddingAngle={5}
                  dataKey="value"
                  label
                >
                  {(analytics.placementBySector || []).map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{ backgroundColor: 'rgb(var(--color-card-bg))', borderRadius: '12px', border: '1px solid rgb(var(--color-border))' }}
                />
                <Legend verticalAlign="bottom" height={36}/>
              </PieChart>
            </ResponsiveContainer>
          </Card>
        </Col>
      </Row>
    </div>
  );
};

// Mock data for demonstration
const getMockData = () => ({
  totalStudents: 450,
  activeInternships: 325,
  completionRate: 72,
  placementRate: 68,
  studentsByBatch: [
    { batch: '2020', students: 95 },
    { batch: '2021', students: 120 },
    { batch: '2022', students: 135 },
    { batch: '2023', students: 100 },
  ],
  internshipStatus: [
    { name: 'Not Started', value: 45 },
    { name: 'In Progress', value: 325 },
    { name: 'Delayed', value: 35 },
    { name: 'Completed', value: 45 },
  ],
  monthlyProgress: [
    { month: 'Jan', completed: 20, inProgress: 30 },
    { month: 'Feb', completed: 35, inProgress: 45 },
    { month: 'Mar', completed: 42, inProgress: 55 },
    { month: 'Apr', completed: 50, inProgress: 60 },
    { month: 'May', completed: 65, inProgress: 70 },
    { month: 'Jun', completed: 75, inProgress: 80 },
  ],
  placementBySector: [
    { name: 'IT Services', value: 120 },
    { name: 'Manufacturing', value: 80 },
    { name: 'Healthcare', value: 45 },
    { name: 'Finance', value: 55 },
    { name: 'Education', value: 30 },
  ],
});

export default Analytics;