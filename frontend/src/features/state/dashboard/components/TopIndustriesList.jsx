import React from 'react';
import { Card, List, Avatar, Typography, Tag, Progress, Empty, Tooltip, Badge } from 'antd';
import {
  ShopOutlined,
  TeamOutlined,
  StarFilled,
  RightOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';

const { Text } = Typography;

const IndustryItem = ({ item, rank }) => {
  const getRankClass = (rank) => {
    if (rank === 0) return 'bg-yellow-400';
    if (rank === 1) return 'bg-gray-400';
    if (rank === 2) return 'bg-amber-600';
    return 'bg-gray-500';
  };

  return (
    <List.Item className="!px-3 !py-2 rounded-xl hover:bg-background-tertiary transition-colors mb-1 border-b border-border/50 last:border-0">
      <div className="flex items-center w-full gap-3">
        <div
          className={`w-6 h-6 rounded-full flex items-center justify-center text-white font-bold text-xs shrink-0 ${getRankClass(rank)}`}
        >
          {rank + 1}
        </div>
        <Avatar
          icon={<ShopOutlined />}
          className="bg-primary shrink-0"
          src={item.logo}
          size="small"
        />
        <div className="flex-1 min-w-0">
          <Tooltip title={item.name}>
            <Text strong className="block truncate text-text-primary text-sm">{item.name}</Text>
          </Tooltip>
          <div className="flex items-center gap-2">
            <TeamOutlined className="text-text-tertiary text-xs" />
            <Text className="text-xs text-text-tertiary">
              {item.internsHired || 0} interns
            </Text>
            {item.rating && (
              <>
                <span className="text-border">|</span>
                <StarFilled className="text-warning text-xs" />
                <Text className="text-xs text-text-tertiary">
                  {item.rating}
                </Text>
              </>
            )}
          </div>
        </div>
        <div className="text-right shrink-0">
          <Tag color={item.activePostings > 0 ? 'green' : 'default'} className="m-0 rounded-md border-0 text-[10px] font-bold">
            {item.activePostings || 0} ACTIVE
          </Tag>
        </div>
      </div>
    </List.Item>
  );
};

const TopIndustriesList = ({ industries = [], loading, onViewAll }) => {
  const navigate = useNavigate();

  return (
    <Card
      title={
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
            <ShopOutlined className="text-primary text-lg" />
          </div>
          <span className="font-bold text-text-primary text-lg">Top Partners</span>
        </div>
      }
      extra={
        onViewAll && (
          <a onClick={onViewAll} className="flex items-center gap-1 font-bold text-xs text-primary hover:text-primary-600">
            View All <RightOutlined className="text-[10px]" />
          </a>
        )
      }
      className="shadow-sm border-border rounded-2xl bg-surface h-full"
      loading={loading}
      styles={{ header: { borderBottom: '1px solid var(--color-border)', padding: '16px 20px' }, body: { padding: '12px' } }}
    >
      {industries.length > 0 ? (
        <List
          dataSource={industries.slice(0, 5)}
          renderItem={(item, index) => (
            <IndustryItem item={item} rank={index} />
          )}
          split={false}
        />
      ) : (
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description={<span className="text-text-tertiary">No industry partners yet</span>}
          className="py-8"
        />
      )}
    </Card>
  );
};

export default TopIndustriesList;