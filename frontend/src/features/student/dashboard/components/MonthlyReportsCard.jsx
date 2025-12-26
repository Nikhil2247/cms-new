import React from 'react';
import { Card, Tag, Button, Typography, Empty, Progress, Avatar } from 'antd';
import {
  FileTextOutlined,
  UploadOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  ExclamationCircleOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';

const { Text } = Typography;

const getStatusConfig = (status) => {
  const configs = {
    DRAFT: { color: 'default', icon: <ClockCircleOutlined />, label: 'Draft' },
    SUBMITTED: { color: 'blue', icon: <ClockCircleOutlined />, label: 'Submitted' },
    UNDER_REVIEW: { color: 'gold', icon: <ClockCircleOutlined />, label: 'Under Review' },
    APPROVED: { color: 'green', icon: <CheckCircleOutlined />, label: 'Approved' },
    REJECTED: { color: 'red', icon: <ExclamationCircleOutlined />, label: 'Rejected' },
    REVISION_REQUIRED: { color: 'orange', icon: <ExclamationCircleOutlined />, label: 'Revision Required' },
  };
  return configs[status] || { color: 'default', icon: <ClockCircleOutlined />, label: status };
};

const MonthlyReportsCard = ({
  reports = [],
  loading,
  onUploadReport,
  canUpload,
  totalRequired,
  submitted,
}) => {
  const progressPercent = totalRequired > 0 ? Math.round((submitted / totalRequired) * 100) : 0;

  return (
    <Card
      title={
        <div className="flex items-center gap-2">
          <FileTextOutlined className="text-secondary-500" />
          <span>Monthly Reports</span>
        </div>
      }
      extra={
        canUpload && (
          <Button type="primary" icon={<UploadOutlined />} onClick={onUploadReport}>
            Upload Report
          </Button>
        )
      }
      className="h-full border border-border rounded-xl"
    >
      {/* Progress Summary */}
      <div className="mb-4 p-3 bg-secondary-50 rounded-lg">
        <div className="flex justify-between items-center mb-2">
          <Text className="text-sm">Report Submission Progress</Text>
          <Text className="text-sm font-medium">{submitted}/{totalRequired}</Text>
        </div>
        <Progress
          percent={progressPercent}
          size="small"
          showInfo={false}
        />
      </div>

      {/* Reports List */}
      {reports.length > 0 ? (
        <div className="flex flex-col gap-3">
          {reports.slice(0, 5).map((report, index) => {
            const statusConfig = getStatusConfig(report.status);
            const monthName = dayjs()
              .month(report.reportMonth - 1)
              .format('MMMM');

            return (
              <div key={report.id || index} className={`flex items-center justify-between w-full pb-3 ${index !== reports.slice(0, 5).length - 1 ? 'border-b border-border/50' : ''}`}>
                <div className="flex items-center gap-3">
                  <Avatar
                    size="small"
                    icon={<FileTextOutlined />}
                    className="bg-secondary-100 text-secondary-600"
                  />
                  <div>
                    <Text className="text-sm font-medium block">
                      {monthName} {report.reportYear}
                    </Text>
                    <Text className="text-xs text-text-secondary">
                      {report.submittedAt
                        ? `Submitted ${dayjs(report.submittedAt).format('MMM DD')}`
                        : 'Not submitted'}
                    </Text>
                  </div>
                </div>
                <Tag color={statusConfig.color} icon={statusConfig.icon} className="m-0">
                  {statusConfig.label}
                </Tag>
              </div>
            );
          })}
        </div>
      ) : (
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description="No reports submitted yet"
        />
      )}
    </Card>
  );
};

export default MonthlyReportsCard;