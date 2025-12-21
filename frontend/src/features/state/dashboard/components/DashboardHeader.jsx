import React from 'react';
import { Typography, Button, DatePicker, Tooltip } from 'antd';
import {
  CalendarOutlined,
  DownloadOutlined,
  ReloadOutlined,
  FilterOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';

const { Title, Text } = Typography;

const DashboardHeader = ({ userName, onRefresh, onExport, selectedMonth, onMonthChange, exporting = false }) => {
  const currentDate = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return (
    <div className="mb-6">
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
        {/* Left Section - Welcome */}
        <div>
          <div className="flex items-center gap-2 text-slate-600 text-sm mb-2">
            <CalendarOutlined />
            <span>{currentDate}</span>
          </div>
          <Title level={2} className="!mb-1 !text-slate-900">
            Welcome back, <span className="text-primary">{userName || 'Administrator'}</span>
          </Title>
          <Text className="text-slate-600 text-base">
            State Directorate Dashboard - Monitor all institutions and their performance
          </Text>
        </div>

        {/* Right Section - Actions */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Month Filter */}
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-background-tertiary border border-border">
            <FilterOutlined className="text-slate-600 text-sm" />
            <DatePicker
              picker="month"
              value={selectedMonth ? dayjs(selectedMonth) : null}
              onChange={(date) => onMonthChange?.(date?.toDate())}
              placeholder="Filter by month"
              allowClear
              variant="borderless"
              className="
                !px-0 !py-0 !bg-transparent
                [&_.ant-picker-input>input]:!text-sm
                [&_.ant-picker-input>input]:!text-slate-900
                [&_.ant-picker-input>input::placeholder]:!text-slate-500
              "
              style={{ width: 140 }}
            />
          </div>

          {/* Refresh Button */}
          {onRefresh && (
            <Tooltip title="Refresh data">
              <Button
                icon={<ReloadOutlined />}
                onClick={onRefresh}
                className="
                  h-10 px-4 rounded-xl
                  border-border hover:border-primary
                  text-text-secondary hover:text-primary
                  transition-all duration-200
                "
              >
                <span className="hidden sm:inline ml-1">Refresh</span>
              </Button>
            </Tooltip>
          )}

          {/* Export Button */}
          {onExport && (
            <Button
              type="primary"
              icon={<DownloadOutlined />}
              onClick={onExport}
              loading={exporting}
              disabled={exporting}
              className="
                h-10 px-5 rounded-xl font-medium
                shadow-lg shadow-primary/20
                hover:shadow-xl hover:shadow-primary/30
                transition-all duration-200
              "
            >
              <span className="hidden sm:inline ml-1">
                {exporting ? 'Exporting...' : 'Export Report'}
              </span>
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};

export default DashboardHeader;