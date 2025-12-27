import React, { memo } from 'react';
import { Card, Typography, Tag, Button, Avatar, Progress, Spin, Empty } from 'antd';
import {
  BankOutlined,
  CalendarOutlined,
  EnvironmentOutlined,
  UserOutlined,
  ClockCircleOutlined,
  RightOutlined,
  LoadingOutlined,
  TrophyOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';

const { Title, Text } = Typography;

const ActiveInternshipCard = ({
  internship,
  onViewDetails,
  loading = false,
  studentMentor = null, // Fallback mentor from student's mentorAssignments
}) => {
  // Show loading state
  if (loading) {
    return (
      <Card bordered={false} className="h-full rounded-2xl border border-gray-100 shadow-sm bg-white">
        <div className="flex flex-col items-center justify-center py-20">
          <Spin indicator={<LoadingOutlined style={{ fontSize: 40 }} spin />} />
          <Text className="mt-4 text-gray-400 font-medium">Loading internship details...</Text>
        </div>
      </Card>
    );
  }

  // Show empty state
  if (!internship) {
    return (
      <Card bordered={false} className="h-full rounded-2xl border border-gray-100 shadow-sm bg-white hover:shadow-md transition-all duration-300">
        <div className="flex flex-col items-center justify-center h-full py-12 px-6">
          <div className="w-20 h-20 bg-background-secondary rounded-full flex items-center justify-center mb-6">
            <TrophyOutlined className="text-3xl text-gray-300" />
          </div>
          <Title level={4} className="!mb-2 text-center text-gray-900">No Active Internship</Title>
          <Text className="text-gray-500 text-center mb-8 max-w-xs">
            Start your career journey by applying for internships or adding a self-identified one.
          </Text>
          <Button 
            type="primary" 
            size="large"
            onClick={() => window.location.href = '/internships'}
            className="rounded-xl px-8 h-11 bg-blue-600 hover:bg-blue-500 shadow-lg shadow-blue-200"
          >
            Browse Opportunities
          </Button>
        </div>
      </Card>
    );
  }

  // Handle self-identified vs regular internships
  const isSelfIdentified = internship.isSelfIdentified || !internship.internshipId;

  const company = isSelfIdentified
    ? { companyName: internship.companyName, city: internship.companyAddress?.split(',')[0] }
    : (internship.internship?.industry || internship.industry || {});

  const startDate = internship.joiningDate || internship.startDate || internship.internship?.startDate;
  const endDate = internship.endDate || internship.internship?.endDate;
  const duration = internship.internshipDuration || internship.internship?.duration;

  // Calculate progress
  const totalDays = endDate && startDate ? dayjs(endDate).diff(dayjs(startDate), 'day') : 0;
  const daysCompleted = startDate ? Math.max(0, dayjs().diff(dayjs(startDate), 'day')) : 0;
  const daysRemaining = totalDays > 0 ? Math.max(0, totalDays - daysCompleted) : 0;
  const progressPercent = totalDays > 0 ? Math.min(Math.round((daysCompleted / totalDays) * 100), 100) : 0;

  const getStatusConfig = (status) => {
    const configs = {
      SELECTED: { color: 'green', label: 'Selected', bg: 'bg-green-50', text: 'text-green-600', border: 'border-green-200' },
      APPROVED: { color: 'green', label: isSelfIdentified ? 'Active' : 'Approved', bg: 'bg-green-50', text: 'text-green-600', border: 'border-green-200' },
      JOINED: { color: 'purple', label: 'Ongoing', bg: 'bg-purple-50', text: 'text-purple-600', border: 'border-purple-200' },
      COMPLETED: { color: 'cyan', label: 'Completed', bg: 'bg-cyan-50', text: 'text-cyan-600', border: 'border-cyan-200' },
    };
    return configs[status] || { color: 'blue', label: status, bg: 'bg-blue-50', text: 'text-blue-600', border: 'border-blue-200' };
  };

  const statusConfig = getStatusConfig(internship.status);

  return (
    <Card
      bordered={false}
      className="h-full rounded-2xl border border-gray-100 bg-white shadow-sm hover:shadow-md transition-all duration-300 group"
      styles={{ body: { padding: '24px', display: 'flex', flexDirection: 'column', height: '100%' } }}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div className="flex items-start gap-4">
          <div className="w-14 h-14 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 shrink-0">
            {company.logo ? (
              <img src={company.logo} alt={company.companyName} className="w-full h-full object-contain p-2" />
            ) : (
              <BankOutlined className="text-2xl" />
            )}
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <Title level={4} className="!m-0 !text-lg !font-bold text-gray-900 leading-tight">
                {company.companyName || 'Company Name'}
              </Title>
              {isSelfIdentified && (
                <Tag className="m-0 border-0 bg-purple-50 text-purple-600 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md">
                  Self-Identified
                </Tag>
              )}
            </div>
            <Text className="text-gray-500 font-medium block">
              {internship.jobProfile || internship.internship?.title || 'Internship Position'}
            </Text>
          </div>
        </div>
        <div className={`px-3 py-1 rounded-lg border ${statusConfig.bg} ${statusConfig.border}`}>
          <Text className={`text-xs font-bold uppercase tracking-wider ${statusConfig.text}`}>
            {statusConfig.label}
          </Text>
        </div>
      </div>

      {/* Progress Section */}
      <div className="bg-background-secondary/80 rounded-xl p-5 mb-6 border border-gray-100">
        <div className="flex justify-between items-end mb-3">
          <div>
            <Text className="text-xs font-bold text-gray-400 uppercase tracking-wider block mb-1">Progress</Text>
            <Text className="text-base font-bold text-gray-800">
              {daysCompleted} <span className="text-sm font-normal text-gray-500">days completed</span>
            </Text>
          </div>
          <Text className="text-xl font-bold text-blue-600">{progressPercent}%</Text>
        </div>
        <Progress
          percent={progressPercent}
          showInfo={false}
          strokeColor={{
            '0%': '#3b82f6',
            '100%': '#10b981',
          }}
          trailColor="#e5e7eb"
          className="mb-3"
          size="small"
        />
        <div className="flex justify-between text-xs font-medium text-gray-400">
          <span>Start: {startDate ? dayjs(startDate).format('MMM DD, YYYY') : 'N/A'}</span>
          <span>End: {endDate ? dayjs(endDate).format('MMM DD, YYYY') : 'N/A'}</span>
        </div>
      </div>

      {/* Details Grid */}
      <div className="grid grid-cols-2 gap-y-4 gap-x-2 mb-6 flex-grow">
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center text-blue-500 shrink-0 mt-0.5">
            <CalendarOutlined />
          </div>
          <div>
            <Text className="text-[10px] uppercase font-bold text-gray-400 block mb-0.5 tracking-wide">Duration</Text>
            <Text className="text-sm font-semibold text-gray-700">{duration || 'N/A'}</Text>
          </div>
        </div>
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center text-emerald-500 shrink-0 mt-0.5">
            <EnvironmentOutlined />
          </div>
          <div>
            <Text className="text-[10px] uppercase font-bold text-gray-400 block mb-0.5 tracking-wide">Location</Text>
            <Text className="text-sm font-semibold text-gray-700">{company.city || 'N/A'}</Text>
          </div>
        </div>
        <div className="flex items-start gap-3 col-span-2">
          <div className="w-8 h-8 rounded-lg bg-orange-50 flex items-center justify-center text-orange-500 shrink-0 mt-0.5">
            <UserOutlined />
          </div>
          <div className="flex-1 min-w-0">
            <Text className="text-[10px] uppercase font-bold text-gray-400 block mb-0.5 tracking-wide">Mentor</Text>
            <Text className="text-sm font-semibold text-gray-700 truncate block">
              {internship.mentor?.name || internship.facultyMentorName || studentMentor?.name || 'Not assigned'}
            </Text>
          </div>
        </div>
      </div>

      {/* Action Button */}
      <Button
        type="primary"
        size="large"
        block
        onClick={onViewDetails}
        className="rounded-xl h-11 bg-gray-900 hover:bg-gray-800 border-0 font-medium shadow-lg shadow-gray-200 mt-auto group-hover:translate-y-[-2px] transition-transform duration-300"
      >
        View Full Details <RightOutlined className="ml-1" />
      </Button>
    </Card>
  );
};

ActiveInternshipCard.displayName = 'ActiveInternshipCard';

export default memo(ActiveInternshipCard);
