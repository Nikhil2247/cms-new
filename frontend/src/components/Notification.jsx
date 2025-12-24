import React, { useState, useEffect, useRef } from 'react';
import {
  Dropdown,
  Badge,
  Button,
  List,
  Typography,
  Empty,
  Divider,
  Space,
  Tag,
  Avatar,
  Tooltip,
  Popconfirm,
  message,
  Drawer,
  Spin,
  Input,
  theme,
} from 'antd';
import {
  BellOutlined,
  DeleteOutlined,
  CheckOutlined,
  EyeOutlined,
  ClearOutlined,
  InboxOutlined,
  BookOutlined,
  TrophyOutlined,
  CalendarOutlined,
  DollarOutlined,
  TeamOutlined,
  NotificationOutlined,
  UserOutlined,
  ExperimentOutlined,
  SearchOutlined,
} from '@ant-design/icons';
import { useTheme } from '../contexts/ThemeContext';
import api from '../services/api';

const { Text, Title } = Typography;

const NotificationDropdown = () => {
  const { token } = theme.useToken();
  const [notifications, setNotifications] = useState([]);
  const [open, setOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [searchText, setSearchText] = useState('');
  const { darkMode } = useTheme();
  const [user, setUser] = useState(null);
  const isInitialized = useRef(false);

  // Parse user data
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        setUser(payload);
      } catch (error) {
        // Token parse error handled silently
      }
    }
  }, []);

  // Load notifications on mount
  useEffect(() => {
    if (user?.sub && !isInitialized.current) {
      loadNotifications();
      isInitialized.current = true;
    }
  }, [user?.sub]);

  const loadNotifications = async () => {
    try {
      setLoading(true);
      const response = await api.get(`/shared/notifications`);
      if (response.data?.data) {
        setNotifications(response.data.data || []);
      }
    } catch (error) {
      // Notification load error handled
    } finally {
      setLoading(false);
    }
  };

  const getNotificationIcon = (type) => {
    const iconStyle = { fontSize: '16px' };
    switch (type) {
      case 'internship':
      case 'ELIGIBLE_INTERNSHIPS':
        return <ExperimentOutlined style={iconStyle} />;
      case 'assignment':
        return <BookOutlined style={iconStyle} />;
      case 'exam':
      case 'examSchedule':
        return <CalendarOutlined style={iconStyle} />;
      case 'placement':
        return <TrophyOutlined style={iconStyle} />;
      case 'fee':
      case 'feeReminder':
        return <DollarOutlined style={iconStyle} />;
      case 'announcement':
        return <TeamOutlined style={iconStyle} />;
      case 'attendance':
        return <UserOutlined style={iconStyle} />;
      default:
        return <NotificationOutlined style={iconStyle} />;
    }
  };

  const markAsRead = async (id) => {
    try {
      await api.put(`/shared/notifications/${id}/read`);
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, read: true } : n))
      );
    } catch (error) {
      // Mark read error handled
    }
  };

  const markAllAsRead = async () => {
    try {
      await api.put('/shared/notifications/read-all');
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
      message.success('All notifications marked as read');
    } catch (error) {
      // Mark all read error handled
    }
  };

  const deleteNotification = async (id) => {
    try {
      await api.delete(`/shared/notifications/${id}`);
      setNotifications((prev) => prev.filter((n) => n.id !== id));
      message.success('Notification deleted');
    } catch (error) {
      // Delete error handled
    }
  };

  const clearAllNotifications = async () => {
    try {
      // Delete all notifications (one by one for now)
      for (const n of notifications) {
        await api.delete(`/shared/notifications/${n.id}`);
      }
      setNotifications([]);
      message.success('All notifications cleared');
    } catch (error) {
      // Clear error handled
    }
  };

  const formatTimeAgo = (timestamp) => {
    const now = new Date();
    const time = new Date(timestamp);
    const diff = Math.floor((now - time) / 1000);

    if (diff < 60) return 'Just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
    return time.toLocaleDateString();
  };

  const unreadCount = notifications.filter((n) => !n.read).length;

  const filteredNotifications = notifications.filter((n) => {
    if (!searchText) return true;
    const search = searchText.toLowerCase();
    return (
      n.title?.toLowerCase().includes(search) ||
      n.body?.toLowerCase().includes(search)
    );
  });

  const renderNotificationItem = (item) => (
    <List.Item
      key={item.id}
      className={`notification-item cursor-pointer transition-all duration-200 border-b border-border/50 ${
        !item.read ? 'bg-primary-50 dark:bg-primary-900/20' : ''
      }`}
      style={{
        padding: '12px 16px',
      }}
      onClick={() => {
        if (!item.read) markAsRead(item.id);
      }}
    >
      <List.Item.Meta
        avatar={
          <Avatar
            size={40}
            className="bg-background-tertiary flex items-center justify-center"
          >
            {getNotificationIcon(item.type)}
          </Avatar>
        }
        title={
          <div className="flex items-center justify-between">
            <Text strong className={!item.read ? 'text-primary' : ''}>
              {item.title}
            </Text>
            {!item.read && (
              <span className="w-2 h-2 bg-primary rounded-full" />
            )}
          </div>
        }
        description={
          <div>
            <Text
              type="secondary"
              className="text-sm line-clamp-2 block mb-1"
            >
              {item.body}
            </Text>
            <div className="flex items-center justify-between mt-1">
              <Text type="secondary" className="text-xs">
                {formatTimeAgo(item.createdAt || item.timestamp)}
              </Text>
              <Space size="small">
                {!item.read && (
                  <Tooltip title="Mark as read">
                    <Button
                      type="text"
                      size="small"
                      icon={<CheckOutlined />}
                      onClick={(e) => {
                        e.stopPropagation();
                        markAsRead(item.id);
                      }}
                    />
                  </Tooltip>
                )}
                <Tooltip title="Delete">
                  <Popconfirm
                    title="Delete notification?"
                    onConfirm={(e) => {
                      e?.stopPropagation();
                      deleteNotification(item.id);
                    }}
                    okText="Yes"
                    cancelText="No"
                  >
                    <Button
                      type="text"
                      size="small"
                      danger
                      icon={<DeleteOutlined />}
                      onClick={(e) => e.stopPropagation()}
                    />
                  </Popconfirm>
                </Tooltip>
              </Space>
            </div>
          </div>
        }
      />
    </List.Item>
  );

  const dropdownContent = (
    <div
      className={`notification-dropdown ${darkMode ? 'dark' : ''} w-[380px] max-h-[480px] bg-background rounded-xl shadow-soft-lg overflow-hidden`}
    >
      {/* Header */}
      <div
        className="px-5 py-4 border-b border-border/50"
      >
        <div className="flex items-center justify-between mb-3">
          <Title level={5} className="!m-0">
            Notifications
          </Title>
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
                onClick={() => {
                  setOpen(false);
                  setDrawerOpen(true);
                }}
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
      <div className="max-h-[360px] overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Spin />
          </div>
        ) : notifications.length > 0 ? (
          <List
            dataSource={notifications.slice(0, 5)}
            renderItem={renderNotificationItem}
          />
        ) : (
          <Empty
            image={<InboxOutlined className="text-5xl text-text-tertiary" />}
            description={
              <Text type="secondary">No notifications yet</Text>
            }
            className="py-10"
          />
        )}
      </div>

      {/* Footer */}
      {notifications.length > 5 && (
        <div
          className="px-5 py-3 border-t border-border/50 text-center"
        >
          <Button
            type="link"
            onClick={() => {
              setOpen(false);
              setDrawerOpen(true);
            }}
          >
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
            <span>All Notifications</span>
            {notifications.length > 0 && (
              <Popconfirm
                title="Clear all notifications?"
                onConfirm={clearAllNotifications}
                okText="Yes"
                cancelText="No"
              >
                <Button type="text" danger icon={<ClearOutlined />} size="small">
                  Clear All
                </Button>
              </Popconfirm>
            )}
          </div>
        }
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        width={420}
        placement="right"
      >
        <Input
          placeholder="Search notifications..."
          prefix={<SearchOutlined />}
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          style={{ marginBottom: 16 }}
        />

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Spin />
          </div>
        ) : filteredNotifications.length > 0 ? (
          <List
            dataSource={filteredNotifications}
            renderItem={renderNotificationItem}
          />
        ) : (
          <Empty
            image={<InboxOutlined style={{ fontSize: 48, color: token.colorTextDisabled }} />}
            description={
              <Text type="secondary">
                {searchText ? 'No matching notifications' : 'No notifications yet'}
              </Text>
            }
            style={{ padding: '40px 0' }}
          />
        )}
      </Drawer>
    </>
  );
};

export default NotificationDropdown;