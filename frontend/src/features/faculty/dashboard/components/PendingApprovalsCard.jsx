import React from 'react';
import { Card, Avatar, Tag, Button, Typography, Empty, Space, Popconfirm, theme } from 'antd';
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
  const { token } = theme.useToken();

  // Helper to extract student name from application
  const getStudentName = (app) => {
    return app.student?.name ||
           app.studentName ||
           app.application?.student?.name ||
           'Student';
  };

  // Helper to extract company name from application
  const getCompanyName = (app) => {
    return app.companyName ||
           app.internship?.industry?.companyName ||
           app.application?.companyName ||
           'Company';
  };

  // Filter for pending approvals
  const pendingApplications = applications.filter(app =>
    app.status === 'PENDING' || app.status === 'UNDER_REVIEW' || app.isSelfIdentified
  );

  return (
    <Card
      title={
        <div className="flex items-center gap-2">
          <ExclamationCircleOutlined style={{ color: token.colorWarning }} />
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
      className="h-full rounded-xl"
      style={{ borderColor: token.colorBorder }}
    >
      {pendingApplications.length > 0 ? (
        <div className="flex flex-col gap-3">
          {pendingApplications.slice(0, 5).map((app, index) => (
            <div 
              key={app.id || index} 
              className="flex items-center justify-between w-full gap-3 pb-3"
              style={{ borderBottom: index !== pendingApplications.slice(0, 5).length - 1 ? `1px solid ${token.colorSplit}` : 'none' }}
            >
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <Avatar 
                  icon={<UserOutlined />} 
                  className="shrink-0"
                  style={{ backgroundColor: token.colorWarningBg, color: token.colorWarning }}
                />
                <div className="min-w-0 flex-1">
                  <Text className="text-sm font-medium block truncate">
                    {getStudentName(app)}
                  </Text>
                  <div className="flex items-center gap-2 text-xs" style={{ color: token.colorTextSecondary }}>
                    <BankOutlined />
                    <span className="truncate">
                      {getCompanyName(app)}
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