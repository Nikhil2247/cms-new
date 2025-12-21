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
    <List.Item className="!px-0">
      <div className="flex items-center w-full gap-3">
        <div
          className={`w-7 h-7 rounded-full flex items-center justify-center text-white font-bold text-xs ${getRankClass(rank)}`}
        >
          {rank + 1}
        </div>
        <Avatar
          icon={<ShopOutlined />}
          className="bg-primary"
          src={item.logo}
        />
        <div className="flex-1 min-w-0">
          <Tooltip title={item.name}>
            <Text strong className="block truncate text-slate-900">{item.name}</Text>
          </Tooltip>
          <div className="flex items-center gap-2">
            <TeamOutlined className="text-slate-400 text-xs" />
            <Text className="text-xs text-slate-500">
              {item.internsHired || 0} interns
            </Text>
            {item.rating && (
              <>
                <span className="text-slate-300">|</span>
                <StarFilled className="text-warning-400 text-xs" />
                <Text className="text-xs text-slate-500">
                  {item.rating}
                </Text>
              </>
            )}
          </div>
        </div>
        <div className="text-right">
          <Tag color={item.activePostings > 0 ? 'green' : 'default'}>
            {item.activePostings || 0} Active
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
        <div className="flex items-center gap-2">
          <ShopOutlined className="text-primary" />
          <span>Top Industry Partners</span>
        </div>
      }
      extra={
        onViewAll && (
          <a onClick={onViewAll} className="flex items-center gap-1">
            View All <RightOutlined className="text-xs" />
          </a>
        )
      }
      className="shadow-sm border-slate-200"
      loading={loading}
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
          description="No industry partners yet"
        />
      )}
    </Card>
  );
};

export default TopIndustriesList;