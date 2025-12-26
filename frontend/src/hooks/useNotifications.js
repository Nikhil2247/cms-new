import { useState, useEffect, useCallback, useRef } from 'react';
import { useSelector } from 'react-redux';
import { apiClient } from '../services/api';
import { API_ENDPOINTS } from '../utils/constants';
import toast from 'react-hot-toast';
import { useWebSocket } from './useWebSocket';

export const useNotifications = () => {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Track mounted state
  const mountedRef = useRef(true);
  const handlersRef = useRef([]);
  const initialFetchDoneRef = useRef(false);

  // Get auth token from Redux store
  const { token } = useSelector((state) => state.auth);

  // Use the shared WebSocket hook
  const { isConnected, on, off, emit } = useWebSocket();

  // Set mounted ref on mount/unmount
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // Fetch notifications via HTTP (initial load and fallback)
  const fetchNotifications = useCallback(async () => {
    if (!token) return;

    setLoading(true);
    setError(null);
    try {
      const response = await apiClient.get(API_ENDPOINTS.NOTIFICATIONS);
      if (mountedRef.current) {
        setNotifications(response.data || []);
        setUnreadCount(response.unreadCount || 0);
      }
    } catch (err) {
      if (mountedRef.current) {
        setError(err.message);
        console.error('Error fetching notifications:', err);
      }
    } finally {
      if (mountedRef.current) {
        setLoading(false);
      }
    }
  }, [token]);

  // Set up WebSocket event listeners
  useEffect(() => {
    if (!isConnected) {
      // Clean up any existing handlers when disconnected
      for (const { event, handler } of handlersRef.current) {
        off(event, handler);
      }
      handlersRef.current = [];
      return;
    }

    // Handler for new notifications
    const handleNotification = (notification) => {
      if (mountedRef.current) {
        setNotifications((prev) => [notification, ...prev]);
        setUnreadCount((prev) => prev + 1);

        // Show toast for new notification
        toast(notification.title || 'New notification', {
          icon: '\u2139\ufe0f',
          duration: 4000,
        });
      }
    };

    // Handler for unread count updates
    const handleUnreadCount = (data) => {
      if (mountedRef.current) {
        setUnreadCount(data.count);
      }
    };

    // Handler for mark as read acknowledgment
    const handleMarkAsReadAck = (data) => {
      if (mountedRef.current) {
        // Update local state to reflect the read status
        setNotifications((prev) =>
          prev.map((notif) =>
            notif.id === data.notificationId ? { ...notif, read: true } : notif
          )
        );
      }
    };

    // Handler for notification deleted (from another tab/device)
    const handleNotificationDeleted = (data) => {
      if (mountedRef.current) {
        setNotifications((prev) =>
          prev.filter((notif) => notif.id !== data.notificationId)
        );
      }
    };

    // Define handlers to register
    const handlers = [
      { event: 'notification', handler: handleNotification },
      { event: 'unreadCount', handler: handleUnreadCount },
      { event: 'markAsReadAck', handler: handleMarkAsReadAck },
      { event: 'notificationDeleted', handler: handleNotificationDeleted },
    ];

    // Subscribe to events
    for (const { event, handler } of handlers) {
      on(event, handler);
    }
    handlersRef.current = handlers;

    // Cleanup on unmount or disconnect
    return () => {
      for (const { event, handler } of handlers) {
        off(event, handler);
      }
      handlersRef.current = [];
    };
  }, [isConnected, on, off]);

  // Fetch notifications when token changes (initial load)
  useEffect(() => {
    if (token) {
      // Only fetch if we haven't done initial fetch or token changed
      if (!initialFetchDoneRef.current) {
        fetchNotifications();
        initialFetchDoneRef.current = true;
      }
    } else {
      setNotifications([]);
      setUnreadCount(0);
      initialFetchDoneRef.current = false;
    }
  }, [token, fetchNotifications]);

  // Mark notification as read
  const markAsRead = useCallback(async (notificationId) => {
    try {
      await apiClient.put(`${API_ENDPOINTS.NOTIFICATIONS}/${notificationId}/read`);
      if (mountedRef.current) {
        setNotifications((prev) =>
          prev.map((notif) =>
            notif.id === notificationId ? { ...notif, read: true } : notif
          )
        );
        setUnreadCount((prev) => Math.max(0, prev - 1));
      }

      // Also notify via WebSocket for cross-tab sync
      emit('markAsRead', { notificationId });
    } catch (err) {
      console.error('Error marking notification as read:', err);
      toast.error('Failed to mark as read');
    }
  }, [emit]);

  // Mark all as read
  const markAllAsRead = useCallback(async () => {
    try {
      await apiClient.put(`${API_ENDPOINTS.NOTIFICATIONS}/read-all`);
      if (mountedRef.current) {
        setNotifications((prev) =>
          prev.map((notif) => ({ ...notif, read: true }))
        );
        setUnreadCount(0);
      }
      toast.success('All notifications marked as read');
    } catch (err) {
      console.error('Error marking all as read:', err);
      toast.error('Failed to mark notifications as read');
    }
  }, []);

  // Delete notification
  const deleteNotification = useCallback(async (notificationId) => {
    try {
      await apiClient.delete(`${API_ENDPOINTS.NOTIFICATIONS}/${notificationId}`);
      if (mountedRef.current) {
        setNotifications((prev) =>
          prev.filter((notif) => notif.id !== notificationId)
        );
        // Decrease unread count if the deleted notification was unread
        setUnreadCount((prev) => {
          const wasUnread = notifications.find(n => n.id === notificationId && !n.read);
          return wasUnread ? Math.max(0, prev - 1) : prev;
        });
      }
      toast.success('Notification deleted');
    } catch (err) {
      console.error('Error deleting notification:', err);
      toast.error('Failed to delete notification');
    }
  }, [notifications]);

  // Clear all notifications
  const clearAll = useCallback(async () => {
    try {
      const response = await apiClient.delete(`${API_ENDPOINTS.NOTIFICATIONS}/clear-all`);
      if (mountedRef.current) {
        setNotifications([]);
        setUnreadCount(0);
      }
      toast.success(response.message || 'All notifications cleared');
    } catch (err) {
      console.error('Error clearing notifications:', err);
      toast.error('Failed to clear notifications');
    }
  }, []);

  // Refresh notifications manually
  const refresh = useCallback(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  return {
    notifications,
    unreadCount,
    loading,
    error,
    isConnected,
    fetchNotifications,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    clearAll,
    refresh,
  };
};

export default useNotifications;
