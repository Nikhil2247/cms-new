import React from 'react';
import { Row, Col } from 'antd';
import {
  LaptopOutlined,
  CheckCircleOutlined,
  StarOutlined,
  RocketOutlined,
} from '@ant-design/icons';
import StatCard from './StatCard';

const StatisticsGrid = ({ stats }) => {
  // FIXED: Improved fallback logic with null-safe access
  const safeStats = stats || {};

  const cardConfigs = [
    {
      title: 'Total Applications',
      value: safeStats.totalApplications ?? 0,
      icon: <LaptopOutlined />,
      bgClass: 'bg-purple-500/10',
      colorClass: 'text-purple-500',
    },
    {
      title: 'Ongoing Internships',
      // FIXED: Better fallback chain with explicit check
      value: safeStats.ongoingInternships ?? safeStats.selectedApplications ?? 0,
      icon: <CheckCircleOutlined />,
      bgClass: 'bg-green-500/10',
      colorClass: 'text-green-500',
    },
    {
      title: 'Completed',
      value: safeStats.completedInternships ?? 0,
      icon: <StarOutlined />,
      bgClass: 'bg-pink-500/10',
      colorClass: 'text-pink-500',
    },
    {
      title: 'Self-Identified',
      value: safeStats.selfIdentifiedCount ?? 0,
      icon: <RocketOutlined />,
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