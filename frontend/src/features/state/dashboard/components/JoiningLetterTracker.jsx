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
} from 'antd';
import {
  FileTextOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  CloseCircleOutlined,
  BankOutlined,
  HistoryOutlined,
  InboxOutlined,
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

  useEffect(() => {
    dispatch(fetchJoiningLetterStats());
  }, [dispatch]);

  if (loading) {
    return (
      <Card className="h-full rounded-2xl border-border shadow-sm bg-surface">
        <div className="flex justify-center items-center h-48">
          <Spin size="large" />
        </div>
      </Card>
    );
  }

  if (!stats) {
    return (
      <Card className="h-full rounded-2xl border-border shadow-sm bg-surface">
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
      render: (text) => (
        <Tooltip title={text}>
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded bg-blue-500/10 flex items-center justify-center shrink-0">
              <BankOutlined className="text-blue-500 text-xs" />
            </div>
            <span className="truncate max-w-[150px] font-medium text-text-primary">{text}</span>
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
      render: (text) => <Text className="font-medium text-text-secondary">{text}</Text>,
    },
    {
      title: 'Pending',
      dataIndex: 'pendingReview',
      key: 'pendingReview',
      width: 80,
      align: 'center',
      render: (val) => (
        val > 0 ? <Badge count={val} style={{ backgroundColor: statusColors.pendingReview, boxShadow: 'none' }} /> : <span className="text-text-tertiary">-</span>
      ),
    },
    {
      title: 'Verified',
      dataIndex: 'verified',
      key: 'verified',
      width: 80,
      align: 'center',
      render: (val) => (
        val > 0 ? <Badge count={val} style={{ backgroundColor: statusColors.verified, boxShadow: 'none' }} /> : <span className="text-text-tertiary">-</span>
      ),
    },
    {
      title: 'Rejected',
      dataIndex: 'rejected',
      key: 'rejected',
      width: 80,
      align: 'center',
      render: (val) => (
        val > 0 ? <Badge count={val} style={{ backgroundColor: statusColors.rejected, boxShadow: 'none' }} /> : <span className="text-text-tertiary">-</span>
      ),
    },
  ];

  return (
    <Card
      title={
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center shrink-0">
            <FileTextOutlined className="text-blue-500 text-lg" />
          </div>
          <span className="font-bold text-text-primary text-lg">Joining Letter Tracker</span>
        </div>
      }
      className="h-full rounded-2xl border-border shadow-sm bg-surface"
      styles={{ header: { borderBottom: '1px solid var(--color-border)', padding: '20px 24px' }, body: { padding: '24px' } }}
    >
      {/* Summary Stats Row */}
      <Row gutter={[16, 16]} className="mb-6">
        <Col span={6}>
          <div className="text-center p-3 rounded-xl bg-background-tertiary/30 border border-border/50">
            <div className="text-[10px] uppercase font-bold text-text-tertiary tracking-widest mb-1">Total Letters</div>
            <div className="text-xl font-black text-blue-500 leading-none">
              {summary?.uploaded || 0} <span className="text-sm font-medium text-text-tertiary">of {summary?.total || 0}</span>
            </div>
          </div>
        </Col>
        <Col span={6}>
          <div className="text-center p-3 rounded-xl bg-background-tertiary/30 border border-border/50">
            <div className="text-[10px] uppercase font-bold text-text-tertiary tracking-widest mb-1">Pending</div>
            <div className="text-xl font-black text-warning leading-none flex items-center justify-center gap-1">
              <ClockCircleOutlined className="text-sm" /> {summary?.pendingReview || 0}
            </div>
          </div>
        </Col>
        <Col span={6}>
          <div className="text-center p-3 rounded-xl bg-background-tertiary/30 border border-border/50">
            <div className="text-[10px] uppercase font-bold text-text-tertiary tracking-widest mb-1">Verified</div>
            <div className="text-xl font-black text-success leading-none flex items-center justify-center gap-1">
              <CheckCircleOutlined className="text-sm" /> {summary?.verified || 0}
            </div>
          </div>
        </Col>
        <Col span={6}>
          <div className="text-center p-3 rounded-xl bg-background-tertiary/30 border border-border/50">
            <div className="text-[10px] uppercase font-bold text-text-tertiary tracking-widest mb-1">Rejected</div>
            <div className="text-xl font-black text-error leading-none flex items-center justify-center gap-1">
              <CloseCircleOutlined className="text-sm" /> {summary?.rejected || 0}
            </div>
          </div>
        </Col>
      </Row>

      {/* Verification Rate */}
      <div className="mb-6 p-4 bg-background-tertiary/20 rounded-xl border border-border/50">
        <div className="flex justify-between items-center mb-2">
          <Text className="text-xs font-bold text-text-secondary uppercase tracking-wide">Verification Progress</Text>
          <Text strong className="text-text-primary">{summary?.verificationRate || 0}%</Text>
        </div>
        <Progress
          percent={summary?.verificationRate || 0}
          strokeColor={{
            '0%': 'rgb(var(--color-info))',
            '100%': 'rgb(var(--color-success))',
          }}
          trailColor="rgba(var(--color-border), 0.3)"
          size="small"
          showInfo={false}
          className="!m-0"
        />
        <div className="flex justify-between text-[10px] font-medium text-text-tertiary mt-2">
          <span>Upload Rate: {summary?.uploadRate || 0}%</span>
          <span>No Letter: {summary?.noLetter || 0}</span>
        </div>
      </div>

      {/* Two Column Layout: Institution Table & Recent Activity */}
      <Row gutter={24}>
        <Col span={14}>
          <div className="mb-3 flex items-center gap-2">
            <BankOutlined className="text-text-tertiary" />
            <Text strong className="text-sm text-text-secondary">Institution Breakdown</Text>
          </div>
          <div className="rounded-xl border border-border overflow-hidden">
            <Table
              dataSource={byInstitution.slice(0, 5)}
              columns={institutionColumns}
              rowKey="institutionId"
              size="small"
              pagination={false}
              scroll={{ y: 180 }}
              locale={{ emptyText: 'No institution data' }}
              className="custom-table"
            />
          </div>
        </Col>
        <Col span={10}>
          <div className="mb-3 flex items-center gap-2">
            <HistoryOutlined className="text-text-tertiary" />
            <Text strong className="text-sm text-text-secondary">Recent Activity</Text>
          </div>
          <div className="max-h-[220px] overflow-y-auto px-2">
            {recentActivity.length > 0 ? (
              <Timeline
                items={recentActivity.slice(0, 5).map((activity) => ({
                  color: activity.action === 'VERIFIED' ? 'green' : 'red',
                  children: (
                    <div className="pb-2">
                      <div className="flex items-center justify-between mb-0.5">
                        <Text className="font-bold text-xs text-text-primary">{activity.studentName}</Text>
                        <Tag
                          className="m-0 border-0 text-[9px] font-bold uppercase"
                          color={activity.action === 'VERIFIED' ? 'success' : 'error'}
                        >
                          {activity.action}
                        </Tag>
                      </div>
                      <Text className="text-xs text-text-secondary block truncate" title={activity.companyName}>
                        {activity.companyName}
                      </Text>
                      <Text className="text-[10px] text-text-tertiary block truncate" title={activity.institutionName}>
                        {activity.institutionName}
                      </Text>
                    </div>
                  ),
                }))}
                className="mt-1"
              />
            ) : (
              <div className="text-center py-8">
                <InboxOutlined className="text-2xl text-text-tertiary mb-2" />
                <Text className="text-xs text-text-tertiary block">No recent activity</Text>
              </div>
            )}
          </div>
        </Col>
      </Row>
    </Card>
  );
};

export default JoiningLetterTracker;
