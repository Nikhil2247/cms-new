import React from 'react';
import { Typography, Button, DatePicker, Tooltip } from 'antd';
import {
  BankOutlined,
  ReloadOutlined,
  DownloadOutlined,
  CalendarOutlined,
} from '@ant-design/icons';

const { Title, Paragraph } = Typography;

const DashboardHeader = ({
  userName,
  onRefresh,
  onExport,
  selectedMonth,
  onMonthChange,
  exporting,
}) => {
  const currentDate = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return (
    <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-6 mb-6">
      <div className="flex items-center">
        <div className="w-10 h-10 flex items-center justify-center rounded-xl bg-surface border border-border text-primary shadow-sm mr-3">
          <BankOutlined className="text-lg" />
        </div>
        <div>
          <Title level={2} className="mb-0 text-text-primary text-2xl">
            State Dashboard
          </Title>
          <Paragraph className="text-text-secondary text-sm mb-0">
            Welcome back, <span className="font-semibold text-primary">{userName || 'Administrator'}</span> • {currentDate}
          </Paragraph>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 w-full xl:w-auto">
        <DatePicker.MonthPicker
          placeholder="Filter by Month"
          onChange={onMonthChange}
          value={selectedMonth}
          className="w-full sm:w-48 h-10 rounded-lg border-border"
          suffixIcon={<CalendarOutlined className="text-text-tertiary" />}
        />
        
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <Tooltip title="Refresh Data">
            <Button
              icon={<ReloadOutlined />}
              onClick={onRefresh}
              className="flex-1 sm:flex-none w-10 h-10 flex items-center justify-center rounded-xl bg-surface border border-border text-text-secondary shadow-sm hover:bg-surface-hover hover:scale-105 active:scale-95 transition-all duration-200"
            />
          </Tooltip>

          <Button
            type="primary"
            icon={<DownloadOutlined />}
            onClick={onExport}
            loading={exporting}
            className="flex-1 sm:flex-none h-10 rounded-xl font-bold shadow-lg shadow-primary/20 bg-primary border-0"
          >
            Export Report
          </Button>
        </div>
      </div>
    </div>
  );
};

export default DashboardHeader;