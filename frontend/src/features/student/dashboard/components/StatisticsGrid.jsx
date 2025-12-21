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
      title: 'Active Applications',
      value: stats?.totalApplications || 0,
      icon: <LaptopOutlined />,
      bgClass: 'bg-purple-500/10',
      colorClass: 'text-purple-500',
    },
    {
      title: 'Selected',
      value: stats?.selectedApplications || 0,
      icon: <CheckCircleOutlined />,
      bgClass: 'bg-green-500/10',
      colorClass: 'text-green-500',
    },
    {
      title: 'Completed Internships',
      value: stats?.completedInternships || 0,
      icon: <StarOutlined />,
      bgClass: 'bg-pink-500/10',
      colorClass: 'text-pink-500',
    },
    {
      title: 'Achievements',
      value: stats?.totalAchievements || 0,
      icon: <TrophyOutlined />,
      bgClass: 'bg-cyan-500/10',
      colorClass: 'text-cyan-500',
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      {cardConfigs.map((card, idx) => (
        <StatCard key={idx} {...card} />
      ))}
    </div>
  );
};

export default StatisticsGrid;