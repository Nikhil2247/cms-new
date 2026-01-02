import React, { useState, useMemo } from 'react';
import { Card, Tooltip } from 'antd';
import {
  TeamOutlined,
  FileTextOutlined,
  VideoCameraOutlined,
  ExclamationCircleOutlined,
  EyeOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
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

  // Get current month start and formatted name
  const currentMonthStart = useMemo(() => dayjs().startOf('month'), []);
  const currentMonthEnd = useMemo(() => dayjs().endOf('month'), []);
  const currentMonthName = useMemo(() => dayjs().format('MMMM YYYY'), []);

  // Helper function to check if a student's internship is active in the current month
  const isInternshipActiveInCurrentMonth = useMemo(() => (student) => {
    // Get internship from various possible locations in the data structure
    const internship = student.activeInternship ||
                       student.internship ||
                       student.application?.internship ||
                       student.applications?.[0]?.internship ||
                       student.applications?.[0];

    // If no internship data, check if student has active status
    if (!internship) {
      // Fall back to checking student's hasActiveInternship flag or similar
      return student.hasActiveInternship || student.isActive || false;
    }

    // Get dates from internship or application level
    const startDateStr = internship.startDate || student.application?.startDate || student.applications?.[0]?.startDate;
    const endDateStr = internship.endDate || student.application?.endDate || student.applications?.[0]?.endDate;

    // If no dates, assume active if internship exists
    if (!startDateStr || !endDateStr) {
      return true;
    }

    const startDate = dayjs(startDateStr);
    const endDate = dayjs(endDateStr);

    if (!startDate.isValid() || !endDate.isValid()) {
      return true; // Assume active if dates are invalid
    }

    // Check if internship overlaps with current month
    const startsBeforeOrDuringMonth = startDate.isBefore(currentMonthEnd) || startDate.isSame(currentMonthEnd, 'day');

    // Apply the 5-day rule for end date
    let effectiveEndDate = endDate;
    if (endDate.date() <= 5) {
      effectiveEndDate = endDate.subtract(1, 'month').endOf('month');
    }

    const endsAfterOrDuringMonth = effectiveEndDate.isAfter(currentMonthStart) || effectiveEndDate.isSame(currentMonthStart, 'month');

    return startsBeforeOrDuringMonth && endsAfterOrDuringMonth;
  }, [currentMonthStart, currentMonthEnd]);

  // Get students with active internships in current month
  const studentsActiveThisMonth = useMemo(() => {
    const activeStudents = students.filter(student => isInternshipActiveInCurrentMonth(student));
    // If no students pass the filter, use all students as fallback
    return activeStudents.length > 0 ? activeStudents : students;
  }, [students, isInternshipActiveInCurrentMonth]);

  // Filter reports for current month
  const currentMonthReports = useMemo(() => {
    return monthlyReports.filter(r => {
      const reportDate = dayjs(r.reportMonth || r.createdAt);
      return reportDate.isSame(currentMonthStart, 'month');
    });
  }, [monthlyReports, currentMonthStart]);

  // Calculate approved reports for current month
  const approvedReportsCount = useMemo(() => {
    return currentMonthReports.filter(r => r.status === 'APPROVED').length;
  }, [currentMonthReports]);

  // Filter visit logs for current month
  const currentMonthVisitLogs = useMemo(() => {
    return visitLogs.filter(v => {
      const visitDate = dayjs(v.visitDate || v.createdAt);
      return visitDate.isSame(currentMonthStart, 'month');
    });
  }, [visitLogs, currentMonthStart]);

  // Total students
  const totalStudents = stats.totalStudents || students.length || 0;

  // Expected total for current month - students with active internships
  const expectedTotal = studentsActiveThisMonth.length || totalStudents;

  // Get grievance stats from API
  const pendingGrievances = stats.pendingGrievances || 0;
  const totalGrievances = stats.totalGrievances || 0;

  const cardConfigs = [
    {
      title: 'Assigned Students',
      value: totalStudents,
      icon: <TeamOutlined />,
      iconBgColor: '#dbeafe',
      iconColor: '#3b82f6',
      valueColor: '#3b82f6',
      subtitle: `${expectedTotal} active this month`,
    },
    {
      title: 'Monthly Reports',
      value: approvedReportsCount,
      secondaryValue: expectedTotal,
      icon: <FileTextOutlined />,
      iconBgColor: '#f3e8ff',
      iconColor: '#9333ea',
      valueColor: '#9333ea',
      subtitle: `Approved - ${currentMonthName}`,
      hasViewMore: true,
      onViewMore: () => setMonthlyReportsModalVisible(true),
    },
    {
      title: 'Visit Logs',
      value: currentMonthVisitLogs.length,
      secondaryValue: expectedTotal,
      icon: <VideoCameraOutlined />,
      iconBgColor: '#d1fae5',
      iconColor: '#10b981',
      valueColor: '#10b981',
      subtitle: `Completed - ${currentMonthName}`,
      hasViewMore: true,
      onViewMore: () => setVisitLogsModalVisible(true),
    },
    {
      title: 'Grievances',
      value: pendingGrievances,
      secondaryValue: totalGrievances,
      icon: <ExclamationCircleOutlined />,
      iconBgColor: '#fee2e2',
      iconColor: '#ef4444',
      valueColor: '#ef4444',
      subtitle: pendingGrievances === 0 ? 'No pending issues' : 'Pending resolution',
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
