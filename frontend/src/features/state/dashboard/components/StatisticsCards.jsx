import React from 'react';
import { Card, Col, Row, Progress, Tooltip, theme } from 'antd';
import {
  BankOutlined,
  TeamOutlined,
  UserOutlined,
  BookOutlined,
  FileDoneOutlined,
  CheckCircleOutlined,
  ShopOutlined,
  SafetyCertificateOutlined,
  RiseOutlined,
  FallOutlined,
} from '@ant-design/icons';

const StatCard = ({ title, value, icon, gradient, active, total, trend }) => {
  const { token: antToken } = theme.useToken();
  const percentage = total > 0 ? Math.round((active / total) * 100) : 0;

  return (
    <Card className="overflow-hidden h-full border-border" styles={{ body: { padding: 0 } }}>
      <div className="p-4 text-white relative" style={{ background: gradient }}>
        {/* Decorative circles */}
        <div 
          className="absolute top-0 right-0 w-20 h-20 rounded-full opacity-20 bg-white translate-x-1/4 -translate-y-1/4"
        />
        
        <div className="flex justify-between items-center relative z-10">
          <div>
            <div className="text-3xl font-bold">{value?.toLocaleString() || 0}</div>
            <div className="text-xs uppercase tracking-wider opacity-90 font-medium">
              {title}
            </div>
          </div>
          <div className="p-3 rounded-xl backdrop-blur-sm bg-white/20">
            {React.cloneElement(icon, { style: { fontSize: '28px' } })}
          </div>
        </div>
        {trend !== undefined && (
          <div className="mt-2 flex items-center text-xs font-medium opacity-90">
            {trend >= 0 ? (
              <RiseOutlined className="mr-1" />
            ) : (
              <FallOutlined className="mr-1" />
            )}
            <span>{Math.abs(trend)}% from last month</span>
          </div>
        )}
      </div>
      <div className="p-4 bg-background-tertiary">
        <div className="flex justify-between mb-1">
          <span className="text-sm font-medium text-slate-900">Active</span>
          <span className="text-sm font-semibold text-slate-700">
            {active?.toLocaleString() || 0}/{total?.toLocaleString() || 0}
          </span>
        </div>
        <Tooltip title={`${percentage}% active`}>
          <Progress
            percent={percentage}
            showInfo={false}
            size="small"
            strokeColor={antToken.colorPrimary}
          />
        </Tooltip>
      </div>
    </Card>
  );
};

const StatisticsCards = ({ stats }) => {
  const totalInstitutions = stats?.totalInstitutions ?? stats?.institutions?.total ?? 0;
  const activeInstitutions = stats?.activeInstitutions ?? stats?.institutions?.active ?? totalInstitutions;

  const totalStudents = stats?.totalStudents ?? stats?.students?.total ?? 0;
  const activeStudents = stats?.activeStudents ?? stats?.students?.active ?? totalStudents;

  const totalFaculty = stats?.totalFaculty ?? stats?.faculty?.total ?? 0;
  const activeFaculty = stats?.activeFaculty ?? stats?.faculty?.active ?? totalFaculty;

  const totalInternships = stats?.totalInternships ?? stats?.internships?.total ?? 0;
  const activeInternships = stats?.activeInternships ?? stats?.internships?.active ?? 0;

  const totalApplications = stats?.totalApplications ?? stats?.applications?.total ?? 0;
  const acceptedApplications = stats?.acceptedApplications ?? stats?.applications?.accepted ?? 0;

  const totalIndustries = stats?.totalIndustries ?? stats?.industries?.total ?? 0;
  const approvedIndustries = stats?.approvedIndustries ?? stats?.industries?.approved ?? 0;

  const totalVisits = stats?.totalVisits ?? stats?.compliance?.totalVisits ?? 0;
  const pendingReports = stats?.pendingReports ?? stats?.compliance?.pendingReports ?? 0;

  const cardConfigs = [
    {
      title: 'Total Institutions',
      value: totalInstitutions,
      active: activeInstitutions,
      total: totalInstitutions,
      icon: <BankOutlined />,
      gradient: 'linear-gradient(135deg, #3b82f6 0%, #4f46e5 100%)',
      trend: stats?.institutionsTrend,
    },
    {
      title: 'Total Students',
      value: totalStudents,
      active: activeStudents,
      total: totalStudents,
      icon: <TeamOutlined />,
      gradient: 'linear-gradient(135deg, #10b981 0%, #14b8a6 100%)',
      trend: stats?.studentsTrend,
    },
    {
      title: 'Total Faculty',
      value: totalFaculty,
      active: activeFaculty,
      total: totalFaculty,
      icon: <UserOutlined />,
      gradient: 'linear-gradient(135deg, #f59e0b 0%, #ea580c 100%)',
      trend: stats?.facultyTrend,
    },
    {
      title: 'Active Internships',
      value: activeInternships,
      active: stats?.completedInternships || 0,
      total: totalInternships || activeInternships || 0,
      icon: <BookOutlined />,
      gradient: 'linear-gradient(135deg, #ec4899 0%, #db2777 100%)',
      trend: stats?.internshipsTrend,
    },
  ];

  const secondaryConfigs = [
    {
      title: 'Applications',
      value: totalApplications,
      active: acceptedApplications,
      total: totalApplications,
      icon: <FileDoneOutlined />,
      gradient: 'linear-gradient(135deg, #6366f1 0%, #3b82f6 100%)',
    },
    {
      title: 'Accepted',
      value: acceptedApplications,
      active: acceptedApplications,
      total: totalApplications,
      icon: <CheckCircleOutlined />,
      gradient: 'linear-gradient(135deg, #14b8a6 0%, #10b981 100%)',
    },
    {
      title: 'Industries',
      value: totalIndustries,
      active: approvedIndustries,
      total: totalIndustries,
      icon: <ShopOutlined />,
      gradient: 'linear-gradient(135deg, #f59e0b 0%, #ea580c 100%)',
    },
    {
      title: 'Pending Reports',
      value: pendingReports,
      active: totalVisits,
      total: totalVisits,
      icon: <SafetyCertificateOutlined />,
      gradient: 'linear-gradient(135deg, #f43f5e 0%, #e11d48 100%)',
    },
  ];

  return (
    <div className="space-y-4">
      <Row gutter={[16, 16]}>
        {cardConfigs.map((card, idx) => (
          <Col key={idx} xs={24} sm={12} lg={6}>
            <StatCard {...card} />
          </Col>
        ))}
      </Row>

      <Row gutter={[16, 16]}>
        {secondaryConfigs.map((card, idx) => (
          <Col key={idx} xs={24} sm={12} lg={6}>
            <StatCard {...card} />
          </Col>
        ))}
      </Row>
    </div>
  );
};

export default StatisticsCards;