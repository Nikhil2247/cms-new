import React, { useState } from 'react';
import { Card, Progress, Row, Col, Statistic, Typography, Tooltip, Segmented, Empty } from 'antd';
import {
  CheckCircleOutlined,
  SyncOutlined,
  ClockCircleOutlined,
  TrophyOutlined,
  ArrowUpOutlined,
  ArrowDownOutlined,
  BarChartOutlined,
  LineChartOutlined,
  DotChartOutlined,
} from '@ant-design/icons';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  Cell,
  PieChart,
  Pie,
  Legend,
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
} from 'recharts';

const { Text } = Typography;

const MetricItem = ({ label, value, color, icon, description }) => (
  <div className="mb-4">
    <div className="flex justify-between items-center mb-2">
      <div className="flex items-center gap-2">
        {icon}
        <Text strong>{label}</Text>
      </div>
      <Tooltip title={description}>
        <Text className="font-semibold">
          {value}%
        </Text>
      </Tooltip>
    </div>
    <Progress
      percent={value}
      showInfo={false}
      size="small"
    />
  </div>
);

const CustomTooltip = ({ active, payload }) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="bg-surface p-3 shadow-lg rounded-lg border border-border">
        <p className="font-semibold text-text-primary">{data.label}</p>
        <p className="text-sm" style={{ color: data.color }}>
          Value: <span className="font-bold">{data.value}%</span>
        </p>
      </div>
    );
  }
  return null;
};

const PerformanceMetrics = ({ stats }) => {
  const [viewMode, setViewMode] = useState('progress');

  const placementRateRaw = stats?.placementRate ?? stats?.applications?.placementRate;
  const placementRate = Number.isFinite(Number(placementRateRaw)) ? Number(placementRateRaw) : 0;

  const totalApplications = Number(stats?.applications?.total ?? 0) || 0;
  const acceptedApplications = Number(stats?.applications?.accepted ?? 0) || 0;
  const acceptanceRate = totalApplications > 0 ? Math.round((acceptedApplications / totalApplications) * 100) : 0;

  const totalIndustries = Number(stats?.industries?.total ?? 0) || 0;
  const approvedIndustries = Number(stats?.industries?.approved ?? 0) || 0;
  const industryApprovalRate = totalIndustries > 0 ? Math.round((approvedIndustries / totalIndustries) * 100) : 0;

  const totalVisits = Number(stats?.compliance?.totalVisits ?? 0) || 0;
  const pendingReports = Number(stats?.compliance?.pendingReports ?? 0) || 0;
  const pendingReportsRate = totalVisits > 0 ? Math.round((pendingReports / totalVisits) * 100) : 0;

  const metrics = [
    {
      label: 'Student Placement Rate',
      value: placementRate,
      icon: <TrophyOutlined className="text-success" />,
      description: 'Percentage of students placed in internships',
    },
    {
      label: 'Application Acceptance Rate',
      value: acceptanceRate,
      icon: <CheckCircleOutlined className="text-primary" />,
      description: 'Accepted applications as a percentage of total applications',
    },
    {
      label: 'Industry Approval Rate',
      value: industryApprovalRate,
      icon: <SyncOutlined className="text-secondary" />,
      description: 'Approved industries as a percentage of total industries',
    },
    {
      label: 'Pending Reports Rate',
      value: pendingReportsRate,
      icon: <ClockCircleOutlined className="text-warning" />,
      description: 'Pending reports relative to total compliance visits',
    },
  ];

  // Data for bar chart
  const barChartData = metrics.map((m) => ({
    label: m.label.replace(' Rate', '').replace('Student ', '').replace('Application ', '').replace('Industry ', ''),
    value: m.value,
    color: m.color,
  }));

  // Data for pie chart
  const pieChartData = metrics.map((m) => ({
    name: m.label.split(' ')[0],
    value: m.value,
    color: m.color,
  }));

  // Data for radar chart
  const radarData = metrics.map((m) => ({
    subject: m.label.replace(' Rate', '').replace('Student ', '').replace('Application ', '').replace('Industry ', ''),
    current: m.value,
    target: 85,
  }));

  const renderProgressView = () => (
    <div className="space-y-2">
      {metrics.map((metric, index) => (
        <MetricItem key={index} {...metric} />
      ))}
    </div>
  );

  const renderBarChartView = () => (
    <div style={{ height: 220 }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={barChartData}
          margin={{ top: 10, right: 10, left: -10, bottom: 5 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 10, fill: '#666' }}
            interval={0}
            angle={-20}
            textAnchor="end"
            height={50}
          />
          <YAxis tick={{ fontSize: 10, fill: '#666' }} domain={[0, 100]} />
          <RechartsTooltip content={<CustomTooltip />} />
          <Bar dataKey="value" radius={[4, 4, 0, 0]} barSize={35}>
            {barChartData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );

  const renderRadarChartView = () => (
    <div style={{ height: 220 }}>
      <ResponsiveContainer width="100%" height="100%">
        <RadarChart cx="50%" cy="50%" outerRadius="65%" data={radarData}>
          <PolarGrid stroke="#e0e0e0" />
          <PolarAngleAxis dataKey="subject" tick={{ fontSize: 9, fill: '#666' }} />
          <PolarRadiusAxis angle={90} domain={[0, 100]} tick={{ fontSize: 8, fill: '#999' }} />
          <Radar
            name="Current"
            dataKey="current"
            stroke="#1890ff"
            fill="#1890ff"
            fillOpacity={0.4}
            strokeWidth={2}
          />
          <Radar
            name="Target"
            dataKey="target"
            stroke="#52c41a"
            fill="#52c41a"
            fillOpacity={0.2}
            strokeWidth={2}
            strokeDasharray="5 5"
          />
          <Legend wrapperStyle={{ fontSize: 10 }} />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );

  const hasData = metrics.some((m) => m.value > 0);

  return (
    <Card
      title="System Performance Overview"
      className="shadow-sm h-full"
      extra={
        <Segmented
          size="small"
          options={[
            { value: 'progress', icon: <LineChartOutlined /> },
            { value: 'bar', icon: <BarChartOutlined /> },
            { value: 'radar', icon: <DotChartOutlined /> },
          ]}
          value={viewMode}
          onChange={setViewMode}
        />
      }
    >
      {hasData ? (
        viewMode === 'progress' ? renderProgressView() :
        viewMode === 'bar' ? renderBarChartView() :
        renderRadarChartView()
      ) : (
        <Empty description="No performance data available" />
      )}

      {/* Summary Stats */}
      <div className="mt-6 pt-4 border-t border-border">
        <Row gutter={16}>
          <Col span={12}>
            <Statistic
              title="Applications (Last Week)"
              value={stats?.recentActivity?.applicationsLastWeek || 0}
              prefix={<ArrowUpOutlined />}
            />
          </Col>
          <Col span={12}>
            <Statistic
              title="Industries (Last Month)"
              value={stats?.recentActivity?.industriesLastMonth || 0}
              prefix={<ArrowUpOutlined />}
            />
          </Col>
        </Row>
      </div>
    </Card>
  );
};

export default PerformanceMetrics;