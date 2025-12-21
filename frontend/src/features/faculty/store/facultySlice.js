import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import facultyService from '../../../services/faculty.service';

const initialState = {
  dashboard: {
    stats: null,
    recentActivities: [],
    upcomingVisits: [],
    loading: false,
    error: null,
  },
  students: {
    list: [],
    total: 0,
    page: 1,
    totalPages: 1,
    loading: false,
    error: null,
  },
  visitLogs: {
    list: [],
    current: null,
    total: 0,
    page: 1,
    totalPages: 1,
    loading: false,
    error: null,
  },
  monthlyReports: {
    list: [],
    total: 0,
    page: 1,
    totalPages: 1,
    loading: false,
    error: null,
  },
  profile: {
    data: null,
    loading: false,
    error: null,
  },
  applications: {
    list: [],
    total: 0,
    page: 1,
    totalPages: 1,
    loading: false,
    error: null,
  },
  feedbackHistory: {
    list: [],
    total: 0,
    loading: false,
    error: null,
  },
  lastFetched: {
    dashboard: null,
    students: null,
    visitLogs: null,
    monthlyReports: null,
    profile: null,
    applications: null,
    feedbackHistory: null,
  },
};

// Cache duration constant
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

// Dashboard
export const fetchFacultyDashboard = createAsyncThunk(
  'faculty/fetchDashboard',
  async (params, { getState, rejectWithValue }) => {
    try {
      const state = getState();
      const lastFetched = state.faculty.lastFetched.dashboard;

      if (lastFetched && !params?.forceRefresh && (Date.now() - lastFetched) < CACHE_DURATION) {
        return { cached: true };
      }

      const response = await facultyService.getDashboard();
      return response;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch dashboard');
    }
  }
);

// Profile
export const fetchProfile = createAsyncThunk(
  'faculty/fetchProfile',
  async (_, { getState, rejectWithValue }) => {
    try {
      const state = getState();
      const lastFetched = state.faculty.lastFetched.profile;

      if (lastFetched && (Date.now() - lastFetched) < CACHE_DURATION) {
        return { cached: true };
      }

      const response = await facultyService.getProfile();
      return response;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch profile');
    }
  }
);

// Alias for backward compatibility
export const fetchMentor = fetchProfile;

// Students
export const fetchAssignedStudents = createAsyncThunk(
  'faculty/fetchAssignedStudents',
  async (params = {}, { getState, rejectWithValue }) => {
    try {
      const state = getState();
      const lastFetched = state.faculty.lastFetched.students;

      if (lastFetched && !params?.forceRefresh && (Date.now() - lastFetched) < CACHE_DURATION) {
        return { cached: true };
      }

      const response = await facultyService.getAssignedStudents(params);
      return response;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch students');
    }
  }
);

export const fetchStudentProgress = createAsyncThunk(
  'faculty/fetchStudentProgress',
  async (studentId, { rejectWithValue }) => {
    try {
      const response = await facultyService.getStudentProgress(studentId);
      return response;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch student progress');
    }
  }
);

// Visit Logs
export const fetchVisitLogs = createAsyncThunk(
  'faculty/fetchVisitLogs',
  async (params = {}, { getState, rejectWithValue }) => {
    try {
      const state = getState();
      const lastFetched = state.faculty.lastFetched.visitLogs;

      if (lastFetched && !params?.forceRefresh && (Date.now() - lastFetched) < CACHE_DURATION) {
        return { cached: true };
      }

      const response = await facultyService.getVisitLogs(params);
      return response;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch visit logs');
    }
  }
);

export const fetchVisitLogById = createAsyncThunk(
  'faculty/fetchVisitLogById',
  async (id, { rejectWithValue }) => {
    try {
      const response = await facultyService.getVisitLogById(id);
      return response;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch visit log');
    }
  }
);

export const createVisitLog = createAsyncThunk(
  'faculty/createVisitLog',
  async (visitLogData, { rejectWithValue }) => {
    try {
      const response = await facultyService.createVisitLog(visitLogData);
      return response;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to create visit log');
    }
  }
);

export const updateVisitLog = createAsyncThunk(
  'faculty/updateVisitLog',
  async ({ id, data }, { rejectWithValue }) => {
    try {
      const response = await facultyService.updateVisitLog(id, data);
      return response;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to update visit log');
    }
  }
);

export const deleteVisitLog = createAsyncThunk(
  'faculty/deleteVisitLog',
  async (id, { rejectWithValue }) => {
    try {
      const response = await facultyService.deleteVisitLog(id);
      return { id, ...response };
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to delete visit log');
    }
  }
);

// Monthly Reports
export const fetchMonthlyReports = createAsyncThunk(
  'faculty/fetchMonthlyReports',
  async (params = {}, { getState, rejectWithValue }) => {
    try {
      const state = getState();
      const lastFetched = state.faculty.lastFetched.monthlyReports;

      if (lastFetched && !params?.forceRefresh && (Date.now() - lastFetched) < CACHE_DURATION) {
        return { cached: true };
      }

      const response = await facultyService.getMonthlyReports(params);
      return response;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch monthly reports');
    }
  }
);

export const reviewMonthlyReport = createAsyncThunk(
  'faculty/reviewMonthlyReport',
  async ({ reportId, reviewData }, { rejectWithValue }) => {
    try {
      const response = await facultyService.reviewMonthlyReport(reportId, reviewData);
      return response;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to review report');
    }
  }
);

// Self-Identified Approvals
export const fetchApplications = createAsyncThunk(
  'faculty/fetchApplications',
  async (params = {}, { getState, rejectWithValue }) => {
    try {
      const state = getState();
      const lastFetched = state.faculty.lastFetched.applications;

      if (lastFetched && !params?.forceRefresh && (Date.now() - lastFetched) < CACHE_DURATION) {
        return { cached: true };
      }

      const response = await facultyService.getSelfIdentifiedApprovals(params);
      return response;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch applications');
    }
  }
);

export const approveApplication = createAsyncThunk(
  'faculty/approveApplication',
  async ({ applicationId, data = {} }, { rejectWithValue }) => {
    try {
      const response = await facultyService.updateSelfIdentifiedApproval(applicationId, {
        ...data,
        status: 'APPROVED',
      });
      return response;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to approve application');
    }
  }
);

export const rejectApplication = createAsyncThunk(
  'faculty/rejectApplication',
  async ({ applicationId, reason }, { rejectWithValue }) => {
    try {
      const response = await facultyService.updateSelfIdentifiedApproval(applicationId, {
        status: 'REJECTED',
        reviewRemarks: reason,
      });
      return response;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to reject application');
    }
  }
);

// Feedback
export const submitFeedback = createAsyncThunk(
  'faculty/submitFeedback',
  async ({ applicationId, feedbackData }, { rejectWithValue }) => {
    try {
      const response = await facultyService.submitMonthlyFeedback({
        applicationId,
        ...feedbackData,
      });
      return response;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to submit feedback');
    }
  }
);

export const fetchFeedbackHistory = createAsyncThunk(
  'faculty/fetchFeedbackHistory',
  async (params = {}, { getState, rejectWithValue }) => {
    try {
      const state = getState();
      const lastFetched = state.faculty.lastFetched.feedbackHistory;

      if (lastFetched && !params?.forceRefresh && (Date.now() - lastFetched) < CACHE_DURATION) {
        return { cached: true };
      }

      const response = await facultyService.getFeedbackHistory(params);
      return response;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch feedback history');
    }
  }
);

// Backward compatibility aliases
export const fetchGrievances = fetchFeedbackHistory;
export const resolveGrievance = submitFeedback;

const facultySlice = createSlice({
  name: 'faculty',
  initialState,
  reducers: {
    clearError: (state) => {
      state.dashboard.error = null;
      state.students.error = null;
      state.visitLogs.error = null;
      state.monthlyReports.error = null;
      state.applications.error = null;
    },
    invalidateCache: (state) => {
      state.lastFetched = {
        dashboard: null,
        students: null,
        visitLogs: null,
        monthlyReports: null,
        profile: null,
        applications: null,
        feedbackHistory: null,
      };
    },
  },
  extraReducers: (builder) => {
    builder
      // Dashboard
      .addCase(fetchFacultyDashboard.pending, (state) => {
        state.dashboard.loading = true;
        state.dashboard.error = null;
      })
      .addCase(fetchFacultyDashboard.fulfilled, (state, action) => {
        state.dashboard.loading = false;
        if (!action.payload.cached) {
          state.dashboard.stats = {
            totalStudents: action.payload.totalStudents || 0,
            activeInternships: action.payload.activeInternships || 0,
            pendingReports: action.payload.pendingReports || 0,
            pendingApprovals: action.payload.pendingApprovals || 0,
            totalVisits: action.payload.totalVisits || 0,
          };
          state.dashboard.recentActivities = action.payload.recentActivities || [];
          state.dashboard.upcomingVisits = action.payload.upcomingVisits || [];
          state.lastFetched.dashboard = Date.now();
        }
      })
      .addCase(fetchFacultyDashboard.rejected, (state, action) => {
        state.dashboard.loading = false;
        state.dashboard.error = action.payload;
      })

      // Profile
      .addCase(fetchProfile.pending, (state) => {
        state.profile.loading = true;
        state.profile.error = null;
      })
      .addCase(fetchProfile.fulfilled, (state, action) => {
        state.profile.loading = false;
        if (!action.payload.cached) {
          state.profile.data = action.payload;
          state.lastFetched.profile = Date.now();
        }
      })
      .addCase(fetchProfile.rejected, (state, action) => {
        state.profile.loading = false;
        state.profile.error = action.payload;
      })

      // Students
      .addCase(fetchAssignedStudents.pending, (state) => {
        state.students.loading = true;
        state.students.error = null;
      })
      .addCase(fetchAssignedStudents.fulfilled, (state, action) => {
        state.students.loading = false;
        if (!action.payload.cached) {
          state.students.list = action.payload.students || [];
          state.students.total = action.payload.total || 0;
          state.students.page = action.payload.page || 1;
          state.students.totalPages = action.payload.totalPages || 1;
          state.lastFetched.students = Date.now();
        }
      })
      .addCase(fetchAssignedStudents.rejected, (state, action) => {
        state.students.loading = false;
        state.students.error = action.payload;
      })

      // Visit Logs
      .addCase(fetchVisitLogs.pending, (state) => {
        state.visitLogs.loading = true;
        state.visitLogs.error = null;
      })
      .addCase(fetchVisitLogs.fulfilled, (state, action) => {
        state.visitLogs.loading = false;
        if (!action.payload.cached) {
          state.visitLogs.list = action.payload.visitLogs || [];
          state.visitLogs.total = action.payload.total || 0;
          state.visitLogs.page = action.payload.page || 1;
          state.visitLogs.totalPages = action.payload.totalPages || 1;
          state.lastFetched.visitLogs = Date.now();
        }
      })
      .addCase(fetchVisitLogs.rejected, (state, action) => {
        state.visitLogs.loading = false;
        state.visitLogs.error = action.payload;
      })
      .addCase(fetchVisitLogById.pending, (state) => {
        state.visitLogs.loading = true;
        state.visitLogs.error = null;
      })
      .addCase(fetchVisitLogById.fulfilled, (state, action) => {
        state.visitLogs.loading = false;
        state.visitLogs.current = action.payload;
      })
      .addCase(fetchVisitLogById.rejected, (state, action) => {
        state.visitLogs.loading = false;
        state.visitLogs.error = action.payload;
      })
      .addCase(createVisitLog.pending, (state) => {
        state.visitLogs.loading = true;
        state.visitLogs.error = null;
      })
      .addCase(createVisitLog.fulfilled, (state, action) => {
        state.visitLogs.loading = false;
        state.visitLogs.list = [action.payload, ...state.visitLogs.list];
        state.visitLogs.total += 1;
        state.lastFetched.visitLogs = null; // Invalidate cache
      })
      .addCase(createVisitLog.rejected, (state, action) => {
        state.visitLogs.loading = false;
        state.visitLogs.error = action.payload;
      })
      .addCase(updateVisitLog.pending, (state) => {
        state.visitLogs.loading = true;
        state.visitLogs.error = null;
      })
      .addCase(updateVisitLog.fulfilled, (state, action) => {
        state.visitLogs.loading = false;
        const index = state.visitLogs.list.findIndex(log => log.id === action.payload.id);
        if (index !== -1) {
          state.visitLogs.list[index] = action.payload;
        }
      })
      .addCase(updateVisitLog.rejected, (state, action) => {
        state.visitLogs.loading = false;
        state.visitLogs.error = action.payload;
      })
      .addCase(deleteVisitLog.pending, (state) => {
        state.visitLogs.loading = true;
        state.visitLogs.error = null;
      })
      .addCase(deleteVisitLog.fulfilled, (state, action) => {
        state.visitLogs.loading = false;
        state.visitLogs.list = state.visitLogs.list.filter(log => log.id !== action.payload.id);
        state.visitLogs.total -= 1;
      })
      .addCase(deleteVisitLog.rejected, (state, action) => {
        state.visitLogs.loading = false;
        state.visitLogs.error = action.payload;
      })

      // Monthly Reports
      .addCase(fetchMonthlyReports.pending, (state) => {
        state.monthlyReports.loading = true;
        state.monthlyReports.error = null;
      })
      .addCase(fetchMonthlyReports.fulfilled, (state, action) => {
        state.monthlyReports.loading = false;
        if (!action.payload.cached) {
          state.monthlyReports.list = action.payload.reports || [];
          state.monthlyReports.total = action.payload.total || 0;
          state.monthlyReports.page = action.payload.page || 1;
          state.monthlyReports.totalPages = action.payload.totalPages || 1;
          state.lastFetched.monthlyReports = Date.now();
        }
      })
      .addCase(fetchMonthlyReports.rejected, (state, action) => {
        state.monthlyReports.loading = false;
        state.monthlyReports.error = action.payload;
      })
      .addCase(reviewMonthlyReport.pending, (state) => {
        state.monthlyReports.loading = true;
      })
      .addCase(reviewMonthlyReport.fulfilled, (state, action) => {
        state.monthlyReports.loading = false;
        const index = state.monthlyReports.list.findIndex(r => r.id === action.payload.id);
        if (index !== -1) {
          state.monthlyReports.list[index] = action.payload;
        }
        state.lastFetched.monthlyReports = null; // Invalidate cache
      })
      .addCase(reviewMonthlyReport.rejected, (state, action) => {
        state.monthlyReports.loading = false;
        state.monthlyReports.error = action.payload;
      })

      // Applications
      .addCase(fetchApplications.pending, (state) => {
        state.applications.loading = true;
        state.applications.error = null;
      })
      .addCase(fetchApplications.fulfilled, (state, action) => {
        state.applications.loading = false;
        if (!action.payload.cached) {
          state.applications.list = action.payload.approvals || [];
          state.applications.total = action.payload.total || 0;
          state.applications.page = action.payload.page || 1;
          state.applications.totalPages = action.payload.totalPages || 1;
          state.lastFetched.applications = Date.now();
        }
      })
      .addCase(fetchApplications.rejected, (state, action) => {
        state.applications.loading = false;
        state.applications.error = action.payload;
      })
      .addCase(approveApplication.pending, (state) => {
        state.applications.loading = true;
      })
      .addCase(approveApplication.fulfilled, (state, action) => {
        state.applications.loading = false;
        const index = state.applications.list.findIndex(app => app.id === action.payload.id);
        if (index !== -1) {
          state.applications.list[index] = action.payload;
        }
        state.lastFetched.applications = null; // Invalidate cache
      })
      .addCase(approveApplication.rejected, (state, action) => {
        state.applications.loading = false;
        state.applications.error = action.payload;
      })
      .addCase(rejectApplication.pending, (state) => {
        state.applications.loading = true;
      })
      .addCase(rejectApplication.fulfilled, (state, action) => {
        state.applications.loading = false;
        const index = state.applications.list.findIndex(app => app.id === action.payload.id);
        if (index !== -1) {
          state.applications.list[index] = action.payload;
        }
        state.lastFetched.applications = null; // Invalidate cache
      })
      .addCase(rejectApplication.rejected, (state, action) => {
        state.applications.loading = false;
        state.applications.error = action.payload;
      })

      // Feedback History
      .addCase(fetchFeedbackHistory.pending, (state) => {
        state.feedbackHistory.loading = true;
        state.feedbackHistory.error = null;
      })
      .addCase(fetchFeedbackHistory.fulfilled, (state, action) => {
        state.feedbackHistory.loading = false;
        if (!action.payload.cached) {
          state.feedbackHistory.list = action.payload.feedback || [];
          state.feedbackHistory.total = action.payload.total || 0;
          state.lastFetched.feedbackHistory = Date.now();
        }
      })
      .addCase(fetchFeedbackHistory.rejected, (state, action) => {
        state.feedbackHistory.loading = false;
        state.feedbackHistory.error = action.payload;
      })

      // Submit Feedback
      .addCase(submitFeedback.pending, (state) => {
        state.feedbackHistory.loading = true;
      })
      .addCase(submitFeedback.fulfilled, (state, action) => {
        state.feedbackHistory.loading = false;
        state.feedbackHistory.list = [action.payload, ...state.feedbackHistory.list];
        state.lastFetched.feedbackHistory = null; // Invalidate cache
      })
      .addCase(submitFeedback.rejected, (state, action) => {
        state.feedbackHistory.loading = false;
        state.feedbackHistory.error = action.payload;
      });
  },
});

export const { clearError, invalidateCache } = facultySlice.actions;

// Selectors
export const selectDashboard = (state) => state.faculty.dashboard;
export const selectStudents = (state) => state.faculty.students;
export const selectVisitLogs = (state) => state.faculty.visitLogs;
export const selectMonthlyReports = (state) => state.faculty.monthlyReports;
export const selectProfile = (state) => state.faculty.profile;
export const selectApplications = (state) => state.faculty.applications;
export const selectFeedbackHistory = (state) => state.faculty.feedbackHistory;

// Backward compatibility selectors
export const selectMentor = (state) => state.faculty.profile;
export const selectGrievances = (state) => state.faculty.feedbackHistory;

export default facultySlice.reducer;
