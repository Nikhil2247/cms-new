import React from 'react';
import { Card, Avatar, Typography, Tag, Progress, Empty, Tooltip, Badge, Space } from 'antd';
import {
  TrophyOutlined,
  CrownOutlined,
  RiseOutlined,
  FallOutlined,
  BankOutlined,
  UserSwitchOutlined,
  CalendarOutlined,
  FileTextOutlined,
  WarningOutlined,
} from '@ant-design/icons';

const { Text, Title } = Typography;

// Get compliance score from stats (use backend-calculated 2-metric score)
// Formula: (MentorRate + JoiningLetterRate) / 2
// Note: Reports and Visits are NOT part of compliance score
const calculateComplianceScore = (item) => {
  // If item already has a score or placementRate, use that
  if (item.score !== undefined) return item.score;
  if (item.placementRate !== undefined) return item.placementRate;

  // Use backend-calculated complianceScore for consistency with Institution Overview
  // Backend calculates: (MentorRate + JoiningLetterRate) / 2
  const stats = item.stats;
  if (!stats) return 0;
  return stats.complianceScore ?? 0;
};

const PerformerItem = ({ item, rank, type }) => {
  const isTop = type === 'top';
  const score = calculateComplianceScore(item);

  const getRankClass = (rank) => {
    if (rank === 0) return 'bg-yellow-400 shadow-md shadow-yellow-200';
    if (rank === 1) return 'bg-gray-400';
    if (rank === 2) return 'bg-amber-600';
    return 'bg-gray-500';
  };

  const stats = item.stats || {};

  return (
    <div className="!px-3 !py-2 rounded-xl hover:bg-background-tertiary transition-colors mb-1 border-b border-border/50 last:border-0">
      <div className="flex items-center w-full gap-3">
        <div
          className={`w-6 h-6 rounded-full flex items-center justify-center text-white font-bold text-xs shrink-0 ${getRankClass(rank)}`}
        >
          {rank + 1}
        </div>
        <Avatar
          icon={<BankOutlined />}
          className={`${isTop ? 'bg-success' : 'bg-error'} shrink-0`}
          src={item.logo}
          size="small"
        />
        <div className="flex-1 min-w-0">
          <Tooltip title={item.name}>
            <Text strong className="block truncate text-sm text-text-primary">{item.name}</Text>
          </Tooltip>
          {stats.studentsWithInternships !== undefined ? (
            <div className="flex gap-2 text-xs text-text-tertiary">
              <Tooltip title="Total approved self-identified internships">
                <span>{stats.studentsWithInternships || 0} interns</span>
              </Tooltip>
              {stats.unassigned > 0 && (
                <Tooltip title={`${stats.unassigned} students without an assigned mentor (out of ${stats.activeStudents || 0} active students)`}>
                  <Tag color="warning" className="text-[10px] m-0 leading-tight px-1 py-0 border-0 rounded-sm font-bold">
                    {stats.unassigned} NEED MENTOR
                  </Tag>
                </Tooltip>
              )}
            </div>
          ) : (
            <Text className="text-xs text-text-tertiary truncate block">
              {item.city || item.shortName || 'Institution'}
            </Text>
          )}
        </div>
        <Tooltip title="Compliance Score = (Mentor Assignment Rate + Joining Letter Rate) / 2. Reports and Visits are tracked separately.">
          <div className="text-right shrink-0 cursor-help">
            <div className="flex items-center justify-end gap-1">
              {isTop ? (
                <RiseOutlined className="text-success text-xs" />
              ) : (
                <FallOutlined className="text-error text-xs" />
              )}
              <Text
                strong
                className={`text-sm ${isTop ? 'text-success' : 'text-error'}`}
              >
                {score}%
              </Text>
            </div>
            <Text className="text-[10px] uppercase font-bold text-text-tertiary tracking-wider">
              compliance
            </Text>
          </div>
        </Tooltip>
      </div>
    </div>
  );
};

const TopPerformers = ({ topPerformers = [], bottomPerformers = [], loading }) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {/* Top Performers */}
      <Card
        title={
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-warning/10 flex items-center justify-center shrink-0">
              <TrophyOutlined className="text-warning text-lg" />
            </div>
            <span className="font-bold text-text-primary text-lg">Top Performers</span>
          </div>
        }
        extra={<Tag color="success" className="rounded-md border-0 font-bold m-0">Best Compliance</Tag>}
        className="shadow-sm border-border rounded-2xl bg-surface h-full"
        loading={loading}
        size="small"
        styles={{ header: { borderBottom: '1px solid var(--color-border)', padding: '16px 20px' }, body: { padding: '12px' } }}
      >
        {topPerformers.length > 0 ? (
          <div className="flex flex-col">
            {topPerformers.slice(0, 5).map((item, index) => (
              <PerformerItem key={item.id || index} item={item} rank={index} type="top" />
            ))}
          </div>
        ) : (
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description={<span className="text-text-tertiary">No data available</span>}
            className="py-8"
          />
        )}
      </Card>

      {/* Bottom Performers (Needs Attention) */}
      <Card
        title={
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-error/10 flex items-center justify-center shrink-0">
              <WarningOutlined className="text-error text-lg" />
            </div>
            <span className="font-bold text-text-primary text-lg">Needs Attention</span>
          </div>
        }
        extra={<Tag color="warning" className="rounded-md border-0 font-bold m-0">Low Compliance</Tag>}
        className="shadow-sm border-border rounded-2xl bg-surface h-full"
        loading={loading}
        size="small"
        styles={{ header: { borderBottom: '1px solid var(--color-border)', padding: '16px 20px' }, body: { padding: '12px' } }}
      >
        {bottomPerformers.length > 0 ? (
          <div className="flex flex-col">
            {bottomPerformers.slice(0, 5).map((item, index) => (
              <PerformerItem key={item.id || index} item={item} rank={index} type="bottom" />
            ))}
          </div>
        ) : (
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description={<span className="text-text-tertiary">All institutions performing well</span>}
            className="py-8"
          />
        )}
      </Card>
    </div>
  );
};

export default TopPerformers;
