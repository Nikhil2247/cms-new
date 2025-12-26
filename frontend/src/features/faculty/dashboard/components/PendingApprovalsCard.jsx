import React from 'react';
import { Card, Avatar, Tag, Button, Typography, Empty, Space, Popconfirm } from 'antd';
import {
  CheckCircleOutlined,
  CloseCircleOutlined,
  UserOutlined,
  BankOutlined,
  RightOutlined,
  ExclamationCircleOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';

const { Text } = Typography;

const PendingApprovalsCard = ({
  applications = [],
  loading,
  onApprove,
  onReject,
  onViewAll,
}) => {
  const navigate = useNavigate();

  // Filter for pending approvals
  const pendingApplications = applications.filter(app =>
    app.status === 'PENDING' || app.status === 'UNDER_REVIEW' || app.isSelfIdentified
  );

  return (
    <Card
      title={
        <div className="flex items-center gap-2">
          <ExclamationCircleOutlined className="text-warning-500" />
          <span>Pending Approvals</span>
          {pendingApplications.length > 0 && (
            <Tag color="orange">{pendingApplications.length}</Tag>
          )}
        </div>
      }
      extra={
        <Button type="link" onClick={onViewAll || (() => navigate('/approvals'))}>
          View All <RightOutlined />
        </Button>
      }
      className="h-full border border-border rounded-xl"
    >
      {pendingApplications.length > 0 ? (
        <div className="flex flex-col gap-3">
          {pendingApplications.slice(0, 5).map((app, index) => (
            <div key={app.id || index} className={`flex items-center justify-between w-full gap-3 pb-3 ${index !== pendingApplications.slice(0, 5).length - 1 ? 'border-b border-border/50' : ''}`}>
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <Avatar icon={<UserOutlined />} className="bg-warning-100 text-warning-600 shrink-0" />
                <div className="min-w-0 flex-1">
                  <Text className="text-sm font-medium block truncate">
                    {app.student?.name || 'Student'}
                  </Text>
                  <div className="flex items-center gap-2 text-xs text-text-secondary">
                    <BankOutlined />
                    <span className="truncate">
                      {app.companyName || app.internship?.industry?.companyName || 'Company'}
                    </span>
                  </div>
                  {app.isSelfIdentified && (
                    <Tag color="purple" className="text-[10px] m-0 px-1 py-0 border-0 rounded-sm mt-1">Self-Identified</Tag>
                  )}
                </div>
              </div>
              <Space size="small">
                <Popconfirm
                  title="Approve this application?"
                  onConfirm={() => onApprove?.(app)}
                  okText="Yes"
                  cancelText="No"
                >
                  <Button
                    type="primary"
                    size="small"
                    icon={<CheckCircleOutlined />}
                  >
                    Approve
                  </Button>
                </Popconfirm>
                <Popconfirm
                  title="Reject this application?"
                  onConfirm={() => onReject?.(app)}
                  okText="Yes"
                  cancelText="No"
                >
                  <Button
                    danger
                    size="small"
                    icon={<CloseCircleOutlined />}
                  >
                    Reject
                  </Button>
                </Popconfirm>
              </Space>
            </div>
          ))}
        </div>
      ) : (
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description="No pending approvals"
        />
      )}
    </Card>
  );
};

export default PendingApprovalsCard;