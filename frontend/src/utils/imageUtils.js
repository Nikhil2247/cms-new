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
