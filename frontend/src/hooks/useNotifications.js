import { useState, useEffect, useCallback, useRef } from 'react';
import { useSelector } from 'react-redux';
import { io } from 'socket.io-client';
import { apiClient } from '../services/api';
import { API_ENDPOINTS } from '../utils/constants';
import toast from 'react-hot-toast';

const SOCKET_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';
const WS_NAMESPACE = '/ws'; // Unified WebSocket namespace

export const useNotifications = () => {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const socketRef = useRef(null);

  // Get auth token from Redux store
  const { token } = useSelector((state) => state.auth);

  // Fetch notifications via HTTP (initial load and fallback)
  const fetchNotifications = useCallback(async () => {
    setLoading(true);
    try {
      const response = await apiClient.get(API_ENDPOINTS.NOTIFICATIONS);
      setNotifications(response.data || []);
      setUnreadCount(response.unreadCount || 0);
    } catch (error) {
      console.error('Error fetching notifications:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  // Initialize WebSocket connection
  useEffect(() => {
    if (!token) {
      // No token, disconnect if connected
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
        setIsConnected(false);
      }
      return;
    }

    // Create socket connection with JWT authentication to unified WebSocket
    const socket = io(`${SOCKET_URL}${WS_NAMESPACE}`, {
      auth: { token },
      query: { token },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
    });

    socketRef.current = socket;

    // Connection events
    socket.on('connect', () => {
      console.log('Notification WebSocket connected');
      setIsConnected(true);
    });

    socket.on('connected', (data) => {
      console.log('Notification service connected:', data);
      // Fetch initial notifications after connection
      fetchNotifications();
    });

    socket.on('disconnect', (reason) => {
      console.log('Notification WebSocket disconnected:', reason);
      setIsConnected(false);
    });

    socket.on('connect_error', (error) => {
      console.error('Notification WebSocket connection error:', error.message);
      setIsConnected(false);
    });

    socket.on('error', (error) => {
      console.error('Notification WebSocket error:', error);
    });

    // Notification events
    socket.on('notification', (notification) => {
      console.log('New notification received:', notification);
      setNotifications((prev) => [notification, ...prev]);

      // Show toast for new notification
      toast(notification.title, {
        icon: 'info',
        duration: 4000,
      });
    });

    socket.on('unreadCount', (data) => {
      setUnreadCount(data.count);
    });

    socket.on('markAsReadAck', (data) => {
      console.log('Mark as read acknowledged:', data.notificationId);
    });

    // Cleanup on unmount or token change
    return () => {
      socket.disconnect();
      socketRef.current = null;
      setIsConnected(false);
    };
  }, [token, fetchNotifications]);

  // Handle visibility change - reconnect when tab becomes visible
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden && socketRef.current && !socketRef.current.connected) {
        socketRef.current.connect();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  // Mark notification as read
  const markAsRead = useCallback(async (notificationId) => {
    try {
      await apiClient.put(`${API_ENDPOINTS.NOTIFICATIONS}/${notificationId}/read`);
      setNotifications((prev) =>
        prev.map((notif) =>
          notif.id === notificationId ? { ...notif, read: true } : notif
        )
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));

      // Also notify via WebSocket for acknowledgment
      if (socketRef.current?.connected) {
        socketRef.current.emit('markAsRead', { notificationId });
      }
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  }, []);

  // Mark all as read
  const markAllAsRead = useCallback(async () => {
    try {
      await apiClient.put(`${API_ENDPOINTS.NOTIFICATIONS}/read-all`);
      setNotifications((prev) =>
        prev.map((notif) => ({ ...notif, read: true }))
      );
      setUnreadCount(0);
      toast.success('All notifications marked as read');
    } catch (error) {
      toast.error('Failed to mark notifications as read');
    }
  }, []);

  // Delete notification
  const deleteNotification = useCallback(async (notificationId) => {
    try {
      await apiClient.delete(`${API_ENDPOINTS.NOTIFICATIONS}/${notificationId}`);
      setNotifications((prev) =>
        prev.filter((notif) => notif.id !== notificationId)
      );
      toast.success('Notification deleted');
    } catch (error) {
      toast.error('Failed to delete notification');
    }
  }, []);

  // Clear all notifications
  const clearAll = useCallback(async () => {
    try {
      const response = await apiClient.delete(`${API_ENDPOINTS.NOTIFICATIONS}/clear-all`);
      setNotifications([]);
      setUnreadCount(0);
      toast.success(response.message || 'All notifications cleared');
    } catch (error) {
      console.error('Error clearing notifications:', error);
      toast.error('Failed to clear notifications');
    }
  }, []);

  return {
    notifications,
    unreadCount,
    loading,
    isConnected,
    fetchNotifications,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    clearAll,
  };
};

export default useNotifications;
