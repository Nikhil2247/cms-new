import React from 'react';
import { Typography, Button, Tooltip } from 'antd';
import {
  UserOutlined,
  ReloadOutlined,
} from '@ant-design/icons';

const { Title, Paragraph } = Typography;

const DashboardHeader = ({ facultyName, stats, onRefresh, loading, lastFetched }) => {
  const currentDate = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return (
    <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center !gap-4 !mb-4">
      <div className="flex items-center">
        <div>
          <div className="flex items-center gap-3">
            <Title level={4} className="mb-0 text-text-primary text-xl">
              Faculty Dashboard
            </Title>
            {lastFetched && (
              <span className="text-[10px] text-text-tertiary">
                Updated {new Date(lastFetched).toLocaleTimeString()}
              </span>
            )}
          </div>
          <Paragraph className="text-text-secondary text-xs mb-0">
            Welcome back, <span className="font-semibold text-primary">{facultyName || 'Faculty'}</span> • {currentDate}
          </Paragraph>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <Tooltip title="Refresh Data">
          <Button
            icon={<ReloadOutlined spin={loading} />}
            onClick={onRefresh}
            className="w-8 h-8 flex items-center justify-center !rounded-lg bg-surface border border-border text-text-secondary shadow-sm hover:bg-surface-hover hover:scale-105 active:scale-95 transition-all duration-200"
          />
        </Tooltip>
      </div>
    </div>
  );
};

export default DashboardHeader;