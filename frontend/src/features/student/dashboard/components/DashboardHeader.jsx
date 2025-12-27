import React from 'react';
import { Typography, Button, Tooltip } from 'antd';
import {
  ReloadOutlined,
  ReadOutlined,
  UserOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';

const { Title, Paragraph, Text } = Typography;

const DashboardHeader = ({ studentName, instituteName, mentorName, onRefresh, loading, isRevalidating }) => {
  const currentDate = dayjs().format('dddd, MMMM D, YYYY');

  return (
    <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6 mb-8 animate-fade-in">
      <div className="flex items-center group">
        <div className="w-14 h-14 flex items-center justify-center rounded-2xl bg-surface border border-gray-100 text-blue-600 shadow-sm mr-5 group-hover:scale-105 group-hover:shadow-md transition-all duration-300">
          <ReadOutlined className="text-2xl" />
        </div>
        <div>
          <Title level={2} className="!mb-1 !text-gray-900 !text-2xl lg:!text-3xl tracking-tight">
            Student Dashboard
          </Title>
          <Paragraph className="!text-gray-500 !text-sm lg:!text-base !mb-0 font-medium">
            Welcome back, <span className="font-bold text-blue-600">{studentName || 'Student'}</span> • {currentDate}
          </Paragraph>
        </div>
      </div>

      <div className="flex items-center gap-4 w-full lg:w-auto">
        {mentorName && (
          <div className="hidden md:flex items-center gap-3 px-4 py-2.5 rounded-xl bg-surface border border-gray-100 shadow-sm hover:shadow-md transition-all duration-300 flex-1 lg:flex-none">
            <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-600">
              <UserOutlined />
            </div>
            <div>
              <Text className="text-[10px] uppercase font-bold text-gray-400 block leading-none mb-1 tracking-wider">
                Assigned Mentor
              </Text>
              <Text className="text-sm font-bold text-gray-800 leading-none block">
                {mentorName}
              </Text>
            </div>
          </div>
        )}

        <Tooltip title="Refresh Dashboard">
          <Button
            icon={<ReloadOutlined spin={loading || isRevalidating} />}
            onClick={onRefresh}
            size="large"
            className="w-12 h-12 flex items-center justify-center rounded-xl border-gray-200 text-gray-500 hover:text-blue-600 hover:border-blue-200 hover:bg-blue-50 shadow-sm hover:shadow-md transition-all duration-300"
          />
        </Tooltip>
      </div>
    </div>
  );
};

export default DashboardHeader;