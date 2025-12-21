import React from 'react';
import { Card, List, Avatar, Tag, Button, Typography, Empty, Badge } from 'antd';
import {
  TeamOutlined,
  UserOutlined,
  RightOutlined,
  BankOutlined,
  PhoneOutlined,
  MailOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';

const { Text } = Typography;

const getStatusConfig = (status) => {
  const configs = {
    ACTIVE: { color: 'green', label: 'Active' },
    SELECTED: { color: 'blue', label: 'Selected' },
    PENDING: { color: 'orange', label: 'Pending' },
    COMPLETED: { color: 'cyan', label: 'Completed' },
  };
  return configs[status] || { color: 'default', label: status };
};

const AssignedStudentsList = ({ students = [], loading, onViewAll, onViewStudent }) => {
  const navigate = useNavigate();

  return (
    <Card
      title={
        <div className="flex items-center gap-2">
          <TeamOutlined className="text-primary" />
          <span>Assigned Students</span>
          <Badge count={students.length} className="ml-2" />
        </div>
      }
      extra={
        <Button type="link" onClick={onViewAll || (() => navigate('/assigned-students'))}>
          View All <RightOutlined />
        </Button>
      }
      className="h-full border border-border rounded-xl"
      styles={{ body: { padding: students.length > 0 ? 0 : 24 } }}
    >
      {students.length > 0 ? (
        <List
          loading={loading}
          dataSource={students.slice(0, 5)}
          renderItem={(student) => {
            const statusConfig = getStatusConfig(student.status || student.internshipStatus);
            const company = student.internship?.industry || student.company || {};

            return (
              <List.Item
                className="px-4 hover:bg-surface-hover cursor-pointer"
                onClick={() => onViewStudent?.(student) || navigate(`/students/${student.id}`)}
              >
                <List.Item.Meta
                  avatar={
                    <Avatar icon={<UserOutlined />} className="bg-primary" />
                  }
                  title={
                    <div className="flex items-center justify-between">
                      <Text strong>{student.name || student.student?.name}</Text>
                      <Tag color={statusConfig.color}>{statusConfig.label}</Tag>
                    </div>
                  }
                  description={
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 text-xs text-text-secondary">
                        <BankOutlined />
                        <span>{company.companyName || student.companyName || 'N/A'}</span>
                      </div>
                      {(student.email || student.student?.email) && (
                        <div className="flex items-center gap-2 text-xs text-text-tertiary">
                          <MailOutlined />
                          <span>{student.email || student.student?.email}</span>
                        </div>
                      )}
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
          description="No students assigned"
        />
      )}
    </Card>
  );
};

export default AssignedStudentsList;