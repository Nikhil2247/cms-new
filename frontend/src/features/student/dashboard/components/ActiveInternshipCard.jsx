import React from 'react';
import { Card, Typography, Tag, Button, Avatar, Progress, Space, Tooltip, Divider } from 'antd';
import {
  BankOutlined,
  CalendarOutlined,
  EnvironmentOutlined,
  UserOutlined,
  PhoneOutlined,
  MailOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  FileTextOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';

const { Title, Text } = Typography;

const ActiveInternshipCard = ({
  internship,
  onViewDetails,
  onUploadReport,
  monthlyReportStatus,
  canUploadReport,
}) => {
  if (!internship) {
    return (
      <Card className="h-full border border-border rounded-xl">
        <div className="text-center py-8">
          <BankOutlined className="text-5xl text-text-tertiary" />
          <Title level={5} className="mt-4 text-text-tertiary">
            No Active Internship
          </Title>
          <Text type="secondary">
            Apply for internships to get started
          </Text>
        </div>
      </Card>
    );
  }

  const company = internship.internship?.industry || internship.industry || {};
  const startDate = internship.joiningDate || internship.startDate || internship.internship?.startDate;
  const endDate = internship.endDate || internship.internship?.endDate;
  const duration = internship.internshipDuration || internship.internship?.duration;

  // Calculate progress
  const totalDays = endDate && startDate ? dayjs(endDate).diff(dayjs(startDate), 'day') : 0;
  const daysCompleted = startDate ? dayjs().diff(dayjs(startDate), 'day') : 0;
  const progressPercent = totalDays > 0 ? Math.min(Math.round((daysCompleted / totalDays) * 100), 100) : 0;

  return (
    <Card
      className="h-full border border-border rounded-xl hover:shadow-md transition-shadow"
      title={
        <div className="flex items-center gap-3">
          <Avatar
            size={48}
            icon={<BankOutlined />}
            src={company.logo}
            className="bg-primary"
          />
          <div>
            <Title level={5} className="m-0">
              {company.companyName || 'Company'}
            </Title>
            <Text type="secondary" className="text-sm">
              {internship.jobProfile || internship.internship?.title || 'Internship'}
            </Text>
          </div>
        </div>
      }
      extra={
        <Tag color={internship.status === 'SELECTED' ? 'green' : 'blue'}>
          {internship.status}
        </Tag>
      }
    >
      <Space direction="vertical" className="w-full" size="middle">
        {/* Duration Progress */}
        <div>
          <div className="flex justify-between mb-1">
            <Text className="text-sm">Internship Progress</Text>
            <Text className="text-sm font-medium">{progressPercent}%</Text>
          </div>
          <Progress
            percent={progressPercent}
            showInfo={false}
            size="small"
          />
          <div className="flex justify-between mt-1 text-xs text-text-secondary">
            <span>{startDate ? dayjs(startDate).format('MMM DD, YYYY') : 'N/A'}</span>
            <span>{endDate ? dayjs(endDate).format('MMM DD, YYYY') : 'N/A'}</span>
          </div>
        </div>

        <Divider className="my-2" />

        {/* Details */}
        <div className="grid grid-cols-2 gap-3">
          <div className="flex items-center gap-2">
            <CalendarOutlined className="text-text-tertiary" />
            <Text className="text-sm">{duration || 'N/A'} months</Text>
          </div>
          <div className="flex items-center gap-2">
            <EnvironmentOutlined className="text-text-tertiary" />
            <Text className="text-sm">{company.city || 'N/A'}</Text>
          </div>
        </div>

        {/* Industry Mentor */}
        {internship.industryMentor && (
          <div className="p-3 bg-background-tertiary rounded-lg">
            <Text className="text-xs text-text-secondary block mb-2">Industry Mentor</Text>
            <div className="flex items-center gap-2">
              <Avatar size="small" icon={<UserOutlined />} />
              <div>
                <Text strong className="text-sm">{internship.industryMentor.name}</Text>
                {internship.industryMentor.email && (
                  <Text className="text-xs text-text-secondary block">{internship.industryMentor.email}</Text>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Monthly Report Status */}
        {monthlyReportStatus && (
          <div className="p-3 bg-primary-50 rounded-lg">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2">
                <FileTextOutlined className="text-primary" />
                <Text className="text-sm">Monthly Reports</Text>
              </div>
              <Text className="text-sm font-medium">
                {monthlyReportStatus.submitted}/{monthlyReportStatus.total}
              </Text>
            </div>
            <Progress
              percent={monthlyReportStatus.total > 0
                ? Math.round((monthlyReportStatus.submitted / monthlyReportStatus.total) * 100)
                : 0}
              showInfo={false}
              size="small"
              className="mt-2"
            />
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2 mt-2">
          <Button type="primary" block onClick={onViewDetails}>
            View Details
          </Button>
          {canUploadReport && (
            <Button block onClick={onUploadReport}>
              Upload Report
            </Button>
          )}
        </div>
      </Space>
    </Card>
  );
};

export default ActiveInternshipCard;