import React from 'react';
import { Card, List, Tag, Button, Typography, Empty, Avatar, Badge } from 'antd';
import {
  ExclamationCircleOutlined,
  PlusOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  RightOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';

const { Text } = Typography;

const getStatusConfig = (status) => {
  const configs = {
    SUBMITTED: { color: 'blue', icon: <ClockCircleOutlined />, label: 'Submitted' },
    IN_PROGRESS: { color: 'orange', icon: <ClockCircleOutlined />, label: 'In Progress' },
    RESOLVED: { color: 'green', icon: <CheckCircleOutlined />, label: 'Resolved' },
    CLOSED: { color: 'default', icon: <CheckCircleOutlined />, label: 'Closed' },
  };
  return configs[status] || { color: 'default', icon: <ClockCircleOutlined />, label: status };
};

const getPriorityColor = (priority) => {
  const colors = {
    HIGH: 'red',
    MEDIUM: 'orange',
    LOW: 'blue',
  };
  return colors[priority] || 'default';
};

const GrievancesCard = ({ grievances = [], loading, onCreateNew, onViewAll }) => {
  const navigate = useNavigate();

  const pendingCount = grievances.filter(
    g => g.status !== 'RESOLVED' && g.status !== 'CLOSED'
  ).length;

  return (
    <Card
      title={
        <div className="flex items-center gap-2">
          <ExclamationCircleOutlined className="text-warning-500" />
          <span>Grievances</span>
          {pendingCount > 0 && (
            <Badge count={pendingCount} className="ml-2" />
          )}
        </div>
      }
      extra={
        <Button
          type="primary"
          icon={<PlusOutlined />}
          size="small"
          onClick={onCreateNew || (() => navigate('/grievances/new'))}
        >
          New
        </Button>
      }
      className="h-full border border-border rounded-xl"
    >
      {grievances.length > 0 ? (
        <>
          <List
            loading={loading}
            dataSource={grievances.slice(0, 3)}
            size="small"
            renderItem={(grievance) => {
              const statusConfig = getStatusConfig(grievance.status);

              return (
                <List.Item className="!px-0">
                  <div className="flex items-start justify-between w-full gap-3">
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      <Avatar
                        size="small"
                        icon={<ExclamationCircleOutlined />}
                        className="bg-warning-100 text-warning-600 mt-1"
                      />
                      <div className="min-w-0 flex-1">
                        <Text className="text-sm font-medium block truncate">
                          {grievance.title || grievance.subject}
                        </Text>
                        <div className="flex items-center gap-2 mt-1">
                          <Tag color={getPriorityColor(grievance.severity || grievance.priority)} className="text-xs">
                            {grievance.severity || grievance.priority || 'MEDIUM'}
                          </Tag>
                          <Text className="text-xs text-text-tertiary">
                            {dayjs(grievance.createdAt).format('MMM DD')}
                          </Text>
                        </div>
                      </div>
                    </div>
                    <Tag color={statusConfig.color} className="flex-shrink-0">
                      {statusConfig.label}
                    </Tag>
                  </div>
                </List.Item>
              );
            }}
          />
          {grievances.length > 3 && (
            <Button
              type="link"
              block
              onClick={onViewAll || (() => navigate('/grievances'))}
              className="mt-2"
            >
              View All ({grievances.length}) <RightOutlined />
            </Button>
          )}
        </>
      ) : (
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description="No grievances"
        >
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={onCreateNew || (() => navigate('/grievances/new'))}
          >
            Report Issue
          </Button>
        </Empty>
      )}
    </Card>
  );
};

export default GrievancesCard;