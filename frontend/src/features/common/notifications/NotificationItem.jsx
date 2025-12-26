import React from 'react';
import { Avatar, Button, Tooltip, Popconfirm, Space, Typography, Tag } from 'antd';
import { CheckOutlined, DeleteOutlined } from '@ant-design/icons';
import { getNotificationIcon, getNotificationColor, formatTimeAgo, formatFullDate } from './notificationUtils.jsx';

const { Text } = Typography;

/**
 * Shared notification item component
 * Used in both dropdown and full page views
 */
const NotificationItem = ({
  notification,
  onMarkAsRead,
  onDelete,
  compact = false,
  showType = false,
  selectable = false,
  selected = false,
  onSelect,
}) => {
  const { id, title, body, type, read, createdAt } = notification;

  const handleClick = () => {
    if (selectable && onSelect) {
      onSelect(id);
    } else if (!read && onMarkAsRead) {
      onMarkAsRead(id);
    }
  };

  const handleMarkAsRead = (e) => {
    e?.stopPropagation();
    onMarkAsRead?.(id);
  };

  const handleDelete = (e) => {
    e?.stopPropagation();
    onDelete?.(id);
  };

  return (
    <div
      onClick={handleClick}
      className={`
        notification-item cursor-pointer transition-all duration-200
        border-b border-border/50 last:border-b-0
        flex items-start gap-3 ${compact ? 'p-3' : 'p-4'}
        ${!read ? 'bg-primary-50 dark:bg-primary-900/20' : 'hover:bg-surface-hover'}
        ${selectable ? 'select-none' : ''}
        ${selected ? 'ring-2 ring-primary ring-inset' : ''}
      `}
    >
      {/* Selection checkbox area */}
      {selectable && (
        <div
          className={`
            w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 mt-1
            transition-colors duration-200
            ${selected ? 'bg-primary border-primary' : 'border-border hover:border-primary'}
          `}
        >
          {selected && <CheckOutlined className="text-white text-xs" />}
        </div>
      )}

      {/* Icon */}
      <Avatar
        size={compact ? 32 : 40}
        className="bg-background-tertiary flex items-center justify-center shrink-0"
      >
        {getNotificationIcon(type, compact ? 14 : 16)}
      </Avatar>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-1 gap-2">
          <Text
            strong
            className={`${compact ? 'text-xs' : 'text-sm'} truncate ${!read ? 'text-primary' : ''}`}
          >
            {title}
          </Text>
          <div className="flex items-center gap-2 shrink-0">
            {showType && type && (
              <Tag color={getNotificationColor(type)} className="text-[10px] m-0">
                {type.replace(/_/g, ' ')}
              </Tag>
            )}
            {!read && (
              <span className="w-2 h-2 bg-primary rounded-full" />
            )}
          </div>
        </div>

        <Text
          type="secondary"
          className={`${compact ? 'text-[10px] line-clamp-1' : 'text-xs line-clamp-2'} block mb-2`}
        >
          {body}
        </Text>

        <div className="flex items-center justify-between">
          <Tooltip title={formatFullDate(createdAt)}>
            <Text type="secondary" className="text-[10px]">
              {formatTimeAgo(createdAt)}
            </Text>
          </Tooltip>

          {!selectable && (
            <Space size="small">
              {!read && onMarkAsRead && (
                <Tooltip title="Mark as read">
                  <Button
                    type="text"
                    size="small"
                    icon={<CheckOutlined className="text-[10px]" />}
                    onClick={handleMarkAsRead}
                    className="h-auto p-0"
                  />
                </Tooltip>
              )}
              {onDelete && (
                <Tooltip title="Delete">
                  <Popconfirm
                    title="Delete this notification?"
                    onConfirm={handleDelete}
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
              )}
            </Space>
          )}
        </div>
      </div>
    </div>
  );
};

export default NotificationItem;
