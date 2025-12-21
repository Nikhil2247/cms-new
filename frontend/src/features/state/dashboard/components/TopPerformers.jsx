import React from 'react';
import { Card, List, Avatar, Typography, Tag, Progress, Empty, Tooltip, Badge } from 'antd';
import {
  TrophyOutlined,
  CrownOutlined,
  RiseOutlined,
  FallOutlined,
  BankOutlined,
} from '@ant-design/icons';

const { Text, Title } = Typography;

const PerformerItem = ({ item, rank, type }) => {
  const isTop = type === 'top';
  const getRankClass = (rank) => {
    if (rank === 0) return 'bg-yellow-400';
    if (rank === 1) return 'bg-gray-400';
    if (rank === 2) return 'bg-amber-600';
    return 'bg-gray-500';
  };

  return (
    <List.Item className="!px-0">
      <div className="flex items-center w-full gap-3">
        <div
          className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-sm ${getRankClass(rank)}`}
        >
          {rank + 1}
        </div>
        <Avatar
          icon={<BankOutlined />}
          className={isTop ? 'bg-success' : 'bg-error'}
          src={item.logo}
        />
        <div className="flex-1 min-w-0">
          <Tooltip title={item.name}>
            <Text strong className="block truncate text-slate-900">{item.name}</Text>
          </Tooltip>
          <Text className="text-xs text-slate-500">
            {item.city || item.shortName || 'Institution'}
          </Text>
        </div>
        <div className="text-right">
          <div className="flex items-center gap-1">
            {isTop ? (
              <RiseOutlined className="text-success" />
            ) : (
              <FallOutlined className="text-error" />
            )}
            <Text
              strong
              className={isTop ? 'text-success' : 'text-error'}
            >
              {item.placementRate || item.score || 0}%
            </Text>
          </div>
          <Text className="text-xs text-slate-500">
            {item.selectedApplications || item.studentsPlaced || 0} placed
          </Text>
        </div>
      </div>
    </List.Item>
  );
};

const TopPerformers = ({ topPerformers = [], bottomPerformers = [], loading }) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {/* Top Performers */}
      <Card
        title={
          <div className="flex items-center gap-2">
            <TrophyOutlined className="text-warning" />
            <span>Top Performers</span>
          </div>
        }
        className="shadow-sm border-slate-200"
        loading={loading}
      >
        {topPerformers.length > 0 ? (
          <List
            dataSource={topPerformers.slice(0, 5)}
            renderItem={(item, index) => (
              <PerformerItem item={item} rank={index} type="top" />
            )}
            split={false}
          />
        ) : (
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description="No data available"
          />
        )}
      </Card>

      {/* Bottom Performers (Needs Attention) */}
      <Card
        title={
          <div className="flex items-center gap-2">
            <Badge status="warning" />
            <span>Needs Attention</span>
          </div>
        }
        className="shadow-sm border-slate-200"
        loading={loading}
      >
        {bottomPerformers.length > 0 ? (
          <List
            dataSource={bottomPerformers.slice(0, 5)}
            renderItem={(item, index) => (
              <PerformerItem item={item} rank={index} type="bottom" />
            )}
            split={false}
          />
        ) : (
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description="All institutions performing well"
          />
        )}
      </Card>
    </div>
  );
};

export default TopPerformers;