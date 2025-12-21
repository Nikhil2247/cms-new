import React from 'react';
import { Card, List, Avatar, Tag, Button, Typography, Empty } from 'antd';
import {
  BankOutlined,
  RightOutlined,
  ClockCircleOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';

const { Text } = Typography;

const getStatusConfig = (status) => {
  const configs = {
    APPLIED: { color: 'blue', icon: <ClockCircleOutlined /> },
    SHORTLISTED: { color: 'orange', icon: <ClockCircleOutlined /> },
    SELECTED: { color: 'green', icon: <CheckCircleOutlined /> },
    REJECTED: { color: 'red', icon: <CloseCircleOutlined /> },
    WITHDRAWN: { color: 'default', icon: <CloseCircleOutlined /> },
  };
  return configs[status] || { color: 'default', icon: <ClockCircleOutlined /> };
};

const RecentApplicationsList = ({ applications = [], loading, onViewAll }) => {
  const navigate = useNavigate();

  return (
    <Card
      title={
        <div className="flex items-center gap-2">
          <BankOutlined className="text-primary" />
          <span>Recent Applications</span>
        </div>
      }
      extra={
        <Button type="link" onClick={onViewAll || (() => navigate('/internships'))}>
          View All <RightOutlined />
        </Button>
      }
      className="h-full"
      styles={{ body: { padding: applications.length > 0 ? 0 : 24 } }}
    >
      {applications.length > 0 ? (
        <List
          loading={loading}
          dataSource={applications.slice(0, 5)}
          renderItem={(app) => {
            const statusConfig = getStatusConfig(app.status);
            const company = app.internship?.industry || {};

            return (
              <List.Item
                className="px-4 cursor-pointer transition-colors duration-200 hover:bg-surface-hover"
                onClick={() => navigate(`/internships/${app.internshipId}`)}
              >
                <List.Item.Meta
                  avatar={
                    <Avatar
                      icon={<BankOutlined />}
                      src={company.logo}
                      className="bg-info-bg"
                    />
                  }
                  title={
                    <div className="flex items-center justify-between">
                      <Text strong className="text-sm">
                        {company.companyName || 'Company'}
                      </Text>
                      <Tag color={statusConfig.color} icon={statusConfig.icon}>
                        {app.status}
                      </Tag>
                    </div>
                  }
                  description={
                    <div className="flex justify-between items-center">
                      <Text className="text-xs text-text-secondary">
                        {app.internship?.title || app.jobProfile || 'Position'}
                      </Text>
                      <Text className="text-xs text-text-tertiary">
                        {dayjs(app.createdAt).format('MMM DD, YYYY')}
                      </Text>
                    </div>
                  }
                />
              </List.Item>
            );
          }}
        />
      ) : (
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description="No applications yet"
        >
          <Button type="primary" onClick={() => navigate('/internships')}>
            Browse Internships
          </Button>
        </Empty>
      )}
    </Card>
  );
};

export default RecentApplicationsList;