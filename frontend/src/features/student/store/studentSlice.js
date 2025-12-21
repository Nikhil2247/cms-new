import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { apiClient } from '../../../services/api';
import { API_ENDPOINTS } from '../../../utils/constants';
import studentService from '../../../services/student.service';

const initialState = {
  dashboard: {
    stats: null,
    loading: false,
    error: null,
  },
  profile: {
    data: null,
    loading: false,
    error: null,
  },
  internships: {
    list: [],
    loading: false,
    error: null,
  },
  reports: {
    list: [],
    loading: false,
    error: null,
  },
  enrollments: {
    list: [],
    loading: false,
    error: null,
  },
  availableInternships: {
    list: [],
    loading: false,
    error: null,
  },
  applications: {
    list: [],
    loading: false,
    error: null,
  },
  mentor: {
    data: null,
    loading: false,
    error: null,
  },
  grievances: {
    list: [],
    loading: false,
    error: null,
  },
  lastFetched: {
    dashboard: null,
    profile: null,
    internships: null,
    reports: null,
    enrollments: null,
    availableInternships: null,
    applications: null,
    mentor: null,
    grievances: null,
  },
};

// Cache duration constant
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

export const fetchStudentDashboard = createAsyncThunk(
  'student/fetchDashboard',
  async (params, { getState, rejectWithValue }) => {
    try {
      const state = getState();
      const lastFetched = state.student.lastFetched.dashboard;

      if (lastFetched && !params?.forceRefresh && (Date.now() - lastFetched) < CACHE_DURATION) {
        return { cached: true };
      }

      const response = await apiClient.get(API_ENDPOINTS.STUDENT_DASHBOARD);
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch dashboard');
    }
  }
);

export const fetchStudentProfile = createAsyncThunk(
  'student/fetchProfile',
  async (params, { getState, rejectWithValue }) => {
    try {
      const state = getState();
      const lastFetched = state.student.lastFetched.profile;

      if (lastFetched && !params?.forceRefresh && (Date.now() - lastFetched) < CACHE_DURATION) {
        return { cached: true };
      }

      const response = await apiClient.get(API_ENDPOINTS.STUDENT_PROFILE);
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch profile');
    }
  }
);

export const fetchMyInternships = createAsyncThunk(
  'student/fetchMyInternships',
  async (params, { getState, rejectWithValue }) => {
    try {
      const state = getState();
      const lastFetched = state.student.lastFetched.internships;

      if (lastFetched && !params?.forceRefresh && (Date.now() - lastFetched) < CACHE_DURATION) {
        return { cached: true };
      }

      const response = await studentService.getMyInternships(params);
      return response;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch internships');
    }
  }
);

export const fetchMyReports = createAsyncThunk(
  'student/fetchMyReports',
  async (params, { getState, rejectWithValue }) => {
    try {
      const state = getState();
      const lastFetched = state.student.lastFetched.reports;

      if (lastFetched && !params?.forceRefresh && (Date.now() - lastFetched) < CACHE_DURATION) {
        return { cached: true };
      }

      const response = await studentService.getMyReports(params);
      return response;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch reports');
    }
  }
);

// Enrollments
export const fetchEnrollments = createAsyncThunk(
  'student/fetchEnrollments',
  async (params, { getState, rejectWithValue }) => {
    try {
      const state = getState();
      const lastFetched = state.student.lastFetched.enrollments;

      if (lastFetched && !params?.forceRefresh && (Date.now() - lastFetched) < CACHE_DURATION) {
        return { cached: true };
      }

      const response = await studentService.getEnrollments();
      return response;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch enrollments');
    }
  }
);

// Reports CRUD
export const createReport = createAsyncThunk(
  'student/createReport',
  async (reportData, { rejectWithValue }) => {
    try {
      const response = await studentService.createReport(reportData);
      return response;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to create report');
    }
  }
);

export const updateReport = createAsyncThunk(
  'student/updateReport',
  async ({ id, data }, { rejectWithValue }) => {
    try {
      const response = await studentService.updateReport(id, data);
      return response;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to update report');
    }
  }
);

// Profile update
export const updateProfile = createAsyncThunk(
  'student/updateProfile',
  async (profileData, { rejectWithValue }) => {
    try {
      const response = await studentService.updateProfile(profileData);
      return response;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to update profile');
    }
  }
);

// Internship application
export const applyForInternship = createAsyncThunk(
  'student/applyForInternship',
  async ({ internshipId, applicationData }, { rejectWithValue }) => {
    try {
      const response = await studentService.applyForInternship(internshipId, applicationData);
      return response;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to apply for internship');
    }
  }
);

// Available internships
export const fetchAvailableInternships = createAsyncThunk(
  'student/fetchAvailableInternships',
  async (filters, { getState, rejectWithValue }) => {
    try {
      const state = getState();
      const lastFetched = state.student.lastFetched.availableInternships;

      if (lastFetched && !filters?.forceRefresh && (Date.now() - lastFetched) < CACHE_DURATION) {
        return { cached: true };
      }

      const response = await studentService.getAvailableInternships(filters);
      return response;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch available internships');
    }
  }
);

// Applications
export const fetchApplications = createAsyncThunk(
  'student/fetchApplications',
  async (params, { getState, rejectWithValue }) => {
    try {
      const state = getState();
      const lastFetched = state.student.lastFetched.applications;

      if (lastFetched && !params?.forceRefresh && (Date.now() - lastFetched) < CACHE_DURATION) {
        return { cached: true };
      }

      const response = await studentService.getApplications();
      return response;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch applications');
    }
  }
);

// Submit report (alias for createReport for consistency)
export const submitReport = createReport;

// Alias for fetchStudentProfile for consistency
export const fetchProfile = fetchStudentProfile;

// Aliases for monthly reports (same as regular reports)
export const createMonthlyReport = createReport;
export const updateMonthlyReport = updateReport;

// Alias for fetchAvailableInternships
export const fetchInternships = fetchAvailableInternships;

// Mentor - fetches assigned mentor information from student profile
export const fetchMentor = createAsyncThunk(
  'student/fetchMentor',
  async (_, { rejectWithValue }) => {
    try {
      // Mentor info is included in student profile
      const response = await apiClient.get('/student/profile');
      return response.data?.mentor || null;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch mentor');
    }
  }
);

// Grievances
export const fetchGrievances = createAsyncThunk(
  'student/fetchGrievances',
  async (params, { rejectWithValue }) => {
    try {
      const response = await apiClient.get('/student/grievances', { params });
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch grievances');
    }
  }
);

export const createGrievance = createAsyncThunk(
  'student/createGrievance',
  async (grievanceData, { rejectWithValue }) => {
    try {
      const response = await apiClient.post('/student/grievances', grievanceData);
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to create grievance');
    }
  }
);

// Application actions
export const withdrawApplication = createAsyncThunk(
  'student/withdrawApplication',
  async (applicationId, { rejectWithValue }) => {
    try {
      // Use student service endpoint - withdraw is handled via update with status
      const response = await studentService.withdrawApplication(applicationId);
      return { id: applicationId, ...response };
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to withdraw application');
    }
  }
);

export const updateApplication = createAsyncThunk(
  'student/updateApplication',
  async ({ id, data }, { rejectWithValue }) => {
    try {
      // Applications are managed via student portal
      const response = await apiClient.put(`/student/applications/${id}`, data);
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to update application');
    }
  }
);

// Monthly report submission
export const submitMonthlyReport = createAsyncThunk(
  'student/submitMonthlyReport',
  async ({ reportId, data }, { rejectWithValue }) => {
    try {
      const response = await apiClient.put(`/student/monthly-reports/${reportId}`, data);
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to submit report');
    }
  }
);

export const uploadReportFile = createAsyncThunk(
  'student/uploadReportFile',
  async (formData, { rejectWithValue }) => {
    try {
      const response = await apiClient.post('/student/documents', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to upload report');
    }
  }
);

const studentSlice = createSlice({
  name: 'student',
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      // Dashboard
      .addCase(fetchStudentDashboard.pending, (state) => {
        state.dashboard.loading = true;
        state.dashboard.error = null;
      })
      .addCase(fetchStudentDashboard.fulfilled, (state, action) => {
        state.dashboard.loading = false;
        if (!action.payload.cached) {
          state.dashboard.stats = action.payload;
          state.lastFetched.dashboard = Date.now();
        }
      })
      .addCase(fetchStudentDashboard.rejected, (state, action) => {
        state.dashboard.loading = false;
        state.dashboard.error = action.payload;
      })

      // Profile
      .addCase(fetchStudentProfile.pending, (state) => {
        state.profile.loading = true;
        state.profile.error = null;
      })
      .addCase(fetchStudentProfile.fulfilled, (state, action) => {
        state.profile.loading = false;
        if (!action.payload.cached) {
          state.profile.data = action.payload;
          state.lastFetched.profile = Date.now();
        }
      })
      .addCase(fetchStudentProfile.rejected, (state, action) => {
        state.profile.loading = false;
        state.profile.error = action.payload;
      })
      .addCase(updateProfile.pending, (state) => {
        state.profile.loading = true;
        state.profile.error = null;
      })
      .addCase(updateProfile.fulfilled, (state, action) => {
        state.profile.loading = false;
        state.profile.data = action.payload;
        state.lastFetched.profile = Date.now();
      })
      .addCase(updateProfile.rejected, (state, action) => {
        state.profile.loading = false;
        state.profile.error = action.payload;
      })

      // My Internships
      .addCase(fetchMyInternships.pending, (state) => {
        state.internships.loading = true;
        state.internships.error = null;
      })
      .addCase(fetchMyInternships.fulfilled, (state, action) => {
        state.internships.loading = false;
        if (!action.payload.cached) {
          state.internships.list = action.payload.data || action.payload;
          state.lastFetched.internships = Date.now();
        }
      })
      .addCase(fetchMyInternships.rejected, (state, action) => {
        state.internships.loading = false;
        state.internships.error = action.payload;
      })

      // Available Internships
      .addCase(fetchAvailableInternships.pending, (state) => {
        state.availableInternships.loading = true;
        state.availableInternships.error = null;
      })
      .addCase(fetchAvailableInternships.fulfilled, (state, action) => {
        state.availableInternships.loading = false;
        if (!action.payload.cached) {
          state.availableInternships.list = action.payload.data || action.payload;
          state.lastFetched.availableInternships = Date.now();
        }
      })
      .addCase(fetchAvailableInternships.rejected, (state, action) => {
        state.availableInternships.loading = false;
        state.availableInternships.error = action.payload;
      })

      // Apply for internship
      .addCase(applyForInternship.pending, (state) => {
        state.internships.loading = true;
        state.internships.error = null;
      })
      .addCase(applyForInternship.fulfilled, (state, action) => {
        state.internships.loading = false;
        // Add to internships list
        state.internships.list = [action.payload, ...state.internships.list];
      })
      .addCase(applyForInternship.rejected, (state, action) => {
        state.internships.loading = false;
        state.internships.error = action.payload;
      })

      // Reports
      .addCase(fetchMyReports.pending, (state) => {
        state.reports.loading = true;
        state.reports.error = null;
      })
      .addCase(fetchMyReports.fulfilled, (state, action) => {
        state.reports.loading = false;
        if (!action.payload.cached) {
          state.reports.list = action.payload.data || action.payload;
          state.lastFetched.reports = Date.now();
        }
      })
      .addCase(fetchMyReports.rejected, (state, action) => {
        state.reports.loading = false;
        state.reports.error = action.payload;
      })
      .addCase(createReport.pending, (state) => {
        state.reports.loading = true;
        state.reports.error = null;
      })
      .addCase(createReport.fulfilled, (state, action) => {
        state.reports.loading = false;
        state.reports.list = [action.payload, ...state.reports.list];
        state.lastFetched.reports = Date.now();
      })
      .addCase(createReport.rejected, (state, action) => {
        state.reports.loading = false;
        state.reports.error = action.payload;
      })
      .addCase(updateReport.pending, (state) => {
        state.reports.loading = true;
        state.reports.error = null;
      })
      .addCase(updateReport.fulfilled, (state, action) => {
        state.reports.loading = false;
        const index = state.reports.list.findIndex(r => r.id === action.payload.id);
        if (index !== -1) {
          state.reports.list[index] = action.payload;
        }
        state.lastFetched.reports = Date.now();
      })
      .addCase(updateReport.rejected, (state, action) => {
        state.reports.loading = false;
        state.reports.error = action.payload;
      })

      // Enrollments
      .addCase(fetchEnrollments.pending, (state) => {
        state.enrollments.loading = true;
        state.enrollments.error = null;
      })
      .addCase(fetchEnrollments.fulfilled, (state, action) => {
        state.enrollments.loading = false;
        if (!action.payload.cached) {
          state.enrollments.list = action.payload.data || action.payload;
          state.lastFetched.enrollments = Date.now();
        }
      })
      .addCase(fetchEnrollments.rejected, (state, action) => {
        state.enrollments.loading = false;
        state.enrollments.error = action.payload;
      })

      // Applications
      .addCase(fetchApplications.pending, (state) => {
        state.applications.loading = true;
        state.applications.error = null;
      })
      .addCase(fetchApplications.fulfilled, (state, action) => {
        state.applications.loading = false;
        if (!action.payload.cached) {
          state.applications.list = action.payload.data || action.payload;
          state.lastFetched.applications = Date.now();
        }
      })
      .addCase(fetchApplications.rejected, (state, action) => {
        state.applications.loading = false;
        state.applications.error = action.payload;
      })

      // Mentor
      .addCase(fetchMentor.pending, (state) => {
        state.mentor.loading = true;
        state.mentor.error = null;
      })
      .addCase(fetchMentor.fulfilled, (state, action) => {
        state.mentor.loading = false;
        state.mentor.data = action.payload;
        state.lastFetched.mentor = Date.now();
      })
      .addCase(fetchMentor.rejected, (state, action) => {
        state.mentor.loading = false;
        state.mentor.error = action.payload;
      })

      // Grievances
      .addCase(fetchGrievances.pending, (state) => {
        state.grievances.loading = true;
        state.grievances.error = null;
      })
      .addCase(fetchGrievances.fulfilled, (state, action) => {
        state.grievances.loading = false;
        state.grievances.list = action.payload.data || action.payload;
        state.lastFetched.grievances = Date.now();
      })
      .addCase(fetchGrievances.rejected, (state, action) => {
        state.grievances.loading = false;
        state.grievances.error = action.payload;
      })
      .addCase(createGrievance.pending, (state) => {
        state.grievances.loading = true;
      })
      .addCase(createGrievance.fulfilled, (state, action) => {
        state.grievances.loading = false;
        state.grievances.list = [action.payload, ...state.grievances.list];
      })
      .addCase(createGrievance.rejected, (state, action) => {
        state.grievances.loading = false;
        state.grievances.error = action.payload;
      })

      // Application actions
      .addCase(withdrawApplication.pending, (state) => {
        state.applications.loading = true;
      })
      .addCase(withdrawApplication.fulfilled, (state, action) => {
        state.applications.loading = false;
        state.applications.list = state.applications.list.filter(
          app => app.id !== action.payload.id
        );
      })
      .addCase(withdrawApplication.rejected, (state, action) => {
        state.applications.loading = false;
        state.applications.error = action.payload;
      })
      .addCase(updateApplication.pending, (state) => {
        state.applications.loading = true;
      })
      .addCase(updateApplication.fulfilled, (state, action) => {
        state.applications.loading = false;
        const index = state.applications.list.findIndex(app => app.id === action.payload.id);
        if (index !== -1) {
          state.applications.list[index] = action.payload;
        }
      })
      .addCase(updateApplication.rejected, (state, action) => {
        state.applications.loading = false;
        state.applications.error = action.payload;
      })

      // Monthly report submission
      .addCase(submitMonthlyReport.pending, (state) => {
        state.reports.loading = true;
      })
      .addCase(submitMonthlyReport.fulfilled, (state, action) => {
        state.reports.loading = false;
        const index = state.reports.list.findIndex(r => r.id === action.payload.id);
        if (index !== -1) {
          state.reports.list[index] = action.payload;
        }
      })
      .addCase(submitMonthlyReport.rejected, (state, action) => {
        state.reports.loading = false;
        state.reports.error = action.payload;
      })

      // Upload report file
      .addCase(uploadReportFile.pending, (state) => {
        state.reports.loading = true;
        state.reports.error = null;
      })
      .addCase(uploadReportFile.fulfilled, (state) => {
        state.reports.loading = false;
      })
      .addCase(uploadReportFile.rejected, (state, action) => {
        state.reports.loading = false;
        state.reports.error = action.payload;
      });
  },
});

export default studentSlice.reducer;
