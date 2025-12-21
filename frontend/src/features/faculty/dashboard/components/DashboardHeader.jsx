import React from 'react';
import { Typography, Button, Tooltip } from 'antd';
import {
  UserOutlined,
  ReloadOutlined,
  IdcardOutlined,
} from '@ant-design/icons';

const { Title, Paragraph } = Typography;

const DashboardHeader = ({ facultyName, stats, onRefresh, loading }) => {
  const currentDate = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return (
    <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6 mb-6">
      <div className="flex items-center">
        <div className="w-10 h-10 flex items-center justify-center rounded-xl bg-surface border border-border text-primary shadow-sm mr-3">
          <IdcardOutlined className="text-lg" />
        </div>
        <div>
          <Title level={2} className="mb-0 text-text-primary text-2xl">
            Faculty Dashboard
          </Title>
          <Paragraph className="text-text-secondary text-sm mb-0">
            Welcome back, <span className="font-semibold text-primary">{facultyName || 'Faculty'}</span> • {currentDate}
          </Paragraph>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <Tooltip title="Refresh Data">
          <Button
            icon={<ReloadOutlined spin={loading} />}
            onClick={onRefresh}
            className="w-10 h-10 flex items-center justify-center rounded-xl bg-surface border border-border text-text-secondary shadow-sm hover:bg-surface-hover hover:scale-105 active:scale-95 transition-all duration-200"
          />
        </Tooltip>
      </div>
    </div>
  );
};

export default DashboardHeader;