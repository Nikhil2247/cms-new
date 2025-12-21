import React from 'react';
import { Card, Typography, Avatar, Tag, Button, Space } from 'antd';
import {
  UserOutlined,
  ClockCircleOutlined,
  ReloadOutlined,
} from '@ant-design/icons';

const { Title, Text } = Typography;

const DashboardHeader = ({ userName, designation, instituteName, onRefresh }) => {
  const currentDate = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return (
    <Card className="mb-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex items-center gap-4">
          <Avatar
            size={64}
            icon={<UserOutlined />}
            className="bg-success"
          />
          <div>
            <div className="text-text-secondary text-sm mb-1">
              <ClockCircleOutlined className="mr-1" />
              {currentDate}
            </div>
            <Title level={3} className="m-0">
              Welcome Back, <span className="text-success-600">{userName || 'Faculty'}</span>
            </Title>
            <Space className="mt-1">
              {designation && <Tag color="green">{designation}</Tag>}
              {instituteName && <Text type="secondary">{instituteName}</Text>}
            </Space>
          </div>
        </div>

        <Button icon={<ReloadOutlined />} onClick={onRefresh}>
          Refresh
        </Button>
      </div>
    </Card>
  );
};

export default DashboardHeader;