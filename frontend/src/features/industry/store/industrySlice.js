import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import industryService from '../../../services/industry.service';
import { CACHE_DURATIONS, isCacheValid } from '../../../utils/cacheConfig';

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
    postingsKey: null,
    applications: null,
    applicationsKey: null,
    profile: null,
  },
};

export const fetchIndustryDashboard = createAsyncThunk(
  'industry/fetchDashboard',
  async (params, { getState, rejectWithValue }) => {
    try {
      const state = getState();
      const lastFetched = state.industry.lastFetched.dashboard;

      if (!params?.forceRefresh && isCacheValid(lastFetched, CACHE_DURATIONS.DASHBOARD)) {
        return { cached: true };
      }

      const response = await industryService.getDashboard();
      return response;
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

      // Cache must be param-aware; otherwise pagination/search may show stale data.
      const normalizedParams = {
        page: params?.page ?? 1,
        limit: params?.limit ?? 10,
        search: params?.search ?? '',
        status: params?.status ?? '',
      };
      const requestKey = JSON.stringify(normalizedParams);
      const lastKey = state.industry.lastFetched.postingsKey;

      if (
        !params?.forceRefresh &&
        lastKey === requestKey &&
        isCacheValid(lastFetched, CACHE_DURATIONS.LISTS)
      ) {
        return { cached: true };
      }

      const response = await industryService.getMyPostings(params);
      return { ...response, _cacheKey: requestKey };
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

      // Cache must be param-aware; otherwise pagination/search may show stale data.
      const normalizedParams = {
        page: params?.page ?? 1,
        limit: params?.limit ?? 10,
        search: params?.search ?? '',
        status: params?.status ?? '',
        postingId: params?.postingId ?? '',
      };
      const requestKey = JSON.stringify(normalizedParams);
      const lastKey = state.industry.lastFetched.applicationsKey;

      if (
        !params?.forceRefresh &&
        lastKey === requestKey &&
        isCacheValid(lastFetched, CACHE_DURATIONS.LISTS)
      ) {
        return { cached: true };
      }

      const response = await industryService.getMyApplications(params);
      return { ...response, _cacheKey: requestKey };
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

      if (!params?.forceRefresh && isCacheValid(lastFetched, CACHE_DURATIONS.PROFILE)) {
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
  reducers: {
    // Optimistic update reducers for applications
    optimisticallyUpdateApplicationStatus: (state, action) => {
      const { id, status } = action.payload;
      const index = state.applications.list.findIndex(a => a.id === id);
      if (index !== -1) {
        state.applications.list[index] = {
          ...state.applications.list[index],
          status,
          _isOptimistic: true,
        };
      }
    },
    rollbackApplicationOperation: (state, action) => {
      if (action.payload?.list) {
        state.applications.list = action.payload.list;
      }
    },
    // Optimistic update reducers for posting status
    optimisticallyTogglePostingStatus: (state, action) => {
      const { id, isActive } = action.payload;
      const index = state.postings.list.findIndex(p => p.id === id);
      if (index !== -1) {
        state.postings.list[index] = {
          ...state.postings.list[index],
          isActive,
          _isOptimistic: true,
        };
      }
    },
    rollbackPostingStatus: (state, action) => {
      if (action.payload?.list) {
        state.postings.list = action.payload.list;
      }
    },
    clearIndustryError: (state) => {
      state.profile.error = null;
      state.dashboard.error = null;
      state.postings.error = null;
      state.applications.error = null;
    },
    setIndustryProfile: (state, action) => {
      state.profile.data = action.payload;
    },
  },
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
          state.lastFetched.postingsKey = action.payload._cacheKey ?? null;
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
        state.lastFetched.postings = null; // Invalidate cache after mutation
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
        state.lastFetched.postings = null; // Invalidate cache after mutation
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
        state.lastFetched.postings = null; // Invalidate cache after mutation
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
          state.postings.list[index] = {
            ...state.postings.list[index],
            isActive: action.payload.isActive,
            _isOptimistic: false
          };
        }
        state.lastFetched.postings = null; // Invalidate cache after mutation
        state.lastFetched.postingsKey = null;
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
          state.lastFetched.applicationsKey = action.payload._cacheKey ?? null;
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
        state.lastFetched.applications = null; // Invalidate cache after mutation
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
        state.lastFetched.applications = null; // Invalidate cache after mutation
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
        state.lastFetched.applications = null; // Invalidate cache after mutation
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
        state.lastFetched.applications = null; // Invalidate cache after mutation
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

export const {
  optimisticallyUpdateApplicationStatus,
  rollbackApplicationOperation,
  optimisticallyTogglePostingStatus,
  rollbackPostingStatus,
  clearIndustryError,
  setIndustryProfile,
} = industrySlice.actions;

// Selectors
export const selectIndustry = (state) => state.industry;
export const selectIndustryProfile = (state) => state.industry.profile.data;
export const selectIndustryLoading = (state) => state.industry.profile.loading;
export const selectIndustryError = (state) => state.industry.profile.error;

export default industrySlice.reducer;
