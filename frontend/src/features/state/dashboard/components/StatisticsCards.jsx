import React, { useState } from 'react';
import { Card, Col, Row, Progress, Tooltip, theme, Modal, Statistic, Divider, Badge, Space, Typography, Button } from 'antd';
import {
  BankOutlined,
  TeamOutlined,
  UserOutlined,
  BookOutlined,
  CheckCircleOutlined,
  EyeOutlined,
  UserSwitchOutlined,
  CalendarOutlined,
  FileTextOutlined,
  WarningOutlined,
  ClockCircleOutlined,
  RiseOutlined,
} from '@ant-design/icons';

const { Text, Title } = Typography;

// Simple stat card for primary metrics
const StatCard = ({ title, value, subtitle, icon, colorClass, bgClass, badge }) => {
  return (
    <Card className="rounded-xl border-border shadow-sm hover:shadow-md transition-all h-full bg-surface" styles={{ body: { padding: '16px' } }}>
      <div className="flex items-center gap-4">
        <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${bgClass} ${colorClass}`}>
          {React.cloneElement(icon, { style: { fontSize: '24px' } })}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex justify-between items-start">
            <Text className="text-text-tertiary text-xs font-bold uppercase tracking-wider block mb-0.5">{title}</Text>
            {badge > 0 && <Badge count={badge} style={{ backgroundColor: 'rgb(var(--color-primary))', boxShadow: 'none' }} />}
          </div>
          <div className="text-2xl font-black text-text-primary leading-tight">
            {value?.toLocaleString() || 0}
          </div>
          {subtitle && (
            <Text className="text-text-secondary text-xs mt-1 block truncate">{subtitle}</Text>
          )}
        </div>
      </div>
    </Card>
  );
};

// Enhanced card for detailed stats with eye icon modal
const DetailedStatCard = ({
  title,
  mainValue,
  mainLabel,
  secondaryValue,
  secondaryLabel,
  icon,
  colorClass,
  bgClass,
  details,
  badgeCount,
  badgeStatus = 'warning',
  alertMessage,
}) => {
  const [modalVisible, setModalVisible] = useState(false);

  return (
    <>
      <Card className="rounded-xl border-border shadow-sm hover:shadow-md transition-all h-full bg-surface" styles={{ body: { padding: '16px' } }}>
        <div className="flex items-start gap-4">
          <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${bgClass} ${colorClass}`}>
            {React.cloneElement(icon, { style: { fontSize: '24px' } })}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex justify-between items-start mb-2">
              <Text className="text-text-tertiary text-xs font-bold uppercase tracking-wider">{title}</Text>
              <Tooltip title="View Details">
                <Button 
                  type="text" 
                  size="small" 
                  icon={<EyeOutlined className="text-text-tertiary hover:text-primary" />} 
                  onClick={() => setModalVisible(true)} 
                  className="rounded-lg w-6 h-6 flex items-center justify-center"
                />
              </Tooltip>
            </div>
            
            <div className="flex items-end gap-4 mb-3">
              <div>
                <div className="text-2xl font-black text-text-primary leading-none">{mainValue?.toLocaleString() || 0}</div>
                <div className="text-text-tertiary text-[10px] uppercase font-bold mt-1">{mainLabel}</div>
              </div>
              <div className="h-8 w-px bg-border mx-2"></div>
              <div>
                <div className="text-xl font-bold text-text-secondary leading-none">{secondaryValue?.toLocaleString() || 0}</div>
                <div className="text-text-tertiary text-[10px] uppercase font-bold mt-1">{secondaryLabel}</div>
              </div>
            </div>

            {alertMessage && (
              <div className="flex items-center gap-2 text-xs bg-warning/10 text-warning-700 px-2 py-1 rounded-md border border-warning/20">
                <WarningOutlined className="text-warning" />
                <span className="font-medium truncate">{alertMessage}</span>
              </div>
            )}
            
            {!alertMessage && details && (
              <div className="grid grid-cols-2 gap-x-4 gap-y-1 mt-2">
                {details.slice(0, 2).map((detail, idx) => (
                  <div key={idx} className="flex justify-between items-center text-xs">
                    <span className="text-text-tertiary truncate">{detail.label}:</span>
                    <span className={`font-semibold ${detail.highlight ? 'text-warning' : 'text-text-primary'}`}>
                      {detail.value}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </Card>

      <Modal
        title={
          <div className="flex items-center gap-3 py-2">
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${bgClass} ${colorClass}`}>
              {React.cloneElement(icon, { style: { fontSize: '16px' } })}
            </div>
            <span className="text-text-primary font-bold text-lg">{title} Details</span>
          </div>
        }
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        footer={null}
        width={600}
        className="rounded-2xl overflow-hidden"
      >
        <div className="py-4">
          <Row gutter={[16, 16]}>
            {details?.map((detail, idx) => (
              <Col span={12} key={idx}>
                <div className={`p-4 rounded-xl border ${detail.highlight ? 'bg-warning-50 border-warning-200' : 'bg-background-tertiary/30 border-border'}`}>
                  <div className="flex items-center gap-2 mb-2 text-text-tertiary text-xs font-bold uppercase tracking-wider">
                    {detail.icon && React.cloneElement(detail.icon, { className: detail.highlight ? 'text-warning' : 'text-text-secondary' })}
                    {detail.label}
                  </div>
                  <div className={`text-2xl font-black ${detail.highlight ? 'text-warning-700' : 'text-text-primary'}`}>
                    {detail.value}
                  </div>
                </div>
              </Col>
            ))}
          </Row>
        </div>
      </Modal>
    </>
  );
};

const StatisticsCards = ({ stats }) => {
  // Primary metrics
  const totalInstitutions = stats?.institutions?.total ?? 0;
  const activeInstitutions = stats?.institutions?.active ?? totalInstitutions;

  const totalStudents = stats?.students?.total ?? 0;
  const activeStudents = stats?.students?.active ?? totalStudents;

  const totalFaculty = stats?.faculty?.total ?? stats?.totalFaculty ?? 0;
  const activeFaculty = stats?.faculty?.active ?? stats?.activeFaculty ?? totalFaculty;

  // Self-identified internships (main focus)
  const totalInternships = stats?.internships?.total ?? 0;
  const activeInternships = stats?.internships?.active ?? 0;

  // Detailed stats
  const assignments = stats?.assignments || {};
  const facultyVisits = stats?.facultyVisits || {};
  const monthlyReports = stats?.monthlyReports || {};

  // Primary stat cards - focused on core metrics
  const primaryCards = [
    {
      title: 'Institutions',
      value: totalInstitutions,
      subtitle: `${activeInstitutions} active`,
      icon: <BankOutlined />,
      bgClass: 'bg-blue-500/10',
      colorClass: 'text-blue-500',
    },
    {
      title: 'Students',
      value: totalStudents,
      subtitle: `${activeStudents} active`,
      icon: <TeamOutlined />,
      bgClass: 'bg-emerald-500/10',
      colorClass: 'text-emerald-500',
    },
    {
      title: 'Active Internships',
      value: activeInternships,
      subtitle: `${totalInternships} students with approved internships`,
      icon: <BookOutlined />,
      bgClass: 'bg-pink-500/10',
      colorClass: 'text-pink-500',
      badge: activeInternships,
    },
    {
      title: 'Faculty',
      value: totalFaculty,
      subtitle: `${activeFaculty} active mentors`,
      icon: <UserOutlined />,
      bgClass: 'bg-amber-500/10',
      colorClass: 'text-amber-500',
    },
  ];

  // Detailed cards configuration with focus areas
  const detailedCards = [
    {
      title: 'Mentor Assignments',
      mainValue: assignments?.assigned || 0,
      mainLabel: 'Assigned',
      secondaryValue: assignments?.unassigned || 0,
      secondaryLabel: 'Unassigned',
      icon: <UserSwitchOutlined />,
      bgClass: 'bg-purple-500/10',
      colorClass: 'text-purple-500',
      badgeCount: assignments?.unassigned || 0,
      badgeStatus: 'warning',
      alertMessage: assignments?.unassigned > 0 ? `${assignments.unassigned} students need mentor assignment` : null,
      details: [
        { label: 'Total Students', value: assignments?.totalStudents || totalStudents || 0, icon: <TeamOutlined /> },
        { label: 'Students with Mentors', value: assignments?.assigned || 0, icon: <CheckCircleOutlined /> },
        { label: 'Students with no Mentor', value: assignments?.unassigned || 0, icon: <WarningOutlined />, highlight: (assignments?.unassigned || 0) > 0 },
        { label: 'Total Internships', value: assignments?.studentsWithInternships || 0, icon: <BookOutlined /> },
        { label: 'Internships with Mentors', value: assignments?.internshipsWithMentors || 0, icon: <CheckCircleOutlined /> },
        { label: 'Internships without Mentors', value: assignments?.internshipsWithoutMentors || 0, icon: <WarningOutlined />, highlight: (assignments?.internshipsWithoutMentors || 0) > 0 },
      ],
    },
    {
      title: 'Faculty Visits',
      mainValue: facultyVisits?.thisMonth || 0,
      mainLabel: 'This Month',
      secondaryValue: facultyVisits?.pendingThisMonth || 0,
      secondaryLabel: 'Pending',
      icon: <CalendarOutlined />,
      bgClass: 'bg-cyan-500/10',
      colorClass: 'text-cyan-500',
      badgeCount: facultyVisits?.pendingThisMonth || 0,
      badgeStatus: 'processing',
      alertMessage: facultyVisits?.pendingThisMonth > 0 ? `${facultyVisits.pendingThisMonth} visits pending this month` : null,
      details: [
        { label: 'Total Visits', value: facultyVisits?.total || 0, icon: <CalendarOutlined /> },
        { label: 'This Month', value: facultyVisits?.thisMonth || 0, icon: <CheckCircleOutlined /> },
        { label: 'Last Month', value: facultyVisits?.lastMonth || 0, icon: <ClockCircleOutlined /> },
        { label: 'Expected This Month', value: facultyVisits?.expectedThisMonth || 0, icon: <TeamOutlined /> },
        { label: 'Pending This Month', value: facultyVisits?.pendingThisMonth || 0, icon: <WarningOutlined />, highlight: (facultyVisits?.pendingThisMonth || 0) > 0 },
        { label: 'Completion Rate', value: `${facultyVisits?.completionRate || 0}%`, icon: <RiseOutlined /> },
      ],
    },
    {
      title: 'Monthly Reports',
      mainValue: monthlyReports?.thisMonth || 0,
      mainLabel: 'Submitted',
      secondaryValue: monthlyReports?.missingThisMonth || 0,
      secondaryLabel: 'Missing',
      icon: <FileTextOutlined />,
      bgClass: 'bg-orange-500/10',
      colorClass: 'text-orange-500',
      badgeCount: monthlyReports?.missingThisMonth || 0,
      badgeStatus: 'error',
      alertMessage: monthlyReports?.missingThisMonth > 0 ? `${monthlyReports.missingThisMonth} reports missing this month` : null,
      details: [
        { label: 'Total Submitted', value: monthlyReports?.total || 0, icon: <FileTextOutlined /> },
        { label: 'Submitted This Month', value: monthlyReports?.thisMonth || 0, icon: <CheckCircleOutlined /> },
        { label: 'Submitted Last Month', value: monthlyReports?.lastMonth || 0, icon: <ClockCircleOutlined /> },
        { label: 'Pending Review', value: monthlyReports?.pendingReview || 0, icon: <ClockCircleOutlined /> },
        { label: 'Expected This Month', value: monthlyReports?.expectedThisMonth || 0, icon: <TeamOutlined /> },
        { label: 'Missing This Month', value: monthlyReports?.missingThisMonth || 0, icon: <WarningOutlined />, highlight: (monthlyReports?.missingThisMonth || 0) > 0 },
        { label: 'Submission Rate', value: `${monthlyReports?.submissionRate || 0}%`, icon: <RiseOutlined /> },
      ],
    },
  ];

  return (
    <div className="space-y-4">
      {/* Primary Stats Row - Core Metrics */}
      <Row gutter={[16, 16]}>
        {primaryCards.map((card, idx) => (
          <Col key={idx} xs={24} sm={12} lg={6}>
            <StatCard {...card} />
          </Col>
        ))}
      </Row>

      {/* Detailed Stats Row - Focus Areas with Eye Icons */}
      <Row gutter={[16, 16]}>
        {detailedCards.map((card, idx) => (
          <Col key={idx} xs={24} sm={24} lg={8}>
            <DetailedStatCard {...card} />
          </Col>
        ))}
      </Row>
    </div>
  );
};

export default StatisticsCards;
