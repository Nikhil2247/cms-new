import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { apiClient } from '../../../services/api';
import { API_ENDPOINTS } from '../../../utils/constants';
import industryService from '../../../services/industry.service';

const initialState = {
  dashboard: {
    stats: null,
    loading: false,
    error: null,
  },
  postings: {
    list: [],
    selected: null,
    loading: false,
    error: null,
  },
  applications: {
    list: [],
    loading: false,
    error: null,
  },
  internships: {
    list: [],
    selected: null,
    loading: false,
    error: null,
  },
  profile: {
    data: null,
    loading: false,
    error: null,
  },
  lastFetched: {
    dashboard: null,
    postings: null,
    applications: null,
    profile: null,
  },
};

// Cache duration constant
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

export const fetchIndustryDashboard = createAsyncThunk(
  'industry/fetchDashboard',
  async (params, { getState, rejectWithValue }) => {
    try {
      const state = getState();
      const lastFetched = state.industry.lastFetched.dashboard;

      if (lastFetched && !params?.forceRefresh && (Date.now() - lastFetched) < CACHE_DURATION) {
        return { cached: true };
      }

      const response = await apiClient.get(API_ENDPOINTS.INDUSTRY_DASHBOARD);
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch dashboard');
    }
  }
);

export const fetchMyPostings = createAsyncThunk(
  'industry/fetchMyPostings',
  async (params = {}, { getState, rejectWithValue }) => {
    try {
      const state = getState();
      const lastFetched = state.industry.lastFetched.postings;

      if (lastFetched && !params?.forceRefresh && (Date.now() - lastFetched) < CACHE_DURATION) {
        return { cached: true };
      }

      const response = await industryService.getMyPostings(params);
      return response;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch postings');
    }
  }
);

export const fetchMyApplications = createAsyncThunk(
  'industry/fetchMyApplications',
  async (params = {}, { getState, rejectWithValue }) => {
    try {
      const state = getState();
      const lastFetched = state.industry.lastFetched.applications;

      if (lastFetched && !params?.forceRefresh && (Date.now() - lastFetched) < CACHE_DURATION) {
        return { cached: true };
      }

      const response = await industryService.getMyApplications(params);
      return response;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch applications');
    }
  }
);

// Posting CRUD
export const createPosting = createAsyncThunk(
  'industry/createPosting',
  async (postingData, { rejectWithValue }) => {
    try {
      const response = await industryService.createPosting(postingData);
      return response;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to create posting');
    }
  }
);

export const updatePosting = createAsyncThunk(
  'industry/updatePosting',
  async ({ id, data }, { rejectWithValue }) => {
    try {
      const response = await industryService.updatePosting(id, data);
      return response;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to update posting');
    }
  }
);

export const deletePosting = createAsyncThunk(
  'industry/deletePosting',
  async (id, { rejectWithValue }) => {
    try {
      const response = await industryService.deletePosting(id);
      return { id, ...response };
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to delete posting');
    }
  }
);

export const togglePostingStatus = createAsyncThunk(
  'industry/togglePostingStatus',
  async ({ id, isActive }, { rejectWithValue }) => {
    try {
      const response = await industryService.togglePostingStatus(id, isActive);
      return { id, isActive, ...response };
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to toggle posting status');
    }
  }
);

// Application management
export const updateApplicationStatus = createAsyncThunk(
  'industry/updateApplicationStatus',
  async ({ id, status, rejectionReason }, { rejectWithValue }) => {
    try {
      const response = await industryService.updateApplicationStatus(id, status, rejectionReason);
      return response;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to update application status');
    }
  }
);

export const shortlistApplication = createAsyncThunk(
  'industry/shortlistApplication',
  async (id, { rejectWithValue }) => {
    try {
      const response = await industryService.shortlistApplication(id);
      return response;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to shortlist application');
    }
  }
);

export const selectApplication = createAsyncThunk(
  'industry/selectApplication',
  async ({ id, joiningDate }, { rejectWithValue }) => {
    try {
      const response = await industryService.selectApplication(id, joiningDate);
      return response;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to select application');
    }
  }
);

export const rejectApplication = createAsyncThunk(
  'industry/rejectApplication',
  async ({ id, reason }, { rejectWithValue }) => {
    try {
      const response = await industryService.rejectApplication(id, reason);
      return response;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to reject application');
    }
  }
);

// Profile
export const fetchProfile = createAsyncThunk(
  'industry/fetchProfile',
  async (params, { getState, rejectWithValue }) => {
    try {
      const state = getState();
      const lastFetched = state.industry.lastFetched.profile;

      if (lastFetched && !params?.forceRefresh && (Date.now() - lastFetched) < CACHE_DURATION) {
        return { cached: true };
      }

      const response = await industryService.getProfile();
      return response;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch profile');
    }
  }
);

export const updateProfile = createAsyncThunk(
  'industry/updateProfile',
  async (profileData, { rejectWithValue }) => {
    try {
      const response = await industryService.updateProfile(profileData);
      return response;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to update profile');
    }
  }
);

const industrySlice = createSlice({
  name: 'industry',
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      // Dashboard
      .addCase(fetchIndustryDashboard.pending, (state) => {
        state.dashboard.loading = true;
        state.dashboard.error = null;
      })
      .addCase(fetchIndustryDashboard.fulfilled, (state, action) => {
        state.dashboard.loading = false;
        if (!action.payload.cached) {
          state.dashboard.stats = action.payload;
          state.lastFetched.dashboard = Date.now();
        }
      })
      .addCase(fetchIndustryDashboard.rejected, (state, action) => {
        state.dashboard.loading = false;
        state.dashboard.error = action.payload;
      })

      // Postings
      .addCase(fetchMyPostings.pending, (state) => {
        state.postings.loading = true;
        state.postings.error = null;
      })
      .addCase(fetchMyPostings.fulfilled, (state, action) => {
        state.postings.loading = false;
        if (!action.payload.cached) {
          state.postings.list = action.payload.data || action.payload;
          state.lastFetched.postings = Date.now();
        }
      })
      .addCase(fetchMyPostings.rejected, (state, action) => {
        state.postings.loading = false;
        state.postings.error = action.payload;
      })
      .addCase(createPosting.pending, (state) => {
        state.postings.loading = true;
        state.postings.error = null;
      })
      .addCase(createPosting.fulfilled, (state, action) => {
        state.postings.loading = false;
        state.postings.list = [action.payload, ...state.postings.list];
        state.lastFetched.postings = Date.now();
      })
      .addCase(createPosting.rejected, (state, action) => {
        state.postings.loading = false;
        state.postings.error = action.payload;
      })
      .addCase(updatePosting.pending, (state) => {
        state.postings.loading = true;
        state.postings.error = null;
      })
      .addCase(updatePosting.fulfilled, (state, action) => {
        state.postings.loading = false;
        const index = state.postings.list.findIndex(p => p.id === action.payload.id);
        if (index !== -1) {
          state.postings.list[index] = action.payload;
        }
        state.lastFetched.postings = Date.now();
      })
      .addCase(updatePosting.rejected, (state, action) => {
        state.postings.loading = false;
        state.postings.error = action.payload;
      })
      .addCase(deletePosting.pending, (state) => {
        state.postings.loading = true;
        state.postings.error = null;
      })
      .addCase(deletePosting.fulfilled, (state, action) => {
        state.postings.loading = false;
        state.postings.list = state.postings.list.filter(p => p.id !== action.payload.id);
        state.lastFetched.postings = Date.now();
      })
      .addCase(deletePosting.rejected, (state, action) => {
        state.postings.loading = false;
        state.postings.error = action.payload;
      })
      .addCase(togglePostingStatus.pending, (state) => {
        state.postings.loading = true;
        state.postings.error = null;
      })
      .addCase(togglePostingStatus.fulfilled, (state, action) => {
        state.postings.loading = false;
        const index = state.postings.list.findIndex(p => p.id === action.payload.id);
        if (index !== -1) {
          state.postings.list[index] = { ...state.postings.list[index], isActive: action.payload.isActive };
        }
      })
      .addCase(togglePostingStatus.rejected, (state, action) => {
        state.postings.loading = false;
        state.postings.error = action.payload;
      })

      // Applications
      .addCase(fetchMyApplications.pending, (state) => {
        state.applications.loading = true;
        state.applications.error = null;
      })
      .addCase(fetchMyApplications.fulfilled, (state, action) => {
        state.applications.loading = false;
        if (!action.payload.cached) {
          state.applications.list = action.payload.data || action.payload;
          state.lastFetched.applications = Date.now();
        }
      })
      .addCase(fetchMyApplications.rejected, (state, action) => {
        state.applications.loading = false;
        state.applications.error = action.payload;
      })
      .addCase(updateApplicationStatus.pending, (state) => {
        state.applications.loading = true;
        state.applications.error = null;
      })
      .addCase(updateApplicationStatus.fulfilled, (state, action) => {
        state.applications.loading = false;
        const index = state.applications.list.findIndex(a => a.id === action.payload.id);
        if (index !== -1) {
          state.applications.list[index] = action.payload;
        }
      })
      .addCase(updateApplicationStatus.rejected, (state, action) => {
        state.applications.loading = false;
        state.applications.error = action.payload;
      })
      .addCase(shortlistApplication.pending, (state) => {
        state.applications.loading = true;
        state.applications.error = null;
      })
      .addCase(shortlistApplication.fulfilled, (state, action) => {
        state.applications.loading = false;
        const index = state.applications.list.findIndex(a => a.id === action.payload.id);
        if (index !== -1) {
          state.applications.list[index] = action.payload;
        }
      })
      .addCase(shortlistApplication.rejected, (state, action) => {
        state.applications.loading = false;
        state.applications.error = action.payload;
      })
      .addCase(selectApplication.pending, (state) => {
        state.applications.loading = true;
        state.applications.error = null;
      })
      .addCase(selectApplication.fulfilled, (state, action) => {
        state.applications.loading = false;
        const index = state.applications.list.findIndex(a => a.id === action.payload.id);
        if (index !== -1) {
          state.applications.list[index] = action.payload;
        }
      })
      .addCase(selectApplication.rejected, (state, action) => {
        state.applications.loading = false;
        state.applications.error = action.payload;
      })
      .addCase(rejectApplication.pending, (state) => {
        state.applications.loading = true;
        state.applications.error = null;
      })
      .addCase(rejectApplication.fulfilled, (state, action) => {
        state.applications.loading = false;
        const index = state.applications.list.findIndex(a => a.id === action.payload.id);
        if (index !== -1) {
          state.applications.list[index] = action.payload;
        }
      })
      .addCase(rejectApplication.rejected, (state, action) => {
        state.applications.loading = false;
        state.applications.error = action.payload;
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
      });
  },
});

export default industrySlice.reducer;
