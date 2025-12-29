import React, { useState, useMemo } from 'react';
import {
  Dropdown,
  Badge,
  Button,
  Typography,
  Empty,
  Space,
  Tag,
  Tooltip,
  Popconfirm,
  Drawer,
  Spin,
  Input,
} from 'antd';
import {
  BellOutlined,
  CheckOutlined,
  EyeOutlined,
  ClearOutlined,
  InboxOutlined,
  SearchOutlined,
  WifiOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '../../../contexts/ThemeContext';
import { useNotifications } from './useNotifications';
import NotificationItem from './NotificationItem';
import { searchNotifications } from './notificationUtils.jsx';

const { Text, Title } = Typography;

/**
 * Notification dropdown component for the header
 * Shows recent notifications with real-time updates
 */
const NotificationDropdown = ({ maxItems = 5 }) => {
  const navigate = useNavigate();
  const { darkMode } = useTheme();

  const [open, setOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [searchText, setSearchText] = useState('');

  const {
    notifications,
    unreadCount,
    loading,
    isConnected,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    clearAll,
  } = useNotifications();

  // Filter notifications by search in drawer
  const filteredNotifications = useMemo(() => {
    if (!searchText) return notifications;
    return searchNotifications(notifications, searchText);
  }, [notifications, searchText]);

  // Handle view all click - open drawer instead of navigating
  const handleViewAll = () => {
    setOpen(false);
    setDrawerOpen(true);
  };

  // Handle opening drawer
  const handleOpenDrawer = () => {
    setOpen(false);
    setDrawerOpen(true);
  };

  // Dropdown content
  const dropdownContent = (
    <div
      className={`notification-dropdown ${darkMode ? 'dark' : ''} w-[380px] max-h-[520px] bg-surface rounded-2xl shadow-2xl border border-border overflow-hidden animate-fade-in`}
    >
      {/* Header */}
      <div className="px-5 py-4 border-b border-border bg-surface sticky top-0 z-10">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Title level={5} className="!m-0 !text-gray-900 dark:!text-white">
              Notifications
            </Title>
            {isConnected && (
              <Tooltip title="Real-time connected">
                <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              </Tooltip>
            )}
          </div>
          <Space>
            {unreadCount > 0 && (
              <Tooltip title="Mark all as read">
                <Button
                  type="text"
                  size="small"
                  className="text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20"
                  icon={<CheckOutlined />}
                  onClick={markAllAsRead}
                />
              </Tooltip>
            )}
            <Tooltip title="Expand to side panel">
              <Button
                type="text"
                size="small"
                className="text-gray-500 hover:bg-gray-100 dark:hover:bg-slate-800"
                icon={<EyeOutlined />}
                onClick={handleOpenDrawer}
              />
            </Tooltip>
          </Space>
        </div>
        {unreadCount > 0 && (
          <div className="flex items-center gap-2">
            <Tag color="blue" className="m-0 rounded-full border-0 font-bold px-2 py-0 text-[10px] uppercase tracking-wider">
              {unreadCount} New
            </Tag>
          </div>
        )}
      </div>

      {/* Notification List */}
      <div className="max-h-[380px] overflow-y-auto flex flex-col bg-surface">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <Spin size="small" />
            <Text className="text-gray-400 text-xs font-medium">Checking for updates...</Text>
          </div>
        ) : notifications.length > 0 ? (
          notifications.slice(0, maxItems).map((item) => (
            <NotificationItem
              key={item.id}
              notification={item}
              onMarkAsRead={markAsRead}
              onDelete={deleteNotification}
              compact
            />
          ))
        ) : (
          <div className="py-16 flex flex-col items-center justify-center px-6">
            <div className="w-16 h-16 bg-background-secondary rounded-full flex items-center justify-center mb-4">
              <InboxOutlined className="text-3xl text-gray-300 dark:text-slate-600" />
            </div>
            <Text className="text-gray-500 dark:text-slate-400 font-medium">All caught up!</Text>
            <Text className="text-gray-400 dark:text-slate-500 text-xs text-center mt-1">No new notifications at the moment.</Text>
          </div>
        )}
      </div>

      {/* Footer */}
      {notifications.length > 0 && (
        <div className="px-5 py-3 border-t border-border bg-background-secondary/50 text-center">
          <Button 
            type="link" 
            onClick={handleViewAll}
            className="text-blue-600 font-semibold text-xs"
          >
            View all notifications
          </Button>
        </div>
      )}
    </div>
  );

  return (
    <>
      <Dropdown
        popupRender={() => dropdownContent}
        trigger={['click']}
        open={open}
        onOpenChange={setOpen}
        placement="bottomRight"
        overlayClassName="notification-dropdown-overlay"
      >
        <Badge 
          count={unreadCount} 
          size="small" 
          offset={[-4, 4]}
          className="hover:scale-110 transition-transform"
        >
          <Button
            type="text"
            icon={<BellOutlined className="text-xl" />}
            className="w-10 h-10 flex items-center justify-center rounded-xl bg-surface border border-border text-gray-600 dark:text-gray-300 shadow-sm hover:text-blue-600 dark:hover:text-blue-400 hover:border-blue-100 dark:hover:border-blue-900/50 transition-all duration-200"
          />
        </Badge>
      </Dropdown>

      {/* Full Notification Drawer */}
      <Drawer
        title={
          <div className="flex items-center justify-between w-full pr-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center text-blue-600">
                <BellOutlined />
              </div>
              <span className="font-bold text-gray-900 dark:text-white">Recent Activity</span>
            </div>
            <div className="flex items-center gap-2">
              {notifications.length > 0 && (
                <Popconfirm
                  title="Clear all?"
                  description="This will remove all notifications."
                  onConfirm={clearAll}
                  okText="Yes"
                  cancelText="No"
                  placement="bottomRight"
                >
                  <Button type="text" danger size="small" className="text-xs font-semibold px-2">
                    Clear All
                  </Button>
                </Popconfirm>
              )}
            </div>
          </div>
        }
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        width={420}
        placement="right"
        className="notification-drawer"
        styles={{ 
          header: { borderBottom: '1px solid #f3f4f6', padding: '20px 24px' },
          body: { padding: 0, background: darkMode ? '#0f172a' : '#ffffff' },
          content: { background: darkMode ? '#0f172a' : '#ffffff', borderRadius: '24px 0 0 24px' }
        }}
      >
        <div className="p-5 bg-background-secondary/50 dark:bg-surface sticky top-0 z-10 border-b border-border">
          <Input
            placeholder="Search notifications..."
            prefix={<SearchOutlined className="text-gray-400" />}
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            allowClear
            className="rounded-xl h-10 bg-surface border-border"
          />
        </div>

        <div className="flex flex-col bg-surface min-h-full">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3">
              <Spin />
              <Text className="text-gray-400 font-medium">Loading notifications...</Text>
            </div>
          ) : filteredNotifications.length > 0 ? (
            <div className="flex flex-col">
              {filteredNotifications.map((item) => (
                <NotificationItem
                  key={item.id}
                  notification={item}
                  onMarkAsRead={markAsRead}
                  onDelete={deleteNotification}
                />
              ))}
            </div>
          ) : (
            <div className="py-24 flex flex-col items-center justify-center px-8 text-center">
              <div className="w-20 h-20 bg-background-secondary rounded-full flex items-center justify-center mb-6">
                <InboxOutlined className="text-4xl text-gray-300 dark:text-slate-600" />
              </div>
              <Title level={5} className="!mb-2 dark:!text-white">
                {searchText ? 'No results found' : 'No notifications'}
              </Title>
              <Text className="text-gray-500 dark:text-slate-400">
                {searchText ? `No notifications matching "${searchText}"` : "We'll notify you when something important happens."}
              </Text>
            </div>
          )}
        </div>
      </Drawer>
    </>
  );
};

export default NotificationDropdown;
