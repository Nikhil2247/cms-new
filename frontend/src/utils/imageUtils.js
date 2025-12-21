/**
 * Utility functions for handling image URLs in the application
 */

// API base URL for static files
const API_BASE_URL = 'https://api.placeintern.com';

/**
 * Convert relative file path to full URL
 * @param {string} relativePath - Relative path from database (e.g., "profile/profile-123456.jpg")
 * @returns {string|null} - Full URL or null if no path provided
 */
export const getImageUrl = (relativePath) => {
  if (!relativePath) return null;

  // If it's already a full URL (old Cloudinary URLs), return as is
  if (relativePath.startsWith('http')) return relativePath;

  // Otherwise, prepend the API base URL with /uploads/
  return `${API_BASE_URL}/uploads/${relativePath}`;
};

/**
 * Get full document URL
 * @param {string} relativePath - Relative path from database
 * @returns {string|null} - Full URL or null
 */
export const getDocumentUrl = (relativePath) => {
  return getImageUrl(relativePath);
};

/**
 * Get profile image URL with fallback to default avatar
 * @param {string} relativePath - Relative path from database
 * @param {string} fallback - Optional fallback URL
 * @returns {string|null} - Full URL or fallback
 */
export const getProfileImageUrl = (relativePath, fallback = null) => {
  return getImageUrl(relativePath) || fallback;
};

/**
 * Get API base URL for custom use cases
 * @returns {string} - API base URL
 */
export const getApiBaseUrl = () => {
  return API_BASE_URL;
};
