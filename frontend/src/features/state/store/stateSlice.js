import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { apiClient } from '../../../services/api';
import { API_ENDPOINTS } from '../../../utils/constants';
import stateService from '../../../services/state.service';
import reportService from '../../../services/report.service';

const initialState = {
  dashboard: {
    stats: null,
    loading: false,
    error: null,
  },
  currentPrincipal: null,
  institutions: {
    list: [],
    selected: null,
    pagination: null,
    loading: false,
    error: null,
  },
  principals: {
    list: [],
    pagination: null,
    loading: false,
    error: null,
  },
  staff: {
    list: [],
    pagination: null,
    loading: false,
    error: null,
  },
  reports: {
    list: [],
    loading: false,
    error: null,
  },
  analytics: {
    topPerformers: [],
    bottomPerformers: [],
    topIndustries: [],
    monthlyStats: null,
    loading: false,
    error: null,
  },
  placements: {
    stats: null,
    trends: [],
    loading: false,
    error: null,
  },
  joiningLetters: {
    stats: null,
    loading: false,
    error: null,
  },
  reportBuilder: {
    catalog: [],
    config: null,
    history: [],
    generating: false,
    loading: false,
    error: null,
  },
  selectedInstitute: {
    id: null,
    data: null,
    loading: false,
    error: null,
  },
  instituteOverview: {
    data: null,
    loading: false,
    error: null,
  },
  instituteStudents: {
    list: [],
    cursor: null,
    hasMore: true,
    total: 0,
    filters: {
      branches: [],
    },
    loading: false,
    loadingMore: false,
    error: null,
  },
  instituteCompanies: {
    list: [],
    total: 0,
    summary: null,
    loading: false,
    error: null,
  },
  instituteFacultyPrincipal: {
    principal: null,
    faculty: [],
    summary: null,
    loading: false,
    error: null,
  },
  institutionsWithStats: {
    list: [],
    pagination: null,
    month: null,
    year: null,
    loading: false,
    error: null,
  },
  criticalAlerts: {
    data: null,
    loading: false,
    error: null,
  },
  actionItems: {
    data: null,
    loading: false,
    error: null,
  },
  complianceSummary: {
    data: null,
    loading: false,
    error: null,
  },
  lastFetched: {
    dashboard: null,
    institutions: null,
    institutionsKey: null,
    institutionsWithStats: null,
    institutionsWithStatsKey: null,
    principals: null,
    principalsKey: null,
    staff: null,
    staffKey: null,
    reports: null,
    analytics: null,
    placements: null,
    joiningLetters: null,
    criticalAlerts: null,
    actionItems: null,
    complianceSummary: null,
  },
};

// Cache duration constant
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

// Async thunks
export const fetchDashboardStats = createAsyncThunk(
  'state/fetchDashboardStats',
  async (params, { getState, rejectWithValue }) => {
    try {
      const state = getState();
      const lastFetched = state.state.lastFetched.dashboard;

      if (lastFetched && !params?.forceRefresh && (Date.now() - lastFetched) < CACHE_DURATION) {
        return { cached: true };
      }

      const response = await stateService.getDashboard();
      return response;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch dashboard');
    }
  }
);

export const fetchInstitutions = createAsyncThunk(
  'state/fetchInstitutions',
  async (params = {}, { getState, rejectWithValue }) => {
    try {
      const state = getState();
      const lastFetched = state.state.lastFetched.institutions;

      // Cache must be param-aware; otherwise pagination/search may randomly show stale data.
      // Normalize params into a stable key.
      const normalizedParams = {
        page: params?.page ?? 1,
        limit: params?.limit ?? 10,
        search: params?.search ?? '',
        type: params?.type ?? '',
        isActive:
          typeof params?.isActive === 'boolean' ? String(params.isActive) : params?.isActive ?? '',
        cursor: params?.cursor ?? '',
      };
      const requestKey = JSON.stringify(normalizedParams);
      const lastKey = state.state.lastFetched.institutionsKey;

      if (
        lastFetched &&
        !params?.forceRefresh &&
        lastKey === requestKey &&
        (Date.now() - lastFetched) < CACHE_DURATION
      ) {
        return { cached: true };
      }

      const response = await stateService.getInstitutions(params);
      return { ...response, _cacheKey: requestKey };
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch institutions');
    }
  }
);

export const fetchInstitutionsWithStats = createAsyncThunk(
  'state/fetchInstitutionsWithStats',
  async (params = {}, { getState, rejectWithValue }) => {
    try {
      const state = getState();
      const lastFetched = state.state.lastFetched.institutionsWithStats;

      const normalizedParams = {
        page: params?.page ?? 1,
        limit: params?.limit ?? 10,
        search: params?.search ?? '',
      };
      const requestKey = JSON.stringify(normalizedParams);
      const lastKey = state.state.lastFetched.institutionsWithStatsKey;

      if (
        lastFetched &&
        !params?.forceRefresh &&
        lastKey === requestKey &&
        (Date.now() - lastFetched) < CACHE_DURATION
      ) {
        return { cached: true };
      }

      const response = await stateService.getInstitutionsWithStats(params);
      return { ...response, _cacheKey: requestKey };
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch institutions stats');
    }
  }
);

export const fetchPrincipals = createAsyncThunk(
  'state/fetchPrincipals',
  async (params = {}, { getState, rejectWithValue }) => {
    try {
      const state = getState();
      const lastFetched = state.state.lastFetched.principals;

      // Cache must be param-aware; otherwise pagination/search may randomly show stale data.
      // Normalize params into a stable key.
      const normalizedParams = {
        page: params?.page ?? 1,
        limit: params?.limit ?? 10,
        search: params?.search ?? '',
        institutionId: params?.institutionId ?? '',
      };
      const requestKey = JSON.stringify(normalizedParams);
      const lastKey = state.state.lastFetched.principalsKey;

      if (
        lastFetched &&
        !params?.forceRefresh &&
        lastKey === requestKey &&
        (Date.now() - lastFetched) < CACHE_DURATION
      ) {
        return { cached: true };
      }

      const response = await stateService.getPrincipals(params);
      return { ...response, _cacheKey: requestKey };
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch principals');
    }
  }
);

export const fetchReports = createAsyncThunk(
  'state/fetchReports',
  async (params = {}, { getState, rejectWithValue }) => {
    try {
      const state = getState();
      const lastFetched = state.state.lastFetched.reports;

      if (lastFetched && !params?.forceRefresh && (Date.now() - lastFetched) < CACHE_DURATION) {
        return { cached: true };
      }

      const response = await stateService.getReports(params);
      return response;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch reports');
    }
  }
);

// Institution CRUD
export const createInstitution = createAsyncThunk(
  'state/createInstitution',
  async (institutionData, { rejectWithValue }) => {
    try {
      const response = await stateService.createInstitution(institutionData);
      return response;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to create institution');
    }
  }
);

export const updateInstitution = createAsyncThunk(
  'state/updateInstitution',
  async ({ id, data }, { rejectWithValue }) => {
    try {
      const response = await stateService.updateInstitution(id, data);
      return response;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to update institution');
    }
  }
);

export const deleteInstitution = createAsyncThunk(
  'state/deleteInstitution',
  async (id, { rejectWithValue }) => {
    try {
      const response = await stateService.deleteInstitution(id);
      return { id, ...response };
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to delete institution');
    }
  }
);

// Principal CRUD
export const createPrincipal = createAsyncThunk(
  'state/createPrincipal',
  async (principalData, { rejectWithValue }) => {
    try {
      const response = await stateService.createPrincipal(principalData);
      return response;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to create principal');
    }
  }
);

export const updatePrincipal = createAsyncThunk(
  'state/updatePrincipal',
  async ({ id, data }, { rejectWithValue }) => {
    try {
      const response = await stateService.updatePrincipal(id, data);
      return response;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to update principal');
    }
  }
);

export const deletePrincipal = createAsyncThunk(
  'state/deletePrincipal',
  async (id, { rejectWithValue }) => {
    try {
      const response = await stateService.deletePrincipal(id);
      return { id, ...response };
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to delete principal');
    }
  }
);

export const resetPrincipalPassword = createAsyncThunk(
  'state/resetPrincipalPassword',
  async (id, { rejectWithValue }) => {
    try {
      const response = await stateService.resetPrincipalPassword(id);
      return response;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to reset password');
    }
  }
);

export const fetchPrincipalById = createAsyncThunk(
  'state/fetchPrincipalById',
  async (id, { rejectWithValue }) => {
    try {
      const response = await stateService.getPrincipalById(id);
      return response;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch principal');
    }
  }
);

// Staff
export const fetchStaff = createAsyncThunk(
  'state/fetchStaff',
  async (params = {}, { getState, rejectWithValue }) => {
    try {
      const state = getState();
      const lastFetched = state.state.lastFetched.staff;

      // Cache must be param-aware; otherwise pagination/search may show stale data.
      const normalizedParams = {
        page: params?.page ?? 1,
        limit: params?.limit ?? 10,
        search: params?.search ?? '',
        institutionId: params?.institutionId ?? '',
        role: params?.role ?? '',
        branchName: params?.branchName ?? '',
        active: params?.active ?? '',
      };
      const requestKey = JSON.stringify(normalizedParams);
      const lastKey = state.state.lastFetched.staffKey;

      if (
        lastFetched &&
        !params?.forceRefresh &&
        lastKey === requestKey &&
        (Date.now() - lastFetched) < CACHE_DURATION
      ) {
        return { cached: true };
      }

      const response = await stateService.getStaff(params);
      return { ...response, _cacheKey: requestKey };
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch staff');
    }
  }
);

export const fetchStaffById = createAsyncThunk(
  'state/fetchStaffById',
  async (id, { rejectWithValue }) => {
    try {
      const response = await stateService.getStaffById(id);
      return response;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch staff member');
    }
  }
);

export const createStaff = createAsyncThunk(
  'state/createStaff',
  async (data, { rejectWithValue }) => {
    try {
      const response = await stateService.createStaff(data);
      return response;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to create staff');
    }
  }
);

export const updateStaff = createAsyncThunk(
  'state/updateStaff',
  async ({ id, data }, { rejectWithValue }) => {
    try {
      const response = await stateService.updateStaff(id, data);
      return response;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to update staff');
    }
  }
);

export const deleteStaff = createAsyncThunk(
  'state/deleteStaff',
  async (id, { rejectWithValue }) => {
    try {
      const response = await stateService.deleteStaff(id);
      return { id, ...response };
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to delete staff');
    }
  }
);

export const resetStaffPassword = createAsyncThunk(
  'state/resetStaffPassword',
  async (id, { rejectWithValue }) => {
    try {
      const response = await stateService.resetStaffPassword(id);
      return response;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to reset password');
    }
  }
);

// Reports
export const fetchReportById = createAsyncThunk(
  'state/fetchReportById',
  async (id, { rejectWithValue }) => {
    try {
      const response = await stateService.getReportById(id);
      return response;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch report');
    }
  }
);

export const generateReport = createAsyncThunk(
  'state/generateReport',
  async (reportParams, { rejectWithValue }) => {
    try {
      const response = await apiClient.post('/state/reports/generate', reportParams);
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to generate report');
    }
  }
);

// Analytics thunks
export const fetchTopPerformers = createAsyncThunk(
  'state/fetchTopPerformers',
  async (params = {}, { getState, rejectWithValue }) => {
    try {
      const state = getState();
      const lastFetched = state.state.lastFetched.analytics;

      if (lastFetched && !params?.forceRefresh && (Date.now() - lastFetched) < CACHE_DURATION) {
        return { cached: true };
      }

      const response = await apiClient.get('/state/analytics/performers', { params });
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch performers');
    }
  }
);

export const fetchTopIndustries = createAsyncThunk(
  'state/fetchTopIndustries',
  async (params = {}, { getState, rejectWithValue }) => {
    try {
      const state = getState();
      const lastFetched = state.state.lastFetched.analytics;

      // Skip cache for industries to always get fresh data unless forceRefresh is explicitly false
      if (lastFetched && params?.forceRefresh === false && (Date.now() - lastFetched) < CACHE_DURATION) {
        return { cached: true };
      }

      const response = await stateService.getTopIndustries({ limit: params?.limit || 10 });
      return response;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch industries');
    }
  }
);

export const fetchMonthlyAnalytics = createAsyncThunk(
  'state/fetchMonthlyAnalytics',
  async (params = {}, { getState, rejectWithValue }) => {
    try {
      const state = getState();
      const lastFetched = state.state.lastFetched.analytics;

      if (lastFetched && !params?.forceRefresh && (Date.now() - lastFetched) < CACHE_DURATION) {
        return { cached: true };
      }

      const response = await stateService.getMonthlyAnalytics(params);
      return response;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch monthly analytics');
    }
  }
);

export const exportDashboardReport = createAsyncThunk(
  'state/exportDashboardReport',
  async (params = {}, { rejectWithValue }) => {
    try {
      const response = await stateService.exportDashboardReport(params);
      return response;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to export report');
    }
  }
);

// Force refresh thunks - bypass cache
export const forceRefreshDashboard = createAsyncThunk(
  'state/forceRefreshDashboard',
  async (params = {}, { rejectWithValue }) => {
    try {
      const response = await stateService.getDashboard();
      return response;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to refresh dashboard');
    }
  }
);

export const forceRefreshInstitutions = createAsyncThunk(
  'state/forceRefreshInstitutions',
  async (params = {}, { rejectWithValue }) => {
    try {
      const response = await stateService.getInstitutions(params);
      return response;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to refresh institutions');
    }
  }
);

export const forceRefreshPrincipals = createAsyncThunk(
  'state/forceRefreshPrincipals',
  async (params = {}, { rejectWithValue }) => {
    try {
      const response = await stateService.getPrincipals(params);
      return response;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to refresh principals');
    }
  }
);

// Report Builder thunks
export const fetchReportCatalog = createAsyncThunk(
  'state/fetchReportCatalog',
  async (_, { rejectWithValue }) => {
    try {
      const response = await reportService.getCatalog();
      return response;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch report catalog');
    }
  }
);

export const fetchReportConfig = createAsyncThunk(
  'state/fetchReportConfig',
  async (type, { rejectWithValue }) => {
    try {
      const response = await reportService.getConfig(type);
      return response;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch report config');
    }
  }
);

export const generateNewReport = createAsyncThunk(
  'state/generateNewReport',
  async (reportData, { rejectWithValue }) => {
    try {
      const response = await reportService.generateReport(reportData);
      return response;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to generate report');
    }
  }
);

export const fetchReportHistory = createAsyncThunk(
  'state/fetchReportHistory',
  async (params = {}, { rejectWithValue }) => {
    try {
      const response = await reportService.getHistory(params);
      return response;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch report history');
    }
  }
);

export const checkReportStatus = createAsyncThunk(
  'state/checkReportStatus',
  async (id, { rejectWithValue }) => {
    try {
      const response = await reportService.getReportStatus(id);
      return response;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to check report status');
    }
  }
);

// Placement Statistics thunks
export const fetchPlacementStats = createAsyncThunk(
  'state/fetchPlacementStats',
  async (params = {}, { getState, rejectWithValue }) => {
    try {
      const state = getState();
      const lastFetched = state.state.lastFetched.placements;

      if (lastFetched && !params?.forceRefresh && (Date.now() - lastFetched) < CACHE_DURATION) {
        return { cached: true };
      }

      const response = await stateService.getPlacementStats();
      return response;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch placement stats');
    }
  }
);

export const fetchPlacementTrends = createAsyncThunk(
  'state/fetchPlacementTrends',
  async (params = {}, { getState, rejectWithValue }) => {
    try {
      const state = getState();
      const lastFetched = state.state.lastFetched.placements;

      if (lastFetched && !params?.forceRefresh && (Date.now() - lastFetched) < CACHE_DURATION) {
        return { cached: true };
      }

      const response = await stateService.getPlacementTrends(params);
      return response;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch placement trends');
    }
  }
);

// Joining Letter Stats thunks
export const fetchJoiningLetterStats = createAsyncThunk(
  'state/fetchJoiningLetterStats',
  async (params = {}, { getState, rejectWithValue }) => {
    try {
      const state = getState();
      const lastFetched = state.state.lastFetched.joiningLetters;

      if (lastFetched && !params?.forceRefresh && (Date.now() - lastFetched) < CACHE_DURATION) {
        return { cached: true };
      }

      const response = await stateService.getJoiningLetterStats();
      return response;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch joining letter stats');
    }
  }
);

// Institute Detail View thunks
export const fetchInstituteOverview = createAsyncThunk(
  'state/fetchInstituteOverview',
  async (institutionId, { rejectWithValue }) => {
    try {
      const response = await stateService.getInstitutionOverview(institutionId);
      return response;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch institute overview');
    }
  }
);

export const fetchInstituteStudents = createAsyncThunk(
  'state/fetchInstituteStudents',
  async ({ institutionId, cursor, limit, search, filter, branch, companyId, reportStatus, visitStatus, selfIdentified, loadMore = false }, { rejectWithValue }) => {
    try {
      const response = await stateService.getInstitutionStudents(institutionId, {
        cursor,
        limit,
        search,
        filter,
        branch,
        companyId,
        reportStatus,
        visitStatus,
        selfIdentified,
      });
      return { ...response, loadMore };
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch students');
    }
  }
);

export const fetchInstituteCompanies = createAsyncThunk(
  'state/fetchInstituteCompanies',
  async ({ institutionId, limit, search }, { rejectWithValue }) => {
    try {
      const response = await stateService.getInstitutionCompanies(institutionId, { limit, search });
      return response;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch companies');
    }
  }
);

export const fetchInstituteFacultyPrincipal = createAsyncThunk(
  'state/fetchInstituteFacultyPrincipal',
  async (institutionId, { rejectWithValue }) => {
    try {
      const response = await stateService.getInstitutionFacultyPrincipal(institutionId);
      return response;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch faculty and principal');
    }
  }
);

// Mentor management thunks
export const fetchInstitutionMentors = createAsyncThunk(
  'state/fetchInstitutionMentors',
  async (institutionId, { rejectWithValue }) => {
    try {
      const response = await stateService.getInstitutionMentors(institutionId);
      return response;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch mentors');
    }
  }
);

export const assignMentorToStudent = createAsyncThunk(
  'state/assignMentorToStudent',
  async ({ studentId, mentorId }, { rejectWithValue }) => {
    try {
      const response = await stateService.assignMentorToStudent(studentId, mentorId);
      return { studentId, ...response };
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to assign mentor');
    }
  }
);

export const removeMentorFromStudent = createAsyncThunk(
  'state/removeMentorFromStudent',
  async (studentId, { rejectWithValue }) => {
    try {
      const response = await stateService.removeMentorFromStudent(studentId);
      return { studentId, ...response };
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to remove mentor');
    }
  }
);

// Critical Alerts thunk
export const fetchCriticalAlerts = createAsyncThunk(
  'state/fetchCriticalAlerts',
  async (params = {}, { getState, rejectWithValue }) => {
    try {
      const state = getState();
      const lastFetched = state.state.lastFetched.criticalAlerts;

      if (lastFetched && !params?.forceRefresh && (Date.now() - lastFetched) < CACHE_DURATION) {
        return { cached: true };
      }

      const response = await stateService.getCriticalAlerts();
      return response;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch critical alerts');
    }
  }
);

// Action Items thunk
export const fetchActionItems = createAsyncThunk(
  'state/fetchActionItems',
  async (params = {}, { getState, rejectWithValue }) => {
    try {
      const state = getState();
      const lastFetched = state.state.lastFetched.actionItems;

      if (lastFetched && !params?.forceRefresh && (Date.now() - lastFetched) < CACHE_DURATION) {
        return { cached: true };
      }

      const response = await stateService.getActionItems();
      return response;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch action items');
    }
  }
);

// Compliance Summary thunk
export const fetchComplianceSummary = createAsyncThunk(
  'state/fetchComplianceSummary',
  async (params = {}, { getState, rejectWithValue }) => {
    try {
      const state = getState();
      const lastFetched = state.state.lastFetched.complianceSummary;

      if (lastFetched && !params?.forceRefresh && (Date.now() - lastFetched) < CACHE_DURATION) {
        return { cached: true };
      }

      const response = await stateService.getComplianceSummary();
      return response;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch compliance summary');
    }
  }
);

const stateSlice = createSlice({
  name: 'state',
  initialState,
  reducers: {
    setSelectedInstitution: (state, action) => {
      state.institutions.selected = action.payload;
    },
    clearStateError: (state) => {
      state.dashboard.error = null;
      state.institutions.error = null;
      state.principals.error = null;
      state.reports.error = null;
      state.analytics.error = null;
    },
    markAllDataStale: (state) => {
      state.lastFetched.dashboard = 0;
      state.lastFetched.institutions = 0;
      state.lastFetched.institutionsKey = null;
      state.lastFetched.principals = 0;
      state.lastFetched.principalsKey = null;
      state.lastFetched.reports = 0;
      state.lastFetched.analytics = 0;
    },
    resetStateSlice: () => initialState,
    clearCurrentPrincipal: (state) => {
      state.currentPrincipal = null;
    },
    // Optimistic update reducers for institutions
    optimisticallyAddInstitution: (state, action) => {
      const tempInstitution = {
        ...action.payload,
        id: `temp_${Date.now()}`,
        _isOptimistic: true,
      };
      state.institutions.list.unshift(tempInstitution);
    },
    optimisticallyUpdateInstitution: (state, action) => {
      const { id, data } = action.payload;
      const index = state.institutions.list.findIndex(inst => inst.id === id);
      if (index !== -1) {
        state.institutions.list[index] = {
          ...state.institutions.list[index],
          ...data,
          _isOptimistic: true,
        };
      }
    },
    optimisticallyDeleteInstitution: (state, action) => {
      state.institutions.list = state.institutions.list.filter(
        inst => inst.id !== action.payload
      );
    },
    rollbackInstitutionOperation: (state, action) => {
      if (action.payload?.list) {
        state.institutions.list = action.payload.list;
      }
    },
    // Optimistic update reducers for principals
    optimisticallyAddPrincipal: (state, action) => {
      const tempPrincipal = {
        ...action.payload,
        id: `temp_${Date.now()}`,
        _isOptimistic: true,
      };
      state.principals.list.unshift(tempPrincipal);
    },
    optimisticallyUpdatePrincipal: (state, action) => {
      const { id, data } = action.payload;
      const index = state.principals.list.findIndex(p => p.id === id);
      if (index !== -1) {
        state.principals.list[index] = {
          ...state.principals.list[index],
          ...data,
          _isOptimistic: true,
        };
      }
    },
    optimisticallyDeletePrincipal: (state, action) => {
      state.principals.list = state.principals.list.filter(
        p => p.id !== action.payload
      );
    },
    rollbackPrincipalOperation: (state, action) => {
      if (action.payload?.list) {
        state.principals.list = action.payload.list;
      }
    },
    setSelectedInstitute: (state, action) => {
      state.selectedInstitute.id = action.payload;
      // Reset other data when selecting new institute
      state.instituteOverview.data = null;
      state.instituteStudents.list = [];
      state.instituteStudents.cursor = null;
      state.instituteStudents.hasMore = true;
      state.instituteCompanies.list = [];
      state.instituteCompanies.summary = null;
      state.instituteFacultyPrincipal.principal = null;
      state.instituteFacultyPrincipal.faculty = [];
      state.instituteFacultyPrincipal.summary = null;
    },
    clearSelectedInstitute: (state) => {
      state.selectedInstitute = { id: null, data: null, loading: false, error: null };
      state.instituteOverview = { data: null, loading: false, error: null };
      state.instituteStudents = { list: [], cursor: null, hasMore: true, total: 0, loading: false, loadingMore: false, error: null };
      state.instituteCompanies = { list: [], total: 0, summary: null, loading: false, error: null };
      state.instituteFacultyPrincipal = { principal: null, faculty: [], summary: null, loading: false, error: null };
    },
  },
  extraReducers: (builder) => {
    builder
      // Dashboard
      .addCase(fetchDashboardStats.pending, (state) => {
        state.dashboard.loading = true;
        state.dashboard.error = null;
      })
      .addCase(fetchDashboardStats.fulfilled, (state, action) => {
        state.dashboard.loading = false;
        if (!action.payload.cached) {
          state.dashboard.stats = action.payload;
          state.lastFetched.dashboard = Date.now();
        }
      })
      .addCase(fetchDashboardStats.rejected, (state, action) => {
        state.dashboard.loading = false;
        state.dashboard.error = action.payload;
      })

      // Institutions
      .addCase(fetchInstitutions.pending, (state) => {
        state.institutions.loading = true;
        state.institutions.error = null;
      })
      .addCase(fetchInstitutions.fulfilled, (state, action) => {
        state.institutions.loading = false;
        if (!action.payload.cached) {
          state.institutions.list = action.payload.data || action.payload;
          // Support multiple response shapes:
          // - { data, pagination: { ... } }
          // - { data, total, page, limit, totalPages, nextCursor }
          // - legacy arrays
          state.institutions.pagination =
            action.payload.pagination ||
            (typeof action.payload?.total === 'number' || typeof action.payload?.page === 'number'
              ? {
                  total: action.payload.total ?? (action.payload.data?.length || 0),
                  page: action.payload.page ?? 1,
                  limit: action.payload.limit ?? (action.payload.data?.length || 10),
                  totalPages: action.payload.totalPages,
                  nextCursor: action.payload.nextCursor,
                }
              : null);
          state.lastFetched.institutions = Date.now();
          state.lastFetched.institutionsKey = action.payload._cacheKey ?? null;
        }
      })
      .addCase(fetchInstitutions.rejected, (state, action) => {
        state.institutions.loading = false;
        state.institutions.error = action.payload;
      })
      // Institutions with Stats (for dashboard)
      .addCase(fetchInstitutionsWithStats.pending, (state) => {
        state.institutionsWithStats.loading = true;
        state.institutionsWithStats.error = null;
      })
      .addCase(fetchInstitutionsWithStats.fulfilled, (state, action) => {
        state.institutionsWithStats.loading = false;
        if (!action.payload.cached) {
          state.institutionsWithStats.list = action.payload.data || [];
          state.institutionsWithStats.pagination = {
            total: action.payload.total ?? 0,
            page: action.payload.page ?? 1,
            limit: action.payload.limit ?? 10,
            totalPages: action.payload.totalPages ?? 1,
          };
          state.institutionsWithStats.month = action.payload.month;
          state.institutionsWithStats.year = action.payload.year;
          state.lastFetched.institutionsWithStats = Date.now();
          state.lastFetched.institutionsWithStatsKey = action.payload._cacheKey ?? null;
        }
      })
      .addCase(fetchInstitutionsWithStats.rejected, (state, action) => {
        state.institutionsWithStats.loading = false;
        state.institutionsWithStats.error = action.payload;
      })
      .addCase(createInstitution.pending, (state) => {
        state.institutions.loading = true;
        state.institutions.error = null;
      })
      .addCase(createInstitution.fulfilled, (state, action) => {
        state.institutions.loading = false;
        state.institutions.list = [action.payload, ...state.institutions.list];
        state.lastFetched.institutions = Date.now();
      })
      .addCase(createInstitution.rejected, (state, action) => {
        state.institutions.loading = false;
        state.institutions.error = action.payload;
      })
      .addCase(updateInstitution.pending, (state) => {
        state.institutions.loading = true;
        state.institutions.error = null;
      })
      .addCase(updateInstitution.fulfilled, (state, action) => {
        state.institutions.loading = false;
        const index = state.institutions.list.findIndex(i => i.id === action.payload.id);
        if (index !== -1) {
          state.institutions.list[index] = action.payload;
        }
        state.lastFetched.institutions = Date.now();
      })
      .addCase(updateInstitution.rejected, (state, action) => {
        state.institutions.loading = false;
        state.institutions.error = action.payload;
      })
      .addCase(deleteInstitution.pending, (state) => {
        state.institutions.loading = true;
        state.institutions.error = null;
      })
      .addCase(deleteInstitution.fulfilled, (state, action) => {
        state.institutions.loading = false;
        state.institutions.list = state.institutions.list.filter(i => i.id !== action.payload.id);
        state.lastFetched.institutions = Date.now();
      })
      .addCase(deleteInstitution.rejected, (state, action) => {
        state.institutions.loading = false;
        state.institutions.error = action.payload;
      })

      // Principals
      .addCase(fetchPrincipals.pending, (state) => {
        state.principals.loading = true;
        state.principals.error = null;
      })
      .addCase(fetchPrincipals.fulfilled, (state, action) => {
        state.principals.loading = false;
        if (!action.payload.cached) {
          state.principals.list = action.payload.data || action.payload;
          state.principals.pagination = {
            total: action.payload.total,
            page: action.payload.page,
            limit: action.payload.limit,
            totalPages: action.payload.totalPages,
          };
          state.lastFetched.principals = Date.now();
          state.lastFetched.principalsKey = action.payload._cacheKey ?? null;
        }
      })
      .addCase(fetchPrincipals.rejected, (state, action) => {
        state.principals.loading = false;
        state.principals.error = action.payload;
      })
      .addCase(fetchPrincipalById.pending, (state) => {
        state.principals.loading = true;
        state.principals.error = null;
      })
      .addCase(fetchPrincipalById.fulfilled, (state, action) => {
        state.principals.loading = false;
        state.currentPrincipal = action.payload?.data ?? action.payload;
      })
      .addCase(fetchPrincipalById.rejected, (state, action) => {
        state.principals.loading = false;
        state.principals.error = action.payload;
      })
      .addCase(createPrincipal.pending, (state) => {
        state.principals.loading = true;
        state.principals.error = null;
      })
      .addCase(createPrincipal.fulfilled, (state, action) => {
        state.principals.loading = false;
        state.principals.list = [action.payload, ...state.principals.list];
        state.lastFetched.principals = Date.now();
      })
      .addCase(createPrincipal.rejected, (state, action) => {
        state.principals.loading = false;
        state.principals.error = action.payload;
      })
      .addCase(updatePrincipal.pending, (state) => {
        state.principals.loading = true;
        state.principals.error = null;
      })
      .addCase(updatePrincipal.fulfilled, (state, action) => {
        state.principals.loading = false;
        const updatedPrincipal = action.payload?.data ?? action.payload;
        const index = state.principals.list.findIndex(p => p.id === updatedPrincipal.id);
        if (index !== -1) {
          state.principals.list[index] = updatedPrincipal;
        }
        state.currentPrincipal = null; // Clear current principal after update
        state.lastFetched.principals = Date.now();
      })
      .addCase(updatePrincipal.rejected, (state, action) => {
        state.principals.loading = false;
        state.principals.error = action.payload;
      })
      .addCase(deletePrincipal.pending, (state) => {
        state.principals.loading = true;
        state.principals.error = null;
      })
      .addCase(deletePrincipal.fulfilled, (state, action) => {
        state.principals.loading = false;
        state.principals.list = state.principals.list.filter(p => p.id !== action.payload.id);
        state.lastFetched.principals = Date.now();
      })
      .addCase(deletePrincipal.rejected, (state, action) => {
        state.principals.loading = false;
        state.principals.error = action.payload;
      })
      .addCase(resetPrincipalPassword.pending, (state) => {
        state.principals.loading = true;
        state.principals.error = null;
      })
      .addCase(resetPrincipalPassword.fulfilled, (state) => {
        state.principals.loading = false;
      })
      .addCase(resetPrincipalPassword.rejected, (state, action) => {
        state.principals.loading = false;
        state.principals.error = action.payload;
      })

      // Staff
      .addCase(fetchStaff.pending, (state) => {
        state.staff.loading = true;
        state.staff.error = null;
      })
      .addCase(fetchStaff.fulfilled, (state, action) => {
        state.staff.loading = false;
        if (!action.payload.cached) {
          state.staff.list = action.payload.data || action.payload;
          state.staff.pagination = {
            total: action.payload.total,
            page: action.payload.page,
            limit: action.payload.limit,
            totalPages: action.payload.totalPages,
          };
          state.lastFetched.staff = Date.now();
          state.lastFetched.staffKey = action.payload._cacheKey ?? null;
        }
      })
      .addCase(fetchStaff.rejected, (state, action) => {
        state.staff.loading = false;
        state.staff.error = action.payload;
      })
      .addCase(fetchStaffById.pending, (state) => {
        state.staff.loading = true;
        state.staff.error = null;
      })
      .addCase(fetchStaffById.fulfilled, (state) => {
        state.staff.loading = false;
      })
      .addCase(fetchStaffById.rejected, (state, action) => {
        state.staff.loading = false;
        state.staff.error = action.payload;
      })
      .addCase(createStaff.pending, (state) => {
        state.staff.loading = true;
        state.staff.error = null;
      })
      .addCase(createStaff.fulfilled, (state, action) => {
        state.staff.loading = false;
        state.staff.list = [action.payload, ...state.staff.list];
        state.lastFetched.staff = null; // Invalidate cache to force refresh
        state.lastFetched.staffKey = null;
      })
      .addCase(createStaff.rejected, (state, action) => {
        state.staff.loading = false;
        state.staff.error = action.payload;
      })
      .addCase(updateStaff.pending, (state) => {
        state.staff.loading = true;
        state.staff.error = null;
      })
      .addCase(updateStaff.fulfilled, (state, action) => {
        state.staff.loading = false;
        const updatedStaff = action.payload?.data ?? action.payload;
        const index = state.staff.list.findIndex(s => s.id === updatedStaff.id);
        if (index !== -1) {
          state.staff.list[index] = updatedStaff;
        }
        state.lastFetched.staff = null; // Invalidate cache
        state.lastFetched.staffKey = null;
      })
      .addCase(updateStaff.rejected, (state, action) => {
        state.staff.loading = false;
        state.staff.error = action.payload;
      })
      .addCase(deleteStaff.pending, (state) => {
        state.staff.loading = true;
        state.staff.error = null;
      })
      .addCase(deleteStaff.fulfilled, (state, action) => {
        state.staff.loading = false;
        state.staff.list = state.staff.list.filter(s => s.id !== action.payload.id);
        state.lastFetched.staff = null; // Invalidate cache
        state.lastFetched.staffKey = null;
      })
      .addCase(deleteStaff.rejected, (state, action) => {
        state.staff.loading = false;
        state.staff.error = action.payload;
      })
      .addCase(resetStaffPassword.pending, (state) => {
        state.staff.loading = true;
        state.staff.error = null;
      })
      .addCase(resetStaffPassword.fulfilled, (state) => {
        state.staff.loading = false;
      })
      .addCase(resetStaffPassword.rejected, (state, action) => {
        state.staff.loading = false;
        state.staff.error = action.payload;
      })

      // Reports
      .addCase(fetchReports.pending, (state) => {
        state.reports.loading = true;
        state.reports.error = null;
      })
      .addCase(fetchReports.fulfilled, (state, action) => {
        state.reports.loading = false;
        if (!action.payload.cached) {
          state.reports.list = action.payload.data || action.payload;
          state.lastFetched.reports = Date.now();
        }
      })
      .addCase(fetchReports.rejected, (state, action) => {
        state.reports.loading = false;
        state.reports.error = action.payload;
      })
      .addCase(fetchReportById.pending, (state) => {
        state.reports.loading = true;
        state.reports.error = null;
      })
      .addCase(fetchReportById.fulfilled, (state, action) => {
        state.reports.loading = false;
      })
      .addCase(fetchReportById.rejected, (state, action) => {
        state.reports.loading = false;
        state.reports.error = action.payload;
      })
      .addCase(generateReport.pending, (state) => {
        state.reports.loading = true;
        state.reports.error = null;
      })
      .addCase(generateReport.fulfilled, (state, action) => {
        state.reports.loading = false;
        state.reports.list = [action.payload, ...state.reports.list];
        state.lastFetched.reports = Date.now();
      })
      .addCase(generateReport.rejected, (state, action) => {
        state.reports.loading = false;
        state.reports.error = action.payload;
      })

      // Analytics
      .addCase(fetchTopPerformers.pending, (state) => {
        state.analytics.loading = true;
        state.analytics.error = null;
      })
      .addCase(fetchTopPerformers.fulfilled, (state, action) => {
        state.analytics.loading = false;
        if (!action.payload.cached) {
          state.analytics.topPerformers = action.payload.topPerformers || [];
          state.analytics.bottomPerformers = action.payload.bottomPerformers || [];
          state.lastFetched.analytics = Date.now();
        }
      })
      .addCase(fetchTopPerformers.rejected, (state, action) => {
        state.analytics.loading = false;
        state.analytics.error = action.payload;
      })
      .addCase(fetchTopIndustries.pending, (state) => {
        state.analytics.loading = true;
      })
      .addCase(fetchTopIndustries.fulfilled, (state, action) => {
        state.analytics.loading = false;
        state.analytics.topIndustries = action.payload.data || action.payload || [];
      })
      .addCase(fetchTopIndustries.rejected, (state, action) => {
        state.analytics.loading = false;
        state.analytics.error = action.payload;
      })
      .addCase(fetchMonthlyAnalytics.pending, (state) => {
        state.analytics.loading = true;
      })
      .addCase(fetchMonthlyAnalytics.fulfilled, (state, action) => {
        state.analytics.loading = false;
        state.analytics.monthlyStats = action.payload.data || action.payload;
      })
      .addCase(fetchMonthlyAnalytics.rejected, (state, action) => {
        state.analytics.loading = false;
        state.analytics.error = action.payload;
      })

      // Force Refresh thunks
      .addCase(forceRefreshDashboard.pending, (state) => {
        state.dashboard.loading = true;
        state.dashboard.error = null;
      })
      .addCase(forceRefreshDashboard.fulfilled, (state, action) => {
        state.dashboard.loading = false;
        state.dashboard.stats = action.payload;
        state.lastFetched.dashboard = Date.now();
      })
      .addCase(forceRefreshDashboard.rejected, (state, action) => {
        state.dashboard.loading = false;
        state.dashboard.error = action.payload;
      })
      .addCase(forceRefreshInstitutions.pending, (state) => {
        state.institutions.loading = true;
        state.institutions.error = null;
      })
      .addCase(forceRefreshInstitutions.fulfilled, (state, action) => {
        state.institutions.loading = false;
        state.institutions.list = action.payload.data || action.payload;
        state.institutions.pagination = action.payload.pagination || null;
        state.lastFetched.institutions = Date.now();
      })
      .addCase(forceRefreshInstitutions.rejected, (state, action) => {
        state.institutions.loading = false;
        state.institutions.error = action.payload;
      })
      .addCase(forceRefreshPrincipals.pending, (state) => {
        state.principals.loading = true;
        state.principals.error = null;
      })
      .addCase(forceRefreshPrincipals.fulfilled, (state, action) => {
        state.principals.loading = false;
        state.principals.list = action.payload.data || action.payload;
        state.lastFetched.principals = Date.now();
      })
      .addCase(forceRefreshPrincipals.rejected, (state, action) => {
        state.principals.loading = false;
        state.principals.error = action.payload;
      })

      // Report Builder
      .addCase(fetchReportCatalog.pending, (state) => {
        state.reportBuilder.loading = true;
        state.reportBuilder.error = null;
      })
      .addCase(fetchReportCatalog.fulfilled, (state, action) => {
        state.reportBuilder.loading = false;
        // Backend returns { reports: [...], total: number }
        state.reportBuilder.catalog = action.payload.reports || action.payload.data || action.payload || [];
      })
      .addCase(fetchReportCatalog.rejected, (state, action) => {
        state.reportBuilder.loading = false;
        state.reportBuilder.error = action.payload;
      })
      .addCase(fetchReportConfig.pending, (state) => {
        state.reportBuilder.loading = true;
        state.reportBuilder.error = null;
      })
      .addCase(fetchReportConfig.fulfilled, (state, action) => {
        state.reportBuilder.loading = false;
        state.reportBuilder.config = action.payload.data || action.payload;
      })
      .addCase(fetchReportConfig.rejected, (state, action) => {
        state.reportBuilder.loading = false;
        state.reportBuilder.error = action.payload;
      })
      .addCase(generateNewReport.pending, (state) => {
        state.reportBuilder.generating = true;
        state.reportBuilder.error = null;
      })
      .addCase(generateNewReport.fulfilled, (state, action) => {
        state.reportBuilder.generating = false;
        state.reportBuilder.history = [action.payload, ...state.reportBuilder.history];
      })
      .addCase(generateNewReport.rejected, (state, action) => {
        state.reportBuilder.generating = false;
        state.reportBuilder.error = action.payload;
      })
      .addCase(fetchReportHistory.pending, (state) => {
        state.reportBuilder.loading = true;
        state.reportBuilder.error = null;
      })
      .addCase(fetchReportHistory.fulfilled, (state, action) => {
        state.reportBuilder.loading = false;
        state.reportBuilder.history = action.payload.data || action.payload || [];
      })
      .addCase(fetchReportHistory.rejected, (state, action) => {
        state.reportBuilder.loading = false;
        state.reportBuilder.error = action.payload;
      })
      .addCase(checkReportStatus.fulfilled, (state, action) => {
        const index = state.reportBuilder.history.findIndex(r => r.id === action.payload.id);
        if (index !== -1) {
          state.reportBuilder.history[index] = action.payload;
        }
      })

      // Placement Stats
      .addCase(fetchPlacementStats.pending, (state) => {
        state.placements.loading = true;
        state.placements.error = null;
      })
      .addCase(fetchPlacementStats.fulfilled, (state, action) => {
        state.placements.loading = false;
        if (!action.payload.cached) {
          state.placements.stats = action.payload;
          state.lastFetched.placements = Date.now();
        }
      })
      .addCase(fetchPlacementStats.rejected, (state, action) => {
        state.placements.loading = false;
        state.placements.error = action.payload;
      })
      .addCase(fetchPlacementTrends.pending, (state) => {
        state.placements.loading = true;
        state.placements.error = null;
      })
      .addCase(fetchPlacementTrends.fulfilled, (state, action) => {
        state.placements.loading = false;
        if (!action.payload.cached) {
          state.placements.trends = action.payload || [];
          state.lastFetched.placements = Date.now();
        }
      })
      .addCase(fetchPlacementTrends.rejected, (state, action) => {
        state.placements.loading = false;
        state.placements.error = action.payload;
      })

      // Joining Letter Stats
      .addCase(fetchJoiningLetterStats.pending, (state) => {
        state.joiningLetters.loading = true;
        state.joiningLetters.error = null;
      })
      .addCase(fetchJoiningLetterStats.fulfilled, (state, action) => {
        state.joiningLetters.loading = false;
        if (!action.payload.cached) {
          state.joiningLetters.stats = action.payload;
          state.lastFetched.joiningLetters = Date.now();
        }
      })
      .addCase(fetchJoiningLetterStats.rejected, (state, action) => {
        state.joiningLetters.loading = false;
        state.joiningLetters.error = action.payload;
      })

      // Institute Detail View
      .addCase(fetchInstituteOverview.pending, (state) => {
        state.instituteOverview.loading = true;
        state.instituteOverview.error = null;
      })
      .addCase(fetchInstituteOverview.fulfilled, (state, action) => {
        state.instituteOverview.loading = false;
        state.instituteOverview.data = action.payload;
      })
      .addCase(fetchInstituteOverview.rejected, (state, action) => {
        state.instituteOverview.loading = false;
        state.instituteOverview.error = action.payload;
      })
      .addCase(fetchInstituteStudents.pending, (state, action) => {
        if (action.meta.arg.loadMore) {
          state.instituteStudents.loadingMore = true;
        } else {
          state.instituteStudents.loading = true;
        }
        state.instituteStudents.error = null;
      })
      .addCase(fetchInstituteStudents.fulfilled, (state, action) => {
        if (action.payload.loadMore) {
          state.instituteStudents.list = [...state.instituteStudents.list, ...action.payload.students];
          state.instituteStudents.loadingMore = false;
        } else {
          state.instituteStudents.list = action.payload.students;
          state.instituteStudents.loading = false;
        }
        state.instituteStudents.cursor = action.payload.nextCursor;
        state.instituteStudents.hasMore = action.payload.hasMore;
        state.instituteStudents.total = action.payload.total;
        // Store filters data (branches list for dropdown)
        if (action.payload.filters) {
          state.instituteStudents.filters = action.payload.filters;
        }
      })
      .addCase(fetchInstituteStudents.rejected, (state, action) => {
        state.instituteStudents.loading = false;
        state.instituteStudents.loadingMore = false;
        state.instituteStudents.error = action.payload;
      })
      .addCase(fetchInstituteCompanies.pending, (state) => {
        state.instituteCompanies.loading = true;
        state.instituteCompanies.error = null;
      })
      .addCase(fetchInstituteCompanies.fulfilled, (state, action) => {
        state.instituteCompanies.loading = false;
        state.instituteCompanies.list = action.payload.companies || action.payload.data || [];
        state.instituteCompanies.total = action.payload.total || 0;
        state.instituteCompanies.summary = action.payload.summary || null;
      })
      .addCase(fetchInstituteCompanies.rejected, (state, action) => {
        state.instituteCompanies.loading = false;
        state.instituteCompanies.error = action.payload;
      })

      // Faculty & Principal
      .addCase(fetchInstituteFacultyPrincipal.pending, (state) => {
        state.instituteFacultyPrincipal.loading = true;
        state.instituteFacultyPrincipal.error = null;
      })
      .addCase(fetchInstituteFacultyPrincipal.fulfilled, (state, action) => {
        state.instituteFacultyPrincipal.loading = false;
        state.instituteFacultyPrincipal.principal = action.payload.principal || null;
        state.instituteFacultyPrincipal.faculty = action.payload.faculty || [];
        state.instituteFacultyPrincipal.summary = action.payload.summary || null;
      })
      .addCase(fetchInstituteFacultyPrincipal.rejected, (state, action) => {
        state.instituteFacultyPrincipal.loading = false;
        state.instituteFacultyPrincipal.error = action.payload;
      })

      // Critical Alerts
      .addCase(fetchCriticalAlerts.pending, (state) => {
        state.criticalAlerts.loading = true;
        state.criticalAlerts.error = null;
      })
      .addCase(fetchCriticalAlerts.fulfilled, (state, action) => {
        state.criticalAlerts.loading = false;
        if (!action.payload.cached) {
          state.criticalAlerts.data = action.payload;
          state.lastFetched.criticalAlerts = Date.now();
        }
      })
      .addCase(fetchCriticalAlerts.rejected, (state, action) => {
        state.criticalAlerts.loading = false;
        state.criticalAlerts.error = action.payload;
      })

      // Action Items
      .addCase(fetchActionItems.pending, (state) => {
        state.actionItems.loading = true;
        state.actionItems.error = null;
      })
      .addCase(fetchActionItems.fulfilled, (state, action) => {
        state.actionItems.loading = false;
        if (!action.payload.cached) {
          state.actionItems.data = action.payload;
          state.lastFetched.actionItems = Date.now();
        }
      })
      .addCase(fetchActionItems.rejected, (state, action) => {
        state.actionItems.loading = false;
        state.actionItems.error = action.payload;
      })

      // Compliance Summary
      .addCase(fetchComplianceSummary.pending, (state) => {
        state.complianceSummary.loading = true;
        state.complianceSummary.error = null;
      })
      .addCase(fetchComplianceSummary.fulfilled, (state, action) => {
        state.complianceSummary.loading = false;
        if (!action.payload.cached) {
          state.complianceSummary.data = action.payload;
          state.lastFetched.complianceSummary = Date.now();
        }
      })
      .addCase(fetchComplianceSummary.rejected, (state, action) => {
        state.complianceSummary.loading = false;
        state.complianceSummary.error = action.payload;
      });
  },
});

export const {
  setSelectedInstitution,
  clearStateError,
  markAllDataStale,
  resetStateSlice,
  clearCurrentPrincipal,
  // Institution optimistic updates
  optimisticallyAddInstitution,
  optimisticallyUpdateInstitution,
  optimisticallyDeleteInstitution,
  rollbackInstitutionOperation,
  // Principal optimistic updates
  optimisticallyAddPrincipal,
  optimisticallyUpdatePrincipal,
  optimisticallyDeletePrincipal,
  rollbackPrincipalOperation,
  // Institute detail view actions
  setSelectedInstitute,
  clearSelectedInstitute,
} = stateSlice.actions;

// ============= SELECTORS =============

// Dashboard selectors
export const selectDashboardStats = (state) => state.state.dashboard.stats;
export const selectDashboardLoading = (state) => state.state.dashboard.loading;
export const selectDashboardError = (state) => state.state.dashboard.error;

// Institution selectors
export const selectInstitutions = (state) => state.state.institutions.list;
export const selectSelectedInstitution = (state) => state.state.institutions.selected;
export const selectInstitutionsPagination = (state) => state.state.institutions.pagination;
export const selectInstitutionsLoading = (state) => state.state.institutions.loading;
export const selectInstitutionsError = (state) => state.state.institutions.error;

// Institutions with Stats selectors (for dashboard)
export const selectInstitutionsWithStats = (state) => state.state.institutionsWithStats.list;
export const selectInstitutionsWithStatsPagination = (state) => state.state.institutionsWithStats.pagination;
export const selectInstitutionsWithStatsLoading = (state) => state.state.institutionsWithStats.loading;
export const selectInstitutionsWithStatsError = (state) => state.state.institutionsWithStats.error;
export const selectInstitutionsWithStatsMonth = (state) => state.state.institutionsWithStats.month;
export const selectInstitutionsWithStatsYear = (state) => state.state.institutionsWithStats.year;

// Principal selectors
export const selectPrincipals = (state) => state.state.principals.list;
export const selectCurrentPrincipal = (state) => state.state.currentPrincipal;
export const selectPrincipalsLoading = (state) => state.state.principals.loading;
export const selectPrincipalsError = (state) => state.state.principals.error;

// Reports selectors
export const selectReports = (state) => state.state.reports.list;
export const selectReportsLoading = (state) => state.state.reports.loading;
export const selectReportsError = (state) => state.state.reports.error;

// Analytics selectors
export const selectTopPerformers = (state) => state.state.analytics.topPerformers;
export const selectBottomPerformers = (state) => state.state.analytics.bottomPerformers;
export const selectTopIndustries = (state) => state.state.analytics.topIndustries;
export const selectMonthlyStats = (state) => state.state.analytics.monthlyStats;
export const selectAnalyticsLoading = (state) => state.state.analytics.loading;
export const selectAnalyticsError = (state) => state.state.analytics.error;

// Report Builder selectors
export const selectReportCatalog = (state) => state.state.reportBuilder.catalog;
export const selectReportConfig = (state) => state.state.reportBuilder.config;
export const selectReportHistory = (state) => state.state.reportBuilder.history;
export const selectReportBuilderLoading = (state) => state.state.reportBuilder.loading;
export const selectReportGenerating = (state) => state.state.reportBuilder.generating;
export const selectReportBuilderError = (state) => state.state.reportBuilder.error;

// Placement selectors
export const selectPlacementStats = (state) => state.state.placements.stats;
export const selectPlacementTrends = (state) => state.state.placements.trends;
export const selectPlacementsLoading = (state) => state.state.placements.loading;
export const selectPlacementsError = (state) => state.state.placements.error;

// Joining Letter selectors
export const selectJoiningLetterStats = (state) => state.state.joiningLetters.stats;
export const selectJoiningLettersLoading = (state) => state.state.joiningLetters.loading;
export const selectJoiningLettersError = (state) => state.state.joiningLetters.error;

// Last fetched selectors
export const selectLastFetched = (state) => state.state.lastFetched;
export const selectMostRecentFetch = (state) => {
  const timestamps = Object.values(state.state.lastFetched).filter(Boolean);
  return timestamps.length > 0 ? Math.max(...timestamps) : null;
};

// Combined loading selector
export const selectAnyLoading = (state) =>
  state.state.dashboard.loading ||
  state.state.institutions.loading ||
  state.state.principals.loading ||
  state.state.reports.loading ||
  state.state.analytics.loading ||
  state.state.placements.loading ||
  state.state.joiningLetters.loading;

// Institute Detail View selectors
export const selectSelectedInstitute = (state) => state.state.selectedInstitute;
export const selectInstituteOverview = (state) => state.state.instituteOverview;
export const selectInstituteStudents = (state) => state.state.instituteStudents;
export const selectInstituteCompanies = (state) => state.state.instituteCompanies;
export const selectInstituteFacultyPrincipal = (state) => state.state.instituteFacultyPrincipal;

// Critical Alerts selectors
export const selectCriticalAlerts = (state) => state.state.criticalAlerts.data;
export const selectCriticalAlertsLoading = (state) => state.state.criticalAlerts.loading;
export const selectCriticalAlertsError = (state) => state.state.criticalAlerts.error;

// Action Items selectors
export const selectActionItems = (state) => state.state.actionItems.data;
export const selectActionItemsLoading = (state) => state.state.actionItems.loading;
export const selectActionItemsError = (state) => state.state.actionItems.error;

// Compliance Summary selectors
export const selectComplianceSummary = (state) => state.state.complianceSummary.data;
export const selectComplianceSummaryLoading = (state) => state.state.complianceSummary.loading;
export const selectComplianceSummaryError = (state) => state.state.complianceSummary.error;

export default stateSlice.reducer;
