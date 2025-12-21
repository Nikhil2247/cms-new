import React from 'react';
import { Card, Typography, Avatar, Tag, Space } from 'antd';
import { UserOutlined, ClockCircleOutlined } from '@ant-design/icons';

const { Title, Text } = Typography;

const DashboardHeader = ({ userName, instituteName, assignedMentor }) => {
  const currentDate = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return (
    <Card className="p-6 md:p-8 mb-4">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex items-center gap-4">
          <Avatar
            size={64}
            icon={<UserOutlined />}
            className="bg-primary"
          />
          <div>
            <div className="text-text-secondary text-sm mb-1">
              <ClockCircleOutlined className="mr-1" />
              {currentDate}
            </div>
            <Title level={3} className="m-0">
              Welcome Back, <span className="text-primary-600">{userName || 'Student'}</span>
            </Title>
            {instituteName && (
              <Text className="text-text-secondary">{instituteName}</Text>
            )}
          </div>
        </div>

        {assignedMentor && (
          <div className="flex items-center gap-3 p-3 bg-success-50 rounded-lg">
            <Avatar icon={<UserOutlined />} className="bg-success" />
            <div>
              <Text className="text-xs text-text-secondary block">Faculty Mentor</Text>
              <Text strong>{assignedMentor.name}</Text>
              {assignedMentor.designation && (
                <Tag color="green" className="ml-2">{assignedMentor.designation}</Tag>
              )}
            </div>
          </div>
        )}
      </div>
    </Card>
  );
};

export default DashboardHeader;