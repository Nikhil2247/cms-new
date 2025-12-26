import React, { useState, useMemo } from 'react';
import {
  Dropdown,
  Badge,
  Button,
  Typography,
  Empty,
  Space,
  Tag,
  Avatar,
  Tooltip,
  Popconfirm,
  App,
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
  WifiOutlined,
} from '@ant-design/icons';
import { useTheme } from '../contexts/ThemeContext';
import { useNotifications } from '../hooks/useNotifications';

const { Text, Title } = Typography;

const NotificationDropdown = () => {
  const { token } = theme.useToken();
  const { message } = App.useApp();
  const [open, setOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [searchText, setSearchText] = useState('');
  const { darkMode } = useTheme();

  // Use the notifications hook for real-time updates
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

  const getNotificationIcon = (type) => {
    const iconStyle = { fontSize: '16px' };
    switch (type) {
      case 'internship':
      case 'INTERNSHIP_DEADLINE':
      case 'INTERNSHIP_APPLICATION':
      case 'INTERNSHIP_ACCEPTED':
      case 'INTERNSHIP_REJECTED':
      case 'ELIGIBLE_INTERNSHIPS':
        return <ExperimentOutlined style={iconStyle} />;
      case 'assignment':
      case 'MONTHLY_REPORT_REMINDER':
      case 'MONTHLY_REPORT_URGENT':
      case 'ASSIGNMENT_NEW':
      case 'ASSIGNMENT_DUE':
        return <BookOutlined style={iconStyle} />;
      case 'exam':
      case 'examSchedule':
      case 'EXAM_SCHEDULED':
      case 'EXAM_REMINDER':
        return <CalendarOutlined style={iconStyle} />;
      case 'placement':
      case 'PLACEMENT_UPDATE':
      case 'PLACEMENT_OFFER':
        return <TrophyOutlined style={iconStyle} />;
      case 'fee':
      case 'feeReminder':
      case 'FEE_DUE':
      case 'FEE_REMINDER':
        return <DollarOutlined style={iconStyle} />;
      case 'announcement':
      case 'ANNOUNCEMENT':
      case 'WEEKLY_SUMMARY':
        return <TeamOutlined style={iconStyle} />;
      case 'attendance':
      case 'ATTENDANCE_MARKED':
      case 'ATTENDANCE_WARNING':
        return <UserOutlined style={iconStyle} />;
      case 'GRIEVANCE_ASSIGNED':
      case 'GRIEVANCE_UPDATE':
      case 'GRIEVANCE_STATUS_CHANGED':
      case 'SUPPORT_TICKET_NEW':
        return <NotificationOutlined style={iconStyle} />;
      default:
        return <NotificationOutlined style={iconStyle} />;
    }
  };

  const handleMarkAsRead = async (id, e) => {
    if (e) e.stopPropagation();
    await markAsRead(id);
  };

  const handleMarkAllAsRead = async () => {
    await markAllAsRead();
    message.success('All notifications marked as read');
  };

  const handleDelete = async (id, e) => {
    if (e) e.stopPropagation();
    await deleteNotification(id);
  };

  const handleClearAll = async () => {
    await clearAll();
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

  const filteredNotifications = useMemo(() => {
    if (!searchText) return notifications;
    const search = searchText.toLowerCase();
    return notifications.filter((n) =>
      n.title?.toLowerCase().includes(search) ||
      n.body?.toLowerCase().includes(search)
    );
  }, [notifications, searchText]);

  const dropdownContent = (
    <div
      className={`notification-dropdown ${darkMode ? 'dark' : ''} w-[380px] max-h-[480px] bg-background rounded-xl shadow-soft-lg overflow-hidden`}
    >
      {/* Header */}
      <div
        className="px-5 py-4 border-b border-border/50"
      >
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
                  onClick={handleMarkAllAsRead}
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
      <div className="max-h-[360px] overflow-y-auto flex flex-col">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Spin />
          </div>
        ) : notifications.length > 0 ? (
          notifications.slice(0, 5).map((item, index) => (
            <div
              key={item.id || index}
              className={`
                notification-item cursor-pointer transition-all duration-200 border-b border-border/50 flex items-start gap-4 p-4
                ${!item.read ? 'bg-primary-50 dark:bg-primary-900/20' : ''}
              `}
              onClick={() => {
                if (!item.read) handleMarkAsRead(item.id);
              }}
            >
              <Avatar
                size={40}
                className="bg-background-tertiary flex items-center justify-center shrink-0"
              >
                {getNotificationIcon(item.type)}
              </Avatar>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1 gap-2">
                  <Text strong className={`text-sm truncate ${!item.read ? 'text-primary' : ''}`}>
                    {item.title}
                  </Text>
                  {!item.read && (
                    <span className="w-2 h-2 bg-primary rounded-full shrink-0" />
                  )}
                </div>
                <Text
                  type="secondary"
                  className="text-xs line-clamp-2 block mb-2"
                >
                  {item.body}
                </Text>
                <div className="flex items-center justify-between">
                  <Text type="secondary" className="text-[10px]">
                    {formatTimeAgo(item.createdAt || item.timestamp)}
                  </Text>
                  <Space size="small">
                    {!item.read && (
                      <Tooltip title="Mark as read">
                        <Button
                          type="text"
                          size="small"
                          icon={<CheckOutlined className="text-[10px]" />}
                          onClick={(e) => handleMarkAsRead(item.id, e)}
                          className="h-auto p-0"
                        />
                      </Tooltip>
                    )}
                    <Tooltip title="Delete">
                      <Popconfirm
                        title="Delete notification?"
                        onConfirm={(e) => handleDelete(item.id, e)}
                        okText="Yes"
                        cancelText="No"
                      >
                        <Button
                          type="text"
                          size="small"
                          danger
                          icon={<DeleteOutlined className="text-[10px]" />}
                          onClick={(e) => e.stopPropagation()}
                          className="h-auto p-0"
                        />
                      </Popconfirm>
                    </Tooltip>
                  </Space>
                </div>
              </div>
            </div>
          ))
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
            <div className="flex items-center gap-2">
              <span>All Notifications</span>
              {isConnected && (
                <Tooltip title="Real-time connected">
                  <WifiOutlined className="text-green-500 text-sm" />
                </Tooltip>
              )}
            </div>
            {notifications.length > 0 && (
              <Popconfirm
                title="Clear all notifications?"
                onConfirm={handleClearAll}
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
        styles={{ wrapper: { width: 420 } }}
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
          <div className="flex flex-col gap-2">
            {filteredNotifications.map((item, index) => (
              <div
                key={item.id || index}
                className={`
                  notification-item cursor-pointer transition-all duration-200 border-b border-border/50 flex items-start gap-4 p-4
                  ${!item.read ? 'bg-primary-50 dark:bg-primary-900/20' : ''}
                `}
                onClick={() => {
                  if (!item.read) handleMarkAsRead(item.id);
                }}
              >
                <Avatar
                  size={40}
                  className="bg-background-tertiary flex items-center justify-center shrink-0"
                >
                  {getNotificationIcon(item.type)}
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1 gap-2">
                    <Text strong className={`text-sm truncate ${!item.read ? 'text-primary' : ''}`}>
                      {item.title}
                    </Text>
                    {!item.read && (
                      <span className="w-2 h-2 bg-primary rounded-full shrink-0" />
                    )}
                  </div>
                  <Text
                    type="secondary"
                    className="text-xs line-clamp-2 block mb-2"
                  >
                    {item.body}
                  </Text>
                  <div className="flex items-center justify-between">
                    <Text type="secondary" className="text-[10px]">
                      {formatTimeAgo(item.createdAt || item.timestamp)}
                    </Text>
                    <Space size="small">
                      {!item.read && (
                        <Tooltip title="Mark as read">
                          <Button
                            type="text"
                            size="small"
                            icon={<CheckOutlined className="text-[10px]" />}
                            onClick={(e) => handleMarkAsRead(item.id, e)}
                            className="h-auto p-0"
                          />
                        </Tooltip>
                      )}
                      <Tooltip title="Delete">
                        <Popconfirm
                          title="Delete notification?"
                          onConfirm={(e) => handleDelete(item.id, e)}
                          okText="Yes"
                          cancelText="No"
                        >
                          <Button
                            type="text"
                            size="small"
                            danger
                            icon={<DeleteOutlined className="text-[10px]" />}
                            onClick={(e) => e.stopPropagation()}
                            className="h-auto p-0"
                          />
                        </Popconfirm>
                      </Tooltip>
                    </Space>
                  </div>
                </div>
              </div>
            ))}
          </div>
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
