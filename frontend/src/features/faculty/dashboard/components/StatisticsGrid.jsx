import React, { useState, useMemo } from 'react';
import { Card, Tooltip } from 'antd';
import {
  TeamOutlined,
  FileTextOutlined,
  VideoCameraOutlined,
  EyeOutlined,
} from '@ant-design/icons';
import MonthlyReportsOverviewModal from './MonthlyReportsOverviewModal';
import VisitLogsOverviewModal from './VisitLogsOverviewModal';

// Compact Stat Card Component
const StatCard = ({
  title,
  value,
  secondaryValue,
  icon,
  iconBgColor,
  iconColor,
  valueColor,
  subtitle,
  hasViewMore,
  onViewMore,
}) => {
  return (
    <Card
      className="!rounded-lg border !border-gray-100 hover:shadow-md transition-all duration-200 h-full relative"
      bodyStyle={{ padding: '14px 16px' }}
      size="small"
    >
      <div className="flex items-center gap-3">
        {/* Icon */}
        <div
          className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
          style={{ backgroundColor: iconBgColor }}
        >
          {React.cloneElement(icon, {
            style: { fontSize: '18px', color: iconColor },
          })}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="text-[10px] font-semibold uppercase tracking-wide text-gray-400 mb-0.5 truncate">
            {title}
          </div>
          <div className="flex items-baseline gap-1">
            {secondaryValue !== undefined ? (
              <>
                <span style={{ fontSize: '20px', fontWeight: 700, color: valueColor, lineHeight: 1 }}>
                  {value}
                </span>
                <span style={{ fontSize: '14px', color: '#d1d5db' }}>/</span>
                <span style={{ fontSize: '14px', fontWeight: 600, color: '#9ca3af' }}>
                  {secondaryValue}
                </span>
              </>
            ) : (
              <span style={{ fontSize: '20px', fontWeight: 700, color: valueColor, lineHeight: 1 }}>
                {value}
              </span>
            )}
          </div>
          {subtitle && (
            <div className="text-[10px] text-gray-400 mt-0.5 truncate">{subtitle}</div>
          )}
        </div>

        {/* Eye Icon for View More */}
        {hasViewMore && (
          <Tooltip title="View Details">
            <button
              onClick={onViewMore}
              className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors cursor-pointer border-0 bg-transparent flex-shrink-0"
            >
              <EyeOutlined style={{ fontSize: '14px', color: '#9ca3af' }} />
            </button>
          </Tooltip>
        )}
      </div>
    </Card>
  );
};

const StatisticsGrid = ({ stats = {}, students = [], monthlyReports = [], visitLogs = [] }) => {
  const [monthlyReportsModalVisible, setMonthlyReportsModalVisible] = useState(false);
  const [visitLogsModalVisible, setVisitLogsModalVisible] = useState(false);

  // Calculate pending monthly reports
  const pendingReportsCount = useMemo(() => {
    return monthlyReports.filter(r => r.status === 'DRAFT' || r.status === 'PENDING').length;
  }, [monthlyReports]);

  // Calculate submitted/approved reports
  const submittedReports = useMemo(() => {
    return monthlyReports.filter(r => r.status === 'APPROVED' || r.status === 'SUBMITTED').length;
  }, [monthlyReports]);

  // Total students
  const totalStudents = stats.totalStudents || students.length || 0;
  const activeInternships = stats.activeInternships || stats.activeStudents || 0;

  // Expected total (for denominator)
  const expectedTotal = totalStudents * 6;

  const cardConfigs = [
    {
      title: 'Assigned Students',
      value: totalStudents,
      icon: <TeamOutlined />,
      iconBgColor: '#dbeafe',
      iconColor: '#3b82f6',
      valueColor: '#3b82f6',
      subtitle: `${activeInternships} active internships`,
    },
    {
      title: 'Monthly Reports',
      value: submittedReports,
      secondaryValue: expectedTotal,
      icon: <FileTextOutlined />,
      iconBgColor: '#f3e8ff',
      iconColor: '#9333ea',
      valueColor: '#9333ea',
      subtitle: pendingReportsCount > 0 ? `${pendingReportsCount} pending` : 'All submitted',
      hasViewMore: true,
      onViewMore: () => setMonthlyReportsModalVisible(true),
    },
    {
      title: 'Visit Logs',
      value: visitLogs.length,
      secondaryValue: expectedTotal,
      icon: <VideoCameraOutlined />,
      iconBgColor: '#d1fae5',
      iconColor: '#10b981',
      valueColor: '#10b981',
      subtitle: `${totalStudents} students to visit`,
      hasViewMore: true,
      onViewMore: () => setVisitLogsModalVisible(true),
    },
    {
      title: 'Pending Reports',
      value: stats.pendingMonthlyReports || pendingReportsCount,
      icon: <FileTextOutlined />,
      iconBgColor: '#fef3c7',
      iconColor: '#f59e0b',
      valueColor: '#f59e0b',
      subtitle: pendingReportsCount === 0 ? 'All clear' : 'Awaiting submission',
      hasViewMore: true,
      onViewMore: () => setMonthlyReportsModalVisible(true),
    },
  ];

  return (
    <>
      <div className="grid grid-cols-2 lg:grid-cols-4 !gap-3 !mb-6">
        {cardConfigs.map((card, idx) => (
          <StatCard key={idx} {...card} />
        ))}
      </div>

      {/* Monthly Reports Overview Modal */}
      <MonthlyReportsOverviewModal
        visible={monthlyReportsModalVisible}
        onClose={() => setMonthlyReportsModalVisible(false)}
        students={students}
        monthlyReports={monthlyReports}
      />

      {/* Visit Logs Overview Modal */}
      <VisitLogsOverviewModal
        visible={visitLogsModalVisible}
        onClose={() => setVisitLogsModalVisible(false)}
        students={students}
        visitLogs={visitLogs}
      />
    </>
  );
};

export default StatisticsGrid;
