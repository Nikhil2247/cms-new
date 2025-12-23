import React, { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  Card,
  Row,
  Col,
  Progress,
  Table,
  Tag,
  Spin,
  Empty,
  Tooltip,
  Badge,
  Timeline,
  Typography,
  Statistic,
} from 'antd';
import {
  FileTextOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  CloseCircleOutlined,
  BankOutlined,
  WarningOutlined,
  HistoryOutlined,
} from '@ant-design/icons';
import {
  fetchJoiningLetterStats,
  selectJoiningLetterStats,
  selectJoiningLettersLoading,
} from '../../store/stateSlice';

const { Text, Title } = Typography;

const JoiningLetterTracker = () => {
  const dispatch = useDispatch();
  const stats = useSelector(selectJoiningLetterStats);
  const loading = useSelector(selectJoiningLettersLoading);
  const [activeTab, setActiveTab] = useState('summary');

  useEffect(() => {
    dispatch(fetchJoiningLetterStats());
  }, [dispatch]);

  if (loading) {
    return (
      <Card className="h-full">
        <div className="flex justify-center items-center h-48">
          <Spin size="large" />
        </div>
      </Card>
    );
  }

  if (!stats) {
    return (
      <Card className="h-full">
        <Empty description="No joining letter data available" />
      </Card>
    );
  }

  const { summary, byInstitution = [], recentActivity = [] } = stats;

  // Status colors
  const statusColors = {
    verified: '#52c41a',
    pendingReview: '#faad14',
    rejected: '#ff4d4f',
    noLetter: '#d9d9d9',
  };

  // Institution columns
  const institutionColumns = [
    {
      title: 'Institution',
      dataIndex: 'institutionName',
      key: 'institutionName',
      ellipsis: true,
      render: (text, record) => (
        <Tooltip title={text}>
          <div className="flex items-center gap-2">
            <BankOutlined className="text-blue-500" />
            <span className="truncate max-w-[150px]">{text}</span>
          </div>
        </Tooltip>
      ),
    },
    {
      title: 'Total',
      dataIndex: 'total',
      key: 'total',
      width: 70,
      align: 'center',
    },
    {
      title: 'Pending',
      dataIndex: 'pendingReview',
      key: 'pendingReview',
      width: 80,
      align: 'center',
      render: (val) => (
        <Badge count={val} style={{ backgroundColor: statusColors.pendingReview }} showZero />
      ),
    },
    {
      title: 'Verified',
      dataIndex: 'verified',
      key: 'verified',
      width: 80,
      align: 'center',
      render: (val) => (
        <Badge count={val} style={{ backgroundColor: statusColors.verified }} showZero />
      ),
    },
    {
      title: 'Rejected',
      dataIndex: 'rejected',
      key: 'rejected',
      width: 80,
      align: 'center',
      render: (val) => (
        <Badge count={val} style={{ backgroundColor: statusColors.rejected }} showZero />
      ),
    },
  ];

  return (
    <Card
      title={
        <div className="flex items-center gap-2">
          <FileTextOutlined className="text-blue-500" />
          <span>Joining Letter Tracker</span>
        </div>
      }
      className="h-full"
      styles={{ body: { padding: '16px' } }}
    >
      {/* Summary Stats Row */}
      <Row gutter={[16, 16]} className="mb-4">
        <Col span={6}>
          <Card size="small" className="text-center bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 border-blue-200">
            <Statistic
              title={<span className="text-xs">Total Letters</span>}
              value={summary?.uploaded || 0}
              suffix={<span className="text-sm text-gray-500">/ {summary?.total || 0}</span>}
              valueStyle={{ fontSize: '20px', color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small" className="text-center bg-gradient-to-br from-yellow-50 to-yellow-100 dark:from-yellow-900/20 dark:to-yellow-800/20 border-yellow-200">
            <Statistic
              title={<span className="text-xs">Pending Review</span>}
              value={summary?.pendingReview || 0}
              prefix={<ClockCircleOutlined />}
              valueStyle={{ fontSize: '20px', color: '#faad14' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small" className="text-center bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-800/20 border-green-200">
            <Statistic
              title={<span className="text-xs">Verified</span>}
              value={summary?.verified || 0}
              prefix={<CheckCircleOutlined />}
              valueStyle={{ fontSize: '20px', color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small" className="text-center bg-gradient-to-br from-red-50 to-red-100 dark:from-red-900/20 dark:to-red-800/20 border-red-200">
            <Statistic
              title={<span className="text-xs">Rejected</span>}
              value={summary?.rejected || 0}
              prefix={<CloseCircleOutlined />}
              valueStyle={{ fontSize: '20px', color: '#ff4d4f' }}
            />
          </Card>
        </Col>
      </Row>

      {/* Verification Rate */}
      <div className="mb-4 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
        <div className="flex justify-between items-center mb-2">
          <Text strong>Verification Rate</Text>
          <Text type="secondary">{summary?.verificationRate || 0}%</Text>
        </div>
        <Progress
          percent={summary?.verificationRate || 0}
          strokeColor={{
            '0%': '#52c41a',
            '100%': '#87d068',
          }}
          trailColor="#f0f0f0"
          size="small"
        />
        <div className="flex justify-between text-xs text-gray-500 mt-1">
          <span>Upload Rate: {summary?.uploadRate || 0}%</span>
          <span>No Letter: {summary?.noLetter || 0}</span>
        </div>
      </div>

      {/* Two Column Layout: Institution Table & Recent Activity */}
      <Row gutter={16}>
        <Col span={14}>
          <div className="mb-2">
            <Text strong className="flex items-center gap-1">
              <BankOutlined /> Institution Breakdown
            </Text>
          </div>
          <Table
            dataSource={byInstitution.slice(0, 5)}
            columns={institutionColumns}
            rowKey="institutionId"
            size="small"
            pagination={false}
            scroll={{ y: 180 }}
            locale={{ emptyText: 'No institution data' }}
          />
        </Col>
        <Col span={10}>
          <div className="mb-2">
            <Text strong className="flex items-center gap-1">
              <HistoryOutlined /> Recent Activity
            </Text>
          </div>
          <div className="max-h-[200px] overflow-y-auto">
            {recentActivity.length > 0 ? (
              <Timeline
                items={recentActivity.slice(0, 5).map((activity) => ({
                  color: activity.action === 'VERIFIED' ? 'green' : 'red',
                  children: (
                    <div className="text-xs">
                      <div className="font-medium">
                        {activity.studentName}
                        <Tag
                          size="small"
                          color={activity.action === 'VERIFIED' ? 'success' : 'error'}
                          className="ml-1"
                        >
                          {activity.action}
                        </Tag>
                      </div>
                      <div className="text-gray-500">
                        {activity.companyName}
                      </div>
                      <div className="text-gray-400">
                        {activity.institutionName}
                      </div>
                    </div>
                  ),
                }))}
              />
            ) : (
              <Empty description="No recent activity" image={Empty.PRESENTED_IMAGE_SIMPLE} />
            )}
          </div>
        </Col>
      </Row>
    </Card>
  );
};

export default JoiningLetterTracker;
