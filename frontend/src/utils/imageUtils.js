/**
 * Utility functions for handling image URLs in the application
 */

// Determine the base URL for uploads based on environment
const getUploadsBaseUrl = () => {
  if (import.meta.env.DEV) {
    // Local development - use MinIO directly
    return 'http://127.0.0.1:9000/cms-uploads';
  }
  // Production - use API proxy
  return 'https://api.placeintern.com/uploads';
};

const UPLOADS_BASE_URL = getUploadsBaseUrl();

/**
 * Convert relative file path to full URL
 * @param {string} relativePath - Relative path from database (e.g., "profile/profile-123456.jpg")
 * @returns {string|null} - Full URL or null if no path provided
 */
export const getImageUrl = (relativePath) => {
  if (!relativePath) return null;

  // If it's already a full URL (old Cloudinary URLs), return as is
  if (relativePath.startsWith('http')) return relativePath;

  // Otherwise, prepend the uploads base URL
  return `${UPLOADS_BASE_URL}/${relativePath}`;
};
