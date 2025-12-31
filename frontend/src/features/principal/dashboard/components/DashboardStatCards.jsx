import React from 'react';
import { Card, Tooltip, Typography } from 'antd';
import {
  EyeOutlined,
  TeamOutlined,
  UserOutlined,
  WarningOutlined,
  BankOutlined,
  BarChartOutlined,
  FileTextOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined,
} from '@ant-design/icons';

const { Text } = Typography;

// Stat Card Component matching the design
const DashboardStatCard = ({
  title,
  value,
  secondaryValue,
  subtitle,
  icon,
  iconBgColor,
  iconColor,
  valueColor,
  hasViewMore = false,
  onViewMore,
  isWarning = false,
}) => {
  return (
    <Card
      className="h-full border border-gray-100 shadow-sm hover:shadow-md transition-all duration-200 rounded-xl"
      styles={{ body: { padding: '20px 16px' } }}
    >
      <div className="flex flex-col items-center text-center">
        {/* Top row: Icon centered, Eye on right */}
        <div className="w-full flex justify-center relative mb-3">
          <div
            className="w-14 h-14 rounded-full flex items-center justify-center"
            style={{ backgroundColor: iconBgColor }}
          >
            {React.cloneElement(icon, {
              style: { fontSize: '24px', color: iconColor },
            })}
          </div>
          {hasViewMore && (
            <Tooltip title="View Details">
              <button
                onClick={onViewMore}
                className="absolute right-0 top-0 w-6 h-6 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors cursor-pointer border-0 bg-transparent"
                style={{ color: isWarning ? '#ef4444' : '#9ca3af' }}
              >
                <EyeOutlined style={{ fontSize: '14px' }} />
              </button>
            </Tooltip>
          )}
        </div>

        {/* Title */}
        <Text className="text-sm font-medium text-gray-700 mb-2">{title}</Text>

        {/* Value */}
        <div className="flex items-baseline justify-center gap-1 mb-1">
          <span
            style={{
              fontSize: '32px',
              fontWeight: 700,
              color: valueColor,
              lineHeight: 1,
            }}
          >
            {value}
          </span>
          {secondaryValue !== undefined && (
            <>
              <span style={{ fontSize: '20px', color: '#d1d5db', fontWeight: 500 }}>/</span>
              <span style={{ fontSize: '20px', fontWeight: 600, color: '#6b7280' }}>
                {secondaryValue}
              </span>
            </>
          )}
        </div>

        {/* Subtitle */}
        {subtitle && (
          <Text className="text-xs text-gray-500">{subtitle}</Text>
        )}
      </div>
    </Card>
  );
};

// Basic Statistics Grid (First Row)
export const BasicStatisticsGrid = ({
  totalStudents = 0,
  totalMentors = 0,
  unassignedStudents = 0,
  partnerCompanies = 0,
  loading = false,
  onViewStudents,
  onViewMentors,
  onViewUnassigned,
  onViewCompanies,
}) => {
  const cards = [
    {
      title: 'Total Students',
      value: totalStudents,
      subtitle: 'Overall enrolled strength',
      icon: <TeamOutlined />,
      iconBgColor: '#dbeafe',
      iconColor: '#3b82f6',
      valueColor: '#3b82f6',
      hasViewMore: true,
      onViewMore: onViewStudents,
    },
    {
      title: 'Total Mentors',
      value: totalMentors,
      subtitle: 'Active mentor profiles',
      icon: <UserOutlined />,
      iconBgColor: '#dcfce7',
      iconColor: '#22c55e',
      valueColor: '#22c55e',
      hasViewMore: true,
      onViewMore: onViewMentors,
    },
    {
      title: 'Un-assigned Students',
      value: unassignedStudents,
      subtitle: 'Awaiting mentor assignment',
      icon: <WarningOutlined />,
      iconBgColor: '#fee2e2',
      iconColor: '#ef4444',
      valueColor: '#ef4444',
      hasViewMore: true,
      onViewMore: onViewUnassigned,
      isWarning: true,
    },
    {
      title: 'Partner Companies',
      value: partnerCompanies,
      subtitle: 'Active industry engagements',
      icon: <BankOutlined />,
      iconBgColor: '#f3e8ff',
      iconColor: '#9333ea',
      valueColor: '#9333ea',
      hasViewMore: true,
      onViewMore: onViewCompanies,
    },
  ];

  if (loading) {
    return (
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, idx) => (
          <Card key={idx} className="h-32 border-gray-100 shadow-sm rounded-xl" loading />
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map((card, idx) => (
        <DashboardStatCard key={idx} {...card} />
      ))}
    </div>
  );
};

// Submission & Status Overview Grid (Second Row)
export const SubmissionStatusGrid = ({
  monthlyReports = { submitted: 0, total: 0, pending: 0 },
  joiningLetters = { submitted: 0, total: 0, pendingPercent: 0 },
  facultyVisits = { completed: 0, total: 0, pending: 0 },
  grievances = { total: 0, unaddressed: 0 },
  loading = false,
  onViewReports,
  onViewJoiningLetters,
  onViewVisits,
  onViewGrievances,
}) => {
  const currentMonth = new Date().toLocaleDateString('en-US', { month: 'short', year: 'numeric' });

  const completionPercent = (submitted, total) => {
    if (total === 0) return 0;
    return Math.round((submitted / total) * 100);
  };

  const cards = [
    {
      title: `Monthly Reports - ${currentMonth}`,
      value: monthlyReports.submitted,
      secondaryValue: monthlyReports.total,
      subtitle: (
        <div className="flex flex-col items-center gap-0.5">
          {monthlyReports.pending > 0 && (
            <span className="text-red-500 font-medium">{monthlyReports.pending} pending</span>
          )}
          <span>{completionPercent(monthlyReports.submitted, monthlyReports.total)}% completion</span>
        </div>
      ),
      icon: <BarChartOutlined />,
      iconBgColor: '#f3e8ff',
      iconColor: '#9333ea',
      valueColor: '#9333ea',
      hasViewMore: true,
      onViewMore: onViewReports,
    },
    {
      title: 'Joining Letters',
      value: joiningLetters.submitted,
      secondaryValue: joiningLetters.total,
      subtitle: `${joiningLetters.pendingPercent}% pending`,
      icon: <FileTextOutlined />,
      iconBgColor: '#dbeafe',
      iconColor: '#3b82f6',
      valueColor: '#3b82f6',
      hasViewMore: true,
      onViewMore: onViewJoiningLetters,
    },
    {
      title: `Faculty Visits - ${currentMonth}`,
      value: facultyVisits.completed,
      secondaryValue: facultyVisits.total,
      subtitle: (
        <div className="flex flex-col items-center gap-0.5">
          {facultyVisits.pending > 0 && (
            <span className="text-red-500 font-medium">{facultyVisits.pending} pending</span>
          )}
          <span>{completionPercent(facultyVisits.completed, facultyVisits.total)}% completion</span>
        </div>
      ),
      icon: <CheckCircleOutlined />,
      iconBgColor: '#fef9c3',
      iconColor: '#eab308',
      valueColor: '#eab308',
      hasViewMore: true,
      onViewMore: onViewVisits,
    },
    {
      title: 'Student Grievances',
      value: (
        <span>
          {grievances.total}
          <span className="text-lg text-gray-400 ml-1">({grievances.unaddressed})</span>
        </span>
      ),
      subtitle: 'Total (Unaddressed)',
      icon: <ExclamationCircleOutlined />,
      iconBgColor: '#fee2e2',
      iconColor: '#ef4444',
      valueColor: '#ef4444',
      hasViewMore: true,
      onViewMore: onViewGrievances,
      isWarning: grievances.unaddressed > 0,
    },
  ];

  if (loading) {
    return (
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, idx) => (
          <Card key={idx} className="h-40 border-gray-100 shadow-sm rounded-xl" loading />
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map((card, idx) => (
        <DashboardStatCard key={idx} {...card} />
      ))}
    </div>
  );
};

export default DashboardStatCard;
