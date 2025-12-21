import React from 'react';
import { Row, Col } from 'antd';
import {
  LaptopOutlined,
  CheckCircleOutlined,
  StarOutlined,
  TrophyOutlined,
} from '@ant-design/icons';
import StatCard from './StatCard';

const StatisticsGrid = ({ stats }) => {
  const cardConfigs = [
    {
      title: 'Applications',
      value: stats?.totalApplications || 0,
      active: stats?.activeApplications || 0,
      icon: <LaptopOutlined />,
      iconBg: 'bg-purple-400',
      description: 'Active',
    },
    {
      title: 'Selected',
      value: stats?.totalApplications || 0,
      active: stats?.selectedApplications || 0,
      icon: <CheckCircleOutlined />,
      iconBg: 'bg-green-400',
      description: 'Selected',
    },
    {
      title: 'Internships',
      value: stats?.totalInternships || stats?.activeApplications || 0,
      active: stats?.completedInternships || 0,
      icon: <StarOutlined />,
      iconBg: 'bg-pink-400',
      description: 'Completed',
    },
    {
      title: 'Achievements',
      value: stats?.totalAchievements || 0,
      active: stats?.earnedAchievements || 0,
      icon: <TrophyOutlined />,
      iconBg: 'bg-cyan-400',
      description: 'Earned',
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