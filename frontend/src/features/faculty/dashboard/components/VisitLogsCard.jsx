import React from 'react';
import { Card, List, Avatar, Tag, Button, Typography, Empty, Space } from 'antd';
import {
  CalendarOutlined,
  PlusOutlined,
  RightOutlined,
  EnvironmentOutlined,
  UserOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';

const { Text } = Typography;

const getVisitTypeColor = (type) => {
  const colors = {
    PHYSICAL: 'green',
    VIRTUAL: 'blue',
    PHONE: 'orange',
  };
  return colors[type] || 'default';
};

const VisitLogsCard = ({ visitLogs = [], loading, onCreateNew, onViewAll }) => {
  const navigate = useNavigate();

  const upcomingVisits = visitLogs.filter(v =>
    dayjs(v.visitDate).isAfter(dayjs())
  ).length;

  return (
    <Card
      title={
        <div className="flex items-center gap-2">
          <CalendarOutlined className="text-success" />
          <span>Visit Logs</span>
          {upcomingVisits > 0 && (
            <Tag color="blue">{upcomingVisits} upcoming</Tag>
          )}
        </div>
      }
      extra={
        <Space>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            size="small"
            onClick={onCreateNew || (() => navigate('/visit-logs/new'))}
          >
            New Visit
          </Button>
          <Button
            type="link"
            size="small"
            onClick={onViewAll || (() => navigate('/visit-logs'))}
          >
            <RightOutlined />
          </Button>
        </Space>
      }
      className="h-full border border-border rounded-xl"
    >
      {visitLogs.length > 0 ? (
        <List
          loading={loading}
          dataSource={visitLogs.slice(0, 5)}
          size="small"
          renderItem={(visit) => {
            const isPast = dayjs(visit.visitDate).isBefore(dayjs());

            return (
              <List.Item className="!px-0">
                <div className="flex items-center justify-between w-full">
                  <div className="flex items-center gap-3">
                    <Avatar
                      size="small"
                      icon={isPast ? <CheckCircleOutlined /> : <ClockCircleOutlined />}
                      className={isPast ? 'bg-success-100 text-success-600' : 'bg-primary-100 text-primary-600'}
                    />
                    <div>
                      <Text className="text-sm font-medium block">
                        {visit.application?.student?.name || visit.studentName || 'Student'}
                      </Text>
                      <div className="flex items-center gap-2 text-xs text-text-secondary">
                        <EnvironmentOutlined />
                        <span>{visit.visitLocation || visit.application?.internship?.industry?.companyName || 'Location'}</span>
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <Tag color={getVisitTypeColor(visit.visitType)}>
                      {visit.visitType || 'PHYSICAL'}
                    </Tag>
                    <Text className="text-xs text-text-tertiary block mt-1">
                      {dayjs(visit.visitDate).format('MMM DD, YYYY')}
                    </Text>
                  </div>
                </div>
              </List.Item>
            );
          }}
        />
      ) : (
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description="No visit logs"
        >
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={onCreateNew || (() => navigate('/visit-logs/new'))}
          >
            Schedule Visit
          </Button>
        </Empty>
      )}
    </Card>
  );
};

export default VisitLogsCard;