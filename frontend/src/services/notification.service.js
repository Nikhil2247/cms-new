import API from './api';

/**
 * Notification Service
 * Centralized API methods for notification operations
 */
const NotificationService = {
  /**
   * Get all notifications for the current user
   * @param {Object} params - Query parameters (page, limit, status, type, etc.)
   * @returns {Promise<Object>} Response with notifications and pagination
   */
  getAll: (params = {}) => {
    return API.get('/shared/notifications', { params });
  },

  /**
   * Mark a specific notification as read
   * @param {string} id - Notification ID
   * @returns {Promise<Object>} Updated notification
   */
  markAsRead: (id) => {
    return API.put(`/shared/notifications/${id}/read`);
  },

  /**
   * Mark all notifications as read for the current user
   * @returns {Promise<Object>} Success response
   */
  markAllAsRead: () => {
    return API.put('/shared/notifications/read-all');
  },

  /**
   * Delete a specific notification
   * @param {string} id - Notification ID
   * @returns {Promise<Object>} Success response
   */
  delete: (id) => {
    return API.delete(`/shared/notifications/${id}`);
  },

  /**
   * Get notification settings for the current user
   * @returns {Promise<Object>} Notification settings
   */
  getSettings: () => {
    return API.get('/shared/notifications/settings');
  },

  /**
   * Update notification settings for the current user
   * @param {Object} data - Updated settings
   * @param {boolean} data.emailNotifications - Enable/disable email notifications
   * @param {boolean} data.pushNotifications - Enable/disable push notifications
   * @param {Object} data.preferences - Notification type preferences
   * @returns {Promise<Object>} Updated settings
   */
  updateSettings: (data) => {
    return API.put('/shared/notifications/settings', data);
  },

  /**
   * Get count of unread notifications
   * @returns {Promise<Object>} Response with unread count
   */
  getUnreadCount: () => {
    return API.get('/shared/notifications/unread-count');
  },

  /**
   * Mark multiple notifications as read
   * @param {Array<string>} ids - Array of notification IDs
   * @returns {Promise<Object>} Success response
   */
  markMultipleAsRead: (ids) => {
    return API.put('/shared/notifications/mark-read', { ids });
  },

  /**
   * Delete multiple notifications
   * @param {Array<string>} ids - Array of notification IDs
   * @returns {Promise<Object>} Success response
   */
  deleteMultiple: (ids) => {
    return API.post('/shared/notifications/delete-multiple', { ids });
  },

  /**
   * Clear all read notifications
   * @returns {Promise<Object>} Success response
   */
  clearAllRead: () => {
    return API.delete('/shared/notifications/clear-read');
  },

  /**
   * Get notification by ID
   * @param {string} id - Notification ID
   * @returns {Promise<Object>} Notification details
   */
  getById: (id) => {
    return API.get(`/shared/notifications/${id}`);
  },
};

export default NotificationService;
