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

  // Handle view all click - navigate to notifications page
  const handleViewAll = () => {
    setOpen(false);
    setDrawerOpen(false);
    navigate('/notifications');
  };

  // Handle opening drawer
  const handleOpenDrawer = () => {
    setOpen(false);
    setDrawerOpen(true);
  };

  // Dropdown content
  const dropdownContent = (
    <div
      className={`notification-dropdown ${darkMode ? 'dark' : ''} w-[380px] max-h-[480px] bg-background rounded-xl shadow-soft-lg overflow-hidden`}
    >
      {/* Header */}
      <div className="px-5 py-4 border-b border-border/50">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Title level={5} className="!m-0">
              Notifications
            </Title>
            {isConnected && (
              <Tooltip title="Real-time connected">
                <WifiOutlined className="text-green-500 text-xs" />
              </Tooltip>
            )}
          </div>
          <Space>
            {unreadCount > 0 && (
              <Tooltip title="Mark all as read">
                <Button
                  type="text"
                  size="small"
                  icon={<CheckOutlined />}
                  onClick={markAllAsRead}
                />
              </Tooltip>
            )}
            <Tooltip title="View all">
              <Button
                type="text"
                size="small"
                icon={<EyeOutlined />}
                onClick={handleOpenDrawer}
              />
            </Tooltip>
          </Space>
        </div>
        {unreadCount > 0 && (
          <Tag color="blue" className="mb-0">
            {unreadCount} unread
          </Tag>
        )}
      </div>

      {/* Notification List */}
      <div className="max-h-[360px] overflow-y-auto flex flex-col">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Spin />
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
          <Empty
            image={<InboxOutlined className="text-5xl text-text-tertiary" />}
            description={<Text type="secondary">No notifications yet</Text>}
            className="py-10"
          />
        )}
      </div>

      {/* Footer */}
      {notifications.length > maxItems && (
        <div className="px-5 py-3 border-t border-border/50 text-center">
          <Button type="link" onClick={handleViewAll}>
            View all {notifications.length} notifications
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
      >
        <Badge count={unreadCount} size="small" offset={[-2, 2]}>
          <Button
            type="text"
            icon={<BellOutlined className="text-lg" />}
            className="w-10 h-10 flex items-center justify-center rounded-xl bg-surface border border-border text-text-secondary shadow-sm hover:bg-surface-hover hover:scale-105 active:scale-95 transition-all duration-200"
          />
        </Badge>
      </Dropdown>

      {/* Full Notification Drawer */}
      <Drawer
        title={
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span>All Notifications</span>
              {isConnected && (
                <Tooltip title="Real-time connected">
                  <WifiOutlined className="text-green-500 text-sm" />
                </Tooltip>
              )}
            </div>
            <Space>
              {notifications.length > 0 && (
                <>
                  <Button type="link" onClick={handleViewAll} size="small">
                    Open Full Page
                  </Button>
                  <Popconfirm
                    title="Clear all notifications?"
                    onConfirm={clearAll}
                    okText="Yes"
                    cancelText="No"
                  >
                    <Button type="text" danger icon={<ClearOutlined />} size="small">
                      Clear All
                    </Button>
                  </Popconfirm>
                </>
              )}
            </Space>
          </div>
        }
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        styles={{ wrapper: { width: 420 } }}
        placement="right"
      >
        <Input
          placeholder="Search notifications..."
          prefix={<SearchOutlined />}
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          allowClear
          className="mb-4"
        />

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Spin />
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
          <Empty
            image={<InboxOutlined className="text-5xl text-text-tertiary" />}
            description={
              <Text type="secondary">
                {searchText ? 'No matching notifications' : 'No notifications yet'}
              </Text>
            }
            className="py-10"
          />
        )}
      </Drawer>
    </>
  );
};

export default NotificationDropdown;
