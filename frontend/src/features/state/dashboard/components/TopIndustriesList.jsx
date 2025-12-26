import React from 'react';
import { Card, Avatar, Typography, Tag, Empty, Tooltip } from 'antd';
import {
  ShopOutlined,
  TeamOutlined,
  BankOutlined,
  DollarOutlined,
  RightOutlined,
} from '@ant-design/icons';

const { Text } = Typography;

const CompanyItem = ({ item, rank }) => {
  const getRankClass = (rank) => {
    if (rank === 0) return 'bg-yellow-400';
    if (rank === 1) return 'bg-gray-400';
    if (rank === 2) return 'bg-amber-600';
    return 'bg-gray-500';
  };

  // Format stipend for display
  const formatStipend = (amount) => {
    if (!amount) return null;
    if (amount >= 1000) return `₹${(amount / 1000).toFixed(0)}k`;
    return `₹${amount}`;
  };

  return (
    <div className="!px-3 !py-2 rounded-xl hover:bg-background-tertiary transition-colors mb-1 border-b border-border/50 last:border-0">
      <div className="flex items-center w-full gap-3">
        <div
          className={`w-6 h-6 rounded-full flex items-center justify-center text-white font-bold text-xs shrink-0 ${getRankClass(rank)}`}
        >
          {rank + 1}
        </div>
        <Avatar
          icon={<ShopOutlined />}
          className="bg-primary shrink-0"
          size="small"
        >
          {item.name?.charAt(0)?.toUpperCase()}
        </Avatar>
        <div className="flex-1 min-w-0">
          <Tooltip title={item.name}>
            <Text strong className="block truncate text-text-primary text-sm">{item.name}</Text>
          </Tooltip>
          <div className="flex items-center gap-2 flex-wrap">
            <Tooltip title="Interns hired">
              <span className="flex items-center gap-1">
                <TeamOutlined className="text-text-tertiary text-xs" />
                <Text className="text-xs text-text-tertiary">
                  {item.internsHired || 0}
                </Text>
              </span>
            </Tooltip>
            {item.institutionsCount > 1 && (
              <Tooltip title="From different institutions">
                <span className="flex items-center gap-1">
                  <BankOutlined className="text-text-tertiary text-xs" />
                  <Text className="text-xs text-text-tertiary">
                    {item.institutionsCount}
                  </Text>
                </span>
              </Tooltip>
            )}
            {item.avgStipend > 0 && (
              <Tooltip title="Average stipend">
                <span className="flex items-center gap-1">
                  <DollarOutlined className="text-text-tertiary text-xs" />
                  <Text className="text-xs text-text-tertiary">
                    {formatStipend(item.avgStipend)}
                  </Text>
                </span>
              </Tooltip>
            )}
          </div>
        </div>
        <div className="text-right shrink-0">
          <Tag color="blue" className="m-0 rounded-md border-0 text-[10px] font-bold">
            {item.internsHired || 0} INTERNS
          </Tag>
        </div>
      </div>
    </div>
  );
};

const TopIndustriesList = ({ industries = [], loading, onViewAll }) => {
  return (
    <Card
      title={
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
            <ShopOutlined className="text-primary text-lg" />
          </div>
          <span className="font-bold text-text-primary text-lg">Top Companies</span>
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
        <div className="flex flex-col">
          {industries.slice(0, 5).map((item, index) => (
            <CompanyItem key={item.id || index} item={item} rank={index} />
          ))}
        </div>
      ) : (
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description={<span className="text-text-tertiary">No companies with self-identified interns yet</span>}
          className="py-8"
        />
      )}
    </Card>
  );
};

export default TopIndustriesList;