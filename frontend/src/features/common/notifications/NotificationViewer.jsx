import React, { useState, useMemo, useCallback } from 'react';
import {
  Card,
  Button,
  Empty,
  Badge,
  Input,
  Select,
  Space,
  Tooltip,
  Popconfirm,
  Tabs,
  Spin,
  Typography,
  Divider,
  Checkbox,
  Dropdown,
} from 'antd';
import {
  BellOutlined,
  CheckOutlined,
  DeleteOutlined,
  ClearOutlined,
  SearchOutlined,
  FilterOutlined,
  ReloadOutlined,
  WifiOutlined,
  DisconnectOutlined,
  SyncOutlined,
  InboxOutlined,
  MoreOutlined,
} from '@ant-design/icons';
import { useNotifications } from './useNotifications';
import NotificationItem from './NotificationItem';
import {
  NOTIFICATION_CATEGORIES,
  filterByCategory,
  searchNotifications,
  groupNotificationsByDate,
} from './notificationUtils.jsx';

const { Title, Text } = Typography;

/**
 * Get connection status info based on connection state
 */
const getConnectionStatus = (connectionState, isConnected) => {
  switch (connectionState) {
    case 'connected':
      return { color: 'green', icon: <WifiOutlined />, text: 'Connected' };
    case 'connecting':
      return { color: 'blue', icon: <SyncOutlined spin />, text: 'Connecting...' };
    case 'reconnecting':
      return { color: 'orange', icon: <SyncOutlined spin />, text: 'Reconnecting...' };
    case 'error':
      return { color: 'red', icon: <DisconnectOutlined />, text: 'Connection Error' };
    case 'disconnected':
    default:
      return { color: 'gray', icon: <DisconnectOutlined />, text: 'Disconnected' };
  }
};

/**
 * Full-page notification viewer component
 * Provides comprehensive notification management with filtering, search, and bulk actions
 */
const NotificationViewer = () => {
  const {
    notifications,
    unreadCount,
    loading,
    isConnected,
    connectionState,
    lastSyncTime,
    markAsRead,
    markMultipleAsRead,
    markAllAsRead,
    deleteNotification,
    deleteMultiple,
    clearAll,
    clearRead,
    refresh,
    forceReconnect,
  } = useNotifications();

  // Get connection status info
  const connectionStatus = getConnectionStatus(connectionState, isConnected);

  // Local state
  const [searchText, setSearchText] = useState('');
  const [selectedCategory, setSelectedCategory] = useState(NOTIFICATION_CATEGORIES.ALL);
  const [activeTab, setActiveTab] = useState('all');
  const [selectedIds, setSelectedIds] = useState([]);
  const [selectionMode, setSelectionMode] = useState(false);

  // Filter notifications based on search, category, and tab
  const filteredNotifications = useMemo(() => {
    let result = [...notifications];

    // Filter by tab (all/unread/read)
    if (activeTab === 'unread') {
      result = result.filter((n) => !n.read);
    } else if (activeTab === 'read') {
      result = result.filter((n) => n.read);
    }

    // Filter by category
    result = filterByCategory(result, selectedCategory);

    // Filter by search text
    result = searchNotifications(result, searchText);

    return result;
  }, [notifications, activeTab, selectedCategory, searchText]);

  // Group notifications by date
  const groupedNotifications = useMemo(() => {
    return groupNotificationsByDate(filteredNotifications);
  }, [filteredNotifications]);

  // Selection handlers
  const handleSelectAll = useCallback(() => {
    if (selectedIds.length === filteredNotifications.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredNotifications.map((n) => n.id));
    }
  }, [filteredNotifications, selectedIds]);

  const handleSelect = useCallback((id) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  }, []);

  const handleBulkMarkAsRead = useCallback(async () => {
    if (selectedIds.length > 0) {
      await markMultipleAsRead(selectedIds);
      setSelectedIds([]);
      setSelectionMode(false);
    }
  }, [selectedIds, markMultipleAsRead]);

  const handleBulkDelete = useCallback(async () => {
    if (selectedIds.length > 0) {
      await deleteMultiple(selectedIds);
      setSelectedIds([]);
      setSelectionMode(false);
    }
  }, [selectedIds, deleteMultiple]);

  const toggleSelectionMode = useCallback(() => {
    setSelectionMode((prev) => !prev);
    setSelectedIds([]);
  }, []);

  // Category options
  const categoryOptions = [
    { value: NOTIFICATION_CATEGORIES.ALL, label: 'All Categories' },
    { value: NOTIFICATION_CATEGORIES.INTERNSHIP, label: 'Internship' },
    { value: NOTIFICATION_CATEGORIES.PLACEMENT, label: 'Placement' },
    { value: NOTIFICATION_CATEGORIES.ASSIGNMENT, label: 'Assignments' },
    { value: NOTIFICATION_CATEGORIES.ATTENDANCE, label: 'Attendance' },
    { value: NOTIFICATION_CATEGORIES.EXAM, label: 'Exams' },
    { value: NOTIFICATION_CATEGORIES.FEE, label: 'Fees' },
    { value: NOTIFICATION_CATEGORIES.ANNOUNCEMENT, label: 'Announcements' },
    { value: NOTIFICATION_CATEGORIES.GRIEVANCE, label: 'Grievances' },
    { value: NOTIFICATION_CATEGORIES.SYSTEM, label: 'System' },
  ];

  // Tab items
  const tabItems = [
    {
      key: 'all',
      label: (
        <span>
          All
          <Badge count={notifications.length} className="ml-2" size="small" showZero={false} />
        </span>
      ),
    },
    {
      key: 'unread',
      label: (
        <span>
          Unread
          <Badge count={unreadCount} className="ml-2" size="small" showZero={false} />
        </span>
      ),
    },
    {
      key: 'read',
      label: (
        <span>
          Read
          <Badge
            count={notifications.length - unreadCount}
            className="ml-2"
            size="small"
            showZero={false}
          />
        </span>
      ),
    },
  ];

  // More actions menu
  const moreActionsMenu = {
    items: [
      {
        key: 'select',
        icon: <CheckOutlined />,
        label: selectionMode ? 'Exit Selection' : 'Select Multiple',
        onClick: toggleSelectionMode,
      },
      {
        key: 'clearRead',
        icon: <ClearOutlined />,
        label: 'Clear Read Notifications',
        onClick: clearRead,
        disabled: notifications.filter((n) => n.read).length === 0,
      },
      { type: 'divider' },
      {
        key: 'clearAll',
        icon: <DeleteOutlined />,
        label: 'Clear All Notifications',
        danger: true,
        onClick: clearAll,
        disabled: notifications.length === 0,
      },
    ],
  };

  // Render notification groups
  const renderNotificationGroup = (title, items) => {
    if (items.length === 0) return null;

    return (
      <div key={title} className="mb-6">
        <Text type="secondary" className="text-xs uppercase tracking-wider mb-2 block px-1">
          {title}
        </Text>
        <div className="bg-surface rounded-lg border border-border overflow-hidden">
          {items.map((notification) => (
            <NotificationItem
              key={notification.id}
              notification={notification}
              onMarkAsRead={markAsRead}
              onDelete={deleteNotification}
              showType={selectedCategory === NOTIFICATION_CATEGORIES.ALL}
              selectable={selectionMode}
              selected={selectedIds.includes(notification.id)}
              onSelect={handleSelect}
            />
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="notification-viewer">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div className="flex items-center gap-3">
          <Title level={2} className="!m-0 flex items-center gap-2">
            <BellOutlined />
            Notifications
          </Title>
          {unreadCount > 0 && (
            <Badge count={unreadCount} className="ml-1" />
          )}
          <Tooltip
            title={
              <div>
                <div>{connectionStatus.text}</div>
                {lastSyncTime && (
                  <div className="text-xs opacity-75">
                    Last sync: {lastSyncTime.toLocaleTimeString()}
                  </div>
                )}
                {connectionState === 'error' && (
                  <div className="text-xs mt-1">Click to reconnect</div>
                )}
              </div>
            }
          >
            <span
              className={`cursor-pointer ${connectionState === 'error' ? 'hover:opacity-75' : ''}`}
              onClick={connectionState === 'error' ? forceReconnect : undefined}
              style={{ color: connectionStatus.color }}
            >
              {connectionStatus.icon}
            </span>
          </Tooltip>
        </div>

        <Space wrap>
          {selectionMode && selectedIds.length > 0 && (
            <>
              <Button
                icon={<CheckOutlined />}
                onClick={handleBulkMarkAsRead}
              >
                Mark Selected as Read ({selectedIds.length})
              </Button>
              <Popconfirm
                title={`Delete ${selectedIds.length} notifications?`}
                onConfirm={handleBulkDelete}
                okText="Yes"
                cancelText="No"
              >
                <Button danger icon={<DeleteOutlined />}>
                  Delete Selected
                </Button>
              </Popconfirm>
            </>
          )}

          {!selectionMode && unreadCount > 0 && (
            <Button icon={<CheckOutlined />} onClick={markAllAsRead}>
              Mark All as Read
            </Button>
          )}

          <Tooltip title="Refresh">
            <Button icon={<ReloadOutlined />} onClick={refresh} loading={loading} />
          </Tooltip>

          <Dropdown menu={moreActionsMenu} placement="bottomRight">
            <Button icon={<MoreOutlined />} />
          </Dropdown>
        </Space>
      </div>

      {/* Filters */}
      <Card className="mb-6" size="small">
        <div className="flex flex-col sm:flex-row gap-4">
          <Input
            placeholder="Search notifications..."
            prefix={<SearchOutlined />}
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            allowClear
            className="sm:max-w-xs"
          />

          <Select
            placeholder="Filter by category"
            value={selectedCategory}
            onChange={setSelectedCategory}
            options={categoryOptions}
            className="sm:w-48"
            suffixIcon={<FilterOutlined />}
          />

          {selectionMode && (
            <Button
              type={selectedIds.length === filteredNotifications.length ? 'primary' : 'default'}
              onClick={handleSelectAll}
            >
              {selectedIds.length === filteredNotifications.length ? 'Deselect All' : 'Select All'}
            </Button>
          )}
        </div>
      </Card>

      {/* Tabs */}
      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        items={tabItems}
        className="mb-4"
      />

      {/* Content */}
      {loading && notifications.length === 0 ? (
        <div className="flex items-center justify-center py-20">
          <Spin size="large" />
        </div>
      ) : filteredNotifications.length === 0 ? (
        <Card>
          <Empty
            image={<InboxOutlined className="text-6xl text-text-tertiary" />}
            description={
              <div className="text-center">
                <Text type="secondary" className="block mb-2">
                  {searchText || selectedCategory !== NOTIFICATION_CATEGORIES.ALL
                    ? 'No notifications match your filters'
                    : activeTab === 'unread'
                    ? 'No unread notifications'
                    : activeTab === 'read'
                    ? 'No read notifications'
                    : 'No notifications yet'}
                </Text>
                {(searchText || selectedCategory !== NOTIFICATION_CATEGORIES.ALL) && (
                  <Button
                    type="link"
                    onClick={() => {
                      setSearchText('');
                      setSelectedCategory(NOTIFICATION_CATEGORIES.ALL);
                    }}
                  >
                    Clear filters
                  </Button>
                )}
              </div>
            }
          />
        </Card>
      ) : (
        <div>
          {/* Render grouped notifications */}
          {renderNotificationGroup('Today', groupedNotifications.today)}
          {renderNotificationGroup('Yesterday', groupedNotifications.yesterday)}
          {renderNotificationGroup('This Week', groupedNotifications.thisWeek)}
          {renderNotificationGroup('Older', groupedNotifications.older)}

          {/* If no groups but have notifications (shouldn't happen but fallback) */}
          {Object.values(groupedNotifications).every((g) => g.length === 0) &&
            filteredNotifications.length > 0 && (
              <div className="bg-surface rounded-lg border border-border overflow-hidden">
                {filteredNotifications.map((notification) => (
                  <NotificationItem
                    key={notification.id}
                    notification={notification}
                    onMarkAsRead={markAsRead}
                    onDelete={deleteNotification}
                    showType={selectedCategory === NOTIFICATION_CATEGORIES.ALL}
                    selectable={selectionMode}
                    selected={selectedIds.includes(notification.id)}
                    onSelect={handleSelect}
                  />
                ))}
              </div>
            )}
        </div>
      )}

      {/* Footer stats */}
      {notifications.length > 0 && (
        <div className="mt-6 text-center">
          <Text type="secondary" className="text-sm">
            Showing {filteredNotifications.length} of {notifications.length} notifications
            {unreadCount > 0 && ` (${unreadCount} unread)`}
          </Text>
        </div>
      )}
    </div>
  );
};

export default NotificationViewer;
