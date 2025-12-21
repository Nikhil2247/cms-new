// Report Builder API Service
// Aligned with backend API contract from report-builder.controller.ts
import API from "./api";
import { downloadBlob } from "../utils/downloadUtils";

// Re-export for convenience (some components import it from this module)
export { downloadBlob };

// ============================================
// Error Handling Helper
// ============================================

/**
 * Wrap API call with error handling
 * @param {Function} apiCall - API call function
 * @param {string} errorMessage - Default error message
 * @returns {Promise} Result or throws formatted error
 */
const handleApiCall = async (apiCall, errorMessage = "API request failed") => {
  try {
    return await apiCall();
  } catch (error) {
    const message = error.response?.data?.message || error.message || errorMessage;
    console.error(`[ReportBuilder API] ${errorMessage}:`, message);
    throw new Error(message);
  }
};

// ============================================
// Report Catalog & Configuration
// ============================================

/**
 * Get the full catalog of available reports grouped by category
 * Backend returns: { categories: [{ id, name, description, reports: [...] }] }
 * Frontend expects: { CATEGORY_ID: [reports] }
 * @returns {Promise} Transformed catalog object grouped by category
 */
export const getReportCatalog = async () => {
  return handleApiCall(async () => {
    const response = await API.get("/report-builder/catalog");
    const catalogData = response.data;

    // Transform from { categories: [...] } to { CATEGORY: [reports] }
    const transformedCatalog = {};
    if (catalogData?.categories) {
      catalogData.categories.forEach((category) => {
        transformedCatalog[category.id] = category.reports.map((report) => ({
          ...report,
          category: category.id,
          // Ensure columns/filters arrays exist for UI
          columns: report.columns || [],
          filters: report.filters || [],
        }));
      });
    }

    return { data: transformedCatalog };
  }, "Failed to load report catalog");
};

/**
 * Get detailed configuration for a specific report type
 * @param {string} reportType - The report type identifier (e.g., 'mentor-list')
 * @returns {Promise} API response with report configuration
 */
export const getReportConfig = async (reportType) => {
  if (!reportType) {
    throw new Error("Report type is required");
  }

  return handleApiCall(async () => {
    const response = await API.get(`/report-builder/config/${reportType}`);
    return { data: response.data };
  }, `Failed to load configuration for ${reportType}`);
};

/**
 * Get available filter values for dynamic filters
 * Backend returns: { filterId, options: [{ value, label }] }
 * @param {string} reportType - The report type identifier
 * @param {string} filterId - The filter identifier
 * @returns {Promise} API response with filter options array
 */
export const getFilterValues = async (reportType, filterId) => {
  if (!reportType || !filterId) {
    return { data: [] };
  }

  return handleApiCall(async () => {
    const response = await API.get(`/report-builder/filter-values/${reportType}/${filterId}`);
    return { data: response.data?.options || [] };
  }, `Failed to load filter values for ${filterId}`);
};

// ============================================
// Report Generation
// ============================================

/**
 * Generate a report asynchronously (queued via BullMQ)
 * Returns immediately with report ID, poll status to check completion
 * @param {Object} payload - Report generation configuration
 * @returns {Promise} API response with report ID and status 'pending'
 */
export const generateReport = async (payload) => {
  if (!payload?.reportType) {
    throw new Error("Report type is required");
  }
  if (!payload?.columns?.length) {
    throw new Error("At least one column must be selected");
  }
  if (!payload?.format) {
    throw new Error("Export format is required");
  }

  return handleApiCall(async () => {
    const response = await API.post("/report-builder/generate", payload);
    return { data: response.data };
  }, "Failed to generate report");
};

/**
 * Generate a report synchronously (immediate, 60s timeout)
 * Use only for small reports - async is recommended for production
 * @param {Object} payload - Report generation configuration
 * @returns {Promise} API response with generated report
 */
export const generateReportSync = async (payload) => {
  if (!payload?.reportType) {
    throw new Error("Report type is required");
  }
  if (!payload?.columns?.length) {
    throw new Error("At least one column must be selected");
  }
  if (!payload?.format) {
    throw new Error("Export format is required");
  }

  return handleApiCall(async () => {
    const response = await API.post("/report-builder/generate-sync", payload);
    return { data: response.data };
  }, "Failed to generate report (sync mode)");
};

// ============================================
// Report Status & Retrieval
// ============================================

/**
 * Get full report details by ID
 * @param {string} reportId - The report UUID
 * @returns {Promise} API response with full report details
 */
export const getReport = async (reportId) => {
  if (!reportId) {
    throw new Error("Report ID is required");
  }

  return handleApiCall(async () => {
    const response = await API.get(`/report-builder/reports/${reportId}`);
    return { data: response.data };
  }, "Failed to load report details");
};

/**
 * Get lightweight report status for polling
 * Backend returns: { id, status, totalRecords, errorMessage, fileUrl }
 * @param {string} reportId - The report UUID
 * @returns {Promise} API response with status info
 */
export const getReportStatus = async (reportId) => {
  if (!reportId) {
    throw new Error("Report ID is required");
  }

  return handleApiCall(async () => {
    const response = await API.get(`/report-builder/reports/${reportId}/status`);
    return { data: response.data };
  }, "Failed to fetch report status");
};

/**
 * Get user's report generation history
 * @param {number} [limit=20] - Number of reports to fetch
 * @param {number} [offset=0] - Offset for pagination
 * @returns {Promise} API response with report history
 */
export const getReportHistory = async (limit = 20, offset = 0) => {
  return handleApiCall(async () => {
    const response = await API.get(`/report-builder/history?limit=${limit}&offset=${offset}`);
    // Backend returns array directly, need to wrap for frontend
    const reports = Array.isArray(response.data) ? response.data : response.data?.reports || [];
    return {
      data: reports,
      total: response.data?.total || reports.length,
    };
  }, "Failed to load report history");
};

/**
 * Delete a generated report
 * @param {string} reportId - The report UUID
 * @returns {Promise} API response
 */
export const deleteReport = async (reportId) => {
  if (!reportId) {
    throw new Error("Report ID is required");
  }

  return handleApiCall(async () => {
    const response = await API.delete(`/report-builder/reports/${reportId}`);
    return response.data;
  }, "Failed to delete report");
};

/**
 * Download/export a generated report
 * @param {string} reportId - The report UUID
 * @returns {Promise} Blob response for file download
 */
export const exportReport = async (reportId) => {
  if (!reportId) {
    throw new Error("Report ID is required");
  }

  return handleApiCall(async () => {
    const response = await API.get(`/report-builder/export/${reportId}`, {
      responseType: 'blob',
    });
    return response;
  }, "Failed to download report");
};

/**
 * Get the export URL for a report (for direct download)
 * @param {string} reportId - The report UUID
 * @returns {string} The export URL
 */
export const getExportUrl = (reportId) => {
  if (!reportId) return '';
  const baseUrl = API.defaults.baseURL || '';
  return `${baseUrl}/report-builder/export/${reportId}`;
};

// ============================================
// Template Management
// ============================================

/**
 * Save a new report template
 * @param {Object} payload - Template data
 * @returns {Promise} API response with created template
 */
export const saveTemplate = async (payload) => {
  if (!payload?.name?.trim()) {
    throw new Error("Template name is required");
  }
  if (!payload?.reportType) {
    throw new Error("Report type is required");
  }
  if (!payload?.columns?.length) {
    throw new Error("At least one column must be selected");
  }

  return handleApiCall(async () => {
    const response = await API.post("/report-builder/templates", payload);
    return { data: transformTemplateResponse(response.data) };
  }, "Failed to save template");
};

/**
 * Get all templates (user's and public)
 * @returns {Promise} API response with templates list
 */
export const getTemplates = async () => {
  return handleApiCall(async () => {
    const response = await API.get("/report-builder/templates");
    // Transform array of templates
    const templates = Array.isArray(response.data)
      ? response.data.map(transformTemplateResponse)
      : [];
    return { data: templates };
  }, "Failed to load templates");
};

/**
 * Get a specific template by ID
 * @param {string} templateId - Template UUID
 * @returns {Promise} API response with template details
 */
export const getTemplate = async (templateId) => {
  if (!templateId) {
    throw new Error("Template ID is required");
  }

  return handleApiCall(async () => {
    const response = await API.get(`/report-builder/templates/${templateId}`);
    return { data: transformTemplateResponse(response.data) };
  }, "Failed to load template");
};

/**
 * Update an existing template
 * @param {string} templateId - Template UUID
 * @param {Object} payload - Updated template data
 * @returns {Promise} API response with updated template
 */
export const updateTemplate = async (templateId, payload) => {
  if (!templateId) {
    throw new Error("Template ID is required");
  }

  return handleApiCall(async () => {
    const response = await API.put(`/report-builder/templates/${templateId}`, payload);
    return { data: transformTemplateResponse(response.data) };
  }, "Failed to update template");
};

/**
 * Delete a template
 * @param {string} templateId - Template UUID
 * @returns {Promise} API response
 */
export const deleteTemplate = async (templateId) => {
  if (!templateId) {
    throw new Error("Template ID is required");
  }

  return handleApiCall(async () => {
    const response = await API.delete(`/report-builder/templates/${templateId}`);
    return response.data;
  }, "Failed to delete template");
};

/**
 * Transform backend template response to frontend format
 * Backend stores config in nested 'configuration' object
 * Frontend expects flat structure
 */
const transformTemplateResponse = (template) => {
  if (!template) return null;

  // Backend returns configuration as nested object
  const config = template.configuration || {};

  return {
    id: template.id,
    name: template.name,
    reportType: config.reportType || template.reportType,
    description: template.description,
    columns: config.columns || template.columns || [],
    filters: config.filters || template.filters || {},
    groupBy: config.groupBy || template.groupBy,
    sortBy: config.sortBy || template.sortBy,
    sortOrder: config.sortOrder || template.sortOrder,
    isPublic: template.isPublic || false,
    isOwner: template.isOwner !== undefined ? template.isOwner : true,
    createdAt: template.createdAt,
    updatedAt: template.updatedAt,
  };
};

// ============================================
// Utility Functions
// ============================================

/**
 * Get format-specific file extension
 * @param {string} format - Export format
 * @returns {string} File extension
 */
export const getFileExtension = (format) => {
  const extensions = {
    excel: 'xlsx',
    csv: 'csv',
    pdf: 'pdf',
    json: 'json',
  };
  return extensions[format] || 'xlsx';
};

/**
 * Get format display name
 * @param {string} format - Export format
 * @returns {string} Display name
 */
export const getFormatDisplayName = (format) => {
  const names = {
    excel: 'Excel (.xlsx)',
    csv: 'CSV (.csv)',
    pdf: 'PDF (.pdf)',
    json: 'JSON (.json)',
  };
  return names[format] || format;
};

/**
 * Get MIME type for format
 * @param {string} format - Export format
 * @returns {string} MIME type
 */
export const getMimeType = (format) => {
  const mimeTypes = {
    excel: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    csv: 'text/csv',
    pdf: 'application/pdf',
    json: 'application/json',
  };
  return mimeTypes[format] || 'application/octet-stream';
};

export default {
  // Catalog & Config
  getReportCatalog,
  getReportConfig,
  getFilterValues,
  // Generation
  generateReport,
  generateReportSync,
  // Status & Retrieval
  getReport,
  getReportStatus,
  getReportHistory,
  deleteReport,
  exportReport,
  getExportUrl,
  // Templates
  saveTemplate,
  getTemplates,
  getTemplate,
  updateTemplate,
  deleteTemplate,
  // Utilities
  getFileExtension,
  getFormatDisplayName,
  getMimeType,
  downloadBlob,
};
