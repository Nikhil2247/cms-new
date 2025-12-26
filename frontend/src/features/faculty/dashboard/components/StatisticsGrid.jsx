import React from 'react';
import { Card } from 'antd';
import {
  TeamOutlined,
  FileTextOutlined,
  CheckCircleOutlined,
  CalendarOutlined,
} from '@ant-design/icons';

const StatCard = ({ title, value, icon, colorClass, bgClass }) => {
  return (
    <Card size="small" className="rounded-xl border-border hover:shadow-md transition-all h-full">
      <div className="flex items-center gap-3">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${bgClass} ${colorClass}`}>
          {React.cloneElement(icon, { style: { fontSize: '18px' } })}
        </div>
        <div>
          <div className="text-2xl font-bold text-text-primary">
            {value || 0}
          </div>
          <div className="text-[10px] uppercase font-bold text-text-tertiary">{title}</div>
        </div>
      </div>
    </Card>
  );
};

const StatisticsGrid = ({ stats }) => {
  const cardConfigs = [
    {
      title: 'Assigned Students',
      value: stats?.totalStudents || 0,
      icon: <TeamOutlined />,
      colorClass: 'text-primary',
      bgClass: 'bg-primary/10',
    },
    {
      title: 'Active Internships',
      value: stats?.activeInternships || 0,
      icon: <CheckCircleOutlined />,
      colorClass: 'text-success',
      bgClass: 'bg-success/10',
    },
    {
      title: 'Pending Reports',
      value: stats?.pendingReports || 0,
      icon: <FileTextOutlined />,
      colorClass: 'text-warning',
      bgClass: 'bg-warning/10',
    },
    {
      title: 'Total Visits',
      value: stats?.totalVisits || stats?.completedVisits || 0,
      icon: <CalendarOutlined />,
      colorClass: 'text-info',
      bgClass: 'bg-info/10',
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