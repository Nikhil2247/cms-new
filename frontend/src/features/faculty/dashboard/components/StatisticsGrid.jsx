import React from 'react';
import { Row, Col, Card, Progress, theme } from 'antd';
import {
  TeamOutlined,
  FileTextOutlined,
  CheckCircleOutlined,
  CalendarOutlined,
} from '@ant-design/icons';

const StatCard = ({ title, value, icon, gradient, active, total }) => {
  const { token } = theme.useToken();
  
  return (
    <Card className="overflow-hidden h-full border-border" styles={{ body: { padding: 0 } }}>
      <div className="p-4 text-white relative" style={{ background: gradient }}>
        {/* Decorative circles */}
        <div 
          className="absolute top-0 right-0 w-20 h-20 rounded-full opacity-20 bg-white translate-x-1/4 -translate-y-1/4"
        />
        
        <div className="flex justify-between items-center relative z-10">
          <div>
            <div className="text-3xl font-bold mb-1">{value || 0}</div>
            <div className="text-sm uppercase tracking-wider opacity-90 font-medium">{title}</div>
          </div>
          <div className="p-3 rounded-xl backdrop-blur-sm bg-white/20">
            {React.cloneElement(icon, { style: { fontSize: '24px' } })}
          </div>
        </div>
      </div>
      <div className="p-4 bg-background-tertiary">
        <div className="flex justify-between mb-1">
          <span className="text-sm font-medium text-text-primary">Progress</span>
          <span className="text-sm font-semibold text-text-secondary">
            {active || 0}/{total || value || 0}
          </span>
        </div>
        <Progress
          percent={total > 0 ? Math.round((active / total) * 100) : 0}
          showInfo={false}
          strokeColor={token.colorPrimary}
          size="small"
        />
      </div>
    </Card>
  );
};

const StatisticsGrid = ({ stats }) => {
  const cardConfigs = [
    {
      title: 'Assigned Students',
      value: stats?.totalStudents || 0,
      active: stats?.activeStudents || stats?.totalStudents || 0,
      total: stats?.totalStudents || 0,
      icon: <TeamOutlined />,
      gradient: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    },
    {
      title: 'Pending Reports',
      value: stats?.pendingReports || 0,
      active: stats?.reviewedReports || 0,
      total: stats?.totalReports || stats?.pendingReports || 0,
      icon: <FileTextOutlined />,
      gradient: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
    },
    {
      title: 'Visits Completed',
      value: stats?.completedVisits || 0,
      active: stats?.completedVisits || 0,
      total: stats?.totalVisits || stats?.completedVisits || 0,
      icon: <CalendarOutlined />,
      gradient: 'linear-gradient(135deg, #11998e 0%, #38ef7d 100%)',
    },
    {
      title: 'Approvals Pending',
      value: stats?.pendingApprovals || 0,
      active: stats?.approvedApplications || 0,
      total: stats?.totalApplications || stats?.pendingApprovals || 0,
      icon: <CheckCircleOutlined />,
      gradient: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
    },
  ];

  return (
    <Row gutter={[16, 16]} className="mb-6">
      {cardConfigs.map((card, idx) => (
        <Col key={idx} xs={24} sm={12} lg={6}>
          <StatCard {...card} />
        </Col>
      ))}
    </Row>
  );
};

export default StatisticsGrid;