/**
 * Grievance Management Constants
 * Centralized constants for grievance categories, statuses, and priorities
 */

export const GRIEVANCE_CATEGORIES = [
  { value: 'ACADEMIC', label: 'Academic', color: 'blue', description: 'Issues related to academic matters' },
  { value: 'INTERNSHIP', label: 'Internship', color: 'cyan', description: 'Internship-related concerns' },
  { value: 'FACULTY', label: 'Faculty', color: 'purple', description: 'Faculty interaction or support issues' },
  { value: 'INDUSTRY', label: 'Industry', color: 'orange', description: 'Industry partner related issues' },
  { value: 'PLACEMENT', label: 'Placement', color: 'green', description: 'Placement and career concerns' },
  { value: 'TECHNICAL', label: 'Technical', color: 'geekblue', description: 'Technical or infrastructure issues' },
  { value: 'OTHER', label: 'Other', color: 'default', description: 'Other concerns' },
];

export const GRIEVANCE_STATUSES = [
  { value: 'SUBMITTED', label: 'Submitted', color: 'blue', badge: 'processing' },
  { value: 'IN_REVIEW', label: 'In Review', color: 'orange', badge: 'warning' },
  { value: 'ESCALATED', label: 'Escalated', color: 'red', badge: 'error' },
  { value: 'RESOLVED', label: 'Resolved', color: 'green', badge: 'success' },
  { value: 'CLOSED', label: 'Closed', color: 'default', badge: 'default' },
];

export const GRIEVANCE_PRIORITIES = [
  { value: 'LOW', label: 'Low', color: 'default', description: 'Non-urgent matters' },
  { value: 'MEDIUM', label: 'Medium', color: 'blue', description: 'Standard priority' },
  { value: 'HIGH', label: 'High', color: 'orange', description: 'Requires prompt attention' },
  { value: 'URGENT', label: 'Urgent', color: 'red', description: 'Requires immediate attention' },
];

/**
 * Get category configuration by value
 * @param {string} value - Category value
 * @returns {Object} Category configuration
 */
export const getCategoryConfig = (value) => {
  return GRIEVANCE_CATEGORIES.find(c => c.value === value) || GRIEVANCE_CATEGORIES[6];
};

/**
 * Get status configuration by value
 * @param {string} value - Status value
 * @returns {Object} Status configuration
 */
export const getStatusConfig = (value) => {
  return GRIEVANCE_STATUSES.find(s => s.value === value) || GRIEVANCE_STATUSES[0];
};

/**
 * Get priority configuration by value
 * @param {string} value - Priority value
 * @returns {Object} Priority configuration
 */
export const getPriorityConfig = (value) => {
  return GRIEVANCE_PRIORITIES.find(p => p.value === value) || GRIEVANCE_PRIORITIES[1];
};
